# Architecture

## Overview

Switchboard runs on the machine where Claude Code
sessions live. It manages workers via **tmux** and
serves a **Web UI** accessible from any browser.

Optional integrations (Telegram bot, hooks) live
in `contrib/`.

```
Browser (any device)
     │
┌────┴─────┐
│  Web UI  │  :5001 (static files served by API)
└────┬─────┘
     │ WebSocket (persistent, server push)
     │ HTTP (one-off actions: spawn, kill, send)
┌────┴──────────────────────────────────────────┐
│ Flask-SocketIO  :5001 (threading async mode)  │
│                                               │
│  server.py ── core, auth, workers, proposals  │
│  idle_detector.py ── hooks + JSONL idle       │
│  system_monitor.py ── metrics + updates       │
│  project_sync.py ── files, git, projects      │
│  shared.py ── AppContext (shared state)       │
└────┬──────────────────────────────────────────┘
     │ subprocess
┌────┴──────┐
│   tmux    │  socket: switchboard
│  manager  │
└────┬──────┘
     │ windows
 ┌───┼───┐
 │   │   │
 w1  w2  w3 ...
```

## Startup / Shutdown

```bash
./start.sh    # API server (serves static frontend build)
./stop.sh     # kills API (leaves tmux alive)
```

start.sh sequence:
1. Launch API → `logs/api.log`, PID → `logs/api.pid`
2. Frontend served as static build from `web/dist/`
3. tmux session created lazily on first worker spawn

For development with auto-reload:
```bash
DEV=1 python3 api/server.py    # Flask auto-reload on Python changes
cd web && npm run dev           # Vite hot-reload on frontend changes
```

To fully kill tmux:
```bash
tmux -L switchboard kill-session -t switchboard
```

---

## API Endpoints

All routes prefixed with `/api`.

### Workers

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/processes` | List all workers |
| POST | `/processes` | Spawn worker |
| DELETE | `/processes/<name>` | Kill worker |
| POST | `/processes/<name>/send` | Send text/keys |
| GET | `/processes/<name>/output` | Terminal output |

**Spawn** auto-increments name on collision.
Returns `{name, directory, status, pid, log_file}`.

**Send** accepts `{text, raw}`. Used by worker card
actions (Remote, Compact, Interrupt) and CLI helper.
`raw: true` for special keys (Escape, Enter, C-c).
`raw: false` for text (auto-appends Enter).

**Output** default 100 lines. Captures 5x, filters
blanks, returns last N non-empty lines. Accepts `?lines=N`
query param (up to 1000).

### Hooks (Idle Detection)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/hooks/stop` | Claude finished generating (Stop hook) |
| POST | `/hooks/prompt` | User submitted a prompt (UserPromptSubmit hook) |

Both auth-exempt. Receive JSON with `session_id`, `cwd`,
`transcript_path`. Return 204.

### Auth

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/status` | Check if auth is enabled + logged in |
| POST | `/login` | Login with password |
| POST | `/logout` | Logout (clear session) |

Auth is optional. Enabled when `SWITCHBOARD_PASSWORD`
env var is set. Uses Flask session cookies. WebSocket
connections are authenticated on connect. A persistent
secret key is stored in `state/secret.key`.

### Proposals

Proposals are viewable and actionable in the web UI
(Activity panel). Workers submit via curl.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/proposals` | List all |
| POST | `/proposals` | Create |
| PATCH | `/proposals/<id>` | Update status |
| DELETE | `/proposals/<id>` | Delete |

Proposals stored as YAML in `state/proposals/`.
Workers submit via curl to POST endpoint.

### Files & Git

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/projects` | List discovered projects |
| GET | `/home` | File tree (all projects) |
| GET | `/file?path=` | File content |
| PUT | `/file` | Save file content |
| GET | `/diff?project=&path=` | Git diff |
| GET | `/activity` | Changes + unpushed commits |
| POST | `/push` | Push a project to remote |

**`/projects`** returns project list with name +
directory.

**`/home`** auto-discovers projects by scanning the
project root (parent of Switchboard install) for
directories with `CLAUDE.md` files (max depth 3).
Returns tree with git status per file (M/U/A/D).

**`PUT /file`** saves file content (last-write-wins).
Path validated against project root directory.

**`/activity`** aggregates: uncommitted changes
and unpushed commits (with file lists per commit)
across all projects.
Pushed via WebSocket every 5s.

### Worker Logs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/logs/<name>` | List rotated log files for a worker |
| GET | `/logs/<name>/<filename>` | Read a specific log file (tail N lines) |

