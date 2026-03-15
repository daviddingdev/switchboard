# Orchestrator - Current Tasks

## Current Focus
**Network efficiency overhaul + dead code cleanup complete**

All live data pushed via WebSocket with efficiency optimizations:
- Targeted terminal output (rooms-based, not broadcast)
- Incremental JSONL parsing (cached offsets, not full re-reads)
- Client-aware monitor pausing (no work when 0 clients)
- Per-worker context tracking (correct session file mapping)
- 30s project discovery cache, consolidated git status calls
- FileTree via WebSocket push (no more polling)

---

## Quick Start

```bash
cd ~/orchestrator
./start.sh
```

**UI accessible at:** http://localhost:5001

---

## Completed

### Tab Reorder + Usage Time Ranges (Mar 13, 2026)
- [x] Tab drag-and-drop reordering via native HTML5 drag events
- [x] Usage time range selector: 7d / 30d / 90d / 6m / 1y / All
- [x] Adaptive chart granularity (daily → weekly → monthly)
- [x] Client-side filtering and aggregation from daily[] data
- [x] All-time summary row when sub-range selected
- [x] BarChart maxItems fix — time range filtering replaces hardcoded limit

### Network Efficiency + Cleanup (Mar 15, 2026)
- [x] Targeted terminal output via Socket.IO rooms (not broadcast)
- [x] Incremental JSONL parsing with cached file offsets
- [x] Client-aware monitor pausing (skip work when 0 clients)
- [x] Per-worker session file tracking (fixed context tracker bug)
- [x] FileTree via WebSocket push (replaced 10s polling)
- [x] Activity monitor interval 3s → 5s
- [x] Consolidated git status functions
- [x] Project discovery 30s TTL cache
- [x] SocketIO ping tuning (ping_interval=20, ping_timeout=60)
- [x] Model cache warmup at startup
- [x] Dead code cleanup: removed 3 endpoints, 1 function, 4 constants, 7 api.js functions, 2 files, 2 yaml configs, 1 component, dead CSS/tab types

### WebSocket Upgrade + UX Polish (Mar 12, 2026)
- [x] Flask-SocketIO with `threading` async mode (not eventlet — subprocess-safe)
- [x] 5 background monitor threads: workers(2s), usage(5s), activity(5s), metrics(2s), terminal(500ms)
- [x] Hash-based change detection — only push when data changes
- [x] Terminal subscribe/unsubscribe model for on-demand streaming
- [x] Socket.IO client singleton with auto-reconnect
- [x] ConnectionBanner — disconnect/reconnect indicator
- [x] Toast notifications — replaced all alert() calls
- [x] Skeleton loading states in WorkerDashboard, Activity
- [x] Keyboard shortcuts: n (spawn), m (monitor), u (usage), Esc (close), ? (help)
- [x] Dark/light theme toggle with CSS variables, persisted to localStorage
- [x] Worker count in page title
- [x] Terminal theme-aware colors (CSS variables instead of hardcoded)
- [x] Socket cleanup fix — handler refs in socket.off()
- [x] Keyboard shortcuts stability — useRef to avoid re-registration
- [x] Toast animation deduplication — moved to index.css
- [x] Mobile theme toggle (was desktop-only)
- [x] Toast mobile positioning via CSS media query

### Open-Source Prep (Mar 11, 2026)
- [x] Moved Telegram bot to `contrib/telegram/`
- [x] Made systemd services portable with `%h` home expansion
- [x] Made `scripts/orch` portable with `ORCHESTRATOR_URL` env var
- [x] Removed hardcoded paths and personal references from all files
- [x] Simplified CLAUDE.md for external users
- [x] Deleted personal artifacts (assumptions.md, docs/NEW_PROJECT.md)
- [x] Added config.yaml.example template

### Usage Analytics Tab (Mar 2, 2026)
- [x] `scripts/compute-usage.py` — Scans all session JSONLs, computes daily/weekly/by-project/by-model/by-hour stats
- [x] `web/src/components/Usage.jsx` — Dashboard with overview cards, charts, heatmap
- [x] `GET /api/usage` — Auto-recomputes if stale (>5 min)
- [x] `POST /api/usage/refresh` — Manual background recompute
- [x] `state/usage-archive.json` — Persistent daily data archive
- [x] Weekly cron job for automatic stats computation

### Multi-Instance Worker Spawning (Mar 2, 2026)
- [x] Auto-increment names (partner, partner-2, partner-3) instead of 409 error
- [x] Session naming — types folder name + instance number as first message
- [x] Trust prompt detection — only sends "1" when trust prompt is showing

### Mobile-Responsive UI Redesign (Mar 2, 2026)
- [x] `WorkerDashboard.jsx` — Combined worker list + quick actions + input
- [x] `MobileNav.jsx` — Bottom navigation for mobile
- [x] `Monitor.jsx` — System monitoring dashboard
- [x] `useMediaQuery` hook for responsive rendering
- [x] Simplified Activity panel
- [x] Removed Terminal.jsx and EphemeralPreview.jsx

