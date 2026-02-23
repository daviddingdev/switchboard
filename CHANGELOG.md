# Orchestrator Changelog

## 2026-02-23

### API Client Cleanup

- **Minor API response handling improvements** — Performance comment in api.js

---

### Push Tab Mounted + Parallel Operations

- **Keep Push tab mounted** — Push tab stays mounted during tab switches to preserve state (checkboxes, progress)
- **Parallelize doc updates and pushes** — Update docs and push operations now run concurrently across projects instead of sequentially

### Push Upstream Detection

- **Fixed push to detect upstream remote/branch** — Push API now queries git for the tracking branch and pushes to correct remote (e.g., `github/master` instead of always `origin/main`)

---

### Push Tab Improvements

- **Push tab close button** — Push tab now closable like file/diff tabs
- **Always commit docs before push** — Removed `commit_docs` flag, API now always stages and commits modified doc files (CHANGELOG.md, TODO.md, USAGE.md) before pushing
- **Push tab icon** — Blue arrow (⬆) icon for push tabs in TabBar

---

### Push Workflow with Auto Doc Updates

- **PushDialog.jsx** — Modal workflow for pushing changes across projects
  - Step 1: Shows unpushed commits per project, checkbox to update docs
  - Step 2: Runs `claude -p` to update CHANGELOG/TODO/USAGE per project
  - Step 3: Review changes and push all
- **`POST /api/update-docs`** — Spawns Claude to update docs for a project
  - Builds context from: unpushed commits, git diff, worker session logs
  - Runs `claude -p` with allowedTools for Read/Edit/Write/Bash/Glob
  - Returns updated file status
- **`POST /api/push`** — Commits doc updates (if any) and pushes
- **`GET /api/doc-context`** — Returns context for doc automation
  - Includes commit messages, diff stats, worker logs (last 500 lines)
  - Reports which doc files exist (CHANGELOG.md, TODO.md)
- **Worker log rotation** — Existing log rotated to `<name>-timestamp.log` on spawn
  - Current session always writes to fresh `<name>.log`
- **Push button** in Activity panel's Unpushed section

Workers no longer need to update docs — this is handled at push time.

---

### Diff Preview + Raw Keys + Unpushed Tracking

- **Diff preview** — Click changed files in Activity panel to see git diff in a new tab
  - `DiffPreview.jsx` — Syntax-colored diff viewer (green additions, red deletions)
  - `GET /api/diff?project=&path=` — Returns git diff for specific file
  - Handles untracked files (shows full content as additions)
- **Raw key sending** — Escape/Enter buttons now work properly in tmux
  - `raw` parameter in `send_keys()` sends as tmux key vs literal text
  - Escape button styled red, Plan button styled blue
- **Plan button** — Sends `/plan` to active worker's Claude Code session
- **Unpushed commits section** — Activity panel shows commits ahead of origin
  - `get_unpushed_commits()` — Gets commits via `git log upstream..HEAD`
  - Blue badge shows total count across projects
  - Shows commit hash + message for each
- **Worker logging** — Output saved to `~/orchestrator/logs/workers/<name>.log`
  - 50k line scrollback buffer per worker
- **Git status normalization** — Consistent M/U/A/D indicators

---

### VSCode-Style Features

- **Auto-discover projects** — Scans for directories with CLAUDE.md files instead of manual registry
  - `discover_projects()` recursively finds projects up to depth 3
  - Shows `~/*.md` files (SOUL.md, INFRASTRUCTURE.md, WORKER.md) at root
  - Projects appear as collapsible folders below
- **Git status indicators** — Files show status badges:
  - `M` (yellow) = modified
  - `U` (green) = untracked
  - `A` (green) = added
  - `D` (red) = deleted
  - Folders show yellow dot if children have changes
- **File preview with syntax highlighting**:
  - `FilePreview.jsx` — Uses highlight.js for Python, JS, JSON, YAML, Markdown, CSS, HTML, Bash
  - Line numbers display
  - `GET /api/file?path=` — Returns file content with language detection
- **Tab-based navigation**:
  - `TabBar.jsx` — Tabs for terminals and file previews
  - Worker terminals open as new tabs (not replacing partner)
  - Partner terminal tab cannot be closed
  - File tabs closable with × button
