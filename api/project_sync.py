"""Projects, files, git status, and session file helpers for Switchboard."""

import glob as glob_module
import json
import os
import re
import subprocess
import time

from flask import Blueprint, request, jsonify

bp = Blueprint('project_sync', __name__)
_ctx = None

# Claude session files location
CLAUDE_PROJECTS_DIR = os.path.expanduser('~/.claude/projects')

# Directories to exclude from file listings
EXCLUDE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', '.next', '.cache'}
EXCLUDE_FILES = {'.DS_Store', 'Thumbs.db'}
MAX_DEPTH = 4

# Project discovery cache
_projects_cache = None
_projects_cache_time = 0
_PROJECTS_CACHE_TTL = 30  # seconds

# Cache for incremental JSONL parsing: {filepath: {offset, input, output, context}}
_usage_parse_cache = {}


def init(ctx):
    """Initialize with shared context."""
    global _ctx
    _ctx = ctx


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
        root_dir = os.path.expanduser(_ctx.config.get('project_root', '~'))
    if max_depth is None:
        max_depth = _ctx.config.get('scan_depth', 3)

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


load_projects = discover_projects


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
                hash_str = parts[0]
                # Get changed files for this commit
                files_result = subprocess.run(
                    ['git', '-C', directory, 'diff-tree', '--no-commit-id', '-r', '--name-status', hash_str],
                    capture_output=True, text=True, timeout=5
                )
                files = []
                if files_result.returncode == 0:
                    for fline in files_result.stdout.strip().splitlines():
                        if fline:
                            fparts = fline.split('\t', 1)
                            if len(fparts) == 2:
                                files.append({'status': fparts[0], 'path': fparts[1]})
                commits.append({
                    'hash': hash_str,
                    'message': parts[1] if len(parts) > 1 else '',
                    'files': files
                })
        return commits
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def get_home_tree_data():
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


# =============================================================================
# Session file helpers
# =============================================================================

def get_project_session_dir(directory):
    """Get the Claude session directory for a project."""
    # Claude uses a sanitized path format: -home-username-projectname
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


def parse_session_usage(session_file):
    """
    Parse a session JSONL file to extract token usage.
    Uses incremental reading -- only parses new lines since last call.
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


# =============================================================================
# Routes
# =============================================================================

@bp.route('/api/projects')
def list_projects():
    """Auto-discover projects with CLAUDE.md files."""
    return jsonify(load_projects())


@bp.route('/api/home')
def get_home_tree():
    """Get home directory tree."""
    return jsonify(get_home_tree_data())


@bp.route('/api/file')
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


@bp.route('/api/file', methods=['PUT'])
def save_file_content():
    """
    Save file contents. Same security as GET (home-dir confinement, 500KB limit).
    Last-write-wins -- acceptable for personal tool.
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


@bp.route('/api/diff')
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


@bp.route('/api/push', methods=['POST'])
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
            upstream = upstream_result.stdout.strip()
            if '/' in upstream:
                remote, branch = upstream.split('/', 1)
            else:
                remote, branch = 'origin', upstream
        else:
            remote, branch = 'origin', 'main'
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
