# Switchboard

Personal AI operating system for managing Claude Code sessions across projects.

## Quick Start

```bash
./start.sh      # Start API + web server
./stop.sh       # Stop everything
```

**UI:** http://localhost:5001 — spawn workers, monitor sessions.

## Key Details

- **API port:** 5001 (workers use this to submit proposals)
- **tmux session:** `switchboard` (socket: `-L switchboard`, created on first worker spawn)
- **Projects:** Auto-discovered via CLAUDE.md presence
- **Workers:** All sessions are equal — spawn/kill any worker from the web UI
