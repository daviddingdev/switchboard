# Architecture

## Overview

Orchestrator manages Claude Code worker sessions
across projects via a **Web UI** on `localhost:3000`
backed by a **Flask API** on port 5001,
which manages workers via **tmux**.

Optional integrations (Telegram bot, hooks) live
in `contrib/`.

```
┌──────────┐
│  Web UI  │  :3000
└────┬─────┘
     │ HTTP
┌────┴──────┐
│ Flask API │  :5001
│ server.py │
└────┬──────┘
     │ subprocess
┌────┴──────┐
│   tmux    │  socket: orchestrator
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
tmux -L orchestrator kill-session -t orchestrator
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

**Send** accepts `{text, raw}`.
`raw: true` for special keys (Escape, Enter, C-c).
`raw: false` for text (auto-appends Enter).

**Output** default 50 lines. Captures 5x, filters
blanks, returns last N non-empty lines.

### Proposals

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/proposals` | List all |
| POST | `/proposals` | Create |
| PATCH | `/proposals/<id>` | Update status |
| DELETE | `/proposals/<id>` | Delete |

Proposals stored as JSON in `state/proposals/`.
Workers submit via curl to POST endpoint.

### Files & Git

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/projects` | List discovered projects |
| GET | `/home` | File tree (all projects) |
| GET | `/file?path=` | File content |
| GET | `/diff?project=&path=` | Git diff |
| GET | `/activity` | Changes + proposals |

**`/projects`** returns project list with name +
directory. Used by Telegram bot for spawn picker.

**`/home`** auto-discovers projects by scanning `~`
for directories with `CLAUDE.md` files (max depth 3).
Returns tree with git status per file (M/U/A/D).

**`/activity`** aggregates: pending proposals,
uncommitted changes, unpushed commits across
all projects. Polled every 3s by web UI.

### Push Workflow

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/doc-context` | Context for doc updates |
| POST | `/update-docs` | Run claude -p on docs |
| POST | `/push` | Commit docs + git push |
| POST | `/commit` | Stage all + commit |

Flow: load context → update CHANGELOG/TODO
via `claude -p` → commit doc changes → push.

### Workers & Context

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/workers/usage` | Token counts, context % |

**Usage** parses Claude session JSONL files.
Context % = (input + cache_read) / 200k.

### System

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/metrics` | GPU, CPU, memory, disk |

---

## tmux Manager

`api/tmux_manager.py` — all tmux operations.

Socket: `-L orchestrator` (named, not path-based).
Session: `orchestrator`.

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

React + Vite. Dev server on :3000,
proxies `/api` to :5001.

### Layout

**Desktop** (>=768px): 3-panel with draggable dividers

```
┌─────────────────────────────────┐
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
│  Active Section │
│  (full width)   │
│                 │
├─────────────────┤
│ Workers│Files│Activity│Monitor │
└─────────────────┘
```

### Tab System

Tab IDs: `file:<path>`, `diff:<project>:<path>`,
`terminal:<name>`, `monitor`.

Clicking a file opens a tab (desktop) or
full-screen overlay (mobile).

### Components

| Component | What it does |
|-----------|-------------|
| WorkerDashboard | Worker cards, spawn button, quick actions |
| FileTree | Project browser with git status badges |
| Activity | Proposals + changed files + unpushed commits |
| FilePreview | Syntax-highlighted file viewer |
| DiffPreview | Color-coded git diff viewer |
| TerminalView | Raw tmux output viewer (per worker) |
| Monitor | System metrics (GPU, CPU, memory) |
| TabBar | Tab switching + close buttons |
| SpawnDialog | Name + directory form for new workers |
| MobileNav | Bottom navigation bar |
| ErrorBoundary | Crash recovery with reload button |

### Polling

| What | Interval | Endpoint |
|------|----------|----------|
| Workers | 2s | `/processes` |
| Usage | 5s | `/workers/usage` |
| Activity | 3s | `/activity` |
| Files | 5s | `/home` |
| Metrics | 2s | `/metrics` |
| Terminal | 1s | `/processes/<name>/output` |

Each component manages its own `setInterval`.
No centralized state or WebSocket.

---

## State & Storage

```
state/
├── projects.yaml          # project registry
├── proposals/*.json       # pending/resolved proposals
└── usage-stats.json       # worker context stats

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

### Proposal Lifecycle

```
Worker submits POST /api/proposals
  → JSON file in state/proposals/
  → Web UI polls, shows in Activity
  → User approves/rejects via PATCH
  → Worker checks status
```

---

## Key Patterns

- **No WebSocket** — polling only, upgrade later
- **No auth on web** — localhost assumption
- **File-based state** — YAML/JSON, git-friendly
- **tmux named socket** — `-L orchestrator`
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
