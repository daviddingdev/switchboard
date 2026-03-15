# Helm

Personal AI operating system for managing Claude Code sessions across projects.

Spawn and manage multiple Claude Code workers from one web UI. Monitor system metrics, track usage analytics with estimated API costs, approve worker proposals, and browse files — all in real-time via WebSocket.

## What It Does

- **Multi-worker management** — Spawn, kill, and message Claude Code sessions from one interface
- **Real-time terminals** — Stream worker output via WebSocket, no polling
- **File browser** — Browse project files with syntax highlighting and git status badges
- **Proposals** — Workers submit proposals for approval before taking action
- **System monitor** — CPU, memory, GPU, disk, network, and configurable services
- **Usage analytics** — Token usage tracking with estimated API cost comparison
- **Keyboard shortcuts** — `n` spawn, `m` monitor, `u` usage, `?` help
- **Dark/light theme** — Toggle with persistence, including terminal colors
- **Mobile responsive** — Desktop 3-panel layout, mobile bottom nav

## How It Works

Helm runs on the machine where your Claude Code sessions live. It manages them via tmux and serves a web UI accessible from any browser.

```
  Browser (any device)
      │ WebSocket + REST
      ▼
  Helm server (:5001)
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
git clone <your-repo-url>/helm.git
cd helm

# Install dependencies + build frontend
./setup.sh

# Start
./start.sh
```

Open http://localhost:5001 (or `http://<machine-ip>:5001` from another device).

See [QUICKSTART.md](QUICKSTART.md) for a full walkthrough including first session and example prompts.

## How Projects Are Discovered

Helm auto-discovers projects by scanning `~` for directories containing a `CLAUDE.md` file. No manual configuration needed.

To add a project: create a `CLAUDE.md` file in its root directory.

## Configuration

Copy `config.yaml.example` to `config.yaml` to customize:

- **Server** — port, host
- **Models** — Claude models available in spawn dialog
- **Monitor** — GPU command, tracked services, disk path
- **Pricing** — API cost estimation rates per model
- **Platform dashboard** — optional integration for system updates

See `config.yaml.example` for all options with inline documentation.

## Stopping

```bash
./stop.sh
```

To fully kill the tmux session:
```bash
tmux -L helm kill-session -t helm
```

## Project Structure

```
helm/
├── api/              # Flask-SocketIO backend
│   ├── server.py     # API + WebSocket endpoints
│   └── tmux_manager.py
├── web/              # React frontend (Vite)
│   └── src/
├── scripts/          # CLI helper, systemd, usage compute
├── state/            # Runtime state (proposals, usage archive)
├── docs/             # Architecture docs
├── contrib/          # Optional integrations (Telegram bot)
├── setup.sh          # Install dependencies
├── start.sh          # Launch Helm
└── stop.sh           # Stop Helm
```

## Documentation

- [QUICKSTART.md](QUICKSTART.md) — Setup checklist, first session, usage patterns
- [docs/SETUP.md](docs/SETUP.md) — Detailed setup for Linux/macOS
- [docs/architecture.md](docs/architecture.md) — Technical design
- [CONTRIBUTING.md](CONTRIBUTING.md) — Development guide
- [SECURITY.md](SECURITY.md) — Security model

## License

MIT
