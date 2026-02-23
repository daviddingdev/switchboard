"""
Flask API server for orchestrator.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

import os
import subprocess
import json
import glob as glob_module
from datetime import datetime
from pathlib import Path

import yaml
from flask import Flask, request, jsonify
from flask_cors import CORS
import tmux_manager as tmux

# Claude session files location
CLAUDE_PROJECTS_DIR = os.path.expanduser('~/.claude/projects')
CLAUDE_CONFIG_FILE = os.path.expanduser('~/.claude.json')

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
        "version": "0.4.0",
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
            "GET /api/activity",
            "GET /api/workers/usage",
            "GET /api/partner/history",
            "POST /api/partner/reset"
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


@app.route('/api/doc-context')
def get_doc_context():
    """
    Get context needed to update docs for projects with unpushed commits.
    Returns commit messages, diff stats, and worker logs (if available).
    """
    result = []
    logs_dir = os.path.expanduser("~/orchestrator/logs/workers")

    try:
        projects = load_projects()
        for p in projects:
            name = p.get('name', '')
            directory = os.path.expanduser(p.get('directory', ''))
            if not os.path.isdir(directory):
                continue

            commits = get_unpushed_commits(directory)
            if not commits:
                continue

            # Get diff stat for unpushed commits
            diff_stat = None
            try:
                stat_result = subprocess.run(
                    ['git', '-C', directory, 'diff', '--stat', '@{u}..HEAD'],
                    capture_output=True, text=True, timeout=10
                )
                if stat_result.returncode == 0:
                    diff_stat = stat_result.stdout.strip()
            except:
                pass

            # Look for worker log (current session)
            worker_log = None
            log_path = os.path.join(logs_dir, f"{name}.log")
            if os.path.exists(log_path):
                try:
                    with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                        # Read last 500 lines max to keep context manageable
                        lines = f.readlines()
                        worker_log = ''.join(lines[-500:]) if len(lines) > 500 else ''.join(lines)
                except:
                    pass

            # Check for CHANGELOG.md and TODO.md
            has_changelog = os.path.exists(os.path.join(directory, 'CHANGELOG.md'))
            has_todo = os.path.exists(os.path.join(directory, 'TODO.md'))

            result.append({
                'project': name,
                'directory': directory,
                'commits': commits,
                'diff_stat': diff_stat,
                'worker_log': worker_log,
                'worker_log_lines': len(worker_log.split('\n')) if worker_log else 0,
                'has_changelog': has_changelog,
                'has_todo': has_todo
            })
    except Exception as e:
        return {"error": str(e)}, 500

    return jsonify(result)


@app.route('/api/update-docs', methods=['POST'])
def update_docs():
    """
    Run claude -p to update docs for a project.
    Uses context from unpushed commits + worker logs.
    """
    data = request.json or {}
    project_name = data.get('project')

    if not project_name:
        return {"error": "project required"}, 400

    directory = get_project_directory(project_name)
    if not directory:
        return {"error": f"project '{project_name}' not found"}, 404

    # Get context for this project
    logs_dir = os.path.expanduser("~/orchestrator/logs/workers")
    commits = get_unpushed_commits(directory)

    if not commits:
        return {"error": "no unpushed commits"}, 400

    # Build context string
    context_parts = [f"Project: {project_name}", f"Directory: {directory}", ""]

    # Commits
    context_parts.append("## Unpushed Commits")
    for c in commits:
        context_parts.append(f"- {c['hash']} {c['message']}")
    context_parts.append("")

    # Diff stat
    try:
        stat_result = subprocess.run(
            ['git', '-C', directory, 'diff', '--stat', '@{u}..HEAD'],
            capture_output=True, text=True, timeout=10
        )
        if stat_result.returncode == 0 and stat_result.stdout.strip():
            context_parts.append("## Files Changed")
            context_parts.append("```")
            context_parts.append(stat_result.stdout.strip())
            context_parts.append("```")
            context_parts.append("")
    except:
        pass

    # Full diff (limited)
    try:
        diff_result = subprocess.run(
            ['git', '-C', directory, 'diff', '@{u}..HEAD'],
            capture_output=True, text=True, timeout=30
        )
        if diff_result.returncode == 0 and diff_result.stdout.strip():
            diff_text = diff_result.stdout.strip()
            # Limit diff to ~50k chars to avoid overwhelming context
            if len(diff_text) > 50000:
                diff_text = diff_text[:50000] + "\n... (diff truncated)"
            context_parts.append("## Full Diff")
            context_parts.append("```diff")
            context_parts.append(diff_text)
            context_parts.append("```")
            context_parts.append("")
    except:
        pass

    # Worker log if available
    log_path = os.path.join(logs_dir, f"{project_name}.log")
    if os.path.exists(log_path):
        try:
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                log_text = ''.join(lines[-300:]) if len(lines) > 300 else ''.join(lines)
                if log_text.strip():
                    context_parts.append("## Worker Session Log (recent)")
                    context_parts.append("```")
                    context_parts.append(log_text.strip())
                    context_parts.append("```")
        except:
            pass

    context = '\n'.join(context_parts)

    # Build the prompt
    prompt = f"""Update the documentation files in this project based on the changes described below.

