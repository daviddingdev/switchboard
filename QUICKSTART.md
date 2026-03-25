# Switchboard Quick Start

## Setup Checklist

- [ ] Python 3.10+ installed (`python3 --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] tmux installed (`tmux -V`)
- [ ] Claude CLI installed (`claude --version`)
- [ ] Claude Max subscription active
- [ ] Run `./setup.sh` (installs deps, builds frontend, configures hooks)
- [ ] Run `./start.sh` (starts server)
- [ ] Open http://localhost:5001 in browser
- [ ] At least one project has a `CLAUDE.md` file

## First Run — Setup Wizard

On first launch, Switchboard shows a guided setup wizard:

1. **Prerequisites** — Checks for Claude CLI and tmux. If Claude CLI is missing, shows expanded guidance (account signup, Max subscription, install command, login). If installed but not logged in, shows a login prompt. Re-check button to retry after installing.
2. **Password + Contributor** — Optionally set a dashboard password (skippable if you're on a private network). Contributor checkbox includes Switchboard in the project list.
3. **Working Style (SOUL.md)** — Pre-filled with a default template including session naming convention and Claude Code tips. Continue saves, Skip bypasses file creation.
4. **Infrastructure (INFRASTRUCTURE.md)** — Pre-filled with port/service template. Optional "Quick Scan" paste field for `lsof` output. Continue saves, Skip bypasses file creation.
5. **Done** — Summary, "Apply to Global Config" buttons to add references to `~/.claude/CLAUDE.md`, next steps.

All steps are skippable — you can complete the wizard in 5 clicks. Textareas contain real defaults you can edit before saving.

## Your First Session

1. **Open the UI** — http://localhost:5001 (or `http://<machine-ip>:5001` from another device)

2. **Spawn a worker** — Click **+Spawn** (or press `n`). Pick a project, choose a model, and click Spawn.

3. **Watch it work** — Click the **Term** button on the worker card to open a terminal tab streaming the worker's output in real-time.

4. **Interact via remote control** — Workers start with remote control (`/rc`) enabled. Use Claude Code's remote-control feature to send tasks, or use the worker card buttons — Remote, Compact, Interrupt, Kill.

5. **Check Activity** — The right panel shows git changes, unpushed commits (expandable to see changed files), and pending proposals.

## Key Workflows

### Managing Multiple Workers

Spawn workers in different projects to work in parallel. Each gets its own terminal tab.

- **Spawn**: Click +Spawn or press `n`
- **Switch**: Click terminal tabs to switch between workers
- **Kill**: Use the Kill button on the worker card
- **Interrupt**: Send Ctrl+C to a worker (formerly "Reset")
- **Actions**: Remote (enable remote control), Compact, Interrupt, Kill

### Terminal Features

- **Quick command buttons** — y/n, 1-3, Enter, Esc, Ctrl+C for fast interaction
- **Text input** — Type and send custom text to the worker
- **Search** — Click the search icon to find text in terminal output with match highlighting and prev/next navigation
- **Load more** — Click "Load more" at the top of terminal output to fetch additional history (up to 1000 lines)

### File Browser & Editor

Browse project files in the left panel. Click a file to preview with syntax highlighting. Click **Edit** to modify files directly in the browser (last-write-wins).

- Git status badges show modified (M), untracked (U), added (A), deleted (D) files
- Click changed files in the Activity panel to view diffs

### Activity Panel

The right panel shows:
- **Changed files** — Uncommitted changes across all projects, click to view diffs
- **Unpushed commits** — Click a commit to expand and see changed files with status badges. Push button to push.
- **Proposals** — Review and approve/reject worker proposals

### Historical Logs

Click the **Logs** button on a worker card to view rotated log files from previous sessions. Logs include a text filter for searching through output.

### Browser Notifications

Click the **Notifs** button in the header to enable browser notifications. You'll be notified when:
- A worker goes idle (waiting for input)
- A worker is spawned or killed

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `n` | Open spawn dialog |
| `m` | Open system monitor |
| `u` | Open usage analytics |
| `Esc` | Close current dialog/tab |
| `?` | Show all shortcuts |

### System Monitor

Press `m` to see CPU, memory, GPU, disk, network stats, and hardware health. Configure in `config.yaml`:

```yaml
monitor:
  services:
    - name: "Ollama"
      process: "ollama"
    - name: "Postgres"
      process: "postgres"
  smart:
    device: "/dev/nvme0n1"    # NVMe SMART health (requires smartctl + sudo)
```

CPU temperature, GPU power draw, and NVMe temperature appear automatically when sensors are available. SMART disk health (life used, spare capacity, power-on hours) requires `smartctl` with passwordless sudo — see [docs/SETUP.md](docs/SETUP.md#smart-disk-health-monitoring-linux-only) for setup.

### Usage Analytics

Press `u` to see token usage across all sessions. Features:
- Time range filtering (7d / 30d / 90d / 6m / 1y / All)
- Estimated API costs per model
- Activity and cost trend charts
- Breakdown by project, model, and hour
- CSV export of usage data

## Authentication

Set a password during the **Setup Wizard** on first run, or via environment variable:

```bash
SWITCHBOARD_PASSWORD=your-password ./start.sh
```

The env var takes precedence over the wizard-configured password. Logout button appears in the header when auth is enabled.

## Auto-Start on Login

To have Switchboard start automatically when you log in:

```bash
./scripts/setup-autostart.sh
```

This installs a LaunchAgent (macOS) or systemd user service (Linux). To remove:

```bash
./scripts/setup-autostart.sh --remove
```

## Install as App (PWA)

Switchboard is a Progressive Web App. In Chrome or Edge, click the install icon in the address bar to add it as a standalone app on your desktop or phone.

## Tips

- **Multiple workers per project** — You can spawn multiple workers in the same project. They get auto-incremented names (e.g., `myproject`, `myproject-2`).

- **Project discovery** — Switchboard finds projects by scanning its parent directory for `CLAUDE.md` files (configurable depth). Create a `CLAUDE.md` in any directory to make it appear in the spawn dialog. Override with `project_root` in `config.yaml`.

- **Mobile access** — Open `http://<machine-ip>:5001` on your phone. The UI adapts with a bottom navigation bar, including terminal search and log viewing.

- **Remote control** — Workers start with `/rc` mode enabled by default, allowing remote command execution via the API.

- **Session persistence** — Workers run in tmux. If the web UI disconnects, workers keep running. Reconnect to see them again.

- **Worker persistence** — Worker metadata (model, spawn time) is saved to `state/workers.json` and survives API restarts. Uptime is tracked from spawn time.

- **Config changes** — After editing `config.yaml`, restart with `./stop.sh && ./start.sh`.

- **API costs** — The Usage tab estimates what your usage would cost on API billing. Useful for evaluating Max subscription vs pay-per-use. Configure rates in `config.yaml`.

- **Dark/light theme** — Toggle in the header. Persisted to localStorage.

### Working Style (SOUL.md) & Infrastructure Map

The **Setup Wizard** offers to create two optional files in the project root directory:

- **SOUL.md** — Your working style and preferences for Claude Code sessions (tone, detail level, coding style)
- **INFRASTRUCTURE.md** — Your development environment (ports, services, machine details) so Claude Code avoids conflicts

You can also create or edit these manually at any time. If you want all Claude Code sessions to use them, reference them from `~/.claude/CLAUDE.md`. The wizard's final screen provides the exact commands.

## CLI Helper

The `scripts/switchboard` CLI lets you manage workers from the command line:

```bash
# Add to PATH
export PATH="$PATH:$(pwd)/scripts"

# Usage
switchboard list                    # List workers
switchboard spawn myworker ~/proj   # Spawn worker
switchboard send myworker "fix bug" # Send message
switchboard output myworker         # View output
switchboard kill myworker           # Kill worker
```

Override the API URL: `export SWITCHBOARD_URL=http://other-machine:5001`
