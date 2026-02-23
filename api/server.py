"""
Flask API server for orchestrator.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

import os
import subprocess
from datetime import datetime
from pathlib import Path

import yaml
from flask import Flask, request, jsonify
from flask_cors import CORS
import tmux_manager as tmux

STATE_DIR = Path(__file__).parent.parent / 'state'
PROPOSALS_DIR = STATE_DIR / 'proposals'
PROJECTS_FILE = STATE_DIR / 'projects.yaml'

# Directories to exclude from file listings
EXCLUDE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', '.next', '.cache'}
EXCLUDE_FILES = {'.DS_Store', 'Thumbs.db'}
MAX_DEPTH = 4

app = Flask(__name__)
CORS(app)


@app.route('/')
def index():
    """Root endpoint with API info."""
    return {
        "name": "Orchestrator API",
        "version": "0.3.0",
        "endpoints": [
            "GET /api/health",
            "GET /api/processes",
            "POST /api/processes",
            "DELETE /api/processes/<name>",
            "POST /api/processes/<name>/send",
            "GET /api/processes/<name>/output",
            "GET /api/proposals",
            "POST /api/proposals",
            "PATCH /api/proposals/<id>",
            "DELETE /api/proposals/<id>",
            "GET /api/projects",
            "GET /api/home",
            "GET /api/files/<project>",
            "GET /api/file?path=<filepath>",
            "GET /api/changes",
            "GET /api/activity"
        ]
    }


@app.route('/api/health')
def health():
    """Health check endpoint."""
    return {"status": "ok", "session": tmux.ensure_session()}


@app.route('/api/processes')
def list_processes():
    """List all worker windows."""
    windows = tmux.list_windows()
    return jsonify(windows)


@app.route('/api/processes', methods=['POST'])
def spawn_process():
    """Spawn a new worker."""
    data = request.json or {}
    name = data.get('name')
    directory = data.get('directory', '~')

    # Validation
    if not name:
        return {"error": "name required"}, 400

    # Check if already exists
    existing = [w for w in tmux.list_windows() if w['name'] == name]
    if existing:
        return {"error": f"worker '{name}' already exists"}, 409

    try:
        result = tmux.spawn_worker(name, directory)
        return jsonify(result), 201
    except ValueError as e:
        return {"error": str(e)}, 400
    except RuntimeError as e:
        return {"error": str(e)}, 500


@app.route('/api/processes/<name>', methods=['DELETE'])
def kill_process(name):
    """Kill a worker."""
    if name == 'partner':
        return {"error": "cannot kill partner"}, 403

    # Check if worker exists
    existing = [w for w in tmux.list_windows() if w['name'] == name]
    if not existing:
        return {"error": "worker not found"}, 404

    success = tmux.kill_worker(name)
    if success:
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

    proposal = {
        'id': proposal_id,
        'title': title,
        'worker': worker,
        'steps': steps,
        'status': 'approved' if auto_approve else 'pending',
        'auto_approve': auto_approve,
        'created_at': datetime.utcnow().isoformat() + 'Z'
    }

    PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
    proposal_file = PROPOSALS_DIR / f"{proposal_id}.yaml"
    with open(proposal_file, 'w') as f:
        yaml.dump(proposal, f, default_flow_style=False)

    return jsonify(proposal), 201


@app.route('/api/proposals/<proposal_id>', methods=['PATCH'])
def update_proposal(proposal_id):
    """Update a proposal's status."""
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

        return {"status": "updated", "proposal": proposal}
    except Exception as e:
        return {"error": str(e)}, 500


@app.route('/api/proposals/<proposal_id>', methods=['DELETE'])
def delete_proposal(proposal_id):
    """Delete a proposal."""
    proposal_file = PROPOSALS_DIR / f"{proposal_id}.yaml"
    if not proposal_file.exists():
        return {"error": "proposal not found"}, 404

    try:
        proposal_file.unlink()
        return {"status": "deleted"}
    except Exception as e:
        return {"error": str(e)}, 500


