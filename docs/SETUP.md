# Orchestrator Setup Guide

Orchestrator runs on the machine where your Claude Code sessions live (Linux box, Mac, always-on PC). The web UI is accessed from any browser on any device.

## Prerequisites

Install these on the machine that will run Claude Code:

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install tmux python3 python3-pip nodejs npm

npm install -g @anthropic-ai/claude-code
```

### macOS

```bash
brew install tmux python node

npm install -g @anthropic-ai/claude-code
```

### Verify

```bash
python3 --version   # 3.10+
node --version      # 18+
tmux -V
claude --version
```

## Installation

```bash
git clone https://github.com/dingod/orchestrator.git
cd orchestrator

chmod +x setup.sh start.sh stop.sh
./setup.sh
```

## Running

```bash
./start.sh
```

Access the UI:
- Same machine: http://localhost:3000
- Other devices: http://\<machine-ip\>:3000

## Configuration

Copy `config.yaml.example` to `config.yaml` (done automatically by `setup.sh`).

Key settings:
- `port` — API port (default: 5001)
- `monitor.gpu` — GPU monitoring command, or `enabled: false` to hide
- `monitor.services` — processes to track (default: Ollama)
- `monitor.disk_path` — mount point to monitor (default: `/`)
- `spark` — optional platform dashboard integration

See `config.yaml.example` for all options with inline docs.

### Changing Ports

API port: edit `port` in `config.yaml`

Web UI port: edit `web/vite.config.js`:
```js
server: {
  port: 3001,  // Change to available port
}
```

## Stopping

```bash
./stop.sh

# To fully kill the tmux session:
tmux -L orchestrator kill-session -t orchestrator
```

## Project Discovery

Orchestrator auto-discovers projects by scanning `~` for directories containing a `CLAUDE.md` file.

To add a project: create a `CLAUDE.md` in its root.

```markdown
# My Project

Brief description for Claude context.
```

## System Updates (Linux only)

The Monitor tab can check for and apply apt/snap updates. For non-interactive updates, configure passwordless sudo:

```bash
sudo bash scripts/setup-sudo.sh
```

Or manually:
```bash
sudo visudo -f /etc/sudoers.d/orchestrator-updates
# Add: <username> ALL=(ALL) NOPASSWD: /usr/bin/apt-get update *, /usr/bin/apt-get upgrade *, /usr/bin/snap refresh *
```

This feature is automatically hidden on macOS and Windows.

## Troubleshooting

### "claude: command not found"

```bash
npm install -g @anthropic-ai/claude-code
# Or check PATH:
export PATH="$PATH:$(npm bin -g)"
```

### "tmux: command not found"

```bash
# Ubuntu/Debian
sudo apt install tmux

# macOS
brew install tmux
```

### API won't start

```bash
cat logs/api.log
```

Common: port 5001 in use, missing Python deps (`pip3 install -r api/requirements.txt`).

### Web UI won't load

```bash
cat logs/web.log
```

Common: port 3000 in use, missing Node deps (`cd web && npm install`).

### tmux session issues

```bash
tmux -L orchestrator list-sessions              # List sessions
tmux -L orchestrator attach -t orchestrator      # Attach
tmux -L orchestrator kill-session -t orchestrator # Kill all
```
