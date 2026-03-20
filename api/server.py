"""
Flask API server for Switchboard.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

import os
import subprocess
import json
import re
import logging
import threading
import time
import secrets
import glob as glob_module
from datetime import datetime, timezone
from pathlib import Path

import yaml
import flask
from flask import Flask, request, jsonify, make_response, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import tmux_manager as tmux

from shared import AppContext, data_hash
import idle_detector
import system_monitor
import project_sync

PROJECT_ROOT = Path(__file__).parent.parent
STATE_DIR = PROJECT_ROOT / 'state'
PROPOSALS_DIR = STATE_DIR / 'proposals'
LOGS_DIR = PROJECT_ROOT / 'logs' / 'workers'


def load_config():
    """Load config from config.yaml with sensible defaults."""
    defaults = {
        'port': 5001,
        'host': '0.0.0.0',
        'project_root': '~',
        'scan_depth': 3,
        'tmux_socket': 'switchboard',
        'tmux_session': 'switchboard',
    }
    config_path = PROJECT_ROOT / 'config.yaml'
    if config_path.exists():
        try:
            with open(config_path) as f:
                user_config = yaml.safe_load(f) or {}
            defaults.update(user_config)
        except Exception:
            pass
    return defaults


CONFIG = load_config()
logger = logging.getLogger(__name__)

# Valid ID pattern for proposals and other user-supplied identifiers
_SAFE_ID = re.compile(r'^[a-zA-Z0-9_-]+$')

WORKERS_STATE_FILE = STATE_DIR / 'workers.json'


def _save_workers_state():
    """Persist worker models and spawn times to state/workers.json."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        'models': dict(ctx.worker_models),
        'spawn_times': {k: v for k, v in ctx.worker_spawn_times.items()},
    }
    try:
        with open(WORKERS_STATE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass


def _load_workers_state():
    """Load worker state from disk. Cross-reference with actual tmux windows."""
    if not WORKERS_STATE_FILE.exists():
        return
    try:
        with open(WORKERS_STATE_FILE) as f:
            data = json.load(f)
    except Exception:
        return
    # Get actual tmux windows to cross-reference
    try:
        windows = tmux.list_windows()
        live_names = {w['name'] for w in windows}
    except Exception:
        live_names = set()
    # Only restore entries for workers that still exist in tmux
    saved_models = data.get('models', {})
    saved_times = data.get('spawn_times', {})
    for name in live_names:
        if name in saved_models:
            ctx.worker_models[name] = saved_models[name]
        if name in saved_times:
            ctx.worker_spawn_times[name] = saved_times[name]

# Known models (always available immediately)
_KNOWN_MODELS = [
    {"id": "claude-sonnet-4-5", "label": "Sonnet 4.5"},
    {"id": "claude-opus-4-5", "label": "Opus 4.5"},
    {"id": "claude-sonnet-4-6", "label": "Sonnet 4.6"},
    {"id": "claude-opus-4-6", "label": "Opus 4.6"},
]

# Cached model list (enriched by CLI discovery in background)
_models_cache = None
_models_cache_time = 0
_MODELS_CACHE_TTL = 300  # 5 minutes
_models_lock = threading.Lock()


def _discover_models_background():
    """Discover available Claude models from CLI and update cache."""
    global _models_cache, _models_cache_time
    models = []
    try:
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
        result = subprocess.run(
            ["claude", "model", "list"],
            capture_output=True, text=True, timeout=10, env=env
        )
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            # Parse "Claude Opus 4.5 (`claude-opus-4-5`)"
            match = re.match(r'(.+?)\s+\(`([^`]+)`\)', line)
            if match:
                label, model_id = match.groups()
                models.append({"id": model_id, "label": label})
    except Exception:
        pass

    # Merge with known models
    seen = {m["id"] for m in models}
    for m in _KNOWN_MODELS:
        if m["id"] not in seen:
            models.append(m)

    with _models_lock:
        _models_cache = models
        _models_cache_time = time.time()


def _get_models():
    """Get models list (from config or auto-discovery, cached)."""
    global _models_cache, _models_cache_time

    configured = CONFIG.get('models', 'auto')
    if isinstance(configured, list):
        return configured

    # Auto mode: return known models immediately, refresh via background thread
    now = time.time()
    with _models_lock:
        needs_refresh = _models_cache is None or (now - _models_cache_time) > _MODELS_CACHE_TTL
        current = _models_cache

    if needs_refresh:
        threading.Thread(target=_discover_models_background, daemon=True).start()

    return current if current is not None else list(_KNOWN_MODELS)

# --- Auth configuration ---
_AUTH_PASSWORD = os.environ.get('SWITCHBOARD_PASSWORD', '')


def _get_secret_key():
    """Get or generate a persistent secret key for Flask sessions."""
    override = os.environ.get('SWITCHBOARD_SECRET_KEY')
    if override:
        return override
    key_file = STATE_DIR / 'secret.key'
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if key_file.exists():
        return key_file.read_text().strip()
    key = secrets.token_hex(32)
    key_file.write_text(key)
    return key


# Serve built frontend if available
STATIC_DIR = PROJECT_ROOT / 'web' / 'dist'
if STATIC_DIR.exists():
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path='')
else:
    app = Flask(__name__)
