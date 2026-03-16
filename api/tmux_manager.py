"""
tmux manager for Switchboard worker sessions.

Manages a tmux session called 'switchboard' with a custom socket,
allowing multiple Claude Code workers to run in parallel.
"""

import subprocess
import os
import re
import time
from datetime import datetime

SOCKET_NAME = "switchboard"
SESSION_NAME = "switchboard"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs", "workers")


def configure(socket_name=None, session_name=None):
    """Override tmux socket and session names from config."""
    global SOCKET_NAME, SESSION_NAME
    if socket_name:
        SOCKET_NAME = socket_name
    if session_name:
        SESSION_NAME = session_name


def _run_tmux(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a tmux command with the Switchboard socket."""
    cmd = ["tmux", "-L", SOCKET_NAME] + list(args)
    # Strip CLAUDECODE from env to avoid nested session detection
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    return subprocess.run(cmd, capture_output=True, text=True, check=check, env=env)


def _session_exists() -> bool:
    """Check if the Switchboard tmux session exists."""
    result = _run_tmux("has-session", "-t", SESSION_NAME, check=False)
    return result.returncode == 0


def ensure_session() -> str:
    """
    Check if the tmux session exists and return its state.
    Session is created lazily on first worker spawn, not here.
    """
    if _session_exists():
        return "active"
    return "inactive"


def _wait_for_prompt(name: str, timeout: int = 30) -> bool:
    """
    Poll pane output for Claude Code's '>' input prompt, indicating readiness.
    Returns True if prompt detected within timeout, False otherwise.
    """
    start = time.time()
    while time.time() - start < timeout:
        output = capture_output(name, lines=10)
        if output:
            for line in output.strip().split('\n')[-3:]:
                stripped = line.strip()
                if stripped in ('>', '❯'):
                    return True
        time.sleep(1)
    return False


def list_windows() -> list[dict]:
    """
    List all windows in the Switchboard session.
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


def spawn_worker(name: str, directory: str, session_label: str = None, enable_rc: bool = True, model: str = None) -> dict:
    """
    Spawn a new Claude Code worker in a tmux window.

    Creates the tmux window and starts Claude Code immediately (fast),
    then configures the session (wait for prompt, label, RC) in the background.

    Args:
        name: Window name for the worker
        directory: Working directory (~ expansion supported)
        session_label: First message to type (becomes session name in Claude Code UI)
        enable_rc: If True, send /rc after Claude is ready (default: True)

    Returns:
        Dict with {name, directory, status, pid, log_file}

    Raises:
        ValueError: If directory doesn't exist
        RuntimeError: If window creation fails
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

    # Create window (and session if needed)
    if _session_exists():
        result = _run_tmux(
            "new-window", "-t", f"{SESSION_NAME}:", "-n", name, "-c", expanded_dir,
            check=False
        )
    else:
        result = _run_tmux(
            "new-session", "-d", "-s", SESSION_NAME, "-n", name, "-c", expanded_dir,
            check=False
        )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to create window: {result.stderr}")

    # Set large scrollback buffer for this window
    _run_tmux("set-option", "-t", f"{SESSION_NAME}:{name}", "history-limit", "50000", check=False)

    # Start logging output to file (fresh file, old one was rotated above)
    _run_tmux("pipe-pane", "-t", f"{SESSION_NAME}:{name}", f"cat > {log_file}", check=False)

    # Start Claude Code
    claude_cmd = "unset CLAUDECODE && claude"
    if model:
        claude_cmd += f" --model {model}"
    _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", claude_cmd, "Enter", check=False)

    # Get the pane PID (available immediately after window creation)
    pid = get_pane_pid(name)

    return {
        "name": name,
        "directory": expanded_dir,
        "status": "starting",
        "pid": pid,
        "log_file": log_file
    }


def setup_worker(name: str, session_label: str = None, enable_rc: bool = True):
    """
    Configure a spawned worker (wait for prompt, handle trust, send label, enable RC).
    Called in a background thread after spawn_worker returns.
    """
    try:
        # Wait for Claude to be ready
        if not _wait_for_prompt(name, timeout=30):
            time.sleep(2)

        # Check if trust prompt is showing
        output = capture_output(name, lines=20)
        if re.search(r'trust this (folder|directory|project|workspace)', output, re.IGNORECASE):
            _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "1", check=False)
            time.sleep(0.2)
            _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "Enter", check=False)
            _wait_for_prompt(name, timeout=30)

        # Send session label
        if session_label:
            _run_tmux("send-keys", "-l", "-t", f"{SESSION_NAME}:{name}", "--", session_label, check=False)
            time.sleep(0.1)
            _run_tmux("send-keys", "-t", f"{SESSION_NAME}:{name}", "Enter", check=False)
            if enable_rc:
                _wait_for_prompt(name, timeout=30)

        # Enable remote control
        if enable_rc:
            send_keys(name, '/rc', raw=False)
    except Exception:
        pass  # Worker may have been killed during setup


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


def get_pane_cwd(name: str) -> str | None:
    """
    Get the current working directory of a window's pane.

    Args:
        name: Window name

    Returns:
        Directory path as string, or None if not found
    """
    result = _run_tmux(
        "list-panes", "-t", f"{SESSION_NAME}:{name}",
        "-F", "#{pane_current_path}",
        check=False
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None

    return result.stdout.strip().split("\n")[0]
