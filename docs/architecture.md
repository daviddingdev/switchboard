# Orchestrator Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (Mac / Phone / anywhere)                               │
│  React App served from Spark                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP + WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  SPARK SERVER (100.69.237.80)                                   │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Flask API       │  │ WebSocket       │  │ Static Files    │ │
│  │ :5001/api/*     │  │ :5001/ws/*      │  │ :5001/          │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘ │
│           │                    │                                │
│           ▼                    ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ tmux socket: /tmp/orchestrator.sock                        ││
│  │                                                             ││
│  │  session: orchestrator                                      ││
│  │  ├── window 0: partner (master Claude Code)                ││
│  │  ├── window 1: family-vault                                ││
│  │  ├── window 2: research                                    ││
│  │  └── window N: ...                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  State: ~/orchestrator/state/                                   │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Processes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/processes` | List all workers + children |
| POST | `/api/processes` | Spawn new worker |
| DELETE | `/api/processes/:id` | Kill worker |
| POST | `/api/processes/:id/send` | Send command to worker |
| GET | `/api/processes/:id/output` | Get recent output |

### Plans

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/plans` | List all plans |
| GET | `/api/plans/:id` | Get plan details |
| PATCH | `/api/plans/:id` | Update status (approve/reject) |
| POST | `/api/plans/:id/execute` | Execute approved plan |

### WebSocket

| Event | Direction | Purpose |
|-------|-----------|---------|
| `terminal:output` | Server → Client | Stream terminal output |
| `terminal:input` | Client → Server | Send keystrokes |
| `terminal:resize` | Client → Server | Resize terminal |
| `process:status` | Server → Client | Status changes |
| `plan:new` | Server → Client | New plan detected |

## tmux Manager

Python module wrapping tmux commands:

```python
# api/tmux_manager.py

SOCKET = "/tmp/orchestrator.sock"
SESSION = "orchestrator"

def spawn_worker(name: str, directory: str) -> dict:
    """Spawn new Claude Code worker in tmux window."""
    cmd = f"cd {directory} && claude"
    subprocess.run([
        "tmux", "-L", SOCKET.split('/')[-1].replace('.sock', ''),
        "new-window", "-t", SESSION,
        "-n", name, cmd
    ])
    return {"name": name, "status": "running"}

def send_to_worker(name: str, text: str):
    """Send text to worker's terminal."""
    subprocess.run([
        "tmux", "-L", "orchestrator",
        "send-keys", "-t", f"{SESSION}:{name}",
        text, "Enter"
    ])

def capture_output(name: str, lines: int = 100) -> str:
    """Capture recent terminal output."""
    result = subprocess.run([
        "tmux", "-L", "orchestrator",
        "capture-pane", "-t", f"{SESSION}:{name}",
        "-p", "-S", f"-{lines}"
    ], capture_output=True, text=True)
    return result.stdout

def list_windows() -> list:
    """List all tmux windows in session."""
    result = subprocess.run([
        "tmux", "-L", "orchestrator",
        "list-windows", "-t", SESSION,
        "-F", "#{window_index}:#{window_name}:#{window_active}"
    ], capture_output=True, text=True)
    windows = []
    for line in result.stdout.strip().split('\n'):
        if line:
            idx, name, active = line.split(':')
            windows.append({
                "index": int(idx),
                "name": name,
                "active": active == "1"
            })
    return windows

def kill_window(name: str):
    """Kill a tmux window."""
    subprocess.run([
        "tmux", "-L", "orchestrator",
        "kill-window", "-t", f"{SESSION}:{name}"
    ])

def get_child_processes(worker_pid: int) -> list:
    """Get child processes of a worker."""
    result = subprocess.run(
        ["pstree", "-p", str(worker_pid)],
        capture_output=True, text=True
    )
    # Parse pstree output to get child PIDs
    # Returns list of {pid, name, status}
    pass
```

## State Schema

### processes.yaml

```yaml
workers:
  partner:
    tmux_window: 0
    directory: ~/orchestrator
    status: running
    pid: 12345
    started_at: 2026-02-17T09:00:00Z
    children: []

  family-vault:
    tmux_window: 1
    directory: ~/family-vault
    status: running
    pid: 12400
    started_at: 2026-02-17T09:05:00Z
    children:
      - name: pytest
        pid: 12410
        type: job
        status: complete
      - name: npm build
        pid: 12420
        type: job
        status: running
        progress: "67%"
```

### plan.yaml (per project)

```yaml
# Written by worker to its project directory
id: plan-001
title: Deploy to Mom
created_at: 2026-02-17T14:30:00Z
status: pending  # pending | approved | rejected | executing | complete

steps:
  - Run final UI tests
  - Build production bundle
  - Deploy to Spark (port 5000)
  - Send mom the link

estimate_minutes: 25
risk: low
notes: Deploying at 10am EST so mom is awake
```

## Frontend Components

```
<App>
├── <ChatArea>               # Left side, primary
│   ├── <MessageList>
│   │   ├── <UserMessage>
│   │   ├── <PartnerMessage>
│   │   ├── <StatusMessage>  # Compact inline status
│   │   └── <PlanCard>       # Inline plan with approve/reject
│   └── <ChatInput>
│
└── <Sidebar>                # Right side
    ├── <ProcessTree>
    │   └── <ProcessRow>     # Worker or child process
    ├── <TerminalView>       # xterm.js
    └── <WorkerInput>        # Direct command to worker
```

## Terminal Streaming Options

### Option A: Custom WebSocket + tmux

```
Browser ↔ WebSocket ↔ Flask ↔ tmux capture-pane (polling)
```
- Pros: Full control
- Cons: Not real-time, have to poll

### Option B: pty + WebSocket

```
Browser ↔ WebSocket ↔ Flask ↔ pty attached to tmux pane
```
- Pros: Real-time
- Cons: More complex

### Option C: ttyd

```
Browser ↔ ttyd (standalone) ↔ tmux attach
```
- Pros: Turnkey, proven
- Cons: Separate process, less integration

**Recommendation**: Start with Option A (polling), upgrade to B or C if needed.

## Build Phases

### Phase 1: Backend Core
- [ ] Flask app skeleton
- [ ] tmux_manager.py
- [ ] /api/processes endpoints
- [ ] processes.yaml read/write

### Phase 2: Frontend Shell
- [ ] Vite + React setup
- [ ] Layout (chat left, sidebar right)
- [ ] Process tree (static mock)
- [ ] Wire to API

### Phase 3: Terminal Integration
- [ ] xterm.js component
- [ ] WebSocket connection
- [ ] Polling output from tmux

### Phase 4: Chat + Plans
- [ ] Chat message components
- [ ] Plan card component
- [ ] Plan detection (poll project dirs)
- [ ] Approve/reject flow

### Phase 5: Polish
- [ ] Real-time updates
- [ ] Child process tracking
- [ ] Error handling
- [ ] Mobile responsive