app.secret_key = _get_secret_key()
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading',
                    ping_interval=20, ping_timeout=60)

# --- Create shared context and initialize modules ---
ctx = AppContext(socketio, CONFIG)
idle_detector.init(ctx)
system_monitor.init(ctx)
project_sync.init(ctx)

app.register_blueprint(idle_detector.bp)
app.register_blueprint(system_monitor.bp)
app.register_blueprint(project_sync.bp)

# --- Auth middleware (only active when SWITCHBOARD_PASSWORD is set) ---

_AUTH_EXEMPT = {'/api/login', '/api/logout', '/api/auth/status',
                '/api/hooks/stop', '/api/hooks/prompt'}


@app.before_request
def _check_auth():
    """Enforce auth if SWITCHBOARD_PASSWORD is set. No-op otherwise."""
    if not _AUTH_PASSWORD:
        return  # Auth disabled
    # Static files and non-API routes are exempt
    if not request.path.startswith('/api'):
        return
    if request.path in _AUTH_EXEMPT:
        return
    # Check session cookie
    if session.get('authenticated'):
        return
    # Check HTTP Basic Auth
    auth = request.authorization
    if auth and auth.password == _AUTH_PASSWORD:
        return
    return jsonify({"error": "authentication required"}), 401


@app.route('/api/login', methods=['POST'])
def login():
    if not _AUTH_PASSWORD:
        return jsonify({"status": "ok", "auth_enabled": False})
    data = request.json or {}
    if data.get('password') == _AUTH_PASSWORD:
        session['authenticated'] = True
        return jsonify({"status": "ok"})
    return jsonify({"error": "invalid password"}), 401


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('authenticated', None)
    return jsonify({"status": "ok"})


@app.route('/api/auth/status')
def auth_status():
    if not _AUTH_PASSWORD:
        return jsonify({"auth_enabled": False, "authenticated": True})
    return jsonify({
        "auth_enabled": True,
        "authenticated": bool(session.get('authenticated')),
    })


# Terminal subscriptions: {sid: set of worker names}
_terminal_subs = {}
_terminal_subs_lock = threading.Lock()


