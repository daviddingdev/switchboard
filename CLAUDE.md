# Orchestrator

> **Before starting:** Read `~/SOUL.md` (working style) and `~/INFRASTRUCTURE.md` (server details)

Personal AI operating system for managing projects, workers, and context across Claude interfaces.

## Quick Context

- **Owner**: David Ding
- **Status**: MVP in progress
- **Priority**: HIGH — build before LA trip (~1 month)
- **Location**: Spark server (NVIDIA DGX, 128GB RAM, Tailscale: 100.69.237.80)

## What This Is

A web UI + backend that lets David:
1. Talk to a "partner" (Claude Code session) via chat interface
2. Spawn worker sessions (Claude Code per project) that run in parallel
3. See all workers + their spawned subprocesses in a process tree
4. Review and approve plans that workers create
5. Control everything from one interface — no more copy/paste between Claude interfaces

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (Mac / Phone)                                      │
│  React App served from Spark:5001                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP + WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SPARK SERVER                                               │
│                                                             │
│  Flask API (:5001)                                          │
│  ├── /api/processes     — list/spawn/kill workers          │
│  ├── /api/plans         — list/approve/reject plans        │
│  ├── /ws/terminal/:id   — WebSocket for terminal streaming │
│  └── Static files       — React app                        │
│                                                             │
│  tmux socket: /tmp/orchestrator.sock                        │
│  ├── window 0: partner (master Claude Code in ~/orchestrator)
│  ├── window 1: family-vault worker                          │
│  ├── window 2: research worker                              │
│  └── window N: ...                                          │
│                                                             │
│  State files: ~/orchestrator/state/                         │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | What it is |
|---------|------------|
| Partner | Master Claude Code session in ~/orchestrator. Exposed as chat in UI. Can see/control all workers. |
| Worker | Claude Code session in a project directory (e.g., ~/family-vault). Does actual work. |
| Process | Any running thing — workers + their children (servers, scripts, models) |
| Plan | Structured task a worker proposes. Appears in chat for approval. |

## Key Design Decisions

1. **Partner IS a Claude Code session** — not a separate abstraction. UI just wraps it as chat.
2. **Workers self-report** — write STATUS.md or plan.yaml, partner reads them.
3. **Process tree, not project tree** — track what's running, including child processes.
4. **Plans appear in chat** — inline approval, no separate tab.
5. **Start simple** — raw terminal output first, polish into chat UI later.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React (Vite), xterm.js for terminals |
| Backend | Flask + Flask-SocketIO |
| Process management | tmux via subprocess calls |
| State | YAML files |
| Terminal streaming | WebSocket + tmux capture-pane or pty |

## Directory Structure

```
~/orchestrator/
├── CLAUDE.md              # This file
├── docs/
│   ├── architecture.md    # Technical design details
│   ├── chat-summary.md    # Design conversation history
│   └── mockups/           # UI mockups (React components)
├── state/
│   ├── processes.yaml     # Active workers + children
│   └── plans/             # Plan files from workers
├── api/
│   ├── server.py          # Flask app
│   ├── tmux_manager.py    # tmux wrapper functions
│   └── requirements.txt
├── web/
│   ├── package.json
│   ├── src/
│   └── dist/
└── scripts/
    └── start.sh           # Launch everything
```

## Build Order

| Phase | What | Status |
|-------|------|--------|
| 1 | Directory structure + state schema | ✓ Done |
| 2 | Flask API (spawn/kill/list processes) | TODO |
| 3 | tmux manager (spawn workers, send commands, read output) | TODO |
| 4 | React shell (layout, process tree, terminal placeholder) | TODO |
| 5 | Wire API → UI (list workers, spawn, kill) | TODO |
| 6 | xterm.js or ttyd (terminal embedding) | TODO |
| 7 | Chat interface (partner input/output) | TODO |
| 8 | Plan detection + approval buttons | TODO |

## How Partner Understands Plans

Workers write `plan.yaml` to their project directory:

```yaml
# ~/family-vault/plan.yaml
title: Deploy to Mom
created: 2026-02-17T14:30:00Z
steps:
  - Run final UI tests
  - Build production bundle
  - Deploy to Spark (port 5000)
  - Send mom the link
estimate: 25 min
risk: low
notes: Deploying at 10am EST so mom is awake
```

Partner either:
- Polls project directories for new plan.yaml files
- Gets notified via API when worker writes one
- Reads terminal output and parses (fallback)

## Related Projects

