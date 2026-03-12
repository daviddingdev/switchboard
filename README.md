# Orchestrator

Personal AI operating system for managing Claude Code sessions across projects.

## What It Does

- Spawn and manage multiple Claude Code workers from one UI
- See file trees and git changes across projects
- Approve/reject worker proposals
- Monitor system metrics (CPU, memory, GPU, disk, services)
- Track usage analytics across all sessions

## How It Works

Orchestrator runs on the machine where your Claude Code sessions live. It manages them via tmux and serves a web UI you can access from any browser — your laptop, phone, or any device on the network.

```
  Browser (any device)
      │
      ▼
  Orchestrator server (on your Linux/macOS machine)
      │
      ▼
  tmux → Claude Code workers
```

## Requirements

On the machine running Claude Code:

- Python 3.10+
- Node.js 18+
- tmux (`apt install tmux` or `brew install tmux`)
- Claude CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Max subscription (for Claude Code)

## Quick Start

```bash
# Clone
git clone https://github.com/dingod/orchestrator.git
cd orchestrator

# Setup (installs Python + Node dependencies)
chmod +x setup.sh start.sh stop.sh
./setup.sh

# Run
./start.sh
```

Open http://localhost:3000 (or `http://<machine-ip>:3000` from another device)

## How Projects Are Discovered

Orchestrator auto-discovers projects by scanning `~` for directories containing a `CLAUDE.md` file. No manual configuration needed.

To add a project: create a `CLAUDE.md` file in its root directory.

## Usage

1. Click **+Spawn** to create a worker in a project directory
2. Select worker in right panel to see its terminal
3. Send messages via input bar at bottom
4. View pending proposals and git changes in Activity panel
5. Approve/reject proposals with buttons or quick actions (Y/N)

## Configuration

Copy `config.yaml.example` to `config.yaml` to customize:

- **Server** — port, host
- **Models** — Claude models available in spawn dialog
- **Monitor** — GPU command, tracked services, disk path
- **Platform dashboard** — optional integration for system updates

See `config.yaml.example` for all options with inline documentation.

## Stopping

```bash
./stop.sh
```

To fully kill the tmux session:
```bash
tmux -L orchestrator kill-session -t orchestrator
```

## Ports

| Service | Default Port |
|---------|--------------|
| Web UI  | 3000         |
| API     | 5001         |

## Architecture

See `docs/architecture.md` for technical design.

## Project Structure

```
orchestrator/
├── api/              # Flask backend
│   ├── server.py     # API endpoints
│   └── tmux_manager.py
├── web/              # React frontend
│   └── src/
├── state/            # Runtime state
│   └── proposals/    # Worker proposals
├── docs/             # Documentation
├── logs/             # Runtime logs
├── setup.sh          # Install dependencies
├── start.sh          # Launch orchestrator
└── stop.sh           # Stop orchestrator
```

## License

MIT
