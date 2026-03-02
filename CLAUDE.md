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

## Telegram Bot

Mobile control interface. Run: `python3 bot/telegram_bot.py` (or systemd: `orchestrator-telegram`)

| Command | Action |
|---------|--------|
| `/status` | API health + worker list |
| `/workers` | Workers with context usage bars |
| `/spawn <name> <dir>` | Spawn + auto /rc |
| `/kill <name>` | End-of-session → kill (60s delay) |
| `/kill_now <name>` | Immediate kill |
| `/send <name> <msg>` | Send to named worker |
| `/output <name>` | Recent terminal output |
| `/proposals` | Pending proposals |
| `/approve <id>` / `/reject <id>` | Proposal actions |
| `/ask <question>` | Route to Ollama |
| `/reset` | Soft reset partner |
| `/compact [name]` | Compact context (default: partner) |
| `/restart <name>` | Kill + respawn + re-enable /rc |
| *(plain text)* | Send to partner |

**Hooks:** `hooks/notify-telegram.sh` sends Stop + Notification events to Telegram via direct curl (async, no bot dependency).

## Gotchas

- **Dates:** Use system prompt date (local time), not Spark timestamps (UTC)
- **Python:** Use `python3` not `python` on Spark
