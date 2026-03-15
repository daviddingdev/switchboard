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

3. **Watch it start** — The terminal tab opens automatically. You'll see Claude Code loading, then its input prompt.

4. **Send a message** — Type in the input bar at the bottom and press Enter. Try something simple:
   ```
   What files are in this project?
   ```

5. **See results** — Terminal streams output in real-time. When Claude is done, you'll see the `>` prompt again.

6. **Check Activity** — The right panel shows git changes, pending proposals, and unpushed commits across all projects.

## Key Workflows

### Managing Multiple Workers

Spawn workers in different projects to work in parallel. Each gets its own terminal tab.

- **Spawn**: Click +Spawn or press `n`
- **Switch**: Click terminal tabs to switch between workers
- **Kill**: Click the X on a worker card, or use the kill button
- **Send to any**: Select a worker, type in the input bar

### Proposals

Workers can submit proposals for your approval before taking action:

```bash
# From a worker's perspective, it POSTs to the API:
curl -X POST http://localhost:5001/api/proposals \
  -H "Content-Type: application/json" \
  -d '{"id": "refactor-auth", "title": "Refactor auth module", "worker": "my-project"}'
```

You approve or reject in the Activity panel (right side).

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

### Quick Actions

When viewing a worker's terminal, use the quick action buttons:
- **Y / N** — Quick approve/reject (sends text + Enter)
- **1-4** — Send numbered responses
- **Esc** — Send Escape key to terminal
- **Shift+click** — Populate input bar instead of sending immediately

## Example Prompts for Workers

### Starting a new feature
```
Add a dark mode toggle to the settings page. Use CSS variables for theming.
```

### Bug investigation
```
The login form submits twice on click. Investigate and fix the root cause.
```

### Code review
```
Review the changes in the last 3 commits. Flag any security issues or bugs.
```

### Refactoring
```
Refactor the API routes in server.py to use blueprints. Keep all existing behavior.
```

### Documentation
```
Update the README to reflect the new CLI flags added in the last release.
```

### Testing
```
Write unit tests for the auth module. Cover the login, logout, and token refresh flows.
```

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
helm proposals               # List proposals
helm approve <id>            # Approve proposal
```

Override the API URL: `export HELM_URL=http://other-machine:5001`