Log files are ANSI-stripped and cleaned (cursor movement
converted to spaces, duplicate lines removed, blank lines
collapsed).

### Workers & Context

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/workers/usage` | Token counts, context % |

**Usage** parses Claude session JSONL files.
Context % = (input + cache_read) / 200k.

### System

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/metrics` | System metrics (see Monitor) |
| GET | `/models` | Available Claude models |
| GET | `/system/updates` | Available system updates |
| POST | `/system/update` | Trigger system updates |

**`/metrics`** returns:
- `gpu` — configurable via `monitor.gpu` in config.yaml
  (null if disabled, auto-detects NVIDIA by default).
  Includes `power_w` (watts) from nvidia-smi.
- `services` — dict of monitored processes, configurable
  via `monitor.services` (default: Ollama)
- `thermal` — `{cpu_temp, nvme_temp}` from psutil sensors
  (null values when sensors unavailable)
- `smart` — NVMe SMART health via smartctl (null when
  not configured or smartctl fails). Cached 5 min.
  Fields: `health`, `pct_used`, `available_spare`, `power_hours`
- `cpu`, `memory`, `disk`, `network`, `system` — always
  present, cross-platform via psutil

---

## WebSocket Events

Flask-SocketIO with `threading` async mode
(no monkey-patching — safe with subprocess calls).

### Server → Client (push)

| Event | Interval | Data |
|-------|----------|------|
| `workers:update` | 2s | Worker list (only on change) |
| `usage:update` | 5s | Worker usage stats (only on change) |
| `activity:update` | 5s | Git changes + unpushed commits (only on change) |
| `metrics:update` | 2s | System metrics (only on change) |
| `worker:output` | 500ms | Terminal output (targeted via rooms) |
| `worker:idle` | — | Fired when a worker becomes idle (waiting for input) |
| `files:update` | 5s | File tree (only on change) |

All server-push events use hash-based change
detection — only emit when data actually changes.

### Client → Server

| Event | Data | Purpose |
|-------|------|---------|
| `terminal:subscribe` | `{name}` | Start streaming worker output |
| `terminal:unsubscribe` | `{name}` | Stop streaming worker output |

### Background Threads

6 background threads started on API boot:
1. `_bg_workers_monitor` (server.py) — polls tmux, pushes worker list (2s)
2. `_bg_usage_monitor` (server.py) — polls session files, pushes usage (5s)
3. `_bg_activity_monitor` (server.py) — polls git status + file tree, pushes activity (5s)
4. `bg_metrics_monitor` (system_monitor.py) — reads system metrics, pushes (2s)
5. `_bg_terminal_monitor` (server.py) — captures terminal output for subscribed workers (500ms)
6. `bg_idle_monitor` (idle_detector.py) — detects idle workers via prompt detection (5s)

### Idle Detection

Two-layer system: **HTTP hooks** (primary, instant) and
**JSONL polling** (fallback, 5s).

**Primary — HTTP hooks:**
Claude Code fires HTTP hooks on state transitions. Switchboard
registers two hooks in `~/.claude/settings.json`:

- `Stop` → `POST /api/hooks/stop` — Claude finished generating.
  Reads the session transcript JSONL to check the last assistant
  entry: text-only content = idle, tool_use content = still working.
- `UserPromptSubmit` → `POST /api/hooks/prompt` — User submitted
  a prompt. Marks worker as active immediately.

