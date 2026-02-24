# Orchestrator - Current Tasks

## Current Focus
**MVP Complete — Ready for Self-Orchestration**

Core functionality working:
- 3-column UI: Files | Terminal | Workers+Activity
- Tab-based navigation: multiple terminals + file previews
- Auto-discover projects with CLAUDE.md files
- Git status indicators (M/U/A/D) on files
- Syntax-highlighted file preview + diff preview
- Spawn/kill workers, send messages
- Approve/reject worker proposals
- Quick actions: 1-4, Y/N, Enter, Esc, Plan
- Unpushed commits tracking in Activity panel
- Shareable setup with setup.sh/start.sh/stop.sh

---

## Quick Start

```bash
cd ~/orchestrator
./start.sh
```

**UI accessible at:** http://localhost:3000

---

## Completed

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

### Partner Context Management (Feb 23, 2026)
- [x] Context usage meter in Activity panel — shows % for each worker
- [x] Partner history viewer — tab showing filtered conversation messages
- [x] Partner reset button — soft reset to restart session
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
- [x] Worker terminals open as separate tabs (not replacing partner)
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

### Partner Orchestration (Feb 22, 2026)
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
- [ ] **Plan mode awareness in web UI** — Detect when Claude Code is showing a plan approval prompt and show approve/reject buttons instead of text input. Currently, typing in the chat box during plan mode sends raw text to tmux, which Claude Code misinterprets (e.g., "4 test comment" got interpreted as approval)

## Backlog (Post-MVP)
- [ ] **Push workflow: orphaned doc changes** — When "Update Docs" runs but user doesn't complete "Push All", modified CHANGELOG/TODO files are left uncommitted. Need to either: (a) auto-stash on cancel, (b) commit immediately after update, or (c) warn user about uncommitted changes
- [ ] Non-interactive worker tasks (`claude -p`)
- [ ] Overnight queue + executor
- [ ] Digest generator (cron)
- [ ] Claude Desktop MCP integration
- [ ] Phone PWA
- [ ] Child process tracking
- [ ] Real-time WebSocket (replace polling)
- [ ] Editable file preview
- [ ] Terminal resize handling

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| Feb 17 | Partner model, not PM | Solo operator doesn't need formal methodology |
| Feb 17 | Process tree, not project tree | Need to see workers + their children |
| Feb 17 | YAML state files | Human-readable, git-friendly |
| Feb 17 | Polling before WebSocket | Start simple, upgrade if needed |
| Feb 20 | Polling terminal, not xterm.js | Simpler, good enough for MVP |
| Feb 22 | CLI helper over API-only | Partner needs simple bash commands |
| Feb 23 | 3-column layout | Files + Activity more useful than duplicate terminals |
| Feb 23 | Setup scripts | Make shareable without manual steps |
| Feb 23 | Auto-discover projects | Scan for CLAUDE.md vs manual registry |
| Feb 23 | Tab-based terminals | Workers as tabs, not replacing partner |

---

*Last updated: February 24, 2026*
