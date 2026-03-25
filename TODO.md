# Switchboard TODO

## Current Focus

### Multi-Backend Support (Codex, Ollama)

Support spawning workers that run Codex CLI or Ollama models alongside Claude Code workers.

**Why:** Codex is the closest open-source analog to Claude Code. Its `--oss` flag uses Ollama for local model inference, giving agent capabilities (file editing, tool use) with open-source models. Raw `ollama run` covers quick chat/brainstorming without agent features.

#### Phase 1: Config-Driven Backends

- [ ] Add `backends` section to `config.yaml` with per-backend settings:
  - `command` — spawn command template (e.g., `codex --no-alt-screen`, `ollama run`)
  - `model_flag` — how model is passed (`--model` for Claude/Codex, positional for Ollama)
  - `prompt_pattern` — regex to detect ready state (`[>❯]` for Claude, `>>>` for Ollama)
  - `trust_prompt` — whether to auto-handle trust prompts (Claude only)
  - `commands` — available slash commands (`/rc`, `/compact` — Claude only)
- [ ] Update `config.yaml.example` with backend config documentation
- [ ] Track `_worker_backends` dict in server.py (parallel to `_worker_models`)
- [ ] Persist backend type in `state/workers.json`

#### Phase 2: Spawn Refactor

- [ ] Refactor `tmux_manager.spawn_worker()` to accept backend config instead of hardcoded `claude` command
- [ ] Make trust prompt handling conditional on backend config
- [ ] Make `/rc` and session labeling conditional on backend config
- [ ] Codex: use `--no-alt-screen` flag (critical — prevents TUI from breaking tmux capture)
- [ ] Codex: support `--full-auto` flag option for unattended workers

#### Phase 3: Model Discovery

- [ ] Abstract model discovery — currently runs `claude model list`
- [ ] Add Ollama model discovery via `ollama list` or REST API (`localhost:11434/api/tags`)
- [ ] Merge models from all backends into spawn dialog, grouped by backend

#### Phase 4: UI Updates

- [ ] Add backend selector to SpawnDialog (before model selector)
- [ ] Filter model list based on selected backend
- [ ] Conditionally show RC/Compact buttons (only for Claude workers)
- [ ] Update copy: "Claude Code session" → "AI worker session"
- [ ] Show backend type on worker cards

#### Phase 5: Usage Tracking Graceful Degradation

- [ ] Make usage parsing conditional on backend type
- [ ] Claude: existing JSONL parsing in `~/.claude/projects/`
- [ ] Codex: parse `~/.codex/` session files (different format)
- [ ] Ollama: no session files — show "N/A" for usage/context
- [ ] Per-backend context window sizes (Claude 200k, Ollama varies by model)

#### Phase 6: Project Discovery

- [ ] Support `AGENTS.md` (Codex) alongside `CLAUDE.md` for project discovery
- [ ] Configurable marker files in `config.yaml`

#### Notes

- **Codex `--oss`** is the recommended path for Ollama integration — full agent loop with local models
- **Codex `exec --json`** is an alternative to tmux with structured JSONL output, but loses interactive conversation
- **Raw `ollama run`** is chat REPL only — no file editing or tool use
- Start with Codex TUI mode since it's closest to the existing Claude Code pattern

---

## Backlog

- [ ] Non-interactive worker tasks (`claude -p` / `codex exec`)
- [ ] Overnight queue + executor
- [ ] Plan mode awareness — detect plan approval prompt, show buttons in worker card
- [ ] File download/copy on mobile (share API, clipboard, or raw file endpoint)
- [ ] Terminal resize handling
- [ ] Claude Desktop MCP integration
- [ ] Child process tracking

---

## Completed

### Usage Analytics + Process Handling (Mar 25, 2026)

- [x] By Project and By Model charts reflect selected time range (not always all-time)
- [x] Backend emits `daily_by_project` and `daily_by_model` for frontend filtering
- [x] Project name resolution via `history.jsonl` real paths (handles cross-platform)
- [x] `project_aliases` config merges usage from renamed repos
- [x] All-time summary bar consistent with All filter (fixes cost mismatch)
- [x] BarChart label auto-sizing (capped 180px) prevents name truncation
- [x] `stop.sh` kills orphan processes still holding the port
- [x] `start.sh` clears stale PID files, reclaims port from orphans

### Setup Wizard v2 + Config + SpawnDialog (Mar 25, 2026)

- [x] 4-step onboarding wizard: password, SOUL.md, INFRASTRUCTURE.md, launch
- [x] Password stored as SHA-256 hash in `state/auth.json`, works alongside `SWITCHBOARD_PASSWORD` env var
- [x] SOUL.md pre-filled with default template (session naming convention, Claude Code tips)
- [x] INFRASTRUCTURE.md pre-filled with port/service template, optional scan paste field
- [x] Skip/Continue semantics: Continue saves content, Skip bypasses file creation
- [x] Contributor checkbox sets `show_self: true` in config.yaml
- [x] Done step with "Apply to Global Config" buttons for ~/.claude/CLAUDE.md
- [x] `POST /api/setup/apply-global` endpoint with duplicate detection
- [x] Setup config changes hot-reload (no restart needed)
- [x] Setup endpoints auth-exempt (`/api/setup/status`, `/api/setup`, `/api/setup/apply-global`)
- [x] Existing installations auto-skip via `start.sh` migration
- [x] `show_self` only gates spawn dialog; Switchboard always visible in file tree/activity
- [x] Projects include `is_self` field, `/api/projects` returns `{projects, show_self}`
- [x] `/api/projects` returns `relative_dir` field
- [x] SpawnDialog shows relative paths, truncates long directories with RTL ellipsis
- [x] `setup.sh` resets package-lock.json after npm install to prevent platform drift

