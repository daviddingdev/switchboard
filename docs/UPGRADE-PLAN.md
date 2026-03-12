# Orchestrator Upgrade Plan

This document describes the next round of improvements to bring Orchestrator from a working personal tool to a polished, standard-practice application. Each section is self-contained with reasoning, scope, and implementation details.

**Current state (after commit 76a2845):** Security hardened, terminal viewer, model selection, error boundary, async spawn, 19 API tests, open-source docs.

---

## 1. WebSocket Upgrade — Replace Polling with Real-Time Push

### Why
The app currently uses 6+ independent `setInterval` timers polling the API every 1-5 seconds. This is the single most obvious "personal tool" pattern to anyone reviewing the codebase or watching the network tab. Every process manager and dashboard tool that's taken seriously (Portainer, PM2, Coolify) uses WebSocket for live updates. The terminal viewer especially suffers — 1s polling feels sluggish for watching live output.

### What Changes

**Backend (`api/server.py`):**
- Add `flask-socketio` dependency (replaces the need for gunicorn — flask-socketio has its own async server via `eventlet` or `gevent`)
- Add `pip install flask-socketio eventlet` to `requirements.txt`
- Create Socket.IO event emitters that push data when state changes:
  - `workers:update` — emitted when worker list changes (spawn, kill, status change)
  - `worker:output` — emitted per-worker with terminal output (replaces the 1s polling in TerminalView)
  - `activity:update` — emitted when proposals or git changes detected
  - `usage:update` — emitted when usage stats refresh
  - `metrics:update` — emitted with system metrics on interval (server-side push, not client poll)
- Change `start.sh` to use `socketio.run(app)` instead of `app.run()` — flask-socketio handles its own production server
- Add a background thread that monitors for changes and emits events (rather than clients polling)
- Keep all existing REST endpoints working — WebSocket is additive, REST is the fallback

**Frontend (`web/src/`):**
- Add `socket.io-client` npm dependency
- Create `src/socket.js` — singleton socket connection with auto-reconnect
- Replace all `setInterval` polling in components with socket event listeners:
  - `WorkerDashboard.jsx` — listen for `workers:update` and `usage:update`
  - `TerminalView.jsx` — listen for `worker:output` (this is the biggest UX win — near-instant terminal streaming)
  - `Activity.jsx` — listen for `activity:update`
  - `Monitor.jsx` — listen for `metrics:update`
  - `FileTree.jsx` — listen for `files:update` (or keep polling at 5s since file changes are infrequent — lower priority)
- Each component: remove `setInterval`/`clearInterval`, add `useEffect` with socket `.on()` and cleanup `.off()`