@app.route('/')
def index():
    """Serve frontend if built, otherwise show API info."""
    if STATIC_DIR.exists():
        response = make_response(app.send_static_file('index.html'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    return {
        "name": "Switchboard API",
        "version": "0.5.0",
        "note": "Run 'cd web && npm run build' to enable the web UI",
    }


@app.errorhandler(404)
def not_found(e):
    """Serve index.html for client-side routes, 404 for API routes."""
    if STATIC_DIR.exists() and not request.path.startswith('/api'):
        response = make_response(app.send_static_file('index.html'))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    return {"error": "not found"}, 404


@app.route('/api/health')
def health():
    """Health check endpoint."""
    return {"status": "ok", "session": tmux.ensure_session()}


@app.route('/api/models')
def list_models():
    """Return available models (auto-discovered or from config)."""
    models = _get_models()
    default = CONFIG.get('default_model', '')
    return jsonify({"models": models, "default": default})


@app.route('/api/processes')
def list_processes():
    """List all worker windows."""
    windows = tmux.list_windows()
    with ctx.idle_state_lock:
        idle_snapshot = dict(ctx.idle_state)
    for w in windows:
        if w['name'] in ctx.worker_models:
            w['model'] = ctx.worker_models[w['name']]
        if w['name'] in ctx.worker_spawn_times:
            w['spawn_time'] = ctx.worker_spawn_times[w['name']]
        w['idle'] = idle_snapshot.get(w['name'], False)
    return jsonify(windows)


def _setup_and_track_session(name, session_label, enable_rc, session_dir, existing_files):
    """Setup worker and track its .jsonl session file."""
    tmux.setup_worker(name, session_label, enable_rc)
    # After setup, Claude Code should have created its session file
    if os.path.isdir(session_dir):
        current_files = set(glob_module.glob(os.path.join(session_dir, '*.jsonl')))
        new_files = current_files - existing_files
        if new_files:
            ctx.worker_sessions[name] = max(new_files, key=lambda f: os.path.getmtime(f))


@app.route('/api/processes', methods=['POST'])
def spawn_process():
    """Spawn a new worker. Auto-increments name if worker already exists."""
    data = request.json or {}
    name = data.get('name')
    directory = data.get('directory', '~')
    model = data.get('model')

    # Validation
    if not name:
        return {"error": "name required"}, 400

    # Auto-increment name if worker already exists
    windows = tmux.list_windows()
    existing_names = {w['name'] for w in windows}
    actual_name = name
    counter = 2
    while actual_name in existing_names:
        actual_name = f"{name}-{counter}"
        counter += 1

    # Calculate session label: folder name + instance number
    expanded_dir = os.path.expanduser(directory)
    folder_name = os.path.basename(expanded_dir.rstrip('/'))
    instance_number = counter - 1
    session_label = f"{folder_name} {instance_number}"

    try:
        result = tmux.spawn_worker(actual_name, directory, session_label=session_label, model=model)
        if model:
            ctx.worker_models[actual_name] = model
        ctx.worker_spawn_times[actual_name] = time.time()
        _save_workers_state()
        # Snapshot existing session files before Claude Code creates its own
        session_dir = project_sync.get_project_session_dir(expanded_dir)
        existing_files = set()
        if os.path.isdir(session_dir):
            existing_files = set(glob_module.glob(os.path.join(session_dir, '*.jsonl')))
        # Configure worker in background (wait for prompt, label, RC)
        # and track its session file
        threading.Thread(
            target=_setup_and_track_session,
            args=(actual_name, session_label, True, session_dir, existing_files),
            daemon=True
        ).start()
        return jsonify(result), 201
    except ValueError as e:
        return {"error": str(e)}, 400
    except RuntimeError as e:
        return {"error": str(e)}, 500


@app.route('/api/processes/<name>', methods=['DELETE'])
def kill_process(name):
    """Kill a worker."""
    # Check if worker exists
    existing = [w for w in tmux.list_windows() if w['name'] == name]
    if not existing:
        return {"error": "worker not found"}, 404

    success = tmux.kill_worker(name)
    if success:
        ctx.worker_models.pop(name, None)
        ctx.worker_sessions.pop(name, None)
        ctx.worker_spawn_times.pop(name, None)
        ctx.hook_last_seen.pop(name, None)
        with ctx.idle_state_lock:
            ctx.idle_state.pop(name, None)
        _save_workers_state()
        return {"status": "killed"}
    return {"error": "failed to kill worker"}, 500


@app.route('/api/processes/<name>/send', methods=['POST'])
def send_to_process(name):
    """Send text input to a worker."""
    data = request.json or {}
    text = data.get('text', '')
    raw = data.get('raw', False)  # If true, send as tmux key (Escape, C-c, etc.)
    success = tmux.send_keys(name, text, raw=raw)
    return {"status": "sent" if success else "failed"}


@app.route('/api/processes/<name>/output')
def get_output(name):
    """Get recent output from a worker."""
    lines = request.args.get('lines', 100, type=int)
    output = tmux.capture_output(name, lines)
    return {"output": output}


@app.route('/api/proposals')
def list_proposals():
    """List all proposals from state/proposals/ directory."""
    proposals = []
    if PROPOSALS_DIR.exists():
        for proposal_file in PROPOSALS_DIR.glob('*.yaml'):
            try:
                with open(proposal_file) as f:
                    proposal = yaml.safe_load(f)
                    if proposal:
                        # Use filename (without .yaml) as id if not specified
                        if 'id' not in proposal:
                            proposal['id'] = proposal_file.stem
                        # Normalize created_at to string for consistent sorting
                        if 'created_at' in proposal and not isinstance(proposal['created_at'], str):
                            proposal['created_at'] = str(proposal['created_at'])
                        proposals.append(proposal)
            except Exception:
                pass
    # Sort: pending first, then by created_at descending (newest first)
    pending = [p for p in proposals if p.get('status') == 'pending']
    others = [p for p in proposals if p.get('status') != 'pending']
    pending.sort(key=lambda p: p.get('created_at', ''), reverse=True)
    others.sort(key=lambda p: p.get('created_at', ''), reverse=True)
    return jsonify(pending + others)


@app.route('/api/proposals', methods=['POST'])
def create_proposal():
    """Create a new proposal."""
    data = request.json or {}
    proposal_id = data.get('id')
    title = data.get('title')
    worker = data.get('worker', 'unknown')
    steps = data.get('steps', [])
    auto_approve = data.get('auto_approve', False)

    if not proposal_id or not title:
        return {"error": "id and title required"}, 400
    if not _SAFE_ID.match(proposal_id):
        return {"error": "id must contain only alphanumeric, hyphen, underscore"}, 400
    if not isinstance(steps, list):
        return {"error": "steps must be a list"}, 400

    proposal = {
        'id': proposal_id,
        'title': title,
        'worker': worker,
        'steps': steps,
        'status': 'approved' if auto_approve else 'pending',
        'auto_approve': auto_approve,
        'created_at': datetime.now(timezone.utc).isoformat()
    }

    PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
    proposal_file = PROPOSALS_DIR / f"{proposal_id}.yaml"
    with open(proposal_file, 'w') as f:
        yaml.dump(proposal, f, default_flow_style=False)

    return jsonify(proposal), 201


@app.route('/api/proposals/<proposal_id>', methods=['PATCH'])
def update_proposal(proposal_id):
    """Update a proposal's status."""
    if not _SAFE_ID.match(proposal_id):
        return {"error": "invalid proposal id"}, 400
    data = request.json or {}
    new_status = data.get('status')

    if new_status not in ('approved', 'rejected'):
        return {"error": "status must be 'approved' or 'rejected'"}, 400

    proposal_file = PROPOSALS_DIR / f"{proposal_id}.yaml"
    if not proposal_file.exists():
        return {"error": "proposal not found"}, 404

    try:
        with open(proposal_file) as f:
            proposal = yaml.safe_load(f)

        proposal['status'] = new_status

        with open(proposal_file, 'w') as f:
            yaml.dump(proposal, f, default_flow_style=False)

        socketio.emit('activity:update', _get_activity_data())
        return {"status": "updated", "proposal": proposal}
    except Exception as e:
        return {"error": str(e)}, 500


@app.route('/api/proposals/<proposal_id>', methods=['DELETE'])
def delete_proposal(proposal_id):
    """Delete a proposal."""
    if not _SAFE_ID.match(proposal_id):
        return {"error": "invalid proposal id"}, 400
    proposal_file = PROPOSALS_DIR / f"{proposal_id}.yaml"
    if not proposal_file.exists():
        return {"error": "proposal not found"}, 404

    try:
        proposal_file.unlink()
        socketio.emit('activity:update', _get_activity_data())
        return {"status": "deleted"}
    except Exception as e:
        return {"error": str(e)}, 500


# =============================================================================
# Activity Feed
# =============================================================================

def _get_activity_data():
    """Get combined activity feed data (used by REST endpoint and socket monitor)."""
    result = {'pending': [], 'changes': [], 'unpushed': [], 'recent': []}

    # Pending proposals
    try:
        proposals = []
        if PROPOSALS_DIR.exists():
            for proposal_file in PROPOSALS_DIR.glob('*.yaml'):
                try:
                    with open(proposal_file) as f:
                        proposal = yaml.safe_load(f)
                        if proposal:
                            if 'id' not in proposal:
                                proposal['id'] = proposal_file.stem
                            proposals.append(proposal)
                except Exception:
                    pass

        result['pending'] = [p for p in proposals if p.get('status') == 'pending']
        result['recent'] = sorted(
            [p for p in proposals if p.get('status') in ('approved', 'rejected')],
            key=lambda p: p.get('created_at', ''),
            reverse=True
        )[:5]
    except Exception:
        pass

    # Git changes and unpushed commits
    try:
        projects = project_sync.discover_projects()
        for p in projects:
            directory = os.path.expanduser(p.get('directory', ''))
            if not os.path.isdir(directory):
                continue

            # Uncommitted changes
            status = project_sync.get_git_status(directory)
            if status:
                result['changes'].append({
                    'project': p.get('name'),
                    'files': status
                })

            # Unpushed commits
            commits = project_sync.get_unpushed_commits(directory)
            if commits:
                result['unpushed'].append({
                    'project': p.get('name'),
                    'commits': commits
                })
    except Exception:
        pass

    return result


@app.route('/api/activity')
def get_activity():
    """Get combined activity feed: pending proposals + changes + unpushed + recent."""
    return jsonify(_get_activity_data())


# =============================================================================
# Log endpoints
# =============================================================================

# ANSI escape sequence stripping
_ANSI_RE = re.compile(r'\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)')
_CURSOR_FORWARD_RE = re.compile(r'\x1b\[(\d+)C')
_SAFE_WORKER_NAME = re.compile(r'^[a-zA-Z0-9_-]+$')
_SAFE_LOG_FILENAME = re.compile(r'^[a-zA-Z0-9_-]+(-\d{8}-\d{6})?\.log$')


@app.route('/api/logs/<name>')
def list_worker_logs(name):
    """List log files for a worker."""
    if not _SAFE_WORKER_NAME.match(name):
        return {"error": "invalid worker name"}, 400
    log_dir = LOGS_DIR
    if not log_dir.exists():
        return jsonify({"files": []})
    files = []
    for f in sorted(log_dir.iterdir(), key=lambda f: f.stat().st_mtime, reverse=True):
        if f.name.startswith(name) and f.suffix == '.log':
            files.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
            })
    return jsonify({"files": files})


