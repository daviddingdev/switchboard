# Switchboard

Manage AI coding agents across all your projects from one dashboard.

> **Warning:** Switchboard is designed for local/trusted network use. Optional password auth is available via `SWITCHBOARD_PASSWORD` but is not a substitute for proper network security. See [SECURITY.md](SECURITY.md).

Spawn and manage multiple Claude Code workers from one web UI. Monitor system metrics, track usage analytics with estimated API costs, browse and edit files — all in real-time via WebSocket.

## What It Does

- **Multi-worker management** — Spawn, monitor, and control Claude Code sessions from one interface
- **Real-time terminals** — Stream worker output via WebSocket with quick command buttons
- **File browser & editor** — Browse project files with syntax highlighting, git status badges, and inline editing
- **Activity panel** — Git changes, unpushed commits with push button, proposal review (approve/reject)
- **System monitor** — CPU, memory, GPU, disk, network, configurable services, and hardware health (thermal, SMART, power draw)
- **Usage analytics** — Token usage tracking with estimated API cost comparison, CSV export
- **Worker persistence** — Uptime tracking, model/spawn state survives API restarts
- **Historical logs** — View rotated worker log files from the UI
- **Browser notifications** — Get notified when workers go idle or are spawned/killed
- **Optional auth** — Single-password protection via `SWITCHBOARD_PASSWORD` env var
- **Keyboard shortcuts** — `n` spawn, `m` monitor, `u` usage, `?` help
- **Dark/light theme** — Toggle with persistence, including terminal colors
- **Mobile responsive** — Desktop 3-panel layout, mobile bottom nav

## How It Works

Switchboard runs on the machine where your Claude Code sessions live. It manages them via tmux and serves a web UI accessible from any browser.

```
  Browser (any device)
      │ WebSocket + REST
      ▼
  Switchboard server (:5001)
      │ subprocess
      ▼
  tmux → Claude Code workers
```

## Requirements

- Python 3.10+
- Node.js 18+
- tmux (`apt install tmux` or `brew install tmux`)
- Claude CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Max subscription (for Claude Code)

## Quick Start

```bash
git clone <your-repo-url>/switchboard.git
cd switchboard

# Install dependencies + build frontend
./setup.sh

# Start
./start.sh
```

Open http://localhost:5001 (or `http://<machine-ip>:5001` from another device).

See [QUICKSTART.md](QUICKSTART.md) for a full walkthrough including first session and example prompts.

## How Projects Are Discovered

Switchboard auto-discovers projects by scanning `~` for directories containing a `CLAUDE.md` file. No manual configuration needed.

To add a project: create a `CLAUDE.md` file in its root directory.

## Configuration

Copy `config.yaml.example` to `config.yaml` to customize:

- **Server** — port, host
- **Models** — Claude models available in spawn dialog
- **Monitor** — GPU command, tracked services, disk path, SMART device
- **Pricing** — API cost estimation rates per model
- **Platform dashboard** — optional integration for system updates

See `config.yaml.example` for all options with inline documentation.

## Authentication

By default, Switchboard has no authentication (same as always). To enable single-password auth:

```bash
SWITCHBOARD_PASSWORD=your-password ./start.sh
```

This protects all API endpoints and WebSocket connections with session cookies. Unset the variable to disable auth. A persistent secret key is auto-generated in `state/secret.key` so sessions survive API restarts.

## Stopping

```bash
./stop.sh
```

To fully kill the tmux session:
```bash
tmux -L switchboard kill-session -t switchboard
```

## Project Structure

```
switchboard/
├── api/              # Flask-SocketIO backend
│   ├── server.py     # API + WebSocket endpoints
│   └── tmux_manager.py
├── web/              # React frontend (Vite)
│   └── src/
├── scripts/          # CLI helper, systemd, usage compute
├── state/            # Runtime state (usage archive)
├── docs/             # Architecture docs
├── contrib/          # Optional integrations (Telegram bot)
├── setup.sh          # Install dependencies
├── start.sh          # Launch Switchboard
└── stop.sh           # Stop Switchboard
```

## Documentation

- [QUICKSTART.md](QUICKSTART.md) — Setup checklist, first session, usage patterns
- [docs/SETUP.md](docs/SETUP.md) — Detailed setup for Linux/macOS
- [docs/architecture.md](docs/architecture.md) — Technical design
- [CONTRIBUTING.md](CONTRIBUTING.md) — Development guide
- [SECURITY.md](SECURITY.md) — Security model

## License

MIT
