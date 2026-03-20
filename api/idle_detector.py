"""Idle detection for Switchboard workers.

Provides HTTP hook endpoints and JSONL-based idle monitoring.
"""

import json
import os
import threading
import time

from flask import Blueprint, request
import tmux_manager as tmux

bp = Blueprint('idle', __name__)
_ctx = None


def init(ctx):
    """Initialize with shared context."""
    global _ctx
    _ctx = ctx


def _worker_name_from_session(session_id):
    """Reverse-lookup worker name from session file path or session ID."""
    for name, filepath in _ctx.worker_sessions.items():
        if session_id and session_id in filepath:
            return name
    return None


def _worker_name_from_cwd(cwd):
    """Find worker name by matching cwd to tmux pane working directory."""
    if not cwd:
        return None
    try:
        windows = tmux.list_windows()
        for w in windows:
            pane_cwd = tmux.get_pane_cwd(w['name'])
            if pane_cwd and os.path.realpath(pane_cwd) == os.path.realpath(cwd):
                return w['name']
    except Exception:
        pass
    return None


def _check_session_idle(filepath):
    """Parse JSONL session file to determine if Claude is idle.

    Reads the last ~8KB, skips progress entries, and checks:
    - Last assistant entry with text-only content (no tool_use) = idle
    - Last assistant entry with tool_use = active (tool execution pending)
    - Last entry is user with text (not tool_result) = user just submitted, active
    """
    try:
        file_size = os.path.getsize(filepath)
        read_size = min(file_size, 8192)

        with open(filepath, 'r', encoding='utf-8') as f:
            if file_size > read_size:
                f.seek(file_size - read_size)
                f.readline()  # skip partial line
            lines = f.readlines()

        # Parse entries, skip progress
        last_assistant_content_types = None
        last_entry_type = None
        last_user_content_types = None

        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            entry_type = entry.get('type')
            if entry_type not in ('assistant', 'user'):
                continue  # skip progress, system, hook_progress, etc.

            last_entry_type = entry_type

            if entry_type == 'assistant':
                msg = entry.get('message', {})
                content = msg.get('content', [])
                last_assistant_content_types = [
                    c.get('type') for c in content if isinstance(c, dict)
                ]
            elif entry_type == 'user':
                msg = entry.get('message', {})
                content = msg.get('content', [])
                last_user_content_types = [
                    c.get('type') for c in content if isinstance(c, dict)
                ]

        # Determine idle state:
        # If last meaningful entry is assistant with text (no tool_use) -> idle
        if last_entry_type == 'assistant' and last_assistant_content_types:
            has_tool_use = 'tool_use' in last_assistant_content_types
            return not has_tool_use

        # If last entry is user with text content (not tool_result) -> just submitted, active
        if last_entry_type == 'user' and last_user_content_types:
            has_tool_result = 'tool_result' in last_user_content_types
            if not has_tool_result:
                return False  # User just sent a message

        return False  # Default: not idle

    except Exception:
        return False


@bp.route('/api/hooks/stop', methods=['POST'])
def hook_stop():
    """Claude Code Stop hook -- fired when Claude finishes generating.

    Returns 204 immediately (no blocking Claude), then checks the
    transcript in a background thread to determine if truly idle.
    Stop fires on every generation stop including tool_use -- only
    text-only stops (no tool_use) mean Claude is actually idle.
    """
    data = request.json or {}
    session_id = data.get('session_id', '')
    cwd = data.get('cwd', '')
    transcript_path = data.get('transcript_path', '')

    # Find the worker this hook belongs to
    name = _worker_name_from_session(session_id)
    if not name:
        name = _worker_name_from_cwd(cwd)
    if not name:
        return '', 204

    _ctx.hook_last_seen[name] = time.time()

    # Update tracked session file if we got a new path
    if transcript_path and transcript_path != _ctx.worker_sessions.get(name):
        _ctx.worker_sessions[name] = transcript_path

    # Check idle state in background thread (avoids blocking Claude)
    filepath = transcript_path or _ctx.worker_sessions.get(name)
    def _check_idle_bg():
        is_idle = _check_session_idle(filepath) if filepath and os.path.exists(filepath) else True
        with _ctx.idle_state_lock:
            was_idle = _ctx.idle_state.get(name, False)
            _ctx.idle_state[name] = is_idle
        if is_idle and not was_idle:
            _ctx.socketio.emit('worker:idle', {'name': name})

    threading.Thread(target=_check_idle_bg, daemon=True).start()

    return '', 204


@bp.route('/api/hooks/prompt', methods=['POST'])
def hook_prompt():
    """Claude Code UserPromptSubmit hook -- fired when user submits a prompt.

    Marks the worker as active immediately.
    """
    data = request.json or {}
    session_id = data.get('session_id', '')
    cwd = data.get('cwd', '')
    transcript_path = data.get('transcript_path', '')

    name = _worker_name_from_session(session_id)
    if not name:
        name = _worker_name_from_cwd(cwd)
    if not name:
        return '', 204

    _ctx.hook_last_seen[name] = time.time()

    # Update tracked session file if we got a new path
    if transcript_path and transcript_path != _ctx.worker_sessions.get(name):
        _ctx.worker_sessions[name] = transcript_path

    with _ctx.idle_state_lock:
        _ctx.idle_state[name] = False

    return '', 204


def bg_idle_monitor():
    """JSONL-based idle detection fallback for workers without recent hook events.

    Primary idle detection is via HTTP hooks (instant, event-driven).
    This monitor runs every 5s as a fallback for workers that haven't
    received hook events recently (hooks not configured, non-Claude backends).

    For each worker:
    - If a hook fired within the last 30s, skip (hook state is authoritative)
    - Otherwise, check the session JSONL file:
      - If file modified within 10s, definitely active
      - Else parse last entries to determine idle state
    """
    while True:
        if _ctx.has_clients():
            try:
                windows = tmux.list_windows()
                active_names = {w['name'] for w in windows}
                now = time.time()

                for name in active_names:
                    try:
                        # Skip workers with recent hook events (hooks are authoritative)
                        last_hook = _ctx.hook_last_seen.get(name, 0)
                        if now - last_hook < 30:
                            continue

                        session_file = _ctx.worker_sessions.get(name)
                        if not session_file or not os.path.exists(session_file):
                            continue  # No session file -- can't determine state

                        # Quick check: recently modified file = definitely active
                        try:
                            mtime = os.path.getmtime(session_file)
                            if now - mtime < 10:
                                with _ctx.idle_state_lock:
                                    _ctx.idle_state[name] = False
                                continue
                        except OSError:
                            continue

                        is_idle = _check_session_idle(session_file)
                        with _ctx.idle_state_lock:
                            was_idle = _ctx.idle_state.get(name, False)
                            _ctx.idle_state[name] = is_idle

                        if is_idle and not was_idle:
                            _ctx.socketio.emit('worker:idle', {'name': name})

                    except Exception:
                        pass

                # Clean up stale entries for killed workers
                for name in list(_ctx.hook_last_seen):
                    if name not in active_names:
                        del _ctx.hook_last_seen[name]
                with _ctx.idle_state_lock:
                    for name in list(_ctx.idle_state):
                        if name not in active_names:
                            del _ctx.idle_state[name]

            except Exception:
                pass
        _ctx.socketio.sleep(5)
