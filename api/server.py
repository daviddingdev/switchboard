"""
Flask API server for orchestrator.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import tmux_manager as tmux

app = Flask(__name__)
CORS(app)


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
    success = tmux.send_keys(name, text)
    return {"status": "sent" if success else "failed"}


@app.route('/api/processes/<name>/output')
def get_output(name):
    """Get recent output from a worker."""
    lines = request.args.get('lines', 100, type=int)
    output = tmux.capture_output(name, lines)
    return {"output": output}


if __name__ == '__main__':
    tmux.ensure_session()
    app.run(host='0.0.0.0', port=5001, debug=True)
