# Contributing

Thanks for your interest in Switchboard! This guide covers how to set up, develop, and submit changes.

## Setup

```bash
git clone <your-repo-url>/switchboard.git
cd switchboard
./setup.sh        # installs Python + Node dependencies
./start.sh        # starts API + web server
```

Open http://localhost:5001 to verify everything works.

## Development

**API** (Flask-SocketIO, port 5001):
```bash
# For auto-reload on Python changes:
DEV=1 python3 api/server.py

# Or manual restart:
./stop.sh && ./start.sh
```

**Web UI** (React + Vite):
```bash
cd web
npm run dev       # hot-reload dev server on :3000 (proxies to :5001)
npm run build     # production build (served by Flask on :5001)
```

**Important:** When running via `./start.sh`, the frontend is served as a static build from `web/dist/`. Any frontend changes require `cd web && npm run build` to take effect. Use `npm run dev` for hot-reload during frontend development.

## Project Structure

```
api/
  server.py           # Core: app, auth, workers, proposals, websockets
  shared.py           # AppContext (shared state) + data_hash utility
  idle_detector.py    # Hook endpoints + JSONL idle detection
  system_monitor.py   # System metrics, hardware, updates
  project_sync.py     # Projects, files, git, session helpers
  tmux_manager.py     # tmux subprocess wrapper
  tests/              # API tests
web/src/              # React frontend (inline styles, no CSS modules)
state/                # Runtime state (usage stats)
logs/                 # Runtime logs (not committed)
docs/                 # Architecture docs
contrib/              # Optional integrations (Telegram bot, hooks)
```

## Code Style

- **Python**: Standard library preferred. No type annotations required. Keep imports minimal.
- **React**: Functional components with hooks. Inline `styles` objects (no CSS modules). Import order: react, then local modules.
- **General**: No over-engineering. Minimal abstractions. Simple > clever.

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test locally (`./start.sh`, verify in browser)
4. Run `cd web && npm run build` to ensure the production build works
5. Open a pull request with a clear description of what and why

## Reporting Issues

Open an issue with:
- What you expected vs what happened
- Steps to reproduce
- OS, Python version, Node version, browser