@app.route('/api/logs/<name>/<filename>')
def get_worker_log(name, filename):
    """Read a log file with ANSI stripping."""
    if not _SAFE_WORKER_NAME.match(name):
        return {"error": "invalid worker name"}, 400
    if not _SAFE_LOG_FILENAME.match(filename):
        return {"error": "invalid filename"}, 400
    if not filename.startswith(name):
        return {"error": "filename doesn't match worker"}, 400

    log_path = LOGS_DIR / filename
    if not log_path.exists():
        return {"error": "log file not found"}, 404

    tail = min(request.args.get('tail', 500, type=int), 5000)
    try:
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            raw_content = f.read()
        # Replace cursor-forward sequences with spaces before stripping
        content = _CURSOR_FORWARD_RE.sub(lambda m: ' ' * int(m.group(1)), raw_content)
        # Strip remaining ANSI escape sequences
        content = _ANSI_RE.sub('', content)
        # Strip BEL characters
        content = content.replace('\x07', '')
        # Clean up: collapse blank lines, remove duplicate consecutive lines
        lines = content.splitlines()
        cleaned = []
        prev_line = None
        blank_count = 0
        for line in lines:
            stripped = line.strip()
            if not stripped:
                blank_count += 1
                if blank_count <= 1:
                    cleaned.append('')
                continue
            blank_count = 0
            # Skip consecutive duplicate lines (spinner frames)
            if stripped == prev_line:
                continue
            prev_line = stripped
            cleaned.append(line)
        # Take last N lines
        tail_lines = cleaned[-tail:]
        return jsonify({
            "content": '\n'.join(tail_lines),
            "total_lines": len(cleaned),
            "showing": min(tail, len(cleaned)),
        })
    except Exception as e:
        return {"error": str(e)}, 500


