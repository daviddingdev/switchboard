# Switchboard Pre-Open-Source Feature Plan

## Context

Preparing Switchboard for open source release. 10 features address gaps that would be the first issues/complaints from external users, plus a credential cleanup blocker. Several features wire existing backend functionality to the UI (push, proposals), while others add new capabilities (auth, notifications, file editing).

## Execution Order

Pre-req → Extract ConfirmDialog → 5 (push) → 2 (proposals) → 3 (notifications) → 4 (file editing) → 1 (auth) → 6+9 (persistence + uptime) → 7 (logs) → 8 (terminal search) → 10 (usage export) → Docs update

---

## Pre-req: Credential Cleanup

**Problem:** `config.yaml` has `spark.password: hellopie` and `spark.username: davidding`. Already gitignored, but must be scrubbed before any public push.

**Changes:**
- `config.yaml` — replace spark credentials with empty strings
- Verify `config.yaml.example` has safe placeholders (it already does)
- **Verify credentials never entered git history:** `git log --all -p | grep hellopie` — must return nothing

---

## Pre-req: Extract ConfirmDialog

**The confirm overlay pattern exists in WorkerDashboard and Monitor. Features 5 and 2 both need it. Extract before copying a third time.**

| File | Change |
|------|--------|
| `web/src/components/ConfirmDialog.jsx` | New: ~20 line component. Props: `title`, `description`, `onConfirm`, `onCancel`, `confirmLabel`, `danger` (bool). Renders backdrop + centered dialog + Cancel/Confirm buttons |
| `web/src/components/WorkerDashboard.jsx` | Replace inline confirm overlay with `<ConfirmDialog>` |

- Reuse existing style patterns: `var(--bg-secondary)` background, `var(--border)` border, `var(--accent)` for normal confirm, `#ef4444` for danger
- Activity.jsx and any future confirm dialogs import this instead of duplicating

---

## Feature 5: Git Push Button

**Smallest win — wires existing `POST /api/push` to the UI.**

| File | Change |
|------|--------|
| `web/src/api.js` | Add `pushProject(project)` wrapper |
| `web/src/components/Activity.jsx` | Add push button per project in unpushed section, `<ConfirmDialog>` for push confirmation, result feedback banner |

- Push button goes in the project header row next to the project name
- Uses extracted `<ConfirmDialog>` — no inline overlay
- Timed success/error banner after push completes (4s auto-dismiss)

---

## Feature 2: Proposals UI

**Backend is complete. Activity.jsx ignores the `pending` and `recent` data it already receives.**

| File | Change |
|------|--------|
| `web/src/api.js` | Add `updateProposal(id, status)` wrapper |
| `web/src/components/Activity.jsx` | Render pending proposals with approve/reject buttons, show recent proposals with status badges |
| `api/server.py` | Add `socketio.emit('activity:update', _get_activity_data())` after both PATCH and DELETE succeed |

- Activity state init changes from `{ changes: [], unpushed: [] }` to include `pending: [], recent: []`
- **Steps display:** collapsible disclosure — show `▸ N steps` collapsed, expand on click to show all steps. Not truncated, not always-visible.
- Pending section at top (requires action): card with title, worker name, collapsible steps, approve/reject buttons
- Recent section: dimmed cards with approved/rejected status badge
- Server-side: emit socket event on both PATCH (status change) and DELETE (removal) for instant UI update

---

## Feature 3: Browser Push Notifications

**Two parts: server-side idle detection + frontend Notification API.**

| File | Change |
|------|--------|
| `api/server.py` | Extend `_bg_terminal_monitor` with timestamp tracking and idle detection. Emit `worker:idle` / `worker:active` socket events |
| `web/src/hooks/useNotifications.js` | New hook: request permission on first click, fire notifications on `worker:idle` and spawn/kill when tab not focused |
| `web/src/App.jsx` | Wire `useNotifications` hook, one-time click listener for permission request |

**Idle detection specifics:**
- Idle = output unchanged for 10s AND last line is *exactly* `>` or `❯` after stripping whitespace (not "contains" — avoids false positives on `>` confirmation prompts)
- Timer resets on any new output (track `last_change` timestamp, check elapsed on each poll — the 500ms poll loop naturally handles this without setTimeout)
- Emit `worker:idle` once when threshold crossed, `worker:active` when output changes again after being idle