**Connection status:**
- The socket connection itself provides connection state — use this for the reconnection/offline indicator (see upgrade #6 below, can be done together)

### Key Decisions
- Use `eventlet` as the async driver (simpler than gevent, works with flask-socketio out of the box)
- Server pushes on change, not on a timer — terminal output is the exception (needs a small server-side polling loop reading `capture_output` and pushing diffs)
- For terminal streaming: server polls tmux `capture_output` every 500ms per active terminal tab, pushes only when output changes (hash comparison). Client sends `terminal:subscribe`/`terminal:unsubscribe` events to control which workers are being streamed.
- Keep REST endpoints — they're useful for one-off calls (spawn, kill, send) and the test suite

### Files to Change
- `api/requirements.txt` — add flask-socketio, eventlet
- `api/server.py` — add SocketIO init, event emitters, background monitoring thread
- `web/package.json` — add socket.io-client
- `web/src/socket.js` — new file, singleton connection
- `web/src/components/WorkerDashboard.jsx` — replace polling with socket
- `web/src/components/TerminalView.jsx` — replace polling with socket
- `web/src/components/Activity.jsx` — replace polling with socket
- `web/src/components/Monitor.jsx` — replace polling with socket
- `web/src/components/FileTree.jsx` — replace polling with socket (optional, lower priority)
- `start.sh` — change startup command to use socketio.run()

### Testing
- All 19 existing API tests should still pass (REST endpoints unchanged)
- Manual: open UI, spawn worker, watch terminal tab update in real-time
- Manual: kill API, verify UI shows disconnection state, restart API, verify reconnection

---

## 2. Loading / Skeleton States

### Why
Components currently pop in from nothing when data loads. On initial page load or after a reconnect, there's a flash of empty content before data appears. Skeleton placeholders are standard for any React dashboard — they signal "loading" vs "empty" and prevent layout shift.

### What Changes
- Create a simple `Skeleton` component (a pulsing gray rectangle) — no library needed, just a CSS animation on a div
- Add skeleton states to:
  - `WorkerDashboard.jsx` — show 2-3 skeleton cards before workers load
  - `FileTree.jsx` — show skeleton lines before file tree loads
  - `Activity.jsx` — show skeleton rows before activity loads
  - `Monitor.jsx` — show skeleton metric boxes before data loads
- Each component gets a `loading` state (true initially, false after first data fetch)
- Skeleton matches the approximate shape/size of the real content

### Implementation
```jsx
// Simple skeleton component pattern
const Skeleton = ({ width, height, style }) => (
  <div style={{
    width, height,
    background: 'var(--bg-tertiary)',
    borderRadius: '6px',
    animation: 'pulse 1.5s ease-in-out infinite',
    ...style,
  }} />
)
```

Add to `index.css`:
```css
@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
```

### Files to Change
- `web/src/index.css` — add pulse animation
- `web/src/components/WorkerDashboard.jsx` — add loading state + skeletons
- `web/src/components/FileTree.jsx` — add loading state + skeletons
- `web/src/components/Activity.jsx` — add loading state + skeletons
- `web/src/components/Monitor.jsx` — add loading state + skeletons

---

## 3. Toast / Notification System

### Why
Actions like spawn, kill, send message, approve proposal have no visual confirmation beyond state changes in the component. The user clicks "Kill" and the worker just disappears — there's no "Worker killed" feedback. A toast notification system is expected UX for any dashboard app.

### What Changes
- Create `ToastProvider` context and `Toast` component
- Auto-dismiss after 3-4 seconds, stack multiple toasts
- Types: success (green), error (red), info (blue)
- Position: bottom-right on desktop, bottom-center on mobile (above nav)
- Add toast calls to all user-initiated actions:
  - Spawn worker → "Worker 'name' spawning..."
  - Kill worker → "Worker 'name' killed"
  - Send message → "Message sent"
  - Approve/reject proposal → "Proposal approved/rejected"
  - RC/Compact/Reset → "Sent /rc to 'name'" etc.
  - Errors → red toast with error message (replaces `alert()` calls)

### Implementation
- `ToastContext` with `addToast(message, type)` function
- Wrap app in `ToastProvider` in `main.jsx`
- `useToast()` hook in components
- Toast container renders toasts with CSS transitions (slide in/out)
- Replace all `alert()` calls in WorkerDashboard with toast calls

### Files to Change
- `web/src/components/Toast.jsx` — new file (ToastProvider + Toast component)
- `web/src/main.jsx` — wrap in ToastProvider
- `web/src/components/WorkerDashboard.jsx` — replace alert() with toast, add success toasts
- `web/src/components/Activity.jsx` — add toast on proposal approve/reject
- `web/src/components/SpawnDialog.jsx` — add toast on spawn success

---

## 4. Keyboard Shortcuts

### Why
The target audience (developers using Claude Code) are keyboard-driven users. Every developer tool worth its salt has keyboard shortcuts. Process managers without them feel incomplete.

### What Changes
- Global keyboard shortcut handler (event listener on `document`)
- Shortcuts (desktop only, disabled when an input/textarea is focused):
  - `n` — open spawn dialog (new worker)
  - `1-9` — select worker by index
  - `t` — open terminal tab for selected worker
  - `Esc` — close active tab or dialog
  - `m` — open monitor tab
  - `?` — show shortcuts help overlay
- Show shortcuts hint in the UI (small `?` button or footer text)

### Implementation
- Create `useKeyboardShortcuts(shortcuts)` hook
- Register in `App.jsx` with action callbacks
- Guard: skip when `document.activeElement` is an input/textarea/select
- Shortcuts help: simple overlay component listing all shortcuts

### Files to Change
- `web/src/hooks/useKeyboardShortcuts.js` — new file
- `web/src/App.jsx` — register shortcuts
- `web/src/components/ShortcutsHelp.jsx` — new file (overlay listing shortcuts)

---

## 5. Responsive Error Handling

### Why
API errors currently show as raw text or silently fail. If the API is down, components just show stale data or empty state with no indication of what's wrong. Consistent error states with retry options are standard.

### What Changes
- Create an `ErrorState` component (icon + message + retry button)
- Add error handling to each data-fetching component:
  - On fetch error: show ErrorState instead of empty content
  - Retry button re-triggers the fetch
  - Error auto-clears when next fetch succeeds
- This pairs with WebSocket — on disconnect, show a banner; on reconnect, clear it

### Implementation
```jsx
const ErrorState = ({ message, onRetry }) => (
  <div style={styles.errorContainer}>
    <span style={styles.errorIcon}>!</span>
    <span style={styles.errorMessage}>{message || 'Failed to load'}</span>
    {onRetry && <button style={styles.retryBtn} onClick={onRetry}>Retry</button>}
  </div>
)
```

### Files to Change
- `web/src/components/ErrorState.jsx` — new file
- `web/src/components/WorkerDashboard.jsx` — add error state
- `web/src/components/FileTree.jsx` — add error state
- `web/src/components/Activity.jsx` — add error state
- `web/src/components/Monitor.jsx` — add error state

---

## 6. Connection Status / Offline Indicator

### Why
If the API goes down (restart, crash, network issue), the UI shows stale data with no indication that it's disconnected. A connection status banner is standard for any real-time dashboard. This is especially important since API restarts are expected (deploying new code, config changes).

### What Changes
- Show a banner at the top of the page when disconnected: "Connection lost — reconnecting..."
- Auto-hide when reconnected, briefly show "Reconnected" in green
- Integrate with WebSocket connection state (if WebSocket upgrade is done first, this comes almost free)
- If WebSocket is not yet implemented, use a simple heartbeat polling `/api/health` every 5s

### Implementation
Best done together with the WebSocket upgrade. The socket.io client provides `connect`, `disconnect`, `reconnect` events out of the box.

```jsx
// In App.jsx or a ConnectionBanner component
const [connected, setConnected] = useState(true)
useEffect(() => {
  socket.on('connect', () => setConnected(true))
  socket.on('disconnect', () => setConnected(false))
  return () => { socket.off('connect'); socket.off('disconnect') }
}, [])
```

### Files to Change
- `web/src/components/ConnectionBanner.jsx` — new file
- `web/src/App.jsx` — render ConnectionBanner at top

---

## 7. Dark / Light Theme Toggle

### Why
Table stakes for developer tools. The app already uses CSS variables (`--bg-primary`, `--text-primary`, etc.) throughout — the infrastructure is 90% there. Just need a toggle and a light theme definition.

### What Changes
- Define light theme CSS variables alongside the existing dark ones
- Add a theme toggle button (sun/moon icon) in the header area
- Persist preference in `localStorage`
- Apply theme class to `<html>` element

### Implementation
In `index.css`:
```css
:root { /* existing dark theme vars */ }
:root.light {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --text-primary: #1a1a2e;
  --text-secondary: #6b7280;
  --border: #e0e0e0;
  /* etc. */
}
```

In `App.jsx`:
```jsx
const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
useEffect(() => {
  document.documentElement.className = theme === 'light' ? 'light' : ''
  localStorage.setItem('theme', theme)
}, [theme])
```

### Files to Change
- `web/src/index.css` — add `:root.light` variables
- `web/src/App.jsx` — add theme state + toggle button
- No component changes needed — they all use CSS variables already

---

## Recommended Implementation Order

1. **WebSocket upgrade** (#1) — foundational, everything else builds on it
2. **Connection status** (#6) — comes almost free with WebSocket
3. **Toast notifications** (#3) — independent, high UX impact
4. **Loading skeletons** (#2) — independent, high visual polish impact
5. **Error handling** (#5) — builds on connection awareness
6. **Keyboard shortcuts** (#4) — independent, power user feature
7. **Theme toggle** (#7) — independent, cosmetic, lowest priority

Items 2-7 are independent of each other and can be done in any order or in parallel. Item 1 should be done first as it's the biggest architectural change and items 2 and 6 build on it.

---

## Gunicorn Note

Gunicorn was attempted in this session but had issues with sync workers blocking on tmux subprocess calls. The WebSocket upgrade solves this naturally — `flask-socketio` with `eventlet` provides its own production-grade async server. Do NOT add gunicorn separately; let the WebSocket upgrade handle production serving.

The `gunicorn` entry in `requirements.txt` can be removed during the WebSocket upgrade since `flask-socketio` + `eventlet` replaces it.

---

## Quick Reference: Current Architecture

```
Web UI (React, :3000 dev / served by Flask prod)
  ↓ HTTP (polling every 1-5s)
Flask API (:5001)
  ↓ subprocess
tmux manager (socket: orchestrator)
  ↓ windows
workers (claude --model <model>)
```

After WebSocket upgrade:
```
Web UI (React)
  ↓ WebSocket (persistent connection, server push)
  ↓ HTTP (one-off actions: spawn, kill, send)
Flask-SocketIO (:5001, eventlet async server)
  ↓ subprocess
tmux manager (socket: orchestrator)
  ↓ windows
workers (claude --model <model>)
```