# =============================================================================
# Worker Context & Usage
# =============================================================================

def _get_workers_usage_data():
    """Get context usage stats data (used by REST endpoint and socket monitor)."""
    result = []

    # Get active workers from tmux
    windows = tmux.list_windows()

    for window in windows:
        name = window.get('name', '')

        # Get the worker's current working directory from tmux
        proj_dir = tmux.get_pane_cwd(name)
        if not proj_dir:
            continue

        # Find session file: use tracked mapping, then label match, then latest
        session_file = ctx.worker_sessions.get(name)
        if not session_file or not os.path.exists(session_file):
            session_dir = project_sync.get_project_session_dir(proj_dir)
            # Derive session label from worker name (e.g. "myproject-2" -> "myproject 2")
            folder = os.path.basename(proj_dir.rstrip('/'))
            match = re.match(r'^(.+?)-(\d+)$', name)
            label = f"{folder} {match.group(2)}" if match else f"{folder} 1"
            session_file = project_sync.find_session_file_by_label(session_dir, label)
            if session_file:
                ctx.worker_sessions[name] = session_file  # cache for next poll
            else:
                session_file = project_sync.find_latest_session_file(session_dir)
        usage = project_sync.parse_session_usage(session_file)

        if usage:
            # Estimate context percentage (rough: 200k context window)
            context_tokens = usage.get('latest_context', 0)
            pct = min(100, int(context_tokens / 2000))  # 200k = 100%, so /2000

            result.append({
                'name': name,
                'input': usage['input_tokens'],
                'output': usage['output_tokens'],
                'context': context_tokens,
                'total': usage['total'],
                'pct': pct
            })
        else:
            result.append({
                'name': name,
                'input': 0,
                'output': 0,
                'context': 0,
                'total': 0,
                'pct': 0
            })

    return {'workers': result}


