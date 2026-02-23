# Orchestrator

Personal AI operating system for managing Claude Code sessions across projects.

## What It Does

- Spawn and manage multiple Claude Code workers from one UI
- See file trees and git changes across projects
- Approve/reject worker proposals
- Coordinate tasks via Partner session

## Requirements

- Linux/macOS
- Python 3.10+
- Node.js 18+
- tmux
- Claude CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Max subscription (for Claude Code)

## Quick Start

```bash
# Clone
git clone https://github.com/daviddingstudent-create/orchestrator.git
cd orchestrator

# Setup
chmod +x setup.sh start.sh stop.sh
./setup.sh

# Configure your projects
cp state/projects.example.yaml state/projects.yaml
# Edit state/projects.yaml with your project paths

# Run
./start.sh
```

Open http://localhost:3000

## Optional: SOUL.md

Create `~/SOUL.md` with working style preferences for Claude. See `docs/SOUL.example.md` for format. If not present, orchestrator runs without it.

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
│   ├── projects.yaml # Your project config
│   └── proposals/    # Worker proposals
├── docs/             # Documentation
├── logs/             # Runtime logs
├── setup.sh          # Install dependencies
├── start.sh          # Launch orchestrator
└── stop.sh           # Stop orchestrator
```

## License

MIT
