# Orchestrator - Current Tasks

## Current Focus
**Partner Autonomy & Worker Interaction**

Core MVP + partner orchestration complete:
- Partner can spawn/kill workers via `orch` CLI
- Partner can send tasks and monitor output
- Auto-approve plans for routine tasks
- All project CLAUDE.md files have SOUL.md header

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

# Partner orchestration
./scripts/orch list          # List workers
./scripts/orch projects      # List known projects
```

**UI accessible at:** http://100.69.237.80:3000

---

## In Progress

### Phase 7: Non-Interactive Worker Tasks
- [ ] Add `orch task` command for non-interactive execution (`claude -p`)
- [ ] Auto-respond to permission prompts (send "2" for "Yes, don't ask again")
- [ ] Worker completion detection (poll for idle prompt)

---

## Completed

### Partner Orchestration + SOUL Integration (Feb 22, 2026)
- [x] `scripts/orch` — CLI helper for partner automation
- [x] `state/projects.yaml` — Project registry
- [x] `POST /api/plans` — Create plans with auto_approve
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

- [ ] Overnight queue + executor
- [ ] Digest generator (cron)
- [ ] Claude Desktop MCP integration
- [ ] Phone PWA
- [ ] Child process tracking

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| Feb 17 | Partner model, not PM | Solo operator doesn't need formal methodology |
| Feb 17 | Process tree, not project tree | Need to see workers + their children |
| Feb 17 | Plans inline in chat | Reduces context switching |
| Feb 17 | YAML state files | Human-readable, git-friendly |
| Feb 17 | Polling before WebSocket | Start simple, upgrade if needed |

---

| Feb 20 | Polling terminal, not xterm.js | Simpler, works well enough for MVP |
| Feb 22 | CLI helper over API-only | Partner needs simple bash commands |
| Feb 22 | SOUL.md as shared context | Reduces duplication across project CLAUDE.md files |
| Feb 22 | Number prompts for permissions | Arrow keys don't work via tmux send-keys |

---

*Last updated: February 22, 2026*