@app.route('/api/workers/usage')
def get_workers_usage():
    """Get context usage stats for all active workers."""
    return jsonify(_get_workers_usage_data())


# --- Usage Analytics ---

USAGE_STATS_FILE = STATE_DIR / 'usage-stats.json'
USAGE_STALE_SECS = 300  # Auto-recompute if older than 5 minutes
_usage_refresh_proc = None


def _compute_usage_sync():
    """Run compute-usage.py synchronously (~1s)."""
    script = str(PROJECT_ROOT / 'scripts' / 'compute-usage.py')
    subprocess.run(
        ['python3', script],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        timeout=30
    )


@app.route('/api/usage')
def get_usage():
    """Serve usage stats, auto-recomputing if stale (>5 min)."""
    # Auto-compute if missing or stale
    needs_compute = not USAGE_STATS_FILE.exists()
    if not needs_compute:
        age = time.time() - USAGE_STATS_FILE.stat().st_mtime
        needs_compute = age > USAGE_STALE_SECS

    if needs_compute:
        try:
            _compute_usage_sync()
        except Exception:
            pass

    if not USAGE_STATS_FILE.exists():
        return {"error": "no stats computed yet"}, 404

    try:
        with open(USAGE_STATS_FILE) as f:
            return jsonify(json.load(f))
    except Exception as e:
        return {"error": str(e)}, 500


