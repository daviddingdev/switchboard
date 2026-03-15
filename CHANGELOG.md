# Helm Changelog

## 2026-03-15

### Renamed to Helm
- Project renamed from Orchestrator to Helm across all files, configs, service files, and documentation
- tmux socket/session renamed from `orchestrator` to `helm`
- CLI helper renamed from `orch` to `helm`, env var `ORCHESTRATOR_URL` → `HELM_URL`
- Service files renamed: `helm.service`, `helm-telegram.service`
- Deleted stale `docs/UPGRADE-PLAN.md` (completed WebSocket upgrade)
- Created `QUICKSTART.md` — onboarding guide with setup checklist, first session walkthrough, and usage patterns

### Estimated API Cost Tracking
- **Cost estimation** — `scripts/compute-usage.py` now computes estimated API costs per model using configurable pricing from `config.yaml`. Costs flow through daily/weekly/by-model/by-project aggregations.
- **Pricing config** — `config.yaml.example` documents per-model rates (input/output per MTok), cache multipliers, and subscription amount. Stale pricing detection warns on unknown models.
- **Usage UI** — New "Est. API Cost" overview card (amber), cost trend chart (side-by-side with activity), cost per model inline, cost row in comparison table.
- **Archive improvements** — MAX-per-field merge strategy prevents data loss when Claude Code prunes old session files. Seeded archive from `stats-cache.json` to recover historical session counts.
- **Chart layout** — Activity and cost charts now side-by-side. Daily gap filling for accurate timelines. "All" range shows daily data instead of monthly aggregation.

### Network Efficiency Overhaul
- **Targeted terminal output** — `worker:output` now emits only to subscribed clients via Socket.IO rooms, not broadcast to all. Eliminates wasted bandwidth (up to ~50KB per push per extra client).
- **Incremental JSONL parsing** — `parse_session_usage()` caches file offset and accumulated totals, only reading new lines on each cycle instead of re-parsing entire multi-megabyte session files every 5s.
- **FileTree WebSocket push** — Replaced 10s REST polling with `files:update` socket event. File tree now updates in sync with the activity monitor.
- **Client-aware monitor pausing** — All 5 background monitors skip work when no browser clients are connected. Eliminates idle CPU/subprocess waste.
- **Activity monitor optimized** — Interval increased from 3s to 5s, reducing git subprocess calls by 40%.
- **Consolidated git status** — `get_git_status_map()` now delegates to `get_git_status()` instead of running a duplicate subprocess.
- **Project discovery caching** — `discover_projects()` cached with 30s TTL instead of walking the filesystem on every monitor cycle.
- **SocketIO tuning** — `ping_interval=20, ping_timeout=60` for better idle connection survival. Client reconnection tightened (500ms delay, 3s max, infinite retries).
- **Model cache warmup** — Models list pre-fetched at server startup so spawn dialog opens instantly.

### Bug Fixes
- **Context tracker per-worker** — Fixed `find_latest_session_file()` returning the same file for all workers in the same project. Each worker now tracked to its own `.jsonl` session file via spawn-time snapshot + label-based fallback matching for pre-existing workers.

### Dead Code Cleanup (-521 lines)
- Removed 3 dead endpoints (`/api/doc-context`, `/api/update-docs`, `/api/commit`)
- Removed `filter_conversation()`, `CLAUDE_CONFIG_FILE`, `PROJECTS_FILE`, `_git_index_mtimes`
- Removed 7 dead `api.js` client functions
- Removed `ErrorState.jsx` (unused component), `tools/usage_report.py` (superseded)
- Removed `state/projects.yaml` and `state/projects.example.yaml` (auto-discovery replaced manual config)
- Removed empty `hooks/` directory
- Cleaned dead CSS styles and unreachable tab type handling
- Fixed `orch projects` CLI to call API instead of reading deleted YAML file

## 2026-03-13