### Telegram Bot (Feb 27, 2026)
- [x] `contrib/telegram/bot/telegram_bot.py` — Mobile control interface with button-based UI
- [x] Worker commands: spawn, kill, restart, send, output
- [x] Proposal management: list, approve, reject
- [x] Context management: compact, reset, hard reset
- [x] Status views with context usage progress bars
- [x] Git dashboard: changed files + unpushed commits with push button
- [x] Ollama integration for /ask queries
- [x] `contrib/telegram/hooks/notify-telegram.sh` — Stop + Notification events via curl
- [x] `contrib/telegram/orchestrator-telegram.service` — Systemd daemon

### Documentation Cleanup (Feb 27, 2026)
- [x] Removed USAGE.md — Manual token tracking discontinued
- [x] Removed docs/architecture.md, chat-summary.md, SOUL.example.md
- [x] Removed ProposalCard.jsx — Unused component

### Auto-Preview for Plan Files (Feb 23, 2026)
- [x] `POST /api/preview` + `GET /api/preview/pending` — Preview queue API
- [x] `EphemeralPreview.jsx` — Tab component for temporary content
- [x] Terminal preview extraction — Parse `:::PREVIEW:::` blocks from output
- [x] Plan mode integration — Workers post plans that auto-open in UI
- [x] Preview test button (👁) in QuickActions

### Documentation Cleanup (Feb 23, 2026)
- [x] Simplified CLAUDE.md — 144 lines → 38 lines
- [x] Added plan mode curl command for workers

### Documentation Improvements (Feb 23, 2026)
- [x] Removed end-of-session checklist — orchestrator handles doc updates
- [x] Added `docs/NEW_PROJECT.md` — Setup guide for new projects

### Commit Panel + Tab Improvements (Feb 23, 2026)
- [x] Commit panel — Manual commit UI with custom messages per project
- [x] `POST /api/commit` — Stage all and commit endpoint
- [x] Closable tabs for all panel types (push, commit, history)
- [x] Persistent panel state — Panels stay mounted during tab switches

### Context Usage Display Improvements (Feb 23, 2026)
- [x] Show token counts in usage meter (e.g., "142k/85%")
- [x] Compact layout with smaller progress bars
- [x] Warning indicators (⚠️ + bold) when usage >= 80%
- [x] Reorganized action buttons below usage bar

### Quick Action Button Improvements (Feb 23, 2026)
- [x] Send with Enter — Number/letter buttons send as text+Enter
- [x] Shift+click to populate chat input instead of sending
- [x] ChatInput supports controlled mode (value/onChange props)

### Worker Context Management (Feb 23, 2026)
- [x] Context usage meter in Activity panel — shows % for each worker
- [x] Worker history viewer — tab showing filtered conversation messages
- [x] Worker reset button — soft reset to restart session
- [x] `GET /api/workers/usage` — Token usage stats
- [x] `GET /api/partner/history` — Conversation history
- [x] `POST /api/partner/reset` — Restart partner
- [x] `PartnerHistory.jsx` component — Message history viewer

### Push Tab Mounted + Parallel (Feb 23, 2026)
- [x] Keep Push tab mounted during tab switches — preserves state
- [x] Parallelize doc updates — runs concurrently across projects
- [x] Parallelize pushes — runs concurrently across projects

### Push Tab Improvements (Feb 23, 2026)
- [x] Push tab close button — closable like file/diff tabs
- [x] Always commit docs before push — removed commit_docs flag from API
- [x] Push tab icon styling — blue arrow icon in TabBar
- [x] Fixed push to detect upstream remote/branch

### Push Workflow with Auto Doc Updates (Feb 23, 2026)
- [x] PushDialog.jsx — 3-step modal (select → update docs → push)
- [x] `POST /api/update-docs` — Run claude -p to update CHANGELOG/TODO/USAGE
- [x] `POST /api/push` — Commit doc changes and push
- [x] `GET /api/doc-context` — Context for doc automation (commits, diff, logs)
- [x] Worker log rotation on spawn (prevents stale context)
- [x] Push button in Activity panel Unpushed section
- [x] Workers no longer need to update docs (handled at push time)

### Diff Preview + Raw Keys + Unpushed (Feb 23, 2026)
- [x] Diff preview — Click changed files to see git diff in tab
- [x] Raw key sending — Escape/Enter work properly in tmux
- [x] Plan button — Send /plan to active worker
- [x] Unpushed commits section in Activity panel
- [x] Worker logging to `logs/workers/<name>.log`
- [x] Git status normalization (consistent M/U/A/D)