| Project | Directory | Description |
|---------|-----------|-------------|
| Family Vault | ~/family-vault | Document search for family business. ~85% done. |
| Research | ~/research | Paper discovery pipeline. Not started. |
| HBS Cases | ~/hbs-cases | Case study practice. Not started. |

## Infrastructure Notes

- **SSH**: `ssh spark` from Mac (key auth configured)
- **Services**: Ollama (11434), OpenSearch (9200), Family-Vault API (5000)
- **UPS**: CyberPower, auto-shutdown at 10%, ~4hr runtime
- **BIOS**: Auto-power-on after AC loss

## Commands

```bash
# Check Spark
ssh spark "hostname && uptime"

# Start orchestrator (after built)
cd ~/orchestrator && ./scripts/start.sh

# Manual tmux for now
tmux -L orchestrator new-session -s orchestrator -n partner -d
tmux -L orchestrator new-window -t orchestrator -n family-vault
```

## Open Questions for Builder

1. **Terminal streaming**: xterm.js + custom WebSocket bridge, or use ttyd?
2. **Partner as chat**: Parse Claude Code output into messages, or start with raw terminal?
3. **Plan detection**: Poll files, or have workers call an API?

Start with simplest approach, iterate.

## Partner Orchestration

You are the orchestrator partner. Use the `orch` CLI to spawn and coordinate workers.

### Commands

```bash
orch projects              # List known projects with directories
orch spawn <name> <dir>    # Spawn Claude Code worker
orch send <name> "<task>"  # Send task to worker
orch output <name>         # Check worker output
orch list                  # List all workers
orch kill <name>           # Kill worker when done
orch plan <id> <title> <worker> [--auto]  # Create plan
orch plans                 # List plans
orch approve <id>          # Approve plan
```

### Multi-Project Workflow

1. `orch projects` to see available projects
2. `orch spawn <name> <directory>` for each project
3. `orch send <name> "<task description>"`
4. Poll `orch output <name>` until worker completes (look for idle prompt)
5. `orch kill <name>` when done
6. Report summary to user

### Example: Update All CLAUDE.md Files

```bash
# Spawn worker
orch spawn family-vault ~/family-vault

# Send task
orch send family-vault "Add this header after the title:
> **Before starting:** Read ~/SOUL.md and ~/INFRASTRUCTURE.md
Then remove any duplicated infrastructure/date tracking content that's now in those shared files."

# Monitor
orch output family-vault

# When done
orch kill family-vault
```

### Auto-Approve Guidelines

Use `--auto` for routine tasks:
- Documentation updates
- Code formatting
- Adding standard headers

Require manual approval for:
- Deployments
- External API changes
- Data migrations

### Shutting Down Workers

Before killing a worker, ensure it completes end-of-session tasks:

```bash
orch send <name> "Complete end-of-session tasks per CLAUDE.md, then say DONE"
# Wait for DONE in output
orch kill <name>
```

This ensures workers update CHANGELOG, TODO, and commit before terminating.

## What NOT to Build (yet)

- Overnight queue/executor
- Digest generation
- Claude Desktop MCP integration
- Phone PWA
- PM methodology (standups, initiatives, etc.)

Focus on: **spawn workers, see them, talk to partner, approve plans.**

---

## End-of-Session Checklist

**Before finishing a session, Claude MUST:**

1. **Update CHANGELOG.md** — Add entry for today's work
2. **Update TODO.md** — Mark completed items, add new ones discovered
3. **Run `python3 tools/usage_report.py`** — Regenerates USAGE.md with token counts
4. **Git commit** — `git add -A && git commit -m "description" && git push`

This ensures documentation stays current and usage is tracked.

---

## CRITICAL: Date Tracking — Use Local Date, NOT Spark UTC

**The Spark server runs in UTC. This can be 7-8 hours ahead of Pacific time.**

When writing dates in CHANGELOG.md, TODO.md, or any documentation:
- **Use the date from the system prompt** (Mac's local clock)
- **Do NOT infer from Spark timestamps** — they're UTC

**Rule:** Before writing ANY date, check the system prompt for current local date.

Date format: `February 18, 2026` or `2026-02-18` (match existing format in file)

---

## Tracking Files

| File | Purpose | Update When |
|------|---------|-------------|
| `CHANGELOG.md` | Daily progress log | After completing work |
| `TODO.md` | Current tasks, decisions | Tasks change |
| `USAGE.md` | Token usage per session | End of session (auto-generated) |

---

## Commands

```bash
# Update usage report
python3 tools/usage_report.py

# Git workflow
git add -A && git commit -m "description" && git push

# Check Spark services (if needed)
systemctl status ollama opensearch
```
