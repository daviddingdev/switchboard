# Orchestrator Design Session — Feb 17, 2026

## Summary

This document captures the design conversation that led to the orchestrator architecture.

## Key Decisions Made

### 1. Orchestrator is a Peer, Not a Parent
- Lives in `~/orchestrator/` alongside other projects
- Doesn't wrap other project directories
- Has access to all projects (same user), but doesn't own them

### 2. Partner Model, Not PM Model
- Rejected formal PM methodology (standups, initiatives, portfolio tracking)
- Instead: conversational partner that can see and control workers
- Partner IS a Claude Code session, exposed via chat UI
- Value is reducing friction, not adding process

### 3. Process Tree, Not Project Tree
- Track what's running (workers + their children)
- Workers spawn subprocesses (models, servers, scripts)
- Need visibility into the whole tree
- Kill anything at any level

### 4. Workers Self-Report
- Each project maintains its own CLAUDE.md
- Workers write plan.yaml when they have a plan
- Partner reads plans, doesn't derive them
- Keeps partner context light

### 5. Plans Appear in Chat
- No separate "plans" tab
- Plans surface inline in conversation
- Approve/Edit/Reject buttons right there
- Reduces context switching

### 6. Start Simple
- Raw terminal output first
- Polish into chat UI later
- Polling before WebSockets
- Add complexity only when needed

## Architecture Evolution

### First Idea: Orchestrator as PM
- Formal project tracking
- Initiatives, standups, decisions logs
- Rejected as too heavy for solo operator

### Second Idea: Portfolio Manager  
- Track status across projects
- Prioritize, allocate attention
- Rejected — David knows his priorities

### Final Model: Partner + Workers
- Partner = conversational interface + control plane
- Workers = Claude Code sessions doing actual work
- UI = chat + process tree + terminals
- Simple state files, no heavy methodology

## Technical Choices

| Choice | Decision | Reasoning |
|--------|----------|-----------|
| State storage | YAML files | Human-readable, git-friendly |
| Terminal streaming | Polling first | Simpler, upgrade later |
| Partner implementation | Claude Code session | Stateful, same as workers |
| Process tracking | tmux + pstree | Already using tmux |
| Frontend | React + xterm.js | Standard, well-documented |
| Backend | Flask + SocketIO | Simple, Python |

## UI Design

Three mockups created:
1. `orchestrator-dashboard.jsx` — Initial digest-focused view
2. `orchestrator-pm.jsx` — PM-style with plan cards
3. `orchestrator-partner.jsx` — Final chat-primary design

Final design features:
- Chat as primary interface (left)
- Process tree in sidebar (right)
- Terminal view for selected process
- Plans appear inline in chat
- Approve/reject buttons on plan cards

## Open Questions for Implementation

1. How does partner detect new plans? (Poll files vs API notification)
2. Terminal streaming: xterm.js custom or ttyd?
3. Child process tracking: pstree polling vs explicit registration?

## Build Order

1. Directory structure + state schema ✓
2. Flask API (spawn/kill/list)
3. tmux manager
4. React shell + process tree
5. Wire API to UI
6. xterm.js terminals
7. Chat interface
8. Plan detection + approval

## What's NOT in MVP

- Overnight queue/executor
- Digest generation  
- Claude Desktop MCP
- Phone PWA
- Formal PM methodology

## Related Context

- **Infrastructure**: Spark server ready (UPS, auto-boot, Tailscale)
- **SSH**: `ssh spark` works with key auth
- **Family Vault**: Existing project, ~85% done
- **Timeline**: MVP before LA trip (~1 month)