### Scoped File Access (Mar 25, 2026)

- [x] `project_root` defaults to parent of switchboard install (not `~`)
- [x] File read/write API validates against `project_root`
- [x] File tree scans from `project_root`

### PWA + Auto-Start (Mar 24, 2026)

- [x] Progressive Web App: manifest.json, service worker, app icons (SVG + PNG)
- [x] PWA meta tags in index.html, installable on desktop and mobile
- [x] `scripts/setup-autostart.sh` — macOS LaunchAgent + Linux systemd user service
- [x] `--remove` flag to uninstall auto-start

### Programmatic Idle Detection (Mar 19, 2026)

- [x] HTTP hooks (Stop + UserPromptSubmit) for instant idle/active detection
- [x] JSONL session file parsing as polling fallback (5s)
- [x] Removed tmux output pattern matching (_SPINNER_CHARS, _ACTIVITY_RE, hash tracking)
- [x] `scripts/setup-hooks.sh` for merging hook config into ~/.claude/settings.json
- [x] Updated architecture.md, SETUP.md, QUICKSTART.md with hook setup docs

### Pre-Open-Source Release (Mar 17-18, 2026)

- [x] Optional single-password auth — `SWITCHBOARD_PASSWORD`, login page, session cookies, logout
- [x] Proposals UI — approve/reject in Activity panel, socket updates
- [x] Git push button — push from Activity panel with confirmation
- [x] Browser push notifications — Notifs button, idle/spawn/kill alerts
- [x] File editing — inline edit in FilePreview, PUT endpoint, last-write-wins
- [x] Worker metadata persistence + uptime — `state/workers.json`, survives restarts
- [x] Historical log viewer — LogViewer with text filter, ANSI cleaning, closable tabs
- [x] Terminal search — match highlighting, prev/next navigation
- [x] Terminal load more — 200-line increments up to 1000
- [x] Usage CSV export — filtered by current time range
- [x] Unpushed commit details — expandable file lists with status badges
- [x] Keyboard shortcuts for tab navigation — `[`/`]` cycle, `1-9` jump, `w` close
- [x] Extracted ConfirmDialog as reusable component
- [x] Renamed Reset to Interrupt (sends Ctrl+C)
- [x] Fixed terminal quick buttons — y/n/1/2/3 send raw keypress (no stray Enter for TUI prompts)
- [x] DEV mode — `DEV=1` for Flask auto-reload
- [x] Rewrote stop.sh — wait loop, stale PID handling, SIGKILL fallback
- [x] UI cleanup — hardcoded colors → CSS variables, dead code removal, mobile fixes
- [x] Documentation update — all docs updated for current feature set
- [x] Credential cleanup — scrubbed config.yaml, verified git history clean

### Hardware Health Monitoring (Mar 17, 2026)

- [x] CPU/SoC temperature in CPU card
- [x] GPU power draw in GPU card
- [x] NVMe SMART health card (life used, spare, power-on hours)
- [x] Configurable SMART device in config.yaml

### Rename to Switchboard (Mar 16, 2026)

- [x] Renamed from Helm across all files, configs, service files
- [x] Refreshed all documentation

### Cost Estimation in Usage Tab (Mar 15, 2026)

- [x] Per-model pricing in config.yaml, cost calculation engine
- [x] Est. API Cost card, cost trend chart, cost per model
- [x] Archive MAX-merge for historical data preservation

### Network Efficiency + Cleanup (Mar 15, 2026)

- [x] Targeted terminal output via Socket.IO rooms
- [x] Incremental JSONL parsing with cached file offsets
- [x] Client-aware monitor pausing
- [x] Per-worker session file tracking
- [x] Dead code cleanup (-521 lines)

### Tab Reorder + Usage Time Ranges (Mar 13, 2026)

- [x] Tab drag-and-drop reordering
- [x] Usage time range selector with adaptive chart granularity

### WebSocket Upgrade + UX Polish (Mar 12, 2026)

- [x] Flask-SocketIO with threading async mode
- [x] 5 background monitor threads with hash-based change detection
- [x] Toast notifications, skeleton loading, connection banner
- [x] Keyboard shortcuts, dark/light theme

### Earlier (Feb-Mar 2026)

- [x] Multi-instance worker spawning with auto-increment names
- [x] Mobile-responsive UI redesign
- [x] Telegram bot integration
- [x] Usage analytics dashboard with persistent archive
- [x] File tree with git status, diff preview, push workflow
- [x] Proposal submission and approval flow
- [x] Flask API + tmux manager + React frontend

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
| Mar 15 | MAX-merge archive | Historical counts never decrease despite session file pruning |
| Mar 16 | Rename to Switchboard | Final name for open-source release |
| Mar 18 | Raw keypresses for TUI buttons | y/n/1-3 send single keypress, not text+Enter — fixes plan prompt interaction |
| Mar 18 | Multi-backend via config | Config-driven backends (Claude/Codex/Ollama) instead of hardcoded Claude |
| Mar 18 | Codex --oss for Ollama | Use Codex agent loop with Ollama inference instead of building custom agent |

---

*Last updated: March 25, 2026*
