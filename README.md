# Orchestrator

Personal AI operating system for managing Claude Code sessions across projects.

## What It Does

- Spawn and manage multiple Claude Code workers from one UI
- See file trees and git changes across projects
- Approve/reject worker proposals
- Coordinate tasks via Partner session

## Requirements

- Linux or macOS
- Python 3.10+
- Node.js 18+
- tmux
- Claude CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Max subscription (for Claude Code)

## Quick Start

```bash
# Clone
git clone https://github.com/yourusername/orchestrator.git
cd orchestrator

# Setup (installs Python + Node dependencies)
chmod +x setup.sh start.sh stop.sh
./setup.sh

# Run
./start.sh
```

Open http://localhost:3000

## How Projects Are Discovered

Orchestrator auto-discovers projects by scanning `~` for directories containing a `CLAUDE.md` file. No manual configuration needed.

To add a project: create a `CLAUDE.md` file in its root directory.

## Usage

1. Click **+Spawn** to create a worker in a project directory
2. Select worker in right panel to see its terminal
3. Send messages via input bar at bottom
4. View pending proposals and git changes in Activity panel
5. Approve/reject proposals with buttons or quick actions (Y/N)

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

To change ports, edit:
- `web/vite.config.js` for web UI port
- `api/server.py` (bottom of file) for API port

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

## macOS Notes

- Install tmux: `brew install tmux`
- Python 3 comes with Xcode CLI tools, or install via `brew install python`
- Node.js: `brew install node` or use nvm

## License

MIT