**Frontend specifics:**
- Only notify when `document.visibilityState !== 'visible'`
- Store previous worker list in `useRef` (not useState) to avoid re-render-triggered notifications
- Detect spawn/kill by diffing `prevWorkersRef.current` vs incoming `workers:update` payload

---

## Feature 4: File Editing

**New PUT endpoint + edit mode toggle in FilePreview.**

| File | Change |
|------|--------|
| `api/server.py` | Add `PUT /api/file` endpoint — same security checks as GET (home-dir confinement, 500KB limit), writes content |
| `web/src/api.js` | Add `saveFile(filepath, content)` wrapper |
| `web/src/components/FilePreview.jsx` | Add edit mode toggle: Edit/Cancel/Save buttons, swap `<code>` for `<textarea>`, track dirty state, show unsaved indicator |

**PUT endpoint security:**
- Same path validation as GET (realpath must start with home dir)
- Same 500KB limit on incoming content
- **Validate content is valid UTF-8** before writing — reject binary content with 415 (mirrors GET's UnicodeDecodeError guard)
- Reject directory paths with 400

**Frontend:**
- Edit mode: textarea with same monospace font, full-height
- Save writes via PUT, then refreshes content and exits edit mode
- Inline "Unsaved" indicator next to Save button (no tab title change for v1)
- **Concurrent edit note:** last-write-wins silently. Acceptable for personal tool — add code comment documenting this decision

---

## Feature 1: Optional Single-Password Auth

**Highest-risk change — touches request lifecycle globally. Implemented last among server changes.**

| File | Change |
|------|--------|
| `api/server.py` | Check `SWITCHBOARD_PASSWORD` env var. If set: `before_request` hook enforces auth, `/api/login` + `/api/logout` + `/api/auth/status` endpoints, session cookie or HTTP Basic Auth, WebSocket auth on connect |
| `web/src/api.js` | Add `credentials: 'include'` to all fetch calls via shared `apiFetch` wrapper |
| `web/src/components/LoginPage.jsx` | New: password form → POST `/api/login` → set cookie |
| `web/src/App.jsx` | Check `/api/auth/status` on mount, gate all rendering behind auth check, show LoginPage if needed |

**Key decisions:**
- No env var = no auth, zero behavior change (current default preserved)
- **Secret key persistence:** auto-generate and persist to `state/secret.key` (gitignored) on first run. Read from file on subsequent starts. Eliminates session invalidation on restart. `SWITCHBOARD_SECRET_KEY` env var overrides if set.
- Login/logout/auth-status endpoints exempt from auth check
- Static file serving (non-`/api` paths) exempt from auth check
- **WebSocket auth:** in `handle_connect()`, check `flask.session.get('authenticated')`. If not authenticated and auth is enabled, return `False` to reject the connection. Flask-SocketIO makes the HTTP session available during the connect handshake.
- **Rollback:** unset `SWITCHBOARD_PASSWORD` env var → auth fully disabled, all behavior reverts to current state

---

## Feature 6 + 9: Worker Metadata Persistence + Uptime

**Implemented together — both use `state/workers.json`.**

| File | Change |
|------|--------|
| `api/server.py` | New `_worker_spawn_times` dict, `_save_workers_state()` / `_load_workers_state()` functions. Save on spawn/kill, load on startup. Include `spawn_time` in process list API response |
| `web/src/components/WorkerDashboard.jsx` | `formatUptime()` helper, 60s re-render interval, render uptime on worker cards |
| `.gitignore` | Add `state/workers.json` |

- `state/workers.json` stores `{ models: {}, spawn_times: {} }`
- **Load must run after `tmux.ensure_session()`** in the startup sequence
- **Corrupt JSON guard:** wrap `_load_workers_state()` in try/except, default to empty dicts on parse failure
- Cross-reference with actual tmux windows on load — discard entries for workers not in tmux
- Uptime display: "2h 15m", "3d 1h", etc. — below directory, above context bar

---

## Feature 7: Historical Log Viewer

**Workers log to `logs/workers/<name>.log` with rotation, but no way to view old logs.**

| File | Change |
|------|--------|
| `api/server.py` | `GET /api/logs/<name>` — list log files. `GET /api/logs/<name>/<filename>` — read log content with ANSI stripping and tail param |
| `web/src/api.js` | Add `fetchWorkerLogs(name)` and `fetchLogFile(name, filename, tail)` |
| `web/src/components/LogViewer.jsx` | New: file list sidebar, log content in `<pre>`, "Load more" button |
| `web/src/components/WorkerDashboard.jsx` | Add "Logs" button to worker cards |
| `web/src/App.jsx` | Add `'log'` tab type, wire `onLogs` prop |

**Validation:**
- Worker name validated with `^[a-zA-Z0-9_-]+$` (defense-in-depth, don't rely on spawn validation being the only gate)
- Filename validated with `^[a-zA-Z0-9_-]+(-\d{8}-\d{6})?\.log$` — covers both current and rotated patterns
- **ANSI stripping regex:** `re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', content)` — handles color codes, cursor movement, and other escape sequences
- Tail param capped at 5000 lines

---

## Feature 8: Terminal Search

**Entirely frontend — no backend changes.**

| File | Change |
|------|--------|
| `web/src/components/TerminalView.jsx` | Search bar toggle (icon button, not Ctrl+F), regex-escaped text matching, `<mark>` highlights, match counter, up/down navigation, auto-scroll to current match |

**Critical implementation order (XSS prevention):**
1. HTML-escape the raw output (`&`, `<`, `>` → entities)
2. Apply search regex on the escaped string to insert `<mark>` tags
3. Render via `dangerouslySetInnerHTML`

If done in reverse order, you get XSS. Call this out explicitly in the code.

**Escape key handling:** search input `onKeyDown` must handle Escape before the global `useKeyboardShortcuts` handler sees it. The global handler already skips `input` tags, so this should work — but verify focus is set on search bar open via `searchInputRef.current?.focus()`.

- Search icon button in quick buttons row (not Ctrl+F — avoids browser conflict)
- Floating search bar above command bar when open, closes on Escape
- Current match highlighted amber, others semi-transparent amber

---

## Feature 10: Export Usage Data

**Simplest feature — purely frontend.**

| File | Change |
|------|--------|
| `web/src/components/Usage.jsx` | "Export CSV" button in header (reuse `refreshBtn` style), `handleExportCSV()` converts daily data to CSV, blob URL download |

- Export the currently-filtered time range, not always all-time — use whatever daily data the current view is showing
- **Filename includes range:** `switchboard-usage-7d-2026-03-17.csv` or `switchboard-usage-all-2026-03-17.csv`
- Columns: date, sessions, messages, tool_calls, cost, tokens (input/output/cache_read/cache_creation)

---

## Docs Update (Final Pass)

| File | Change |
|------|--------|
| `README.md` | Document `SWITCHBOARD_PASSWORD` env var for auth, mention file editing capability |
| `SECURITY.md` | Update to reflect auth option — no longer "permanently local-only" |

---

## Verification

After all features:
1. `git log --all -p | grep hellopie` — must return nothing (credential cleanup)
2. Start with `./start.sh` — confirm no-auth mode works unchanged
3. `SWITCHBOARD_PASSWORD=test ./start.sh` — confirm login page, 401 without auth, WebSocket rejected without auth. **Rollback:** unset env var, restart, confirm fully reverted
4. Spawn a worker, verify uptime shows on card and persists across `./stop.sh && ./start.sh`
5. Corrupt `state/workers.json` manually (write `{invalid`) → restart → confirm graceful recovery
6. Open a file, click Edit, modify, Save — verify changes persist on disk
7. Open same file in two tabs, save from both — confirm last-write-wins (no crash)
8. Push unpushed commits from Activity panel — confirm overlay, result banner
9. Create proposal via curl, verify it appears, approve/reject works, socket update is instant
10. Switch to another tab, wait for worker idle — verify browser notification fires
11. Open terminal, search for text — verify highlight and navigation
12. **Terminal search edge cases:** empty query (no highlights), `[` and `.*` (regex special chars escaped properly), no matches (shows "0/0")
13. Open historical logs from worker card
14. Export CSV from Usage tab with a specific time range selected — verify filename includes range and data matches the view
