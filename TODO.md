# Orchestrator - Current Tasks

## Current Focus
**MVP Complete — Ready for Testing**

Core functionality working:
- 3-column UI: Files | Terminal | Workers+Activity
- Spawn/kill workers, send messages
- View file trees and git changes across projects
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
- [x] `FileTree.jsx` — Project dropdown + file explorer
- [x] `WorkerList.jsx` — Simplified worker list
- [x] `Activity.jsx` — Pending, changes, recent
- [x] `GET /api/projects` — List projects
- [x] `GET /api/files/<project>` — File tree
- [x] `GET /api/changes` — Git status
- [x] `GET /api/activity` — Combined feed
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

- [ ] File content preview (click file → view)
- [ ] Non-interactive worker tasks (`claude -p`)
- [ ] Overnight queue + executor
- [ ] Digest generator (cron)
- [ ] Claude Desktop MCP integration
- [ ] Phone PWA
- [ ] Child process tracking
- [ ] Real-time WebSocket updates

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

---

*Last updated: February 23, 2026*
