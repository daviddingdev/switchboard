# Orchestrator Setup Guide

Detailed setup instructions for Linux and macOS.

## Prerequisites

### macOS

```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install tmux python node

# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify
python3 --version   # Should be 3.10+
node --version      # Should be 18+
tmux -V
claude --version
```

### Linux (Ubuntu/Debian)

```bash
# Install dependencies
sudo apt update
sudo apt install tmux python3 python3-pip nodejs npm

# Install Claude CLI
npm install -g @anthropic-ai/claude-code

# Verify
python3 --version
node --version
tmux -V
claude --version
```

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/orchestrator.git
cd orchestrator

# Make scripts executable
chmod +x setup.sh start.sh stop.sh

# Run setup (installs Python + Node dependencies)
./setup.sh
```

## Running

```bash
# Start all services
./start.sh

# Open in browser
open http://localhost:3000  # macOS
xdg-open http://localhost:3000  # Linux
```

## Stopping

```bash
# Stop API and web server (keeps tmux session)
./stop.sh

# Fully kill tmux session
tmux -L orchestrator kill-session -t orchestrator
```

## Port Conflicts

### Web UI (default: 3000)

If port 3000 is in use, edit `web/vite.config.js`:

```js
export default defineConfig({
  // ...
  server: {
    port: 3001,  // Change to available port
    // ...
  }
})
```

### API (default: 5001)

If port 5001 is in use, edit `api/server.py` (last line):

```python
app.run(host='0.0.0.0', port=5002, debug=True)  # Change port
```

Then update the proxy in `web/vite.config.js`:

```js
proxy: {
  '/api': 'http://localhost:5002'  // Match new API port
}
```

## Project Discovery

Orchestrator automatically finds projects by scanning your home directory for folders containing a `CLAUDE.md` file.

To add a project:
1. Create a `CLAUDE.md` file in the project root
2. Restart orchestrator (or it will be picked up on next API call)

Example minimal `CLAUDE.md`:
```markdown
# My Project

Brief description of the project for Claude context.
```

## Troubleshooting

### "claude: command not found"

```bash
npm install -g @anthropic-ai/claude-code
```

Or check your PATH includes npm global bin:
```bash
export PATH="$PATH:$(npm bin -g)"
```

### "tmux: command not found"

```bash
# macOS
brew install tmux

# Linux
sudo apt install tmux
```

### API won't start

Check logs:
```bash
cat logs/api.log
```

Common issues:
- Port 5001 already in use
- Missing Python dependencies: `pip3 install -r api/requirements.txt`

### Web UI won't start

Check logs:
```bash
cat logs/web.log
```

Common issues:
- Port 3000 already in use
- Missing Node dependencies: `cd web && npm install`

### "No projects found"

Create a `CLAUDE.md` file in at least one project directory under `~`.

### tmux session issues

List sessions:
```bash
tmux -L orchestrator list-sessions
```

Attach to partner:
```bash
tmux -L orchestrator attach -t orchestrator:partner
```

Kill and restart:
```bash
tmux -L orchestrator kill-session -t orchestrator
./start.sh
```
