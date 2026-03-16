# Security

## Design Assumptions

Switchboard is designed for **localhost use only**. It assumes:

- The API and web UI (port 5001) are not exposed to the internet
- Only trusted users have access to the host machine
- No authentication is implemented — all API endpoints are open

**Do not expose Switchboard ports to the public internet.**

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
