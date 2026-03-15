# Helm Quick Start

## Setup Checklist

- [ ] Python 3.10+ installed (`python3 --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] tmux installed (`tmux -V`)
- [ ] Claude CLI installed (`claude --version`)
- [ ] Claude Max subscription active
- [ ] Run `./setup.sh` (installs deps, builds frontend)
- [ ] Run `./start.sh` (starts server)
- [ ] Open http://localhost:5001 in browser
- [ ] At least one project has a `CLAUDE.md` file

## Your First Session

1. **Open the UI** — http://localhost:5001 (or `http://<machine-ip>:5001` from another device)

2. **Spawn a worker** — Click **+Spawn** (or press `n`). Pick a project and click Spawn.

3. **Watch it work** — Click the **Term** button on the worker card to open a terminal tab streaming the worker's output in real-time.

4. **Interact via remote control** — Workers start with remote control (`/rc`) enabled. Use Claude Code's remote-control feature to send tasks, or use the worker card buttons (RC, Compact, Reset, Kill).

5. **Check Activity** — The right panel shows git changes and unpushed commits across all projects.

## Key Workflows

### Managing Multiple Workers

Spawn workers in different projects to work in parallel. Each gets its own terminal tab.

- **Spawn**: Click +Spawn or press `n`
- **Switch**: Click terminal tabs to switch between workers
- **Kill**: Use the Kill button on the worker card
- **Actions**: Use worker card buttons — RC, Compact, Reset, Kill

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | Open spawn dialog |
| `m` | Open system monitor |
| `u` | Open usage analytics |
| `Esc` | Close current dialog/tab |
| `?` | Show all shortcuts |

### System Monitor

Press `m` to see CPU, memory, GPU, disk, network stats. Configure which services to track in `config.yaml`:

```yaml
monitor:
  services:
    - name: "Ollama"
      process: "ollama"
    - name: "Postgres"
      process: "postgres"
```

### Usage Analytics

Press `u` to see token usage across all sessions. Features:
- Time range filtering (7d / 30d / 90d / 6m / 1y / All)
- Estimated API costs per model
- Activity and cost trend charts
- Breakdown by project, model, and hour

## Tips

- **Multiple workers per project** — You can spawn multiple workers in the same project. They get auto-incremented names (e.g., `myproject`, `myproject-2`).

- **Project discovery** — Helm finds projects by scanning `~` for `CLAUDE.md` files (configurable depth). Create a `CLAUDE.md` in any directory to make it appear in the spawn dialog.

- **Mobile access** — Open `http://<machine-ip>:5001` on your phone. The UI adapts with a bottom navigation bar.

- **Remote control** — Workers start with `/rc` mode enabled by default, allowing remote command execution via the API.

- **Session persistence** — Workers run in tmux. If the web UI disconnects, workers keep running. Reconnect to see them again.

- **Config changes** — After editing `config.yaml`, restart with `./stop.sh && ./start.sh`.

- **API costs** — The Usage tab estimates what your usage would cost on API billing. Useful for evaluating Max subscription vs pay-per-use. Configure rates in `config.yaml`.

## CLI Helper

The `scripts/helm` CLI lets you manage workers from the command line:

```bash
# Add to PATH
export PATH="$PATH:$(pwd)/scripts"

# Usage
helm list                    # List workers
helm spawn myworker ~/proj   # Spawn worker
helm send myworker "fix bug" # Send message
helm output myworker         # View output
helm kill myworker           # Kill worker
helm proposals               # List proposals (API only, no UI yet)
helm approve <id>            # Approve proposal (API only, no UI yet)
```

Override the API URL: `export HELM_URL=http://other-machine:5001`
