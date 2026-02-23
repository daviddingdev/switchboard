# Orchestrator

> **Before starting:** Read `~/INFRASTRUCTURE.md` and `~/WORKER.md`

Personal AI operating system for managing Claude Code sessions across projects.

## Status: MVP Complete

The core system is working:
- Web UI with 3-column layout (Files | Terminal | Workers+Activity)
- Spawn/kill workers, view their terminals as tabs
- File browser with git status indicators (M/U/A/D)
- File preview with syntax highlighting
- Proposal approval system
- Auto-discovery of projects (directories with CLAUDE.md)

## Quick Start

```bash
cd ~/orchestrator
./start.sh      # Start API + web + tmux
./stop.sh       # Stop everything
```

**UI:** http://localhost:3000 (or http://100.69.237.80:3000 via Tailscale)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER                                                     │
│  React App (Vite) at :3000                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP (polling)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  SPARK SERVER                                               │
│                                                             │
│  Flask API (:5001)                                          │
│  ├── /api/processes    — spawn/kill/list workers           │
│  ├── /api/proposals    — approval workflow                 │
│  ├── /api/home         — file tree with git status         │
│  ├── /api/file         — file content for preview          │
│  └── /api/activity     — combined activity feed            │
│                                                             │
│  tmux session: orchestrator                                 │
│  ├── partner (this session)                                │
│  └── workers (spawned on demand)                           │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
~/orchestrator/
├── api/
│   ├── server.py         # Flask API (all endpoints)
│   ├── tmux_manager.py   # tmux wrapper
│   └── requirements.txt
├── web/
│   └── src/
│       ├── App.jsx           # Main layout + tab state
│       ├── api.js            # API client
│       └── components/
│           ├── FileTree.jsx      # Project browser
│           ├── FilePreview.jsx   # Syntax-highlighted viewer
│           ├── TabBar.jsx        # Terminal/file tabs
│           ├── Terminal.jsx      # Worker output
│           ├── WorkerList.jsx    # Worker list
│           ├── Activity.jsx      # Proposals + git changes
│           ├── QuickActions.jsx  # 1/2/3/Y/N buttons
│           └── ChatInput.jsx     # Message input
├── state/
│   └── proposals/        # Worker proposals (YAML)
├── scripts/
│   └── orch              # CLI helper
├── logs/                 # Runtime logs
├── setup.sh              # Install dependencies
├── start.sh              # Launch everything
└── stop.sh               # Clean shutdown
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `api/server.py` | All API endpoints, file tree building, git status |
| `web/src/App.jsx` | Main layout, tab state management |
| `web/src/components/FileTree.jsx` | Project auto-discovery display |
| `web/src/components/Terminal.jsx` | Polls worker output |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Health check |
| `GET /api/processes` | List workers |
| `POST /api/processes` | Spawn worker |
| `DELETE /api/processes/<name>` | Kill worker |
| `POST /api/processes/<name>/send` | Send input |
| `GET /api/processes/<name>/output` | Get output |
| `GET /api/home` | File tree from ~ with git status |
| `GET /api/file?path=` | File content for preview |
| `GET /api/projects` | Auto-discovered projects |
| `GET /api/activity` | Pending + changes + recent |
| `GET /api/proposals` | List proposals |
| `POST /api/proposals` | Create proposal |
| `PATCH /api/proposals/<id>` | Approve/reject |

## Development

```bash
# API runs with auto-reload
cd api && python3 server.py

# Web dev server with HMR
cd web && npm run dev

# Build for production
cd web && npm run build
```

## Current UI Features

- **File tree**: Auto-discovers projects with CLAUDE.md, shows git status
- **Tabs**: Terminal tabs for each worker + file preview tabs
- **Activity panel**: Pending proposals, git changes across projects
- **Quick actions**: 1/2/3/4/Y/N/Enter/Esc buttons for prompts
- **Worker list**: Click to open worker's terminal tab

## Backlog

- [ ] File content editing (not just preview)
- [ ] Non-interactive worker tasks (`claude -p`)
- [ ] Overnight queue + executor
- [ ] Real-time WebSocket updates
- [ ] Mobile responsive

---

## End-of-Session Checklist

Before finishing:
1. Update `CHANGELOG.md` with today's work
2. Update `TODO.md` if tasks changed
3. `git add -A && git commit && git push`

---

## Date Format

Use the date from system prompt (local time), not Spark timestamps (UTC).
Format: `February 23, 2026` or `2026-02-23`