### Configurable System Monitor
- **GPU auto-detection** — GPU card hidden when no GPU present (Mac Mini, headless servers). Configurable command for non-NVIDIA GPUs (e.g., AMD via rocm-smi).
- **Configurable services** — `monitor.services` in config.yaml replaces hardcoded Ollama monitoring. Track any process by name (Postgres, Docker, Open WebUI, etc.). Each service gets its own card.
- **Configurable disk path** — `monitor.disk_path` for monitoring a specific mount point (default: `/`).
- **Platform-aware updates** — System updates card auto-hidden on macOS/Windows. Linux apt/snap updates work on any Debian/Ubuntu system.
- **Generic API routes** — `/api/system/*` for updates. Platform dashboard label configurable via `spark.label` in config.
- **Load average guard** — `psutil.getloadavg()` now guarded for platforms where it's unavailable.
- **Portable config.yaml** — Comprehensive `config.yaml.example` with inline documentation covering GPU, services, disk, updates, and platform dashboard integration.

### Tab Drag-and-Drop Reordering
- **Draggable tabs** — All tab types (terminal, file, diff, monitor, usage) can be reordered via native HTML5 drag-and-drop.
- **Visual feedback** — Dragged tab dims to 40% opacity, drop target shows accent-colored left border insertion indicator.
- **Implementation** — `reorderTab` splice callback in App.jsx, local drag state in TabBar.jsx. No external libraries.

### Usage Analytics — Time Range Selector + Lifetime Stats
- **Time range pills** — `7d | 30d | 90d | 6m | 1y | All` selector in Usage header. Overview cards, charts, and token breakdown update to reflect selected range.
- **SVG line chart** — Replaced horizontal bar chart with SVG line/area chart for time series data. Hover tooltips, grid lines, adaptive dot visibility. Bar chart retained for categorical data (by-project).
- **Adaptive chart granularity** — Daily lines for 7d/30d, weekly for 90d, monthly for 6m/1y/All. Scales to years of data.
- **Client-side aggregation** — `filterDailyByRange`, `aggregateToWeekly`, `aggregateToMonthly` compute from daily[] data. No backend changes needed.
- **All-time context** — When sub-range selected, a compact all-time summary row shows lifetime stats for reference. By-project, by-model, and hourly heatmap always show all-time with label.
- **Subagent sessions** — `compute-usage.py` now includes subagent session files (`*/subagents/*.jsonl`) in all counts. Session count increased from ~385 to ~608.
- **Consistent overview stats** — Frontend always derives overview from daily[] data regardless of time range, fixing "All" showing fewer sessions than sub-ranges.

## 2026-03-12

### WebSocket Upgrade — Real-Time Push (Upgrade v2)

Replaced all polling with WebSocket push. REST retained for actions and initial data.

- **Flask-SocketIO backend** — Added `flask-socketio` with `threading` async mode (not eventlet — avoids monkey-patching subprocess). Replaced `gunicorn` dependency.
- **5 background monitor threads** — Push workers (2s), usage (5s), activity (3s), metrics (2s), terminal output (500ms). All use hash-based change detection — only emit when data changes.
- **Terminal streaming** — Client sends `terminal:subscribe`/`terminal:unsubscribe`, server streams output for subscribed workers only. Near-instant vs old 1s polling.
- **Socket.IO client** — `web/src/socket.js` singleton with auto-reconnect. Components listen for events instead of polling.
- **Vite WebSocket proxy** — Added `/socket.io` proxy with `ws: true` in `vite.config.js`.

### UX Improvements

- **Connection banner** — `ConnectionBanner.jsx` shows yellow "Reconnecting..." on disconnect, green "Reconnected" for 2s on reconnect.
- **Toast notifications** — `ToastProvider` context with `useToast()` hook. Success/error/info toasts replace all `alert()` calls. Auto-dismiss, stacking, slide animation.
- **Skeleton loading** — Pulse animation placeholders in WorkerDashboard and Activity before first data load.
- **Error states** — `ErrorState.jsx` with retry button, shown on fetch failure.
- **Keyboard shortcuts** — `useKeyboardShortcuts` hook. `n` (spawn), `m` (monitor), `u` (usage), `Esc` (close), `?` (help overlay).
- **Dark/light theme** — CSS variables on `:root.light`. Toggle persisted to localStorage. Available on both desktop and mobile.
- **Worker count in page title** — Shows `(N) Helm` when workers are active.

