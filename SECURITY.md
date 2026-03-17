# Security

## Design Assumptions

Switchboard is designed for **localhost use only**. It assumes:

- The API and web UI (port 5001) are not exposed to the internet
- Only trusted users have access to the host machine
- No authentication is implemented — all API endpoints are open

**Do not expose Switchboard ports to the public internet.**

## Worker Access Model

All workers run as the same OS user with identical filesystem access. The project directory chosen at spawn determines the **starting context** — which folder tools default to, which `CLAUDE.md` is loaded — but it is not a sandbox.

A worker spawned in `~/project-a`:
- Starts in `~/project-a` and loads `~/project-a/CLAUDE.md`
- Its tools (Read, Glob, Grep, Bash) default to that directory
- Has no inherent reason to access other projects

But nothing prevents it. The same worker **can** read, write, or execute anything the OS user can. If prompted to read `~/project-b/secrets.json`, it will — same user, same permissions.

Via the Switchboard API, the boundary is even more explicit: any worker can call `GET /api/file?path=~/anything` to read files from any project, regardless of where it was spawned. Workers can also list all projects, read other workers' terminal output, and send commands to other workers.

**In short:** same access, different defaults. Project directories scope attention, not permissions. There is no per-worker isolation, sandboxing, or access control.

## Reporting Vulnerabilities

If you find a security issue, please open a GitHub issue. Since this tool is designed for local use, most security concerns relate to:

- Path traversal in file/directory handling
- Command injection via user inputs passed to subprocess
- Unvalidated inputs that could affect tmux sessions

## What We Do

- Directory paths are expanded and validated before use
- Proposal IDs are validated with regex before filesystem operations
- Subprocess calls use list form (not shell strings) to prevent injection
- System update package names are validated against allowed characters
- The `CLAUDECODE` environment variable is stripped to prevent nested session issues

## What We Don't Do (by design)

- Authentication or authorization — localhost assumption
- HTTPS — intended for local network only
- Rate limiting — single-user tool
- Input sanitization for tmux send-keys — trusted local user
