# Orchestrator - Current Tasks

## Current Focus
**MVP Build Phase — Flask API + tmux manager**

Building the orchestrator UI that lets David:
- Talk to a Partner (Claude Code) via chat
- Spawn/monitor worker sessions
- Approve plans inline
- See process tree

---

## Quick Start (Next Session)

```bash
# SSH to Spark
ssh spark
cd ~/orchestrator

# Check what exists
ls -la

# Start Claude Code
claude
```

---

## In Progress

### Phase 3: React Frontend
- [ ] Initialize Vite + React in `web/`
- [ ] Create layout (chat left, sidebar right)
- [ ] Process tree component
- [ ] Wire to API

### Phase 4: Terminal Integration
- [ ] xterm.js component
- [ ] WebSocket for terminal streaming
- [ ] Connect to tmux output

### Phase 5: Chat + Plans
- [ ] Chat message components
- [ ] Plan card with approve/reject
- [ ] Plan detection from workers

---

## Completed

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

*Last updated: February 19, 2026*
