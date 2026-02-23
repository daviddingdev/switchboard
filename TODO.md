# Orchestrator - Current Tasks

## Current Focus
**UI Redesign — Files, Activity, Simplified Layout**

Problems with current UI:
- Partner terminal shown twice (redundant)
- No file visibility across projects
- No view of what changed (git status)
- Proposals panel takes space even when empty
- Hard to understand what's happening across workers

---

## Quick Start (Next Session)

```bash
# SSH to Spark
ssh spark
cd ~/orchestrator

# Start Flask API (if not running)
cd ~/orchestrator/api && python3 server.py &

# Start Vite dev server
cd ~/orchestrator/web && npm run dev
```

**UI accessible at:** http://100.69.237.80:3001

---

## In Progress

### Phase 8: UI Redesign (3-Column Layout)

**New Layout:**
```
┌──────────────┬─────────────────────────────┬─────────────────┐
│ FILES        │ TERMINAL                    │ WORKERS         │
│              │                             │ • partner       │
│ [project ▼]  │ (selected worker)           │ • family-vault  │
│              │                             │                 │
│ ├─ CLAUDE.md │                             ├─────────────────┤
│ ├─ src/      │                             │ ACTIVITY        │
│ │  └─ ...    │                             │                 │
│ └─ docs/     │                             │ ⏳ Pending (1)  │
│              │                             │ 📝 Changes      │
│              │                             │ ✓ Recent        │
├──────────────┴─────────────────────────────┴─────────────────┤
│ [1][2][3][4][Y][N][Esc]              [Message...]     [Send] │
└──────────────────────────────────────────────────────────────┘
```

**API Additions:**
- [ ] `GET /api/projects` — List from state/projects.yaml
- [ ] `GET /api/files/<project>` — Recursive file tree (exclude .git, node_modules, etc.)
- [ ] `GET /api/changes` — Git status across all projects
- [ ] `GET /api/activity` — Combined: pending proposals + changes + recent

**New Components:**
- [ ] `FileTree.jsx` — Project dropdown + recursive file explorer
- [ ] `WorkerList.jsx` — Simplified worker list (click to select)
- [ ] `Activity.jsx` — Pending proposals + git changes + recent activity

**Modify:**
- [ ] `App.jsx` — New 3-column CSS grid layout
- [ ] `api.js` — Add fetchProjects, fetchFiles, fetchChanges, fetchActivity
- [ ] `index.css` — Grid styles

**Delete:**
- [ ] `ChatArea.jsx` — Replaced by single terminal in main panel
- [ ] `ProcessTree.jsx` — Replaced by WorkerList.jsx

**Keep & Reuse:**
- `ProposalCard.jsx` — Used inside Activity.jsx
- `Terminal.jsx` — Used in main panel
- `QuickActions.jsx` — Used in input bar
- `ChatInput.jsx` — Used in input bar
- `SpawnDialog.jsx` — Still needed for spawning workers

**Verification:**
```bash
# API tests
curl http://localhost:5001/api/projects
curl http://localhost:5001/api/files/orchestrator
curl http://localhost:5001/api/changes
curl http://localhost:5001/api/activity

# Visual tests
# - 3-column layout renders correctly
# - Project dropdown switches file trees
# - Worker selection switches terminal
# - Git changes appear in Activity
# - Proposals appear in Pending section
```

---

## Completed

### UI Polish (Feb 23, 2026)
- [x] Resizable panels (proposals, process tree, sidebar)
- [x] QuickActions component (1, 2, 3, 4, Y, N, Enter, Esc)
- [x] Worker terminal input field

### Proposals + WORKER.md (Feb 22, 2026)
- [x] Renamed "plan" to "proposal" (avoids Claude Code plan mode confusion)
- [x] Created `~/WORKER.md` — Instructions for workers
- [x] UI: collapsible proposals, resizable sidebar, delete button
- [x] All project CLAUDE.md files reference WORKER.md

### Partner Orchestration + SOUL Integration (Feb 22, 2026)
- [x] `scripts/orch` — CLI helper for partner automation
- [x] `state/projects.yaml` — Project registry
- [x] `POST /api/proposals` — Create proposals with auto_approve
- [x] CLAUDE.md — SOUL header + Partner Orchestration section
- [x] All project CLAUDE.md files updated with SOUL header

### Phases 4 & 5: Terminal + Chat/Plans (Feb 20, 2026)
- [x] `Terminal.jsx` — Polls output every 500ms, auto-scroll
- [x] `ChatArea.jsx` — Partner terminal + plan list
- [x] `PlanCard.jsx` — Status badges, approve/reject buttons
- [x] `ChatInput.jsx` — Send messages to partner
- [x] `ProcessTree.jsx` — Worker selection + highlighting
- [x] `App.jsx` — Sidebar terminal for selected worker
- [x] `api.js` — Plan API functions
- [x] `server.py` — GET/PATCH /api/plans endpoints
- [x] `state/plans/` directory created

### Phase 3: React Frontend (Feb 20, 2026)
- [x] `web/package.json` — Vite 5, React 18
- [x] `web/vite.config.js` — Dev server + API proxy
- [x] Layout: header, content area, sidebar
- [x] `ProcessTree.jsx` — List/kill workers with auto-refresh
- [x] `SpawnDialog.jsx` — Modal to spawn new workers
- [x] `api.js` — API client functions
- [x] Dark theme (zinc colors)
- [x] All 3 automated tests passed

### Phase 2: Backend Core (Feb 19, 2026)
- [x] `api/requirements.txt` — Flask 3.0, Flask-CORS, Flask-SocketIO, PyYAML
- [x] `api/tmux_manager.py` — tmux wrapper (spawn, kill, list, send, capture)
- [x] `api/server.py` — Flask API with all endpoints
- [x] All 11 verification tests passed

### Phase 1: Setup (Feb 17-18, 2026)
- [x] Infrastructure hardened (UPS, auto-boot, Tailscale)
- [x] SSH key auth from Mac to Spark
- [x] Directory structure created
- [x] CLAUDE.md with full context
- [x] Architecture doc
- [x] UI mockup
- [x] Git repo + pushed to GitHub

---

## Backlog (Post-MVP)

- [ ] File content preview (click file → view in modal)
- [ ] Non-interactive worker tasks (`claude -p` mode)
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
| Feb 17 | Plans inline in chat | Reduces context switching |
| Feb 17 | YAML state files | Human-readable, git-friendly |
| Feb 17 | Polling before WebSocket | Start simple, upgrade if needed |
| Feb 20 | Polling terminal, not xterm.js | Simpler, works well enough for MVP |
| Feb 22 | CLI helper over API-only | Partner needs simple bash commands |
| Feb 22 | SOUL.md as shared context | Reduces duplication across project CLAUDE.md files |
| Feb 22 | Number prompts for permissions | Arrow keys don't work via tmux send-keys |
| Feb 23 | 3-column layout | Files + Activity more useful than duplicate terminals |

---

*Last updated: February 23, 2026*