### Post-Upgrade Polish

- **Terminal theme-aware colors** — Replaced hardcoded `#0d0d0d`/`#d4d4d4` with `--terminal-bg`/`--terminal-text` CSS variables.
- **Socket cleanup fix** — WorkerDashboard `socket.off()` now passes handler references to avoid removing other components' listeners.
- **Keyboard shortcuts stability** — `useKeyboardShortcuts` uses `useRef` for keyMap to register listener once instead of every render.
- **Toast animation deduplication** — Moved `@keyframes toast-slide-in` from per-instance `<style>` tags to `index.css`.
- **Mobile theme toggle** — Theme button now renders on mobile (was desktop-only).
- **Toast mobile positioning** — Replaced static `window.innerWidth` check with CSS `@media` query for reactive centering.

### Files Added
- `web/src/socket.js` — Socket.IO singleton
- `web/src/components/ConnectionBanner.jsx` — Disconnect/reconnect banner
- `web/src/components/Toast.jsx` — Toast notification system
- `web/src/components/ErrorState.jsx` — Error display with retry
- `web/src/components/ShortcutsHelp.jsx` — Keyboard shortcuts overlay
- `web/src/hooks/useKeyboardShortcuts.js` — Keyboard shortcut hook

### Dependencies
- Added: `flask-socketio>=5.3.0`, `simple-websocket>=1.0.0`, `socket.io-client@^4.7.0`
- Removed: `gunicorn>=21.2.0`

---

## 2026-03-02

### Usage Fixes

- **Filter synthetic model entries** — Rate-limit error responses from Claude Code use `<synthetic>` as the model name; these are now excluded from usage stats (`compute-usage.py`)
- **Fix project name overlap in bar chart** — Widened label column for project names (100px vs 50px), added text truncation with hover tooltip (`Usage.jsx`)
- **Historical data merge** — Support merging `~/.claude/projects/` data from another machine for complete usage history

### Usage Analytics Tab

- **Usage dashboard** — New tab showing Claude Code usage analytics across all sessions
  - `scripts/compute-usage.py` — Scans all `~/.claude/projects/` session JSONLs, computes aggregated stats
  - Handles large files (>50MB) via chunked regex, normal files via line-by-line JSON parsing
  - `web/src/components/Usage.jsx` — Dashboard with overview cards, weekly comparison, daily bar chart, weekly trends, by-project bars, by-model breakdown, hourly heatmap, token breakdown
  - `GET /api/usage` — Auto-recomputes if data older than 5 minutes
  - `POST /api/usage/refresh` — Manual background recompute
  - Weekly cron job (Sunday 2am) for automatic stats computation
- **Data persistence** — `state/usage-archive.json` preserves daily data across runs, so historical stats survive even if Claude Code purges old session files

### Multi-Instance Worker Spawning

- **Auto-increment names** — Spawning a worker with an existing name now creates a new instance (e.g., partner, partner-2, partner-3) instead of returning a 409 error
- **Session naming** — Workers now type the folder name + instance number as first message (e.g., "my-project 1") so sessions have meaningful names in the Claude Code UI
- **Trust prompt detection** — Only sends "1" to confirm trust when the trust prompt is actually showing, preventing "1" from becoming the session name

### Mobile-Responsive UI Redesign

- **New layout** — Responsive design with mobile bottom nav and desktop 3-panel layout
  - `WorkerDashboard.jsx` — Combined worker list + quick actions + input for the top section
  - `MobileNav.jsx` — Bottom navigation bar with Workers, Files, Activity, Monitor, Usage tabs
  - `Monitor.jsx` — System monitoring dashboard (CPU, memory, disk, tmux sessions)
  - `useMediaQuery` hook — Mobile detection for responsive rendering
