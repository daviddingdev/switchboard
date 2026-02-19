# Orchestrator Changelog

## 2026-02-19

### Backend Core Implemented (Phase 2)

- **Created `api/requirements.txt`** — Flask 3.0, Flask-CORS, Flask-SocketIO, PyYAML
- **Created `api/tmux_manager.py`** — tmux subprocess wrapper with:
  - `ensure_session()` — Creates orchestrator session with partner window
  - `list_windows()` — Lists all windows with index/name/pid
  - `spawn_worker()` — Creates new window, starts Claude Code
  - `kill_worker()` — Kills a worker window
  - `send_keys()` — Sends text input (literal mode + Enter)
  - `capture_output()` — Captures pane output
  - `get_pane_pid()` — Gets shell PID for a window
- **Created `api/server.py`** — Flask API with endpoints:
  - `GET /api/health` — Health check + session status
  - `GET /api/processes` — List all workers
  - `POST /api/processes` — Spawn new worker
  - `DELETE /api/processes/<name>` — Kill worker (partner protected)
  - `POST /api/processes/<name>/send` — Send input to worker
  - `GET /api/processes/<name>/output` — Capture worker output
- **All 11 verification tests passed**

**Infrastructure notes discovered:**
- Port 5000: Family Vault API (`~/family-vault/api_server.py`)
- Port 5001: Orchestrator API (this project)
- Port 8080: Open WebUI
- Port 11434: Ollama
- Port 9200: OpenSearch

---

## 2026-02-18

### Project Initialized

- **Created directory structure** on Spark (`~/orchestrator/`)
  - `docs/` — architecture, chat summary, mockups
  - `state/` — processes.yaml, plans/
  - `api/` — Flask backend (to build)
  - `web/` — React frontend (to build)
  - `scripts/` — launch scripts (to build)
- **Wrote CLAUDE.md** — full project context for Claude Code sessions
- **Wrote architecture.md** — technical design with API endpoints, state schema, build phases
- **Wrote chat-summary.md** — design conversation decisions
- **Created UI mockup** (`orchestrator-partner.jsx`) — React component showing:
  - Chat interface with Partner
  - Process tree sidebar
  - Terminal view
  - Inline plan approval cards
- **Initialized git repo** and pushed to GitHub (private)

**Design decisions made:**
- Partner model (conversational) over PM model (formal methodology)
- Process tree for workers + children, not just projects
- Plans appear inline in chat, not separate tab
- YAML state files, polling before WebSocket
- Flask + React + xterm.js stack

---

## 2026-02-17

### Design Session

- Discussed orchestrator vision with Claude Desktop
- Explored PM vs Portfolio Manager vs Partner models
- Settled on Partner + Workers architecture
- Researched industry patterns (CrewAI, MetaGPT, APM)
- Decided: orchestrator is peer to other projects, not parent

---

*Last updated: February 19, 2026*
