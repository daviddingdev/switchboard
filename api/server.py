"""
Flask API server for Switchboard.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

import os
import platform
import subprocess
import json
import re
import logging
import threading
import hashlib
import time
import secrets
import glob as glob_module
from datetime import datetime, timezone
from pathlib import Path

import requests as http_requests
import yaml
import psutil
import flask
from flask import Flask, request, jsonify, make_response, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import tmux_manager as tmux

# Claude session files location
CLAUDE_PROJECTS_DIR = os.path.expanduser('~/.claude/projects')
PROJECT_ROOT = Path(__file__).parent.parent
STATE_DIR = PROJECT_ROOT / 'state'
PROPOSALS_DIR = STATE_DIR / 'proposals'
LOGS_DIR = PROJECT_ROOT / 'logs' / 'workers'

# Directories to exclude from file listings
EXCLUDE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', '.next', '.cache'}
EXCLUDE_FILES = {'.DS_Store', 'Thumbs.db'}
MAX_DEPTH = 4


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

# Thread lock for update status
_update_lock = threading.Lock()

# Valid ID pattern for proposals and other user-supplied identifiers
_SAFE_ID = re.compile(r'^[a-zA-Z0-9_-]+$')

# Track model per worker
_worker_models = {}

# Track worker -> session file mapping (so two workers in same project get distinct files)
_worker_sessions = {}

# Track worker spawn times for uptime display
_worker_spawn_times = {}

WORKERS_STATE_FILE = STATE_DIR / 'workers.json'


def _save_workers_state():
    """Persist worker models and spawn times to state/workers.json."""
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        'models': dict(_worker_models),
        'spawn_times': {k: v for k, v in _worker_spawn_times.items()},
    }
    try:
        with open(WORKERS_STATE_FILE, 'w') as f:
            json.dump(data, f)
    except Exception:
        pass


def _load_workers_state():
    """Load worker state from disk. Cross-reference with actual tmux windows."""
    global _worker_models, _worker_spawn_times
    if not WORKERS_STATE_FILE.exists():
        return
    try:
        with open(WORKERS_STATE_FILE) as f:
            data = json.load(f)
    except Exception:
        # Corrupt JSON — start fresh
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
            _worker_models[name] = saved_models[name]
        if name in saved_times:
            _worker_spawn_times[name] = saved_times[name]

# Cached model list (refreshed periodically)
_models_cache = None
_models_cache_time = 0
_MODELS_CACHE_TTL = 300  # 5 minutes


def _discover_models():
    """Discover available Claude models from CLI, with fallback."""
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

    # CLI may only return the default model; merge with known models
    known = [
        {"id": "claude-sonnet-4-5", "label": "Sonnet 4.5"},
        {"id": "claude-opus-4-5", "label": "Opus 4.5"},
        {"id": "claude-sonnet-4-6", "label": "Sonnet 4.6"},
        {"id": "claude-opus-4-6", "label": "Opus 4.6"},
    ]
    seen = {m["id"] for m in models}
    for m in known:
        if m["id"] not in seen:
            models.append(m)
    return models


def _get_models():
    """Get models list (from config or auto-discovery, cached)."""
    global _models_cache, _models_cache_time

    configured = CONFIG.get('models', 'auto')
    if isinstance(configured, list):
        return configured

    # Auto mode: discover from CLI with caching
    now = time.time()
    if _models_cache is None or (now - _models_cache_time) > _MODELS_CACHE_TTL:
        _models_cache = _discover_models()
        _models_cache_time = now
    return _models_cache

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


# --- Auth middleware (only active when SWITCHBOARD_PASSWORD is set) ---

_AUTH_EXEMPT = {'/api/login', '/api/logout', '/api/auth/status'}


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


def _data_hash(data):
    """Hash data for change detection."""
    return hashlib.md5(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


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
    for w in windows:
        if w['name'] in _worker_models:
            w['model'] = _worker_models[w['name']]
        if w['name'] in _worker_spawn_times:
            w['spawn_time'] = _worker_spawn_times[w['name']]
    return jsonify(windows)


def _setup_and_track_session(name, session_label, enable_rc, session_dir, existing_files):
    """Setup worker and track its .jsonl session file."""
    tmux.setup_worker(name, session_label, enable_rc)
    # After setup, Claude Code should have created its session file
    if os.path.isdir(session_dir):
        current_files = set(glob_module.glob(os.path.join(session_dir, '*.jsonl')))
        new_files = current_files - existing_files
        if new_files:
            _worker_sessions[name] = max(new_files, key=lambda f: os.path.getmtime(f))


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
            _worker_models[actual_name] = model
        _worker_spawn_times[actual_name] = time.time()
        _save_workers_state()
        # Snapshot existing session files before Claude Code creates its own
        session_dir = get_project_session_dir(expanded_dir)
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
        _worker_models.pop(name, None)
        _worker_sessions.pop(name, None)
        _worker_spawn_times.pop(name, None)
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
            except Exception as e:
                # Skip invalid proposal files
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
# Projects, Files, Changes, Activity endpoints
# =============================================================================

_projects_cache = None
_projects_cache_time = 0
_PROJECTS_CACHE_TTL = 30  # seconds


def discover_projects(root_dir=None, max_depth=None):
    """
    Auto-discover projects by finding directories with CLAUDE.md files.
    Cached for 30s since the project list rarely changes.
    """
    global _projects_cache, _projects_cache_time

    now = time.time()
    if _projects_cache is not None and (now - _projects_cache_time) < _PROJECTS_CACHE_TTL:
        return _projects_cache

    if root_dir is None:
        root_dir = os.path.expanduser(CONFIG.get('project_root', '~'))
    if max_depth is None:
        max_depth = CONFIG.get('scan_depth', 3)

    projects = []

    def scan_dir(directory, depth=0):
        if depth > max_depth:
            return
        try:
            entries = os.listdir(directory)
        except (PermissionError, FileNotFoundError):
            return

        # Check if this directory has CLAUDE.md
        if 'CLAUDE.md' in entries:
            projects.append({
                'name': os.path.basename(directory),
                'directory': directory,
                'has_claude_md': True
            })
            return  # Don't recurse into projects

        # Recurse into subdirectories
        for name in entries:
            if name in EXCLUDE_DIRS or name.startswith('.'):
                continue
            path = os.path.join(directory, name)
            if os.path.isdir(path):
                scan_dir(path, depth + 1)

    scan_dir(root_dir)
    _projects_cache = sorted(projects, key=lambda p: p['name'].lower())
    _projects_cache_time = now
    return _projects_cache


def load_projects():
    """Auto-discover projects with CLAUDE.md files."""
    return discover_projects()


def get_project_directory(project_name):
    """Get the directory path for a project by name."""
    projects = load_projects()
    for p in projects:
        if p.get('name') == project_name:
            return p.get('directory', '')
    return None


def get_git_status_map(directory):
    """
    Get git status as a dict mapping filepath to status code.
    Returns empty dict if not a git repo.
    """
    files = get_git_status(directory)
    if not files:
        return {}
    return {f['path']: f['status'] for f in files}


def build_file_tree(directory, depth=0, git_status=None, base_dir=None):
    """
    Recursively build file tree for a directory.
    Includes git status on files and has_changes flag on directories.
    """
    if depth >= MAX_DEPTH:
        return []

    if git_status is None:
        git_status = {}
    if base_dir is None:
        base_dir = directory

    result = []
    try:
        entries = sorted(os.listdir(directory))
    except (PermissionError, FileNotFoundError):
        return []

    for name in entries:
        if name in EXCLUDE_DIRS or name in EXCLUDE_FILES:
            continue
        if name.startswith('.') and name not in {'.env.example', '.gitignore'}:
            continue

        path = os.path.join(directory, name)
        rel_path = os.path.relpath(path, base_dir)
        entry = {'name': name, 'path': path}

        if os.path.isdir(path):
            entry['type'] = 'dir'
            children = build_file_tree(path, depth + 1, git_status, base_dir)
            entry['children'] = children
            # Check if any children have changes
            entry['has_changes'] = any(
                c.get('status') or c.get('has_changes') for c in children
            )
        else:
            entry['type'] = 'file'
            # Check git status for this file
            status = git_status.get(rel_path)
            if status:
                entry['status'] = status

        result.append(entry)

    # Sort: directories first, then files
    result.sort(key=lambda x: (0 if x['type'] == 'dir' else 1, x['name'].lower()))
    return result


def get_git_status(directory):
    """Get git status for a directory. Returns None if not a git repo, list otherwise."""
    try:
        result = subprocess.run(
            ['git', '-C', directory, 'status', '--porcelain'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return None  # Not a git repo or error

        files = []
        for line in result.stdout.splitlines():
            if line and len(line) >= 3:
                status_code = line[:2]
                filepath = line[3:]
                # Normalize status codes
                if status_code == '??':
                    status = 'U'  # Untracked
                elif 'D' in status_code:
                    status = 'D'  # Deleted
                elif 'A' in status_code:
                    status = 'A'  # Added
                elif 'M' in status_code or status_code.strip():
                    status = 'M'  # Modified
                else:
                    status = status_code.strip()
                files.append({'path': filepath, 'status': status})
        return files
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def get_unpushed_commits(directory):
    """Get commits ahead of origin for a git repo."""
    try:
        # First check if there's a remote tracking branch
        result = subprocess.run(
            ['git', '-C', directory, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return None  # No upstream tracking branch

        upstream = result.stdout.strip()

        # Get commits ahead of upstream
        result = subprocess.run(
            ['git', '-C', directory, 'log', f'{upstream}..HEAD', '--oneline'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            return None

        commits = []
        for line in result.stdout.strip().splitlines():
            if line:
                parts = line.split(' ', 1)
                commits.append({
                    'hash': parts[0],
                    'message': parts[1] if len(parts) > 1 else ''
                })
        return commits
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None



@app.route('/api/projects')
def list_projects():
    """Auto-discover projects with CLAUDE.md files."""
    return jsonify(load_projects())


def _get_home_tree_data():
    """Get home directory tree data (used by REST endpoint and socket monitor)."""
    home_dir = os.path.expanduser('~')
    projects = discover_projects()

    result = []

    try:
        entries = sorted(os.listdir(home_dir))
    except (PermissionError, FileNotFoundError):
        return {'directory': home_dir, 'files': []}

    # Add root-level .md files
    for name in entries:
        if name.endswith('.md') and not name.startswith('.'):
            path = os.path.join(home_dir, name)
            if os.path.isfile(path):
                result.append({
                    'name': name,
                    'path': path,
                    'type': 'file'
                })

    # Add project directories with their file trees (including git status)
    for project in projects:
        proj_dir = project['directory']
        proj_name = project['name']

        # Get git status for this project
        git_status = get_git_status_map(proj_dir)

        # Build file tree with git status
        children = build_file_tree(proj_dir, git_status=git_status, base_dir=proj_dir)
        has_changes = any(c.get('status') or c.get('has_changes') for c in children)

        # Get relative path from home (e.g., "projects/my-app" or just "my-project")
        rel_path = os.path.relpath(proj_dir, home_dir)
        parts = rel_path.split(os.sep)

        if len(parts) == 1:
            # Direct child of home (e.g., ~/switchboard)
            result.append({
                'name': proj_name,
                'path': proj_dir,
                'type': 'dir',
                'is_project': True,
                'has_changes': has_changes,
                'children': children
            })
        else:
            # Nested (e.g., ~/projects/my-app)
            parent_name = parts[0]
            existing_parent = next((r for r in result if r['name'] == parent_name and r['type'] == 'dir'), None)

            if not existing_parent:
                parent_path = os.path.join(home_dir, parent_name)
                existing_parent = {
                    'name': parent_name,
                    'path': parent_path,
                    'type': 'dir',
                    'is_project': False,
                    'has_changes': False,
                    'children': []
                }
                result.append(existing_parent)

            existing_parent['children'].append({
                'name': proj_name,
                'path': proj_dir,
                'type': 'dir',
                'is_project': True,
                'has_changes': has_changes,
                'children': children
            })

            if has_changes:
                existing_parent['has_changes'] = True

    result.sort(key=lambda x: (0 if x['type'] == 'file' else 1, x['name'].lower()))

    return {'directory': home_dir, 'files': result}


@app.route('/api/home')
def get_home_tree():
    """Get home directory tree."""
    return jsonify(_get_home_tree_data())



def detect_language(filepath):
    """Map file extension to highlight.js language name."""
    ext_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.html': 'html',
        '.css': 'css',
        '.sh': 'bash',
        '.bash': 'bash',
        '.sql': 'sql',
        '.txt': 'plaintext',
    }
    ext = os.path.splitext(filepath)[1].lower()
    return ext_map.get(ext, 'plaintext')


@app.route('/api/file')
def get_file_content():
    """
    Return file contents with language hint.
    Query param: path (absolute path to file)
    """
    filepath = request.args.get('path', '')

    if not filepath:
        return {"error": "path parameter required"}, 400

    # Expand ~ if present
    filepath = os.path.expanduser(filepath)

    # Security: only allow files under home directory
    home_dir = os.path.expanduser('~')
    real_path = os.path.realpath(filepath)
    if not real_path.startswith(os.path.realpath(home_dir)):
        return {"error": "Access denied"}, 403

    if not os.path.exists(filepath):
        return {"error": "File not found"}, 404

    if os.path.isdir(filepath):
        return {"error": "Is a directory"}, 400

    # Check file size (limit to 500KB)
    file_size = os.path.getsize(filepath)
    if file_size > 500_000:
        return {"error": f"File too large ({file_size} bytes)"}, 413

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return {"error": "Binary file"}, 415
    except Exception as e:
        return {"error": str(e)}, 500

    language = detect_language(filepath)

    return jsonify({
        'content': content,
        'language': language,
        'path': filepath,
        'name': os.path.basename(filepath)
    })



@app.route('/api/file', methods=['PUT'])
def save_file_content():
    """
    Save file contents. Same security as GET (home-dir confinement, 500KB limit).
    Last-write-wins — acceptable for personal tool.
    """
    data = request.json or {}
    filepath = data.get('path', '')
    content = data.get('content', '')

    if not filepath:
        return {"error": "path parameter required"}, 400

    filepath = os.path.expanduser(filepath)

    # Security: only allow files under home directory
    home_dir = os.path.expanduser('~')
    real_path = os.path.realpath(filepath)
    if not real_path.startswith(os.path.realpath(home_dir)):
        return {"error": "Access denied"}, 403

    if os.path.isdir(filepath):
        return {"error": "Is a directory"}, 400

    # Validate content size (500KB limit)
    if len(content.encode('utf-8', errors='replace')) > 500_000:
        return {"error": "Content too large"}, 413

    # Validate content is valid UTF-8 (reject binary)
    try:
        content.encode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return {"error": "Content must be valid UTF-8 text"}, 415

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        return {"error": str(e)}, 500

    return jsonify({"status": "saved", "path": filepath})


@app.route('/api/diff')
def get_diff():
    """
    Get git diff for a specific file.
    Query params: project (name), path (relative file path)
    """
    project_name = request.args.get('project', '')
    file_path = request.args.get('path', '')

    if not project_name or not file_path:
        return {"error": "project and path required"}, 400

    directory = get_project_directory(project_name)
    if not directory:
        return {"error": f"project '{project_name}' not found"}, 404

    try:
        # Get diff for the file (staged + unstaged)
        result = subprocess.run(
            ['git', '-C', directory, 'diff', 'HEAD', '--', file_path],
            capture_output=True,
            text=True,
            timeout=10
        )

        # If no diff with HEAD, try without HEAD (for untracked files)
        if not result.stdout and result.returncode == 0:
            # Check if file is untracked
            status_result = subprocess.run(
                ['git', '-C', directory, 'status', '--porcelain', '--', file_path],
                capture_output=True,
                text=True,
                timeout=5
            )
            if status_result.stdout.startswith('??'):
                # Untracked file - show full content as addition
                full_path = os.path.join(directory, file_path)
                if os.path.exists(full_path):
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        lines = content.split('\n')
                        diff_lines = [f'diff --git a/{file_path} b/{file_path}',
                                      'new file',
                                      f'--- /dev/null',
                                      f'+++ b/{file_path}',
                                      f'@@ -0,0 +1,{len(lines)} @@']
                        diff_lines.extend(f'+{line}' for line in lines)
                        return jsonify({
                            'diff': '\n'.join(diff_lines),
                            'project': project_name,
                            'path': file_path,
                            'status': 'untracked'
                        })
                    except (UnicodeDecodeError, IOError):
                        pass  # Binary or unreadable file, fall through to git diff

        return jsonify({
            'diff': result.stdout,
            'project': project_name,
            'path': file_path,
            'status': 'modified' if result.stdout else 'unchanged'
        })
    except subprocess.TimeoutExpired:
        return {"error": "Diff timed out"}, 500
    except Exception as e:
        return {"error": str(e)}, 500


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
        projects = load_projects()
        for p in projects:
            directory = os.path.expanduser(p.get('directory', ''))
            if not os.path.isdir(directory):
                continue

            # Uncommitted changes
            status = get_git_status(directory)
            if status:
                result['changes'].append({
                    'project': p.get('name'),
                    'files': status
                })

            # Unpushed commits
            commits = get_unpushed_commits(directory)
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


# ANSI escape sequence stripping — handles CSI, OSC, and single-char escapes
_ANSI_RE = re.compile(r'\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)')
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
            lines = f.readlines()
        # Take last N lines
        content = ''.join(lines[-tail:])
        # Strip ANSI escape sequences
        content = _ANSI_RE.sub('', content)
        return jsonify({
            "content": content,
            "total_lines": len(lines),
            "showing": min(tail, len(lines)),
        })
    except Exception as e:
        return {"error": str(e)}, 500


@app.route('/api/push', methods=['POST'])
def push_project():
    """
    Commit doc updates (if any) and push a project.
    Always stages and commits modified doc files before pushing.
    """
    data = request.json or {}
    project_name = data.get('project')

    if not project_name:
        return {"error": "project required"}, 400

    directory = get_project_directory(project_name)
    if not directory:
        return {"error": f"project '{project_name}' not found"}, 404

    results = {'steps': []}

    # Always try to stage and commit doc files if modified
    # Stage doc files (ignores files that don't exist)
    subprocess.run(
        ['git', '-C', directory, 'add', 'CHANGELOG.md', 'TODO.md', 'USAGE.md'],
        capture_output=True, text=True, timeout=10
    )

    # Check if there are staged changes to commit
    diff_result = subprocess.run(
        ['git', '-C', directory, 'diff', '--cached', '--quiet'],
        capture_output=True, timeout=5
    )

    if diff_result.returncode != 0:  # There are staged changes
        commit_result = subprocess.run(
            ['git', '-C', directory, 'commit', '-m', 'Update docs for recent changes'],
            capture_output=True, text=True, timeout=10
        )
        results['steps'].append({
            'action': 'commit_docs',
            'success': commit_result.returncode == 0,
            'output': commit_result.stdout.strip()
        })

    # Get the upstream remote/branch for pushing
    try:
        upstream_result = subprocess.run(
            ['git', '-C', directory, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
            capture_output=True, text=True, timeout=5
        )
        if upstream_result.returncode == 0:
            # Parse "origin/main" or "github/master" into remote and branch
            upstream = upstream_result.stdout.strip()
            if '/' in upstream:
                remote, branch = upstream.split('/', 1)
            else:
                remote, branch = 'origin', upstream
        else:
            remote, branch = 'origin', 'main'  # Fallback
    except (subprocess.TimeoutExpired, Exception):
        remote, branch = 'origin', 'main'

    # Push to the correct remote/branch
    try:
        push_result = subprocess.run(
            ['git', '-C', directory, 'push', remote, f'HEAD:{branch}'],
            capture_output=True, text=True, timeout=60
        )
        results['steps'].append({
            'action': 'push',
            'success': push_result.returncode == 0,
            'output': push_result.stdout.strip() or push_result.stderr.strip()
        })
        results['success'] = push_result.returncode == 0
        if not results['success']:
            results['error'] = push_result.stderr.strip()
    except subprocess.TimeoutExpired:
        results['success'] = False
        results['error'] = 'push timed out'
    except Exception as e:
        results['success'] = False
        results['error'] = str(e)

    return jsonify(results)


# =============================================================================
# Partner Context Management endpoints
# =============================================================================

def get_project_session_dir(directory):
    """Get the Claude session directory for a project."""
    # Claude uses a sanitized path format: -home-username-projectname
    # The path starts with a hyphen replacing the leading /
    sanitized = directory.replace('/', '-')
    return os.path.join(CLAUDE_PROJECTS_DIR, sanitized)


def find_latest_session_file(session_dir):
    """
    Find the most likely active session file in a session directory.
    Uses modification time as primary heuristic (most recent = active).
    """
    if not os.path.isdir(session_dir):
        return None
    jsonl_files = glob_module.glob(os.path.join(session_dir, '*.jsonl'))
    if not jsonl_files:
        return None
    # Most recently modified file is likely the active session
    return max(jsonl_files, key=lambda f: os.path.getmtime(f))


def find_session_file_by_label(session_dir, label):
    """
    Find a session file whose first user message matches the given label.
    Used to match workers to their session files after server restart.
    """
    if not os.path.isdir(session_dir):
        return None
    jsonl_files = glob_module.glob(os.path.join(session_dir, '*.jsonl'))
    for filepath in sorted(jsonl_files, key=lambda f: os.path.getmtime(f), reverse=True):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    entry = json.loads(line.strip())
                    if entry.get('type') != 'user':
                        continue
                    content = entry.get('message', {}).get('content', '')
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and c.get('type') == 'text':
                                content = c['text']
                                break
                        else:
                            content = ''
                    if content.strip() == label:
                        return filepath
                    break  # only check first user message
        except Exception:
            continue
    return None


# Cache for incremental JSONL parsing: {filepath: {offset, input, output, context}}
_usage_parse_cache = {}


def parse_session_usage(session_file):
    """
    Parse a session JSONL file to extract token usage.
    Uses incremental reading — only parses new lines since last call.
    """
    if not session_file or not os.path.exists(session_file):
        return None

    try:
        file_size = os.path.getsize(session_file)
    except OSError:
        return None

    cached = _usage_parse_cache.get(session_file)
    if cached and cached['size'] == file_size:
        return cached['result']

    # Resume from cached position or start fresh
    total_input = cached['input'] if cached else 0
    total_output = cached['output'] if cached else 0
    latest_context = cached['context'] if cached else 0
    offset = cached['offset'] if cached and cached['size'] <= file_size else 0

    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            if offset:
                f.seek(offset)
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get('type') == 'assistant':
                        usage = entry.get('message', {}).get('usage', {})
                        total_input += usage.get('input_tokens', 0)
                        total_output += usage.get('output_tokens', 0)
                        # Context = all input buckets + output (output becomes history next turn)
                        latest_context = (
                            usage.get('input_tokens', 0)
                            + usage.get('cache_read_input_tokens', 0)
                            + usage.get('cache_creation_input_tokens', 0)
                            + usage.get('output_tokens', 0)
                        )
                except json.JSONDecodeError:
                    continue
            new_offset = f.tell()
    except Exception:
        return None

    result = {
        'input_tokens': total_input,
        'output_tokens': total_output,
        'total': total_input + total_output,
        'latest_context': latest_context
    }
    _usage_parse_cache[session_file] = {
        'offset': new_offset, 'size': file_size,
        'input': total_input, 'output': total_output,
        'context': latest_context, 'result': result
    }
    return result


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
        session_file = _worker_sessions.get(name)
        if not session_file or not os.path.exists(session_file):
            session_dir = get_project_session_dir(proj_dir)
            # Derive session label from worker name (e.g. "myproject-2" -> "myproject 2")
            folder = os.path.basename(proj_dir.rstrip('/'))
            match = re.match(r'^(.+?)-(\d+)$', name)
            label = f"{folder} {match.group(2)}" if match else f"{folder} 1"
            session_file = find_session_file_by_label(session_dir, label)
            if session_file:
                _worker_sessions[name] = session_file  # cache for next poll
            else:
                session_file = find_latest_session_file(session_dir)
        usage = parse_session_usage(session_file)

        if usage:
            # Estimate context percentage (rough: 200k context window)
            # latest_context = what was sent to the model on the last turn
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


# --- System Metrics (direct) ---

_prev_net = None
_prev_disk = None
_prev_time = None


def _gpu_metrics():
    """Read GPU metrics via configured command (default: nvidia-smi)."""
    gpu_cfg = CONFIG.get('monitor', {}).get('gpu', {})
    if gpu_cfg.get('enabled') is False:
        return None
    cmd = gpu_cfg.get('command', 'nvidia-smi')
    args = gpu_cfg.get('args', '--query-gpu=utilization.gpu,temperature.gpu,utilization.memory,power.draw --format=csv,noheader,nounits')
    try:
        out = subprocess.run(
            [cmd] + args.split(),
            capture_output=True, text=True, timeout=3
        )
        if out.returncode == 0:
            parts = out.stdout.strip().split(', ')
            result = {'util': int(parts[0]), 'temp': int(parts[1]), 'mem': int(parts[2])}
            if len(parts) > 3:
                try:
                    result['power_w'] = round(float(parts[3]), 1)
                except (ValueError, IndexError):
                    result['power_w'] = None
            return result
    except Exception:
        pass
    return {'util': None, 'temp': None, 'mem': None}


def _service_metrics():
    """Read metrics for configured services (processes monitored by name)."""
    services_cfg = CONFIG.get('monitor', {}).get('services', [{'name': 'Ollama', 'process': 'ollama'}])
    results = {}
    for svc in services_cfg:
        proc_name = svc.get('process', '').lower()
        label = svc.get('name', proc_name)
        found = False
        for p in psutil.process_iter(['name', 'cpu_percent', 'memory_info']):
            try:
                if p.info['name'] and proc_name in p.info['name'].lower():
                    rss = p.info['memory_info'].rss if p.info['memory_info'] else 0
                    results[label] = {'cpu': round(p.info['cpu_percent'] or 0), 'ram_gb': round(rss / 1e9, 1)}
                    found = True
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        if not found:
            results[label] = {'cpu': None, 'ram_gb': None}
    return results


def _thermal_metrics():
    """Read CPU/SoC and NVMe temperatures via psutil sensors."""
    result = {'cpu_temp': None, 'nvme_temp': None}
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return result
        # CPU/SoC temp: prefer acpitz (SoC thermal zones), fallback coretemp/k10temp
        for zone in ('acpitz', 'coretemp', 'k10temp'):
            if zone in temps:
                readings = [t.current for t in temps[zone] if t.current]
                if readings:
                    result['cpu_temp'] = round(max(readings))
                    break
        # NVMe temp
        if 'nvme' in temps:
            readings = [t.current for t in temps['nvme'] if t.current]
            if readings:
                result['nvme_temp'] = round(max(readings))
    except Exception:
        pass
    return result


_smart_cache = {'data': None, 'time': 0}


def _disk_smart():
    """Read NVMe SMART health via smartctl. Cached for 5 minutes."""
    smart_cfg = CONFIG.get('monitor', {}).get('smart', {})
    device = smart_cfg.get('device')
    if not device:
        return None

    cache_secs = smart_cfg.get('cache_seconds', 300)
    now = time.time()
    if _smart_cache['data'] is not None and (now - _smart_cache['time']) < cache_secs:
        return _smart_cache['data']

    try:
        out = subprocess.run(
            ['sudo', '-n', 'smartctl', '-a', '--json', device],
            capture_output=True, text=True, timeout=10
        )
        data = json.loads(out.stdout)
        # smartctl exit bit 1 = device open failed, bit 0 = cmd parse error
        if out.returncode & 0x03 or data.get('smart_status') is None:
            _smart_cache['data'] = None
            _smart_cache['time'] = now
            return None
        health = data.get('smart_status', {}).get('passed')
        nvme_log = data.get('nvme_smart_health_information_log', {})
        result = {
            'health': 'PASSED' if health else 'FAILED',
            'pct_used': nvme_log.get('percentage_used', None),
            'available_spare': nvme_log.get('available_spare', None),
            'power_hours': nvme_log.get('power_on_hours', None),
        }
        _smart_cache['data'] = result
        _smart_cache['time'] = now
        return result
    except Exception:
        _smart_cache['data'] = None
        _smart_cache['time'] = now
        return None


def _get_metrics_data():
    """Get system metrics data (used by REST endpoint and socket monitor)."""
    global _prev_net, _prev_disk, _prev_time
    import time as _time

    now = _time.time()
    result = {
        'gpu': _gpu_metrics(),
        'services': _service_metrics(),
        'thermal': _thermal_metrics(),
        'smart': _disk_smart(),
        'cpu': {
            'usage': round(psutil.cpu_percent()),
            'load': round(psutil.getloadavg()[0], 2) if hasattr(psutil, 'getloadavg') else None,
        },
        'memory': {
            'used_gb': round(psutil.virtual_memory().used / 1e9, 1),
            'available_gb': round(psutil.virtual_memory().available / 1e9, 1),
        },
        'network': {'down_mbps': None, 'up_mbps': None},
        'disk': {
            'read_mbs': None,
            'write_mbs': None,
            'space_pct': round(psutil.disk_usage(CONFIG.get('monitor', {}).get('disk_path', '/')).percent),
        },
        'system': {
            'uptime_secs': round(now - psutil.boot_time()),
            'processes': len(psutil.pids()),
        },
    }

    # Network and disk I/O are rates — need delta from previous call
    net = psutil.net_io_counters()
    disk = psutil.disk_io_counters()

    if _prev_net and _prev_time:
        dt = now - _prev_time
        if dt > 0:
            result['network']['down_mbps'] = round((net.bytes_recv - _prev_net.bytes_recv) * 8 / 1e6 / dt, 2)
            result['network']['up_mbps'] = round((net.bytes_sent - _prev_net.bytes_sent) * 8 / 1e6 / dt, 2)
            result['disk']['read_mbs'] = round((disk.read_bytes - _prev_disk.read_bytes) / 1e6 / dt, 2)
            result['disk']['write_mbs'] = round((disk.write_bytes - _prev_disk.write_bytes) / 1e6 / dt, 2)

    _prev_net = net
    _prev_disk = disk
    _prev_time = now

    return result


@app.route('/api/metrics')
def system_metrics():
    """System metrics read directly from OS."""
    return jsonify(_get_metrics_data())


# --- Platform Dashboard Integration (optional) ---

class PlatformClient:
    """Proxy client for platform dashboard API with token caching.

    Connects to a management dashboard (configured via 'spark' key in config.yaml)
    that provides system-level updates and reboot capabilities.
    """

    def __init__(self):
        self._token = None

    def _get_config(self):
        """Get platform config from global CONFIG."""
        return CONFIG.get('spark', {})

    @property
    def configured(self):
        cfg = self._get_config()
        return bool(cfg.get('url') and cfg.get('username') and cfg.get('password'))

    def _login(self):
        """Authenticate and cache bearer token."""
        cfg = self._get_config()
        resp = http_requests.post(
            f"{cfg['url']}/api/login",
            json={'username': cfg['username'], 'password': cfg['password']},
            timeout=10,
        )
        resp.raise_for_status()
        self._token = resp.json().get('token')

    def _request(self, method, path, **kwargs):
        """Make authenticated request, auto-retry on 401."""
        cfg = self._get_config()
        if not self.configured:
            return None
        url = f"{cfg['url']}/api/v1{path}"
        kwargs.setdefault('timeout', 10)

        for attempt in range(2):
            if not self._token:
                self._login()
            headers = {'Authorization': f'Bearer {self._token}'}
            resp = http_requests.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401 and attempt == 0:
                self._token = None
                continue
            resp.raise_for_status()
            return resp.json()
        return None

    def get_updates(self):
        return self._request('GET', '/updates/available')

    def trigger_update(self):
        return self._request('POST', '/update_reboot')


_platform = PlatformClient()
_update_proc = None  # Track background update subprocess
_update_status = {'running': False, 'category': None, 'error': None}


def _parse_apt_updates():
    """Parse apt list --upgradable into categorized packages."""
    if platform.system() != 'Linux':
        return []
    try:
        out = subprocess.run(
            ['apt', 'list', '--upgradable'],
            capture_output=True, text=True, timeout=30
        )
        lines = [l for l in out.stdout.strip().split('\n')
                 if '/' in l and 'upgradable' in l]
    except Exception:
        return []

    packages = []
    for line in lines:
        name = line.split('/')[0]
        # Extract version info
        parts = line.split()
        new_ver = parts[1] if len(parts) > 1 else ''
        old_ver = ''
        for p in parts:
            if p.startswith('[upgradable'):
                idx = parts.index(p)
                if idx + 2 < len(parts):
                    old_ver = parts[idx + 2].rstrip(']')
        packages.append({'name': name, 'new_version': new_ver, 'old_version': old_ver})
    return packages


def _parse_snap_updates():
    """Parse snap refresh --list for available snap updates."""
    if platform.system() != 'Linux':
        return []
    try:
        out = subprocess.run(
            ['snap', 'refresh', '--list'],
            capture_output=True, text=True, timeout=30
        )
        if out.returncode != 0:
            return []
        lines = out.stdout.strip().split('\n')
        if len(lines) <= 1:
            return []
        # Header: Name  Version  Rev  Size  Publisher  Notes
        snaps = []
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 2:
                snaps.append({'name': parts[0], 'new_version': parts[1]})
        return snaps
    except Exception:
        return []


def _categorize_apt_packages(packages):
    """Sort apt packages into categories."""
    # Match GPU-related packages (NVIDIA ecosystem)
    gpu_pattern = re.compile(
        r'(nvidia|cuda-|cudnn|jetpack|tegra|tensorrt|nccl|'
        r'(?:^|[-_])l4t(?:[-_]|$))', re.I
    )
    firmware_keywords = {'firmware', 'linux-firmware'}

    categories = {
        'gpu': {'name': 'GPU Packages', 'packages': [], 'requires_reboot': True},
        'firmware': {'name': 'Firmware', 'packages': [], 'requires_reboot': True},
        'system': {'name': 'System Packages', 'packages': [], 'requires_reboot': False},
    }

    for pkg in packages:
        name_lower = pkg['name'].lower()
        if any(kw in name_lower for kw in firmware_keywords):
            categories['firmware']['packages'].append(pkg)
        elif gpu_pattern.search(name_lower):
            categories['gpu']['packages'].append(pkg)
        else:
            categories['system']['packages'].append(pkg)

    return categories


def _check_sudoers_setup():
    """Check if passwordless sudo is configured for update commands."""
    if platform.system() != 'Linux':
        return False
    try:
        out = subprocess.run(
            ['sudo', '-n', 'apt-get', 'update', '-qq', '--print-uris'],
            capture_output=True, timeout=5
        )
        return out.returncode == 0
    except Exception:
        return False


@app.route('/api/system/updates')
def system_updates():
    """Return categorized available updates from apt, snap, and platform dashboard."""
    apt_pkgs = _parse_apt_updates()
    apt_cats = _categorize_apt_packages(apt_pkgs)
    snap_pkgs = _parse_snap_updates()

    # Check platform dashboard update
    platform_available = False
    platform_error = None
    if _platform.configured:
        try:
            data = _platform.get_updates()
            platform_available = (data or {}).get('available', False)
        except Exception:
            platform_error = 'Failed to reach platform dashboard'

    categories = []
    for cat_id in ['system', 'gpu', 'firmware']:
        cat = apt_cats[cat_id]
        if cat['packages']:
            categories.append({
                'id': cat_id,
                'name': cat['name'],
                'count': len(cat['packages']),
                'packages': cat['packages'],
                'requires_reboot': cat['requires_reboot'],
            })

    if snap_pkgs:
        categories.append({
            'id': 'snap',
            'name': 'Snap Packages',
            'count': len(snap_pkgs),
            'packages': snap_pkgs,
            'requires_reboot': False,
        })

    categories.append({
        'id': 'platform',
        'name': CONFIG.get('spark', {}).get('label', 'Platform Update'),
        'count': 1 if platform_available else 0,
        'packages': [],
        'requires_reboot': True,
        'available': platform_available,
        'error': platform_error,
    })

    sudo_ok = _check_sudoers_setup()

    is_linux = platform.system() == 'Linux'
    return jsonify({
        'categories': categories,
        'update_status': _update_status,
        'sudo_configured': sudo_ok,
        'supported': is_linux or _platform.configured,
    })


@app.route('/api/system/update', methods=['POST'])
def system_trigger_update():
    """Trigger updates for selected categories."""
    global _update_proc, _update_status

    with _update_lock:
        if _update_status['running']:
            return jsonify({'error': 'Update already in progress'}), 409

    data = request.get_json() or {}
    categories = data.get('categories', [])
    if not categories:
        return jsonify({'error': 'No categories specified'}), 400

    # Platform update goes through dashboard API
    if 'platform' in categories:
        if not _platform.configured:
            return jsonify({'error': 'Platform dashboard not configured'}), 400
        try:
            with _update_lock:
                _update_status = {'running': True, 'category': 'platform', 'error': None}
            _platform.trigger_update()
            return jsonify({'status': 'started', 'category': 'platform',
                            'note': 'System will reboot shortly'})
        except Exception as e:
            with _update_lock:
                _update_status = {'running': False, 'category': None, 'error': str(e)}
            return jsonify({'error': str(e)}), 502

    # For apt/snap categories, build command lists and run in background
    cmd_lists = []
    cat_names = []

    apt_cats_needed = [c for c in categories if c in ('system', 'gpu', 'firmware')]
    if apt_cats_needed:
        # Get the specific packages for requested categories
        apt_pkgs = _parse_apt_updates()
        apt_cats = _categorize_apt_packages(apt_pkgs)
        pkg_names = []
        for cat_id in apt_cats_needed:
            pkg_names.extend(p['name'] for p in apt_cats[cat_id]['packages'])
            cat_names.append(apt_cats[cat_id]['name'])
        if pkg_names:
            # Validate package names contain only safe characters
            safe_pkg = re.compile(r'^[a-zA-Z0-9_.+:~-]+$')
            pkg_names = [p for p in pkg_names if safe_pkg.match(p)]
            if pkg_names:
                cmd_lists.append(['sudo', 'apt-get', 'update', '-qq'])
                cmd_lists.append(['sudo', 'apt-get', 'upgrade', '-y'] + pkg_names)

    if 'snap' in categories:
        snap_pkgs = _parse_snap_updates()
        snap_names = [s['name'] for s in snap_pkgs]
        cat_names.append('Snap Packages')
        safe_snap = re.compile(r'^[a-zA-Z0-9_-]+$')
        for sn in snap_names:
            if safe_snap.match(sn):
                cmd_lists.append(['sudo', 'snap', 'refresh', sn])

    if not cmd_lists:
        return jsonify({'error': 'No packages to update'}), 400

    label = ', '.join(cat_names)
    with _update_lock:
        _update_status = {'running': True, 'category': label, 'error': None}

    # Chain commands: run each sequentially, stop on first failure
    def _run_updates():
        global _update_proc, _update_status
        try:
            for cmd in cmd_lists:
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
                )
                _update_proc = proc
                proc.wait()
                if proc.returncode != 0:
                    stderr = ''
                    try:
                        stderr = proc.stderr.read().decode('utf-8', errors='replace')[-200:]
                    except Exception:
                        pass
                    with _update_lock:
                        _update_status = {'running': False, 'category': None,
                                          'error': f'Update failed (exit {proc.returncode}): {stderr}'}
                    return
            with _update_lock:
                _update_status = {'running': False, 'category': None, 'error': None}
        except Exception as e:
            with _update_lock:
                _update_status = {'running': False, 'category': None, 'error': str(e)}

    threading.Thread(target=_run_updates, daemon=True).start()

    return jsonify({'status': 'started', 'categories': categories})


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
    import time as _time

    # Auto-compute if missing or stale
    needs_compute = not USAGE_STATS_FILE.exists()
    if not needs_compute:
        age = _time.time() - USAGE_STATS_FILE.stat().st_mtime
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

# Track connected client count so monitors can pause when idle
_connected_clients = 0
_clients_lock = threading.Lock()


@socketio.on('connect')
def handle_connect():
    global _connected_clients
    # Reject unauthenticated WebSocket connections when auth is enabled
    if _AUTH_PASSWORD and not flask.session.get('authenticated'):
        return False  # Cleanly reject connection without exception
    with _clients_lock:
        _connected_clients += 1
    logger.info('Client connected: %s (total: %d)', getattr(request, 'sid', '?'), _connected_clients)


@socketio.on('disconnect')
def handle_disconnect():
    global _connected_clients
    sid = getattr(request, 'sid', None)
    with _clients_lock:
        _connected_clients = max(0, _connected_clients - 1)
    logger.info('Client disconnected: %s (total: %d)', sid, _connected_clients)
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

def _has_clients():
    """Check if any clients are connected."""
    return _connected_clients > 0


def _bg_workers_monitor():
    """Push worker list changes every 2s."""
    prev = None
    while True:
        if _has_clients():
            try:
                windows = tmux.list_windows()
                for w in windows:
                    if w['name'] in _worker_models:
                        w['model'] = _worker_models[w['name']]
                    if w['name'] in _worker_spawn_times:
                        w['spawn_time'] = _worker_spawn_times[w['name']]
                h = _data_hash(windows)
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
        if _has_clients():
            try:
                data = _get_workers_usage_data()
                h = _data_hash(data)
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
        if _has_clients():
            try:
                data = _get_activity_data()
                h = _data_hash(data)
                if h != prev_activity:
                    prev_activity = h
                    socketio.emit('activity:update', data)
            except Exception:
                pass
            try:
                data = _get_home_tree_data()
                h = _data_hash(data)
                if h != prev_files:
                    prev_files = h
                    socketio.emit('files:update', data)
            except Exception:
                pass
        socketio.sleep(5)


def _bg_metrics_monitor():
    """Push system metrics every 2s."""
    prev = None
    while True:
        if _has_clients():
            try:
                data = _get_metrics_data()
                h = _data_hash(data)
                if h != prev:
                    prev = h
                    socketio.emit('metrics:update', data)
            except Exception:
                pass
        socketio.sleep(2)


def _bg_terminal_monitor():
    """Push terminal output to subscribed clients only, every 500ms.
    Also tracks idle state: worker is idle when output unchanged for 10s
    and last line is exactly '>' or '❯' (prompt indicator)."""
    prev_outputs = {}
    last_change = {}    # name -> timestamp of last output change
    idle_state = {}     # name -> bool (True = idle notification sent)
    while True:
        if _has_clients():
            now = time.time()
            try:
                # Collect all subscribed workers across all clients
                with _terminal_subs_lock:
                    subscribed = set()
                    for names in _terminal_subs.values():
                        subscribed.update(names)

                for name in subscribed:
                    try:
                        output = tmux.capture_output(name, 200)
                        h = _data_hash(output)
                        if h != prev_outputs.get(name):
                            prev_outputs[name] = h
                            last_change[name] = now
                            # Emit only to clients in this worker's room
                            socketio.emit('worker:output',
                                          {'name': name, 'output': output},
                                          to=f'terminal:{name}')
                            # Reset idle state when output changes
                            if idle_state.get(name):
                                idle_state[name] = False
                        else:
                            # Check for idle: unchanged for 10s and at prompt
                            elapsed = now - last_change.get(name, now)
                            if elapsed >= 10 and not idle_state.get(name):
                                last_line = (output or '').rstrip().split('\n')[-1].strip() if output else ''
                                if last_line in ('>', '❯'):
                                    idle_state[name] = True
                                    socketio.emit('worker:idle', {'name': name})
                    except Exception:
                        pass

                # Clean up cache for unsubscribed workers
                for name in list(prev_outputs):
                    if name not in subscribed:
                        del prev_outputs[name]
                        last_change.pop(name, None)
                        idle_state.pop(name, None)
            except Exception:
                pass
        socketio.sleep(0.5)


def _start_background_monitors():
    """Start all background monitoring threads."""
    socketio.start_background_task(_bg_workers_monitor)
    socketio.start_background_task(_bg_usage_monitor)
    socketio.start_background_task(_bg_activity_monitor)
    socketio.start_background_task(_bg_metrics_monitor)
    socketio.start_background_task(_bg_terminal_monitor)


if __name__ == '__main__':
    _get_models()  # warm cache so first request is instant
    _start_background_monitors()
    socketio.run(app, host=CONFIG.get('host', '0.0.0.0'), port=CONFIG.get('port', 5001),
                 allow_unsafe_werkzeug=True)