- **Folders collapsed by default** — Cleaner initial view
- **Unified file tree** — `GET /api/home` returns combined tree with git status

---

### Made Orchestrator Shareable

- **Created setup/start/stop scripts** for easy installation:
  - `setup.sh` — Checks dependencies, installs Python/Node packages
  - `start.sh` — Launches API, web server, and tmux session
  - `stop.sh` — Clean shutdown of all processes
- **Created README.md** — Quick start guide with requirements
- **Created example files**:
  - `state/projects.example.yaml` — Template for user configuration
  - `docs/SOUL.example.md` — Example working style document
- **Updated .gitignore** — Properly ignores user config, logs, proposals

Fresh clone now works in 5 minutes:
```bash
git clone <repo> && cd orchestrator
./setup.sh
cp state/projects.example.yaml state/projects.yaml
./start.sh
```

---

### UI Redesign: 3-Column Layout

- **New layout structure**:
  - Left: FileTree with project dropdown + recursive file explorer
  - Center: Single terminal for selected worker (removed duplicate)
  - Right: WorkerList + Activity panel
  - Bottom: QuickActions + input bar
- **New API endpoints**:
  - `GET /api/projects` — List from projects.yaml
  - `GET /api/files/<project>` — Recursive file tree (max depth 4)
  - `GET /api/changes` — Git status across all projects
  - `GET /api/activity` — Combined pending/changes/recent feed
- **New components**:
  - `FileTree.jsx` — Project dropdown + expandable file tree
  - `WorkerList.jsx` — Simplified worker list
  - `Activity.jsx` — Pending proposals, git changes, recent activity
- **Deleted redundant components**:
  - `ChatArea.jsx` — Had duplicate partner terminal
  - `ProcessTree.jsx` — Replaced by simpler WorkerList
- **Bug fix**: Git status parsing (`strip().split()` was corrupting first line)

---

### Resizable Panels + Quick Actions

- **All panels now resizable**: proposals section, process tree, sidebar
- **QuickActions component**: 1, 2, 3, 4, Y, N, Enter, Esc buttons
- **Quick actions on both** partner terminal and worker terminal
- **Input field** for sending text to selected worker

---

## 2026-02-22

### Worker Proposal Testing Session

- **Verified WORKER.md implementation** — workers can submit proposals via curl
- **Tested full proposal lifecycle**:
  - Submit proposal → pending status
  - List via `orch proposals`
  - Approve via `orch approve` → approved status
  - Reject via UI → rejected status
- **Coordinated worker shutdown**:
  - Sent end-of-session tasks to both workers
  - Workers updated CHANGELOG, TODO, ran usage reports
  - Workers committed and pushed before shutdown
  - Killed workers cleanly after receiving "DONE"

---

### Rename Plans to Proposals + WORKER.md

- **Renamed "plan" to "proposal"** — Avoids confusion with Claude Code's built-in plan mode
  - `state/plans/` → `state/proposals/`
  - `/api/plans` → `/api/proposals`
  - `PlanCard.jsx` → `ProposalCard.jsx`
  - `orch plan` → `orch propose`
- **Created `~/WORKER.md`** — Instructions for workers on how to submit proposals
  - Workers curl to `POST /api/proposals` with id, title, worker, steps
  - Workers can verify proposals via `GET /api/proposals`
  - Documents end-of-session cleanup tasks
- **UI improvements**:
  - Collapsible proposals section with pending count badge
  - Delete button (×) for completed proposals
  - Resizable sidebar (200-600px) with draggable divider
  - Compact ProcessTree styling
  - Better spacing and proportions

---

### Partner Orchestration + SOUL Integration

- **Created `scripts/orch`** — CLI helper for partner automation:
  - `orch spawn <name> <dir>` — Spawn worker in directory
  - `orch kill <name>` — Kill worker
  - `orch list` — List workers
  - `orch send <name> <msg>` — Send message to worker
  - `orch output <name>` — Get worker output
  - `orch plan <id> <title> <worker> [--auto]` — Create plan
  - `orch plans` — List plans
  - `orch approve <id>` — Approve plan
  - `orch projects` — List known projects
- **Created `state/projects.yaml`** — Project registry with directories
- **Modified `api/server.py`**:
  - Added `POST /api/plans` — Create plans with auto_approve support
  - Fixed datetime sorting bug in list_plans
