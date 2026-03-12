# Contributing

Thanks for your interest in Orchestrator! This guide covers how to set up, develop, and submit changes.

## Setup

```bash
git clone https://github.com/dingod/orchestrator.git
cd orchestrator
./setup.sh        # installs Python + Node dependencies
./start.sh        # starts API + web dev server
```

Open http://localhost:3000 to verify everything works.

## Development

**API** (Flask, port 5001):
```bash
# Edit api/server.py or api/tmux_manager.py
# API auto-restarts if you restart via start.sh
```

**Web UI** (React + Vite, port 3000):
```bash
cd web
npm run dev       # hot-reload dev server
npm run build     # production build (served by Flask)
```

## Project Structure

```
api/              # Flask backend + tmux manager
web/src/          # React frontend (inline styles, no CSS modules)
state/            # Runtime state (proposals, usage stats)
logs/             # Runtime logs (not committed)
docs/             # Architecture docs
contrib/          # Optional integrations (Telegram bot, hooks)
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
