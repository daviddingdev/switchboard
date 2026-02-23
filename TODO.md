# Orchestrator - Current Tasks

## Current Focus
**MVP Complete — Ready for Self-Orchestration**

Core functionality working:
- 3-column UI: Files | Terminal | Workers+Activity
- Tab-based navigation: multiple terminals + file previews
- Auto-discover projects with CLAUDE.md files
- Git status indicators (M/U/A/D) on files
- Syntax-highlighted file preview
- Spawn/kill workers, send messages
- Approve/reject worker proposals
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

## Backlog (Post-MVP)

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

*Last updated: February 23, 2026*
