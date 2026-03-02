# Architecture

## Overview

Orchestrator manages Claude Code worker sessions
across projects. Three interfaces:

- **Web UI** — `localhost:3000` (desktop + mobile)
- **Telegram bot** — remote control from phone
- **CLI** — `scripts/orch` for shell access

All talk to the **Flask API** on port 5001,
which manages workers via **tmux**.

```
┌──────────┐  ┌──────────┐  ┌──────┐
│  Web UI  │  │ Telegram │  │ CLI  │
└────┬─────┘  └────┬─────┘  └──┬───┘
     │             │            │
     └──────┬──────┴────────────┘
            │ HTTP
     ┌──────┴──────┐
     │  Flask API  │  :5001
     │  server.py  │
     └──────┬──────┘
            │ subprocess
     ┌──────┴──────┐
     │    tmux     │  socket: orchestrator
     │  manager    │
     └──────┬──────┘
            │ windows
    ┌───────┼───────┐
    │       │       │
  partner worker1 worker2 ...
  (claude) (claude) (claude)
```

## Startup / Shutdown

```bash
./start.sh    # tmux session + API + web dev server
./stop.sh     # kills API + web (leaves tmux alive)
```

start.sh sequence:
1. Create tmux session `orchestrator` (if missing)
2. Start partner window running `claude`
3. Launch API → `logs/api.log`, PID → `logs/api.pid`
4. Launch web → `logs/web.log`, PID → `logs/web.pid`

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

### Partner & Context

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/workers/usage` | Token counts, context % |
| GET | `/partner/history` | Conversation messages |
| POST | `/partner/reset` | Soft reset (Ctrl-C + restart) |
| POST | `/partner/hard-reset` | Kill window + recreate |

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

1. Expand `~` in directory
2. Rotate existing log → `name-timestamp.log`
3. Create tmux window: `new-window -n {name} -c {dir}`
4. Set `history-limit 50000`
5. Pipe output → `logs/workers/{name}.log`
6. Send `unset CLAUDECODE && claude`
7. Wait 2s for Claude to start
8. Auto-confirm trust prompt if present
9. Send session label
10. Return `{name, directory, status, pid, log_file}`

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
`monitor`, `push`, `commit`, `history`.

Clicking a file opens a tab (desktop) or
full-screen overlay (mobile).

### Components

| Component | What it does |
|-----------|-------------|
| WorkerDashboard | Worker cards, spawn button, quick actions |
| WorkerList | Individual worker detail + kill/send |
| FileTree | Project browser with git status badges |
| Activity | Proposals + changed files + unpushed commits |
| FilePreview | Syntax-highlighted file viewer |
| DiffPreview | Color-coded git diff viewer |
| Monitor | System metrics (GPU, CPU, memory) |
| TabBar | Tab switching + close buttons |
| SpawnDialog | Name + directory form for new workers |
| MobileNav | Bottom navigation bar |
| PushPanel | Multi-step push workflow |
| CommitPanel | Stage + commit with message |
| PartnerHistory | Filtered conversation viewer |
| QuickActions | 1-4, Y/N, Enter, Esc, Plan buttons |
| ChatInput | Text input for worker messages |

### Polling

| What | Interval | Endpoint |
|------|----------|----------|
| Workers | 2s | `/processes` |
| Usage | 5s | `/workers/usage` |
| Activity | 3s | `/activity` |
| Files | 5s | `/home` |
| Metrics | 2s | `/metrics` |
| History | 5s | `/partner/history` |

Each component manages its own `setInterval`.
No centralized state or WebSocket.

---

## Telegram Bot

`bot/telegram_bot.py` — async Python bot
using python-telegram-bot library.

### Config (`bot/config.env`)

```
TELEGRAM_BOT_TOKEN=...
ALLOWED_USER_ID=...
API_URL=http://localhost:5001
OLLAMA_URL=http://localhost:11434
CONTEXT_WARN_PCT=80
CONTEXT_COMPACT_PCT=90
CONTEXT_CHECK_INTERVAL=300
RESPONSE_POLL_TIMEOUT=90
```

### Commands

| Command | Action |
|---------|--------|
| `/status` | Health + worker summary |
| `/workers` | Cards with context bars |
| `/spawn <name> <dir>` | Spawn + auto /rc |
| `/kill <name>` | End-of-session → kill (60s) |
| `/kill_now <name>` | Immediate kill |
| `/send <name> <msg>` | Send to worker |
| `/output <name>` | Recent terminal lines |
| `/proposals` | List with approve/reject buttons |
| `/approve <id>` | Approve proposal |
| `/reject <id>` | Reject proposal |
| `/ask <question>` | Route to Ollama |
| `/reset` | Soft reset partner |
| `/compact [name]` | Compact context |
| `/restart <name>` | Kill + respawn + /rc |
| `/last [n]` | Last N terminal lines |
| `/p` | Quick worker picker |
| `/conversation` | Enter conversation mode |
| `/later <time> <cmd>` | Schedule command |
| `/dashboard` | Live metrics |
| *(plain text)* | Send to partner |

### Background Tasks

- **Context health** — every 5min, warn at 80%,
  auto-compact at 90%
- **Proposal polling** — notify on new proposals
- **Scheduled commands** — execute queued `/later`
- **Conversation mode** — route text to partner

### Hooks

`hooks/notify-telegram.sh` — standalone script,
no bot process needed. Fires on Claude Code
Stop + Notification events via direct Bot API curl.

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

`/api/home` also shows root-level `~/*.md` files
(SOUL.md, INFRASTRUCTURE.md, WORKER.md).

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
- **Single Telegram user** — ALLOWED_USER_ID gate
- **File-based state** — YAML/JSON, git-friendly
- **tmux named socket** — `-L orchestrator`
- **CLAUDECODE env stripping** — prevents nested
  session detection errors in spawned workers
- **Log rotation** — old log renamed on spawn,
  fresh log for current session
- **Auto-trust** — spawn detects trust prompt
  and auto-confirms after 2s delay