- **Simplified Activity panel** — Streamlined to focused git changes + unpushed commits view
- **Removed components** — `Terminal.jsx` (integrated into WorkerDashboard), `EphemeralPreview.jsx` (replaced by preview in tabs)
- **Removed preview test button** from QuickActions (was temporary debug tool)

---

## 2026-02-27

### Telegram Bot

- **Mobile control interface** — New Telegram bot (`bot/telegram_bot.py`) for remote orchestrator management
  - Worker management: `/spawn`, `/kill`, `/kill_now`, `/restart`, `/send`, `/output`
  - Proposal actions: `/proposals`, `/approve`, `/reject`
  - Context management: `/compact`, `/reset`, `/hard_reset`
  - Status views: `/status`, `/workers` with context usage bars
  - Ollama integration: `/ask` routes questions to local LLM
  - Button-based UI with inline keyboards for all actions
  - Partner shortcut: plain text messages route directly to partner
- **Telegram notification hooks** — `hooks/notify-telegram.sh` sends Stop + Notification events via direct curl (async, no bot dependency)
- **Systemd service** — `services/orchestrator-telegram.service` for running as daemon
- **Git dashboard** — New "Git" button in Telegram showing changed files and unpushed commits per project, with push confirmation

### Documentation Cleanup

- **Removed USAGE.md** — Manual token tracking discontinued
- **Removed docs/** files — Deleted `architecture.md`, `chat-summary.md`, `SOUL.example.md` (consolidated into CLAUDE.md and memory)
- **Removed ProposalCard.jsx** — Unused component cleanup

### Output Capture Improvements

- **Fixed blank line handling in capture_output** — Remote-control mode produces many blank lines that consumed the output buffer. Now captures 5x the requested lines, filters out empty lines, and returns only the last N non-empty lines.

---

## 2026-02-25

### Nested Session Support

- **Fixed spawning workers from within Claude Code** — Stripped `CLAUDECODE` environment variable when running tmux commands to avoid nested session detection errors
  - `api/tmux_manager.py` — Filter out `CLAUDECODE` from subprocess env
  - `start.sh` — Unset `CLAUDECODE` before starting orchestrator
  - `api/server.py` — Filter out `CLAUDECODE` from update_docs subprocess to allow doc automation from Claude Code sessions

---

## 2026-02-24

### Portable Paths

- **Made paths portable for cross-machine usage** — Hardcoded `~/orchestrator` paths replaced with dynamic `PROJECT_ROOT` resolution
  - `api/server.py` — Uses `Path(__file__).parent.parent` for STATE_DIR, LOGS_DIR
  - `api/tmux_manager.py` — Uses `os.path.dirname(__file__)` for LOGS_DIR and session working directory
  - `start.sh` / `stop.sh` — Uses `-L orchestrator` socket flag consistently
  - `setup.sh` — Simplified setup instructions, removed projects.yaml copy step
- **New `docs/SETUP.md`** — Comprehensive setup guide for Linux and macOS
  - Prerequisites for both platforms
  - Port conflict resolution instructions
  - Troubleshooting section
- **README updates**:
  - Added macOS notes section
  - Added ports table
  - Documented how to fully kill tmux session
  - Clarified project auto-discovery (no manual config needed)

---

## 2026-02-23

### Auto-Preview for Plan Files

- **Preview API** — New endpoint to queue content for display in the UI
  - `POST /api/preview` — Queue content (markdown, code, etc.) for preview
  - `GET /api/preview/pending` — Fetch and clear pending previews
- **EphemeralPreview component** — New tab type for temporary content display
  - Syntax highlighting with highlight.js
  - Copy button
  - Full-height scrollable content
- **Terminal preview extraction** — Terminal output can contain `:::PREVIEW:Title:lang:::` blocks that auto-open as preview tabs
- **Plan mode integration** — Workers can post plans to `/api/preview` and have them open automatically in the UI
- **Preview test button** (👁) in QuickActions for testing preview functionality

---

### Documentation Cleanup

- **Simplified CLAUDE.md** — Reduced from 144 lines to 38 lines
  - Removed detailed architecture docs (moved to architecture.md)
  - Removed API endpoint reference (check server.py)
  - Removed directory structure listing
  - Added plan mode curl command for workers
  - Focused on quick start, key details, and gotchas

---

### Bug Fixes

- **Fixed update-docs race condition** — Removed automatic `git add` from update-docs prompt and removed Bash tool from allowed tools to prevent doc updater from modifying git state

---

### Documentation Improvements

- **Removed end-of-session checklist from CLAUDE.md** — Orchestrator now handles doc updates at push time, workers don't need manual checklist
- **Added `docs/NEW_PROJECT.md`** — Setup guide for creating new projects
  - Git init, CLAUDE.md template, GitHub repo creation
  - Connect and push instructions
  - Common .gitignore template

---

### Session Detection + Reset Improvements

- **Session detection uses mtime** — `find_latest_session_file()` now uses modification time as primary heuristic (most recently modified = active session), reverting from file size approach
- **Improved soft reset reliability** — `POST /api/partner/reset` now sends multiple Ctrl-C, Escape, and Ctrl-U to ensure clean exit from Claude Code before restarting
- **Removed SOUL.md from CLAUDE.md header** — SOUL.md now auto-loads via `~/.claude/CLAUDE.md`

---

### Commit Panel + Tab Improvements

- **Commit panel** — New tab for manually committing changes with custom messages
  - Shows uncommitted files per project with git status indicators
  - Textarea for commit message per project
  - `POST /api/commit` — Stage all changes and commit with message
  - Commit button in Activity panel's Changes section
- **Closable tabs** — All panel tabs (push, commit, history) now have × close button
- **Persistent panel state** — Push and Commit panels stay mounted during tab switches to preserve state (checkboxes, progress, form input)

---

### Context Usage Display Improvements

- **Show token counts** — Usage meter now displays actual tokens (e.g., "142k/85%") instead of just percentage
- **Compact layout** — Streamlined usage row styling with smaller progress bars
- **Warning indicators** — Shows ⚠️ emoji and bold text when usage exceeds 80%
- **Reorganized actions** — History/Reset buttons moved to separate row below usage bar

---

### Quick Action Button Improvements

- **Send with Enter** — Number/letter buttons (1-4, Y/N) now send as text with Enter for Claude Code prompts
- **Shift+click to edit** — Hold shift and click any quick action button to populate the chat input instead of sending immediately
- **ChatInput controlled mode** — Component now supports both controlled (value/onChange) and uncontrolled modes

---

### Partner Context Management

- **Context usage meter** — Activity panel shows context % for each active worker
  - Parses Claude session JSONL files to extract token usage
  - Color-coded progress bars (green/yellow/red)
- **Partner history viewer** — New tab showing filtered conversation history
  - Shows user and assistant text messages only (no tool calls/thinking)
  - Auto-refreshes, closable tab with chat icon
- **Partner reset button** — Soft reset to restart the partner session
  - Sends Ctrl-C to interrupt, then restarts claude
- **New API endpoints:**
  - `GET /api/workers/usage` — Token usage for all active workers
  - `GET /api/partner/history` — Filtered conversation history
  - `POST /api/partner/reset` — Restart partner session
- **New component:** `PartnerHistory.jsx` — Scrollable message history viewer
- **API version bump:** 0.3.0 → 0.4.0

---

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
  - Shows `~/*.md` files at root level
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

### Worker Orchestration CLI

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
  - Added shared context header
  - Added Partner Orchestration section with commands and workflows
  - Added worker shutdown protocol
- **Updated shared context files** for cross-project use
- **Updated all project CLAUDE.md files** with SOUL header

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
3. UI accessible from remote device

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

**Infrastructure notes:**
- Port 5001: Orchestrator API (this project)
- Check for port conflicts with existing services before starting

---

## 2026-02-18

### Project Initialized

- **Created directory structure** (`~/orchestrator/`)
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

*Last updated: March 12, 2026*
