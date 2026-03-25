# Switchboard Setup Guide

Switchboard runs on the machine where your Claude Code sessions live (Linux box, Mac, always-on PC). The web UI is accessed from any browser on any device.

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
git clone <your-repo-url>/switchboard.git
cd switchboard

chmod +x setup.sh start.sh stop.sh
./setup.sh
```

## Running

```bash
./start.sh
```

Access the UI:
- Same machine: http://localhost:5001
- Other devices: http://\<machine-ip\>:5001

## Claude Code Hooks (Idle Detection)

Switchboard uses Claude Code's HTTP hooks for instant idle detection.
Run the setup script to configure them:

```bash
./scripts/setup-hooks.sh
```

This adds `Stop` and `UserPromptSubmit` hooks to `~/.claude/settings.json`
that notify Switchboard when Claude finishes generating or when a prompt
is submitted. Existing hooks are preserved.

If Switchboard runs on a non-default port:
```bash
./scripts/setup-hooks.sh 8080
```

With hooks, idle detection has ~1-2s latency (Claude Code executes HTTP
hooks synchronously — the delay is Claude's overhead, not Switchboard's).
Without hooks, detection falls back to JSONL file polling (~10-15s delay).
Hooks are recommended for the best experience.

## Configuration

Copy `config.yaml.example` to `config.yaml` (done automatically by `setup.sh`).

Key settings:
- `port` — API port (default: 5001)
- `monitor.gpu` — GPU monitoring command, or `enabled: false` to hide
- `monitor.services` — processes to track (default: Ollama)
- `monitor.disk_path` — mount point to monitor (default: `/`)
- `monitor.smart.device` — NVMe device for SMART health monitoring (e.g., `/dev/nvme0n1`)
- `pricing` — API cost estimation rates (see config.yaml.example for all model rates)

See `config.yaml.example` for all options with inline docs.

### Changing Ports

API + Web UI port: edit `port` in `config.yaml` (default: 5001)

## Auto-Start on Login

To have Switchboard start automatically when you log in:

```bash
./scripts/setup-autostart.sh
```

- **macOS**: Installs a LaunchAgent plist to `~/Library/LaunchAgents/`
- **Linux**: Creates a systemd user service

To remove: `./scripts/setup-autostart.sh --remove`

## Stopping

```bash
./stop.sh

# To fully kill the tmux session:
tmux -L switchboard kill-session -t switchboard
```

## Project Discovery

Switchboard auto-discovers projects by scanning its parent directory (project root) for directories containing a `CLAUDE.md` file.

To add a project: create a `CLAUDE.md` in its root.

```markdown
# My Project

Brief description for Claude context.
```

## SMART Disk Health Monitoring (Linux only)

The Monitor tab can show NVMe disk health (SMART status, life used, spare capacity, temperature, power-on hours) via `smartctl`. The Disk Health card auto-hides when not configured or when smartctl lacks access.

### Setup

1. Install smartmontools if not present:
```bash
sudo apt install smartmontools
```

2. Add your device to `config.yaml`:
```yaml
monitor:
  smart:
    device: "/dev/nvme0n1"
```

3. Grant smartctl passwordless sudo access (one-time):
```bash
sudo visudo -f /etc/sudoers.d/smartctl
# Add: <username> ALL=(ALL) NOPASSWD: /usr/sbin/smartctl
```

### How it works

Switchboard runs `sudo -n smartctl -a --json <device>` and parses the NVMe health log. Results are cached for 5 minutes (configurable via `monitor.smart.cache_seconds`) since SMART data changes very slowly. If smartctl fails (missing, no permissions, non-NVMe device), the Disk Health card silently hides — no errors shown.

### What's monitored

| Metric | Source | Notes |
|--------|--------|-------|
| SMART health | `smart_status.passed` | PASSED/FAILED — FAILED turns red |
| NVMe temperature | `psutil.sensors_temperatures()` → `nvme` zone | Colored bar (warn: 60°C, crit: 75°C) |
| Life used | `percentage_used` from NVMe health log | 0-100%, bar (warn: 80%, crit: 95%) |
| Available spare | `available_spare` from NVMe health log | 100% = full spare capacity |
| Power-on hours | `power_on_hours` from NVMe health log | Displayed as days + hours |

### Thermal monitoring (no setup required)

CPU/SoC temperature is read via `psutil.sensors_temperatures()` and shown in the CPU card automatically. Sensor priority: `acpitz` (ARM/SoC) → `coretemp` (Intel) → `k10temp` (AMD). No configuration needed — the temperature row auto-hides if no sensors are available.

GPU power draw is read from `nvidia-smi` alongside existing GPU metrics and shown in the GPU card when available.

## System Updates (Linux only)

The Monitor tab can check for and apply apt/snap updates. For non-interactive updates, configure passwordless sudo:

```bash
sudo bash scripts/setup-sudo.sh
```

Or manually:
```bash
sudo visudo -f /etc/sudoers.d/switchboard-updates
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
cat logs/api.log
```

Common: port 5001 in use, missing Node deps (`cd web && npm install`).

### tmux session issues

```bash
tmux -L switchboard list-sessions              # List sessions
tmux -L switchboard attach -t switchboard      # Attach
tmux -L switchboard kill-session -t switchboard # Kill all
```
