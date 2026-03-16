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
┌────┴──────────┐
│ Flask-SocketIO │  :5001 (threading async mode)
│   server.py    │  runs on the Claude Code machine
└────┬───────────┘
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
./start.sh    # API + web dev server
./stop.sh     # kills API + web (leaves tmux alive)
```

start.sh sequence:
1. Launch API → `logs/api.log`, PID → `logs/api.pid`
2. Launch web → `logs/web.log`, PID → `logs/web.pid`
3. tmux session created lazily on first worker spawn

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
actions (Remote, Compact, Reset) and CLI helper.
`raw: true` for special keys (Escape, Enter, C-c).
`raw: false` for text (auto-appends Enter).

**Output** default 50 lines. Captures 5x, filters
blanks, returns last N non-empty lines.

### Proposals

Proposals are an optional API/CLI feature. No web UI exists for proposals.

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
| GET | `/diff?project=&path=` | Git diff |
| GET | `/activity` | Changes + unpushed commits |

**`/projects`** returns project list with name +
directory.

**`/home`** auto-discovers projects by scanning `~`
for directories with `CLAUDE.md` files (max depth 3).
Returns tree with git status per file (M/U/A/D).

**`/activity`** aggregates: uncommitted changes
and unpushed commits across all projects.
Pushed via WebSocket every 5s.

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
  (null if disabled, auto-detects NVIDIA by default)
- `services` — dict of monitored processes, configurable
  via `monitor.services` (default: Ollama)
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
| `files:update` | 5s | File tree (only on change) |

All server-push events use hash-based change
detection — only emit when data actually changes.

### Client → Server

| Event | Data | Purpose |
|-------|------|---------|
| `terminal:subscribe` | `{name}` | Start streaming worker output |
| `terminal:unsubscribe` | `{name}` | Stop streaming worker output |

### Background Threads

5 background threads started on API boot:
1. `_bg_workers_monitor` — polls tmux, pushes worker list
2. `_bg_usage_monitor` — polls session files, pushes usage
3. `_bg_activity_monitor` — polls git status, pushes activity
4. `_bg_metrics_monitor` — reads system metrics, pushes
5. `_bg_terminal_monitor` — captures terminal output for subscribed workers

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
`terminal:<name>`, `monitor`, `usage`.

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
| WorkerDashboard | Worker cards, spawn button, theme toggle |
| FileTree | Project browser with git status badges |
| Activity | Changed files + unpushed commits |
| FilePreview | Syntax-highlighted file viewer |
| DiffPreview | Color-coded git diff viewer |
| TerminalView | Real-time terminal streaming via WebSocket, quick command buttons (y/n/1-3/Enter/Esc/Ctrl+C), text input |
| Monitor | System metrics (GPU, CPU, memory, services, updates) |
| Usage | Usage analytics with time range selector, adaptive charts |
| TabBar | Tab switching, close buttons, drag-and-drop reorder |
| SpawnDialog | Name + directory form for new workers |
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
├── proposals/*.yaml       # proposals (API/CLI only)
└── usage-archive.json     # persistent daily usage data

logs/
├── api.log, api.pid       # API server
├── web.log, web.pid       # dev server
└── workers/*.log          # terminal output per worker
```

### Project Discovery

No manual registration needed.
`discover_projects()` scans `~` for directories
containing `CLAUDE.md` (max depth 3).

`/api/home` also shows root-level `~/*.md` files.

### Proposal Lifecycle (API/CLI only)

```
Worker submits POST /api/proposals
  → YAML file in state/proposals/
  → Approve/reject via PATCH (CLI or API)
  → Worker checks status
```

---

## Key Patterns

- **WebSocket + REST hybrid** — WebSocket for live data push,
  REST for actions and initial data
- **Hash-based deduplication** — server only pushes when data changes
- **threading async mode** — no monkey-patching, subprocess-safe
- **No auth on web** — localhost assumption
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
  and updates all configurable. Cards auto-hide when
  hardware isn't present (no GPU = no GPU card)
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