# =============================================================================
# Projects, Files, Changes, Activity endpoints
# =============================================================================

def discover_projects(root_dir=None, max_depth=3):
    """
    Auto-discover projects by finding directories with CLAUDE.md files.
    Returns list of project directories relative to root.
    """
    if root_dir is None:
        root_dir = os.path.expanduser('~')

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
    return sorted(projects, key=lambda p: p['name'].lower())


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
    Status codes: M (modified), A (added), D (deleted), U (untracked)
    """
    result = {}
    try:
        proc = subprocess.run(
            ['git', '-C', directory, 'status', '--porcelain'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if proc.returncode != 0:
            return {}

        for line in proc.stdout.splitlines():
            if line and len(line) >= 3:
                status_code = line[:2]
                filepath = line[3:]
                # Normalize status
                if status_code == '??':
                    result[filepath] = 'U'  # Untracked
                elif 'D' in status_code:
                    result[filepath] = 'D'  # Deleted
                elif 'A' in status_code:
                    result[filepath] = 'A'  # Added
                elif 'M' in status_code or status_code.strip():
                    result[filepath] = 'M'  # Modified
        return result
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {}


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


@app.route('/api/home')
def get_home_tree():
    """
    Get home directory tree showing:
    - Root-level .md files (SOUL.md, INFRASTRUCTURE.md, etc.)
    - Only directories that are projects (have CLAUDE.md)
    """
    home_dir = os.path.expanduser('~')
    projects = discover_projects()
    project_dirs = {p['directory'] for p in projects}

    result = []

    try:
        entries = sorted(os.listdir(home_dir))
    except (PermissionError, FileNotFoundError):
        return jsonify([])

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

        # Get relative path from home (e.g., "services/research-pipeline" or just "orchestrator")
        rel_path = os.path.relpath(proj_dir, home_dir)
        parts = rel_path.split(os.sep)

        if len(parts) == 1:
            # Direct child of home (e.g., ~/orchestrator)
            result.append({
                'name': proj_name,
                'path': proj_dir,
                'type': 'dir',
                'is_project': True,
                'has_changes': has_changes,
                'children': children
            })
        else:
            # Nested (e.g., ~/services/research-pipeline)
            # Find or create parent directories
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

            # Add the project as child
            existing_parent['children'].append({
                'name': proj_name,
                'path': proj_dir,
                'type': 'dir',
                'is_project': True,
                'has_changes': has_changes,
                'children': children
            })

            # Update parent's has_changes
            if has_changes:
                existing_parent['has_changes'] = True

    # Sort: files first (SOUL.md etc.), then directories
    result.sort(key=lambda x: (0 if x['type'] == 'file' else 1, x['name'].lower()))

    return jsonify({
        'directory': home_dir,
        'files': result
    })


@app.route('/api/files/<project>')
def list_files(project):
    """List files for a project with git status."""
    directory = get_project_directory(project)
    if not directory:
        return {"error": f"project '{project}' not found"}, 404

    if not os.path.isdir(directory):
        return {"error": f"directory '{directory}' does not exist"}, 404

    git_status = get_git_status_map(directory)
    tree = build_file_tree(directory, git_status=git_status, base_dir=directory)
    return jsonify({
        'project': project,
        'directory': directory,
        'files': tree
    })


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


@app.route('/api/changes')
def get_changes():
    """Get git status across all projects."""
    projects = load_projects()
    result = []

    for p in projects:
        directory = os.path.expanduser(p.get('directory', ''))
        if not os.path.isdir(directory):
            continue

        status = get_git_status(directory)
        result.append({
            'project': p.get('name'),
            'directory': directory,
            'has_git': status is not None,
            'files': status or []
        })

    return jsonify(result)


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
                    except:
                        pass

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


@app.route('/api/activity')
def get_activity():
    """Get combined activity feed: pending proposals + changes + unpushed + recent."""
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

    return jsonify(result)


if __name__ == '__main__':
    tmux.ensure_session()
    app.run(host='0.0.0.0', port=5001, debug=True)