Hooks fire on state change with ~1-2s delay (Claude Code
executes HTTP hooks synchronously before showing the prompt).
The Switchboard handler itself is instant (no file I/O) — the
latency is entirely Claude's hook execution overhead.
Both endpoints are auth-exempt (local hooks don't need password).
Non-2xx responses are non-blocking, so hooks silently fail if
Switchboard is down.

**Fallback — JSONL polling:**
`_bg_idle_monitor` runs every 5s for workers without recent hook
events (>30s since last hook). For each worker:

1. Skip if hook fired within 30s (hook state is authoritative)
2. Check session file mtime — modified within 10s = active
3. Parse last ~8KB of JSONL, skip progress entries, check last
   assistant message: text-only = idle, tool_use = active

**Setup:** Run `scripts/setup-hooks.sh` to configure hooks.

Detection triggers `worker:idle` socket event on transition,
which drives browser notifications and visual indicators (status
dot, tab badge, page title count).

---

## Module Structure

`server.py` is the entry point. Shared state lives in an `AppContext`
object (`shared.py`) passed to each module via `init(ctx)`. Modules
expose Flask Blueprints for their routes.

| Module | Owns | Blueprint routes |
|--------|------|-----------------|
| `shared.py` | `AppContext`, `data_hash()` | — |
| `idle_detector.py` | Hook endpoints, JSONL parsing, idle monitor | `/api/hooks/*` |
| `system_monitor.py` | Metrics, GPU/thermal/SMART, updates, `PlatformClient` | `/api/metrics`, `/api/system/*` |
| `project_sync.py` | Projects, files, git, session helpers | `/api/projects`, `/api/home`, `/api/file`, `/api/diff`, `/api/push` |
| `server.py` | App, auth, workers, proposals, activity, usage, websockets | everything else |

No circular imports. Dependency graph:
```
shared.py       <-- no api/ imports
idle_detector   --> shared, tmux_manager, flask
system_monitor  --> shared, flask, psutil
project_sync    --> shared, flask, subprocess
server.py       --> shared, idle_detector, system_monitor, project_sync, tmux_manager
```

---

## tmux Manager

`api/tmux_manager.py` — all tmux operations.

Socket: `-L switchboard` (named, not path-based).
Session: `switchboard`.

### spawn_worker(name, directory, session_label)

Fast path (returns immediately):
1. Expand `~` in directory
2. Rotate existing log → `name-timestamp.log`
3. Create tmux window: `new-window -n {name} -c {dir}`
4. Set `history-limit 50000`
5. Pipe output → `logs/workers/{name}.log`
6. Send `unset CLAUDECODE && claude`
7. Return `{name, directory, status, pid, log_file}`

Background setup (via `setup_worker` in thread):
8. Wait for Claude prompt
9. Auto-confirm trust prompt if present
10. Send session label
11. Enable remote control (`/rc`)

### Other Functions

- `ensure_session()` — create session if missing
- `list_windows()` → `[{index, name, pid}]`
- `kill_worker(name)` → `kill-window`
- `send_keys(name, text, raw)` → stdin
- `capture_output(name, lines)` → terminal text
- `get_pane_pid(name)` → shell PID

---

## Web UI

React + Vite. Dev server on :3000 (proxies to :5001),
or served as static build from API on :5001.

### Layout

**Desktop** (>=768px): 3-panel with draggable dividers

```
┌─────────────────────────────────┐
│      ConnectionBanner           │
├─────────────────────────────────┤
│      WorkerDashboard            │
├─────────┬───────────┬───────────┤
│FileTree │ TabBar    │ Activity  │
│         │ + Preview │           │
│ 260px   │  flex     │  260px    │
└─────────┴───────────┴───────────┘
```

**Mobile** (<768px): single panel + bottom nav

```
┌─────────────────┐
│ConnectionBanner  │
├─────────────────┤
│  Active Section │
│  (full width)   │
│                 │
├─────────────────┤
│ Workers│Files│Activity│Monitor │
└─────────────────┘
```

### Tab System

Tab IDs: `file:<path>`, `diff:<project>:<path>`,
`terminal:<name>`, `log:<name>:<filename>`,
`monitor`, `usage`.

Clicking a file opens a tab (desktop) or
full-screen overlay (mobile).

**Drag reorder**: Tabs support native HTML5
drag-and-drop reordering. Dragged tab shows at
reduced opacity, drop target shows accent-colored
left border. State lives in App.jsx (`reorderTab`
splice callback), visual feedback in TabBar.

### Components

| Component | What it does |
|-----------|-------------|
| WorkerDashboard | Worker cards, spawn button, theme/notifs/logout toggles |
| FileTree | Project browser with git status badges |
| Activity | Changed files, expandable unpushed commits, proposals |
| FilePreview | Syntax-highlighted file viewer with inline editing |
| DiffPreview | Color-coded git diff viewer |
| TerminalView | Real-time terminal streaming via WebSocket, quick command buttons (y/n/1-3/Enter/Esc/Ctrl+C), text input, search, load more |
| LogViewer | Historical worker log viewer with text filter |
| LoginPage | Password login when auth is enabled |
| ConfirmDialog | Reusable confirmation modal (danger/normal) |
| Monitor | System metrics (GPU, CPU, memory, services, disk health, updates) |
| Usage | Usage analytics with time range selector, adaptive charts, CSV export |
| TabBar | Tab switching, close buttons, drag-and-drop reorder |
| SpawnDialog | Name + directory + model form for new workers |
| MobileNav | Bottom navigation bar |
| ErrorBoundary | Crash recovery with reload button |
| ConnectionBanner | WebSocket connection status indicator |
| Toast | Toast notification system (success/error/info) |
| ShortcutsHelp | Keyboard shortcuts overlay |

### Data Flow

**WebSocket** (real-time push from server):
- Workers, usage, activity, metrics — server pushes on change
- Terminal output — server pushes for subscribed workers

**REST** (one-off actions + initial data):
- Spawn, kill, send — POST/DELETE via REST
- Initial data fetch on mount — GET via REST
- File content, diffs — GET via REST
- System updates — polling (adaptive interval)

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | Open spawn dialog |
| `m` | Open monitor tab |
| `u` | Open usage tab |
| `Esc` | Close dialog/tab |
| `?` | Toggle shortcuts help |

### Theme

Dark/light theme via CSS variables on `:root`.
Toggle persisted to `localStorage`. Available on both
desktop and mobile (in WorkerDashboard header).

Terminal view uses dedicated `--terminal-bg` and
`--terminal-text` CSS variables for theme-aware colors.

---

## State & Storage

```
state/
├── proposals/*.yaml       # proposals
├── workers.json           # persisted worker metadata (models, spawn times)
├── secret.key             # auth secret key (auto-generated, gitignored)
└── usage-archive.json     # persistent daily usage data

logs/
├── api.log, api.pid       # API server
└── workers/*.log          # terminal output per worker (rotated on spawn)
```

### Project Discovery

No manual registration needed.
`discover_projects()` scans the project root directory
(parent of Switchboard install) for directories
containing `CLAUDE.md` (max depth 3).

`/api/home` also shows root-level `.md` files from
the project root.

### Proposal Lifecycle

```
Worker submits POST /api/proposals
  → YAML file in state/proposals/
  → Approve/reject via web UI or PATCH API
  → Worker checks status
```

---

## Key Patterns

- **WebSocket + REST hybrid** — WebSocket for live data push,
  REST for actions and initial data
- **Hash-based deduplication** — server only pushes when data changes
- **threading async mode** — no monkey-patching, subprocess-safe
- **Optional auth** — single-password via `SWITCHBOARD_PASSWORD` env var
- **File-based state** — YAML/JSON, git-friendly
- **tmux named socket** — `-L switchboard`
- **Lazy session creation** — tmux session created
  on first worker spawn, not at startup
- **Async spawn** — window creation returns immediately,
  setup (trust, label, RC) runs in background thread
- **CLAUDECODE env stripping** — prevents nested
  session detection errors in spawned workers
- **Log rotation** — old log renamed on spawn,
  fresh log for current session
- **Auto-trust** — spawn detects trust prompt
  and auto-confirms
- **Error boundary** — React crash recovery with
  reload button, prevents white screen
- **Toast notifications** — visual feedback for all actions
- **Skeleton loading** — pulse animation placeholders before data loads
- **Connection banner** — auto-show/hide on disconnect/reconnect
- **Stable event cleanup** — socket.off() uses handler refs
  to avoid removing other components' listeners
- **Ref-based shortcuts** — useKeyboardShortcuts uses ref
  to avoid re-registering keydown listener on every render
- **CSS-based toast positioning** — media query for mobile
  centering instead of static JS check
- **Config-driven monitor** — GPU command, services list,
  SMART device, and updates all configurable. Cards
  auto-hide when hardware isn't present or accessible
  (no GPU = no GPU card, no smartctl = no Disk Health card)
- **Rooms-based terminal** — Socket.IO rooms for targeted
  terminal output (only to subscribed clients)
- **Incremental JSONL parsing** — cached file offsets to
  avoid re-reading entire session files
- **Client-aware monitors** — background threads pause
  when no WebSocket clients connected
- **Per-worker session tracking** — spawn-time snapshot +
  label-based fallback for correct context mapping
- **Project discovery cache** — 30s TTL to avoid
  repeated filesystem scans
- **Worker state persistence** — models and spawn times
  saved to `state/workers.json`, survive API restarts
- **Browser notifications** — `useNotifications` hook with
  explicit permission request via UI button
- **Log cleaning** — ANSI cursor-forward converted to
  spaces, duplicate lines removed, blank lines collapsed
