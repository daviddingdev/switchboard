# Security

## Design Assumptions

Switchboard is designed for **localhost and trusted network use**. It assumes:

- The API and web UI (port 5001) are on a trusted network
- Only trusted users have access to the host machine
- Optional single-password auth is available via setup wizard or `SWITCHBOARD_PASSWORD` env var

**Optional auth is a convenience layer, not a hardened security boundary.** It uses Flask session cookies and is suitable for keeping casual access out on a home network. It is not a substitute for proper network isolation if Switchboard is exposed to untrusted networks.

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
- File read/write confined to project root directory (parent of Switchboard install) via realpath validation. Override with `project_root` in `config.yaml`
- File editing uses last-write-wins (acceptable for personal tool, no concurrent edit protection)
- Proposal IDs are validated with regex before filesystem operations
- Log viewer validates worker names and filenames against strict patterns
- Subprocess calls use list form (not shell strings) to prevent injection
- System update package names are validated against allowed characters (system updates require `sudo` access)
- The `CLAUDECODE` environment variable is stripped to prevent nested session issues
- Optional auth: session cookies, WebSocket auth on connect, HTTP Basic Auth fallback
- Setup wizard password stored as SHA-256 hash in `state/auth.json` (gitignored)
- Auth secret key auto-generated and persisted to `state/secret.key` (gitignored) to survive restarts
- Setup endpoints (`/api/setup/status`, `/api/setup`, `/api/setup/apply-global`) are auth-exempt
- Worker log filenames validated against strict patterns before filesystem access

## What We Don't Do (by design)

- HTTPS — intended for local network only (use a reverse proxy for TLS)
- Rate limiting — single-user tool
- Input sanitization for tmux send-keys — trusted local user
- Multi-user access control — single password shared by all users
