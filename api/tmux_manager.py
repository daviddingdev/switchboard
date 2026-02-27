"""
tmux manager for orchestrator worker sessions.

Manages a tmux session called 'orchestrator' with a custom socket,
allowing multiple Claude Code workers to run in parallel.
"""

import subprocess
import os
import time
from datetime import datetime

SOCKET_NAME = "orchestrator"
SESSION_NAME = "orchestrator"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs", "workers")


def _run_tmux(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a tmux command with the orchestrator socket."""
    cmd = ["tmux", "-L", SOCKET_NAME] + list(args)
    # Strip CLAUDECODE from env to avoid nested session detection
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    return subprocess.run(cmd, capture_output=True, text=True, check=check, env=env)


def ensure_session() -> bool:
    """
    Ensure the orchestrator tmux session exists.
    Creates it with a 'partner' window if it doesn't exist.
    Returns True if session is ready.
    """
    # Check if session exists
    result = _run_tmux("has-session", "-t", SESSION_NAME, check=False)
    if result.returncode == 0:
        return True

    # Create session with partner window
    result = _run_tmux(
        "new-session", "-d", "-s", SESSION_NAME, "-n", "partner",
        "-c", PROJECT_ROOT,
        check=False
    )
    if result.returncode != 0:
        return False

    # Start Claude Code in partner window (unset CLAUDECODE to avoid nested session error)
    _run_tmux("send-keys", "-t", f"{SESSION_NAME}:partner", "unset CLAUDECODE && claude", "Enter", check=False)
    return True


def list_windows() -> list[dict]:
    """
    List all windows in the orchestrator session.
    Returns list of {index, name, pid} dicts.
    """
    result = _run_tmux(
        "list-windows", "-t", SESSION_NAME,
        "-F", "#{window_index}|#{window_name}|#{pane_pid}",
        check=False
    )
    if result.returncode != 0:
        return []

    windows = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|")
        if len(parts) >= 3:
            windows.append({
                "index": int(parts[0]),
                "name": parts[1],
                "pid": int(parts[2]) if parts[2].isdigit() else None
            })
    return windows


def spawn_worker(name: str, directory: str) -> dict:
    """
    Spawn a new Claude Code worker in a tmux window.

    Args:
        name: Window name for the worker
        directory: Working directory (~ expansion supported)

    Returns:
        Dict with {name, directory, status, pid}

    Raises:
        ValueError: If directory doesn't exist
    """
    # Expand and validate directory
    expanded_dir = os.path.expanduser(directory)
    if not os.path.isdir(expanded_dir):
        raise ValueError(f"Directory does not exist: {expanded_dir}")

    # Ensure logs directory exists
    os.makedirs(LOGS_DIR, exist_ok=True)

    # Rotate existing log if present (so current session is always fresh)
    log_file = os.path.join(LOGS_DIR, f"{name}.log")
    if os.path.exists(log_file):
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        rotated = os.path.join(LOGS_DIR, f"{name}-{timestamp}.log")
        os.rename(log_file, rotated)

    # Create new window with larger scrollback
    result = _run_tmux(
        "new-window", "-t", SESSION_NAME, "-n", name, "-c", expanded_dir,
        check=False
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create window: {result.stderr}")

    # Set large scrollback buffer for this window
    _run_tmux("set-option", "-t", f"{SESSION_NAME}:{name}", "history-limit", "50000", check=False)

    # Start logging output to file (fresh file, old one was rotated above)
    _run_tmux("pipe-pane", "-t", f"{SESSION_NAME}:{name}", f"cat > {log_file}", check=False)

    # Start Claude Code
    _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "unset CLAUDECODE && claude", "Enter", check=False)

    # Wait for Claude to start and show trust prompt
    time.sleep(2)

    # Auto-confirm trust prompt (select "1. Yes, I trust this folder")
    # This is safe because user explicitly chose to spawn in this directory
    _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "1", check=False)
    time.sleep(0.2)
    _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "Enter", check=False)

    # Get the pane PID
    pid = get_pane_pid(name)

    return {
        "name": name,
        "directory": expanded_dir,
        "status": "running",
        "pid": pid,
        "log_file": log_file
    }


def kill_worker(name: str) -> bool:
    """
    Kill a worker window.
    Returns True if successful.
    """
    result = _run_tmux("kill-window", "-t", f"{SESSION_NAME}:{name}", check=False)
    return result.returncode == 0


def send_keys(name: str, text: str, raw: bool = False) -> bool:
    """
    Send text input to a worker window.

    Args:
        name: Window name
        text: Text to send, or special key name if raw=True
        raw: If True, send as tmux key (Escape, Enter, C-c, etc.) without -l flag

    Returns True if successful.
    """
    if raw:
        # Send as raw tmux key (for Escape, Enter, C-c, etc.)
        result = _run_tmux(
            "send-keys", "-t", f"{SESSION_NAME}:{name}", text,
            check=False
        )
        return result.returncode == 0
    else:
        # Send the text literally (handles special characters)
        result = _run_tmux(
            "send-keys", "-l", "-t", f"{SESSION_NAME}:{name}", "--", text,
            check=False
        )
        if result.returncode != 0:
            return False

        # Send Enter
        result = _run_tmux(
            "send-keys", "-t", f"{SESSION_NAME}:{name}", "Enter",
            check=False
        )
        return result.returncode == 0


def capture_output(name: str, lines: int = 100) -> str:
    """
    Capture recent output from a worker's pane.

    Args:
        name: Window name
        lines: Number of lines to capture (from bottom)

    Returns:
        Captured terminal output as string
    """
    # Capture more than requested to handle remote-control mode blank lines
    capture_lines = max(lines * 5, 1000)
    result = _run_tmux(
        "capture-pane", "-t", f"{SESSION_NAME}:{name}",
        "-p", f"-S", f"-{capture_lines}",
        check=False
    )
    if result.returncode != 0:
        return ""

    # Strip trailing empty lines and return last N non-trivial lines
    output_lines = result.stdout.rstrip('\n').split('\n')
    # Filter to non-empty lines
    non_empty = [l for l in output_lines if l.strip()]
    # Return the last 'lines' worth, rejoined
    return '\n'.join(non_empty[-lines:])


def get_pane_pid(name: str) -> int | None:
    """
    Get the PID of the shell process in a window's pane.

    Args:
        name: Window name

    Returns:
        PID as int, or None if not found
    """
    result = _run_tmux(
        "list-panes", "-t", f"{SESSION_NAME}:{name}",
        "-F", "#{pane_pid}",
        check=False
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None

    pid_str = result.stdout.strip().split("\n")[0]
    return int(pid_str) if pid_str.isdigit() else None