- **Updated `CLAUDE.md`**:
  - Added SOUL.md/INFRASTRUCTURE.md header
  - Added Partner Orchestration section with commands and workflows
  - Added worker shutdown protocol
- **Updated `~/SOUL.md` and `~/INFRASTRUCTURE.md`** — Shared context files
- **Updated all project CLAUDE.md files** with SOUL header:
  - `~/orchestrator/CLAUDE.md` ✓
  - `~/family-vault/CLAUDE.md` ✓
  - `~/services/research-pipeline/CLAUDE.md` ✓

**Partner can now:**
1. Spawn workers using `orch spawn`
2. Send tasks using `orch send`
3. Monitor output using `orch output`
4. Create auto-approved plans for routine tasks
5. Coordinate multi-project workflows

---

## 2026-02-20

### Terminal Integration + Chat & Plans (Phases 4 & 5)

- **Created `web/src/components/Terminal.jsx`**:
  - Polls `/api/processes/<name>/output` every 500ms
  - Auto-scrolls to bottom on new content
  - Monospace font, dark terminal background
  - Shows loading state and error messages
- **Created `web/src/components/ChatArea.jsx`**:
  - Main content area with partner terminal + plan list
  - Loads plans from API, auto-refreshes every 2s
  - Shows pending plans first, then recent resolved
- **Created `web/src/components/PlanCard.jsx`**:
  - Displays plan with title, worker, steps
  - Status badges: pending (yellow), approved (green), rejected (red)
  - Approve/Reject buttons for pending plans
- **Created `web/src/components/ChatInput.jsx`**:
  - Text input for sending messages to partner
  - Enter to send, disabled state while sending
- **Modified `web/src/components/ProcessTree.jsx`**:
  - Added worker selection (click to select)
  - Visual highlight for selected worker
  - Passes `selectedWorker` and `onSelect` props
- **Modified `web/src/App.jsx`**:
  - Added `selectedWorker` state (defaults to 'partner')
  - ChatArea in main content area
  - Terminal in sidebar showing selected worker's output
- **Modified `web/src/api.js`**:
  - Added `fetchPlans()` — GET /api/plans
  - Added `updatePlan(id, status)` — PATCH /api/plans/<id>
- **Modified `api/server.py`**:
  - Added `GET /api/plans` — Lists plans from `state/plans/*.yaml`
  - Added `PATCH /api/plans/<id>` — Updates plan status
  - Pending plans sorted first, then by created_at
- **Created `state/plans/` directory** — Stores plan YAML files

**All verification tests passed:**
1. Terminal shows worker output (polling works)
2. Worker selection highlights in ProcessTree
3. Plans endpoint returns YAML files
4. Plan approval updates file status
5. Frontend builds successfully

---

### React Frontend Shell Implemented (Phase 3)

- **Created `web/package.json`** — Vite 5, React 18
- **Created `web/vite.config.js`** — Dev server on :3000 with proxy to API :5001
- **Created `web/index.html`** — HTML entry point
- **Created `web/src/main.jsx`** — React entry point
- **Created `web/src/index.css`** — Dark theme (zinc colors)
- **Created `web/src/api.js`** — API client functions:
  - `fetchProcesses()` — GET /api/processes
  - `spawnProcess()` — POST /api/processes
  - `killProcess()` — DELETE /api/processes/<name>
  - `sendToProcess()` — POST /api/processes/<name>/send
  - `getOutput()` — GET /api/processes/<name>/output
- **Created `web/src/App.jsx`** — Main layout:
  - Header with Spawn button
  - Content area (placeholder for chat)
  - Sidebar with ProcessTree
  - SpawnDialog modal
- **Created `web/src/components/ProcessTree.jsx`**:
  - Lists processes with status indicators
  - Auto-refreshes every 2 seconds
  - Kill button (partner protected)
  - Loading/error states
- **Created `web/src/components/SpawnDialog.jsx`**:
  - Name input (required)
  - Directory input (default ~)
  - Spawn/Cancel buttons

**All automated verification tests passed:**
1. Dev server starts at :3000
2. API proxy works (/api/processes via :3000)
3. UI accessible from Mac via Tailscale

---

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

*Last updated: February 23, 2026*
