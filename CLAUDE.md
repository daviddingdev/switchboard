# Orchestrator

Personal AI operating system for managing Claude Code sessions across projects.

> **Prerequisites:** `~/INFRASTRUCTURE.md`, `~/WORKER.md`

## Quick Start

```bash
./start.sh      # Start API + web server
./stop.sh       # Stop everything
```

**UI:** http://localhost:3000 — spawn workers, monitor sessions, manage proposals.

## Key Details

- **API port:** 5001 (workers use this to submit proposals)
- **tmux session:** `orchestrator` (socket: `-L orchestrator`, created on first worker spawn)
- **Projects:** Auto-discovered via CLAUDE.md presence
- **Workers:** All sessions are equal — spawn/kill any worker from the web UI. No always-on partner.

## Gotchas

- **Dates:** Use system prompt date (local time), not Spark timestamps (UTC)
- **Python:** Use `python3` not `python` on Spark