@app.route('/api/usage/refresh', methods=['POST'])
def refresh_usage():
    """Trigger background recompute of usage stats."""
    global _usage_refresh_proc

    # Check if already running
    if _usage_refresh_proc and _usage_refresh_proc.poll() is None:
        return {"status": "already_running", "pid": _usage_refresh_proc.pid}

    script = str(PROJECT_ROOT / 'scripts' / 'compute-usage.py')
    _usage_refresh_proc = subprocess.Popen(
        ['python3', script],
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    return {"status": "started", "pid": _usage_refresh_proc.pid}


# Configure tmux at import time (works under both gunicorn and direct invocation)
tmux.configure(
    socket_name=CONFIG.get('tmux_socket'),
    session_name=CONFIG.get('tmux_session'),
)
tmux.ensure_session()
_load_workers_state()

# =============================================================================
# WebSocket event handlers
# =============================================================================

@socketio.on('connect')
def handle_connect():
    # Reject unauthenticated WebSocket connections when auth is enabled
    if _AUTH_PASSWORD and not flask.session.get('authenticated'):
        return False  # Cleanly reject connection without exception
    with ctx.clients_lock:
        ctx.connected_clients += 1
    logger.info('Client connected: %s (total: %d)', getattr(request, 'sid', '?'), ctx.connected_clients)


@socketio.on('disconnect')
def handle_disconnect():
    sid = getattr(request, 'sid', None)
    with ctx.clients_lock:
        ctx.connected_clients = max(0, ctx.connected_clients - 1)
    logger.info('Client disconnected: %s (total: %d)', sid, ctx.connected_clients)
    with _terminal_subs_lock:
        _terminal_subs.pop(sid, None)


@socketio.on('terminal:subscribe')
def handle_terminal_subscribe(data):
    name = data.get('name') if isinstance(data, dict) else None
    if name:
        sid = getattr(request, 'sid', None)
        from flask_socketio import join_room
        join_room(f'terminal:{name}')
        with _terminal_subs_lock:
            if sid not in _terminal_subs:
                _terminal_subs[sid] = set()
            _terminal_subs[sid].add(name)
        logger.debug('Client %s subscribed to terminal: %s', sid, name)


@socketio.on('terminal:unsubscribe')
def handle_terminal_unsubscribe(data):
    name = data.get('name') if isinstance(data, dict) else None
    if name:
        sid = getattr(request, 'sid', None)
        from flask_socketio import leave_room
        leave_room(f'terminal:{name}')
        with _terminal_subs_lock:
            if sid in _terminal_subs:
                _terminal_subs[sid].discard(name)
        logger.debug('Client %s unsubscribed from terminal: %s', sid, name)


# =============================================================================
# Background monitoring threads (server-push via WebSocket)
# =============================================================================

def _bg_workers_monitor():
    """Push worker list changes every 2s."""
    prev = None
    while True:
        if ctx.has_clients():
            try:
                windows = tmux.list_windows()
                with ctx.idle_state_lock:
                    idle_snapshot = dict(ctx.idle_state)
                for w in windows:
                    if w['name'] in ctx.worker_models:
                        w['model'] = ctx.worker_models[w['name']]
                    if w['name'] in ctx.worker_spawn_times:
                        w['spawn_time'] = ctx.worker_spawn_times[w['name']]
                    w['idle'] = idle_snapshot.get(w['name'], False)
                h = data_hash(windows)
                if h != prev:
                    prev = h
                    socketio.emit('workers:update', windows)
            except Exception:
                pass
        socketio.sleep(2)


def _bg_usage_monitor():
    """Push worker usage changes every 5s."""
    prev = None
    while True:
        if ctx.has_clients():
            try:
                data = _get_workers_usage_data()
                h = data_hash(data)
                if h != prev:
                    prev = h
                    socketio.emit('usage:update', data)
            except Exception:
                pass
        socketio.sleep(5)


def _bg_activity_monitor():
    """Push activity and file tree changes every 5s."""
    prev_activity = None
    prev_files = None
    while True:
        if ctx.has_clients():
            try:
                data = _get_activity_data()
                h = data_hash(data)
                if h != prev_activity:
                    prev_activity = h
                    socketio.emit('activity:update', data)
            except Exception:
                pass
            try:
                data = project_sync.get_home_tree_data()
                h = data_hash(data)
                if h != prev_files:
                    prev_files = h
                    socketio.emit('files:update', data)
            except Exception:
                pass
        socketio.sleep(5)


def _bg_terminal_monitor():
    """Push terminal output to subscribed clients only, every 500ms."""
    prev_outputs = {}
    while True:
        if ctx.has_clients():
            try:
                # Collect all subscribed workers across all clients
                with _terminal_subs_lock:
                    subscribed = set()
                    for names in _terminal_subs.values():
                        subscribed.update(names)

                for name in subscribed:
                    try:
                        output = tmux.capture_output(name, 200)
                        h = data_hash(output)
                        if h != prev_outputs.get(name):
                            prev_outputs[name] = h
                            socketio.emit('worker:output',
                                          {'name': name, 'output': output},
                                          to=f'terminal:{name}')
                    except Exception:
                        pass

                # Clean up cache for unsubscribed workers
                for name in list(prev_outputs):
                    if name not in subscribed:
                        del prev_outputs[name]
            except Exception:
                pass
        socketio.sleep(0.5)


def _start_background_monitors():
    """Start all background monitoring threads."""
    socketio.start_background_task(_bg_workers_monitor)
    socketio.start_background_task(_bg_usage_monitor)
    socketio.start_background_task(_bg_activity_monitor)
    socketio.start_background_task(system_monitor.bg_metrics_monitor)
    socketio.start_background_task(_bg_terminal_monitor)
    socketio.start_background_task(idle_detector.bg_idle_monitor)


if __name__ == '__main__':
    _get_models()  # warm cache so first request is instant
    _start_background_monitors()
    dev_mode = os.environ.get('DEV', '').strip() == '1'
    socketio.run(app, host=CONFIG.get('host', '0.0.0.0'), port=CONFIG.get('port', 5001),
                 allow_unsafe_werkzeug=True, use_reloader=dev_mode)
