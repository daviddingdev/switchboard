"""
Flask API server for orchestrator.

Provides HTTP endpoints for managing Claude Code worker sessions.
"""

import os
from datetime import datetime
from pathlib import Path

import yaml
from flask import Flask, request, jsonify
from flask_cors import CORS
import tmux_manager as tmux

PROPOSALS_DIR = Path(__file__).parent.parent / 'state' / 'proposals'

app = Flask(__name__)
CORS(app)


@app.route('/')
def index():
    """Root endpoint with API info."""
    return {
        "name": "Orchestrator API",
        "version": "0.1.0",
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
            "DELETE /api/proposals/<id>"
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
    success = tmux.send_keys(name, text)
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


if __name__ == '__main__':
    tmux.ensure_session()
    app.run(host='0.0.0.0', port=5001, debug=True)
