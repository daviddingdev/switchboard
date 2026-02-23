# Orchestrator

Personal AI operating system for managing Claude Code sessions across projects.

> **Prerequisites:** `~/INFRASTRUCTURE.md`, `~/WORKER.md`

## Quick Start

```bash
./start.sh      # Start API + web + tmux
./stop.sh       # Stop everything
```

**UI:** http://localhost:3000

## Key Details

- **API port:** 5001 (workers use this to submit proposals)
- **tmux session:** `orchestrator` (socket: `/tmp/orchestrator.sock`)
- **Projects:** Auto-discovered via CLAUDE.md presence

## Plan Mode

When in plan mode, after writing the plan file, post it to the preview API so it opens in the UI:

```bash
curl -s -X POST http://localhost:5001/api/preview \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg c "$(cat /path/to/plan.md)" --arg t "Plan: Title" \
    '{content: $c, title: $t, language: "markdown"}')"
```

Then use ExitPlanMode for approval.

## Gotchas

- **Dates:** Use system prompt date (local time), not Spark timestamps (UTC)
- **Python:** Use `python3` not `python` on Spark