UPDATE THESE FILES (if they exist):
- CHANGELOG.md: Add entry for today's changes under current date heading
- TODO.md: Mark completed items as [x], add new discovered tasks
- USAGE.md: Update if usage/API changed

RULES:
- Only update files that exist in the project
- Use today's date: {datetime.now().strftime('%Y-%m-%d')}
- Be concise but complete
- Match existing file style/format
- Don't add entries for doc updates themselves

CONTEXT:
{context}"""

    # Run claude -p
    try:
        result = subprocess.run(
            ['claude', '-p', prompt, '--allowedTools', 'Read,Edit,Write,Glob'],
            cwd=directory,
            capture_output=True,
            text=True,
            timeout=120  # 2 min timeout
        )

        # Get the updated files status
        status_result = subprocess.run(
            ['git', '-C', directory, 'status', '--short'],
            capture_output=True, text=True, timeout=5
        )

        return jsonify({
            'success': result.returncode == 0,
            'output': result.stdout[-5000:] if result.stdout else '',  # Last 5k chars
            'error': result.stderr[-1000:] if result.stderr else '',
            'git_status': status_result.stdout.strip() if status_result.returncode == 0 else ''
        })
    except subprocess.TimeoutExpired:
        return {"error": "claude timed out after 2 minutes"}, 500
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
    except:
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


@app.route('/api/commit', methods=['POST'])
def commit_project():
    """
    Stage all changes and commit with the provided message.
    """
    data = request.json or {}
    project_name = data.get('project')
    message = data.get('message')

    if not project_name:
        return {"error": "project required"}, 400
    if not message:
        return {"error": "message required"}, 400

    directory = get_project_directory(project_name)
    if not directory:
        return {"error": f"project '{project_name}' not found"}, 404

    try:
        # Stage all changes
        add_result = subprocess.run(
            ['git', '-C', directory, 'add', '-A'],
            capture_output=True, text=True, timeout=10
        )
        if add_result.returncode != 0:
            return {"error": f"git add failed: {add_result.stderr.strip()}", "success": False}, 500

        # Check if there are staged changes
        diff_result = subprocess.run(
            ['git', '-C', directory, 'diff', '--cached', '--quiet'],
            capture_output=True, timeout=5
        )

        if diff_result.returncode == 0:
            return {"error": "No changes to commit", "success": False}, 400

        # Commit with message
        commit_result = subprocess.run(
            ['git', '-C', directory, 'commit', '-m', message],
            capture_output=True, text=True, timeout=30
        )

        if commit_result.returncode == 0:
            return jsonify({
                "success": True,
                "output": commit_result.stdout.strip()
            })
        else:
            return jsonify({
                "success": False,
                "error": commit_result.stderr.strip() or commit_result.stdout.strip()
            })

    except subprocess.TimeoutExpired:
        return {"error": "commit timed out", "success": False}, 500
    except Exception as e:
        return {"error": str(e), "success": False}, 500


# =============================================================================
# Partner Context Management endpoints
# =============================================================================

def get_project_session_dir(directory):
    """Get the Claude session directory for a project."""
    # Claude uses a sanitized path format: -home-davidding-projectname
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


def parse_session_usage(session_file):
    """
    Parse a session JSONL file to extract token usage.
    Returns both cumulative totals and latest context size.
    """
    if not session_file or not os.path.exists(session_file):
        return None

    total_input = 0
    total_output = 0
    latest_context = 0  # Most recent turn's full context

    try:
        with open(session_file, 'r', encoding='utf-8') as f:
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
                        # Latest context = input + cached tokens (what was sent to model)
                        turn_input = usage.get('input_tokens', 0)
                        cache_read = usage.get('cache_read_input_tokens', 0)
                        latest_context = turn_input + cache_read
                except json.JSONDecodeError:
                    continue
    except Exception:
        return None

    return {
        'input_tokens': total_input,
        'output_tokens': total_output,
        'total': total_input + total_output,
        'latest_context': latest_context
    }


def filter_conversation(session_file, limit=100):
    """
    Parse session JSONL and return filtered conversation messages.
    Includes user messages and assistant text (excludes tool_use, thinking).
    """
    if not session_file or not os.path.exists(session_file):
        return []

    messages = []
    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    msg_type = entry.get('type')
                    timestamp = entry.get('timestamp', '')

                    if msg_type == 'user':
                        content = entry.get('message', {}).get('content', '')
                        # Content can be string or list
                        if isinstance(content, list):
                            text_parts = [c.get('text', '') for c in content if c.get('type') == 'text']
                            content = '\n'.join(text_parts)
                        if content:
                            messages.append({
                                'role': 'user',
                                'content': content,
                                'timestamp': timestamp
                            })

                    elif msg_type == 'assistant':
                        content = entry.get('message', {}).get('content', [])
                        if isinstance(content, list):
                            # Filter to just text blocks, skip tool_use and thinking
                            text_parts = [c.get('text', '') for c in content
                                         if c.get('type') == 'text' and c.get('text')]
                            if text_parts:
                                messages.append({
                                    'role': 'assistant',
                                    'content': '\n'.join(text_parts),
                                    'timestamp': timestamp
                                })
                except json.JSONDecodeError:
                    continue
    except Exception:
        return []

    # Return last N messages
    return messages[-limit:] if limit else messages


@app.route('/api/workers/usage')
def get_workers_usage():
    """
    Get context usage stats for all active workers.
    Returns token counts and percentage estimates.
    """
    result = []

    # Get active workers from tmux
    windows = tmux.list_windows()

    for window in windows:
        name = window.get('name', '')

        # Find the project directory for this worker
        # For partner, it's ~/orchestrator. For others, we need to determine.
        if name == 'partner':
            proj_dir = os.path.expanduser('~/orchestrator')
        else:
            # Check if it matches a known project
            projects = load_projects()
            proj_dir = None
            for p in projects:
                if p.get('name') == name:
                    proj_dir = p.get('directory')
                    break
            if not proj_dir:
                continue

        # Find session directory and latest session file
        session_dir = get_project_session_dir(proj_dir)
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

    return jsonify({'workers': result})


@app.route('/api/partner/history')
def get_partner_history():
    """
    Get filtered conversation history for the partner session.
    Returns text messages only (no tool calls or thinking blocks).
    """
    limit = request.args.get('limit', 100, type=int)

    # Partner is always ~/orchestrator
    proj_dir = os.path.expanduser('~/orchestrator')
    session_dir = get_project_session_dir(proj_dir)
    session_file = find_latest_session_file(session_dir)

    messages = filter_conversation(session_file, limit=limit if limit > 0 else None)

    return jsonify({
        'messages': messages,
        'session_file': os.path.basename(session_file) if session_file else None
    })


@app.route('/api/partner/reset', methods=['POST'])
def reset_partner():
    """
    Soft reset the partner session.
    Sends Ctrl-C to interrupt, waits for shell, then restarts claude.
    """
    import time

    try:
        # Send Ctrl-C to interrupt any running operation
        tmux.send_keys('partner', 'C-c', raw=True)
        time.sleep(0.3)

        # Send another Ctrl-C in case first was absorbed by a prompt
        tmux.send_keys('partner', 'C-c', raw=True)
        time.sleep(0.3)

        # Send Escape to exit any prompt/menu state
        tmux.send_keys('partner', 'Escape', raw=True)
        time.sleep(0.3)

        # Third Ctrl-C to ensure we're back at shell
        tmux.send_keys('partner', 'C-c', raw=True)
        time.sleep(1.0)  # Wait longer for Claude to fully exit

        # Clear any partial input
        tmux.send_keys('partner', 'C-u', raw=True)
        time.sleep(0.1)

        # Start a new claude session
        tmux.send_keys('partner', 'claude', raw=False)

        return jsonify({'status': 'reset', 'message': 'Partner session restarting'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    tmux.ensure_session()
    app.run(host='0.0.0.0', port=5001, debug=True)