### VSCode-Style Features (Feb 23, 2026)
- [x] Auto-discover projects by scanning for CLAUDE.md files
- [x] Unified file tree: `~/*.md` files + project directories
- [x] Git status indicators on files (M=modified, U=untracked, A=added, D=deleted)
- [x] Folder dot indicator when children have changes
- [x] `FilePreview.jsx` — Syntax highlighting with highlight.js
- [x] `TabBar.jsx` — Tab navigation for terminals and files
- [x] Worker terminals open as separate tabs
- [x] All folders collapsed by default
- [x] `GET /api/home` — Unified file tree with git status
- [x] `GET /api/file` — File content with language detection

### Portable Paths (Feb 24, 2026)
- [x] Made paths portable — PROJECT_ROOT instead of hardcoded `~/orchestrator`
- [x] Added `docs/SETUP.md` — Comprehensive setup guide for Linux/macOS
- [x] Updated README with macOS notes, ports table, project discovery docs

### Made Shareable (Feb 23, 2026)
- [x] `setup.sh` — Install dependencies, create directories
- [x] `start.sh` — Launch API, web, tmux
- [x] `stop.sh` — Clean shutdown
- [x] `README.md` — Quick start guide
- [x] `state/projects.example.yaml` — Template config
- [x] `docs/SOUL.example.md` — Example SOUL file
- [x] Updated `.gitignore` for user config

### UI Redesign (Feb 23, 2026)
- [x] 3-column layout: Files | Terminal | Workers+Activity
- [x] `FileTree.jsx` — Project browser + file explorer
- [x] `WorkerList.jsx` — Simplified worker list
- [x] `Activity.jsx` — Pending, changes, recent
- [x] Removed duplicate terminal (ChatArea.jsx)

### UI Polish (Feb 23, 2026)
- [x] Resizable panels (proposals, process tree, sidebar)
- [x] QuickActions (1, 2, 3, 4, Y, N, Enter, Esc)
- [x] Worker terminal input field

### Proposals + WORKER.md (Feb 22, 2026)
- [x] Renamed "plan" to "proposal"
- [x] Created `~/WORKER.md` for worker instructions
- [x] UI: collapsible proposals, delete button

### Worker Orchestration (Feb 22, 2026)
- [x] `scripts/orch` CLI helper
- [x] `state/projects.yaml` project registry
- [x] `POST /api/proposals` endpoint

### Phases 1-5 (Feb 17-20, 2026)
- [x] Flask API + tmux manager
- [x] React frontend
- [x] Terminal integration (polling)
- [x] Proposal approval flow

---

## Next

### Open-Source Release
- [ ] **Git history cleanup** — Scrub any remaining personal data from git history before public push
- [ ] **Verify no personal data** — Final audit of all files for hardcoded paths, usernames, IPs
- [ ] **Create public repo** — Push to public GitHub repository

### Features
- [ ] **File download/copy on mobile** — FilePreview needs a way to download or copy file content on mobile. Blob URL + `a.click()` navigates the page instead of downloading on mobile browsers, causing the SPA to reset on back navigation. Needs a mobile-safe approach (e.g., share API, copy to clipboard, or backend raw file endpoint).
- [ ] **Plan mode awareness in web UI** — Detect when Claude Code is showing a plan approval prompt and show approve/reject buttons instead of text input. Currently, typing in the chat box during plan mode sends raw text to tmux, which Claude Code misinterprets (e.g., "4 test comment" got interpreted as approval)

## Backlog (Post-MVP)
- [ ] **Terminal scrolling** — Output panel doesn't scroll properly; low priority, defer until worth the effort
- [ ] Non-interactive worker tasks (`claude -p`)
- [ ] Overnight queue + executor
- [ ] Digest generator (cron)
- [ ] Claude Desktop MCP integration
- [x] Phone PWA — Telegram bot provides mobile interface
- [ ] Child process tracking
- [x] Real-time WebSocket (replace polling)
- [ ] Editable file preview
- [ ] Terminal resize handling

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| Feb 17 | Worker model, not PM | Solo operator doesn't need formal methodology |
| Feb 17 | Process tree, not project tree | Need to see workers + their children |
| Feb 17 | YAML state files | Human-readable, git-friendly |
| Feb 17 | Polling before WebSocket | Start simple, upgrade if needed |
| Feb 20 | Polling terminal, not xterm.js | Simpler, good enough for MVP |
| Feb 22 | CLI helper over API-only | Workers need simple bash commands |
| Feb 23 | 3-column layout | Files + Activity more useful than duplicate terminals |
| Feb 23 | Setup scripts | Make shareable without manual steps |
| Feb 23 | Auto-discover projects | Scan for CLAUDE.md vs manual registry |
| Feb 23 | Tab-based terminals | Each worker gets its own tab |
| Mar 12 | threading over eventlet | eventlet monkey-patches subprocess, breaks tmux_manager |
| Mar 12 | WebSocket + REST hybrid | WebSocket for push, REST for actions + initial data |
| Mar 12 | Hash-based dedup | Server only emits when data actually changes |

---

*Last updated: March 13, 2026*
