# Switchboard - Current Tasks

## Current Focus
**Project rename + documentation cleanup complete**

Renamed from Helm to Switchboard. All docs, configs, service files, and internal references updated.

---

## Quick Start

```bash
cd ~/switchboard
./start.sh
```

**UI accessible at:** http://localhost:5001

---

## Completed

### Rename to Switchboard + Doc Cleanup (Mar 16, 2026)
- [x] Renamed project from Helm to Switchboard across all files
- [x] Renamed tmux socket/session from `helm` to `switchboard`
- [x] Renamed service files, CLI helper, environment variables
- [x] Refreshed README.md, CONTRIBUTING.md, SECURITY.md, docs/SETUP.md
- [x] Updated QUICKSTART.md with RC rename to Remote, model label tip
- [x] Updated docs/architecture.md references

### Rename to Helm + Doc Cleanup (Mar 15, 2026)
- [x] Renamed project from Orchestrator to Helm across all files
- [x] Renamed tmux socket/session from `orchestrator` to `helm`
- [x] Renamed service files, CLI helper, environment variables
- [x] Refreshed README.md, CONTRIBUTING.md, SECURITY.md, docs/SETUP.md
- [x] Created QUICKSTART.md onboarding guide with usage patterns
- [x] Deleted stale docs/UPGRADE-PLAN.md
- [x] Updated docs/architecture.md references

### Cost Estimation in Usage Tab (Mar 15, 2026)
- [x] `config.yaml` pricing section — per-model rates, cache multipliers, subscription amount
- [x] `scripts/compute-usage.py` — cost calculation engine with prefix-matched model pricing
- [x] `web/src/components/Usage.jsx` — Est. API Cost card, cost trend chart, cost per model
- [x] Stale pricing detection — warns on unknown models, tracks unpriced tokens
- [x] Archive MAX-merge — historical data survives Claude Code session file pruning
- [x] Side-by-side activity + cost charts with daily gap filling

### Network Efficiency + Cleanup (Mar 15, 2026)
- [x] Targeted terminal output via Socket.IO rooms (not broadcast)
- [x] Incremental JSONL parsing with cached file offsets
- [x] Client-aware monitor pausing (skip work when 0 clients)
- [x] Per-worker session file tracking (fixed context tracker bug)
- [x] FileTree via WebSocket push (replaced 10s polling)
- [x] Dead code cleanup: removed 3 endpoints, 1 function, 4 constants, 7 api.js functions, 2 files

### Tab Reorder + Usage Time Ranges (Mar 13, 2026)
- [x] Tab drag-and-drop reordering via native HTML5 drag events
- [x] Usage time range selector: 7d / 30d / 90d / 6m / 1y / All
- [x] Adaptive chart granularity (daily → weekly → monthly)
- [x] All-time summary row when sub-range selected

### WebSocket Upgrade + UX Polish (Mar 12, 2026)
- [x] Flask-SocketIO with `threading` async mode (subprocess-safe)
- [x] 5 background monitor threads with hash-based change detection
- [x] Terminal subscribe/unsubscribe model for on-demand streaming
- [x] Toast notifications, skeleton loading, connection banner
- [x] Keyboard shortcuts: n (spawn), m (monitor), u (usage), Esc (close), ? (help)
- [x] Dark/light theme toggle with CSS variables

### Open-Source Prep (Mar 11, 2026)
- [x] Moved Telegram bot to `contrib/telegram/`
- [x] Made systemd services portable with `%h` home expansion
- [x] Removed hardcoded paths and personal references
- [x] Added config.yaml.example template

### Usage Analytics Tab (Mar 2, 2026)
- [x] `scripts/compute-usage.py` — daily/weekly/by-project/by-model/by-hour stats
- [x] Dashboard with overview cards, charts, heatmap
- [x] Auto-recompute if stale (>5 min), manual refresh button
- [x] Persistent daily data archive

### Earlier (Feb-Mar 2026)
- [x] Multi-instance worker spawning with auto-increment names
- [x] Mobile-responsive UI redesign (3-panel desktop, bottom nav mobile)
- [x] Telegram bot integration (`contrib/telegram/`)
- [x] Auto-preview for plan files
- [x] Commit panel, diff preview, push workflow
- [x] VSCode-style file tree with git status indicators
- [x] Proposal submission and approval flow
- [x] Flask API + tmux manager + React frontend

---

## Next

### Features
- [ ] **File download/copy on mobile** — FilePreview needs mobile-safe download (share API, clipboard, or backend raw file endpoint)
- [ ] **Plan mode awareness** — Detect Claude Code plan approval prompt, show approve/reject buttons in worker card
- [ ] **Terminal scrolling** — Output panel scroll behavior improvements

## Backlog
- [ ] **Proposals UI** — Web UI for viewing, approving, and rejecting worker proposals (backend API exists, no frontend yet)
- [ ] Non-interactive worker tasks (`claude -p`)
- [ ] Overnight queue + executor
- [ ] Digest generator (cron)
- [ ] Claude Desktop MCP integration
- [ ] Child process tracking
- [ ] Editable file preview
- [ ] Terminal resize handling

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| Feb 17 | Worker model, not PM | Solo operator doesn't need formal methodology |
| Feb 17 | YAML state files | Human-readable, git-friendly |
| Feb 23 | 3-column layout | Files + Activity more useful than duplicate terminals |
| Feb 23 | Auto-discover projects | Scan for CLAUDE.md vs manual registry |
| Mar 12 | threading over eventlet | eventlet monkey-patches subprocess, breaks tmux_manager |
| Mar 12 | WebSocket + REST hybrid | WebSocket for push, REST for actions + initial data |
| Mar 12 | Hash-based dedup | Server only emits when data actually changes |
| Mar 15 | Cost in compute script | Cost flows through daily entries, frontend filtering works automatically |
| Mar 15 | MAX-merge archive | Historical counts never decrease despite session file pruning |
| Mar 15 | Rename to Helm | Cleaner name for open-source release |
| Mar 16 | Rename to Switchboard | Final name for open-source release |

---

*Last updated: March 16, 2026*
