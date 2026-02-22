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

PLANS_DIR = Path(__file__).parent.parent / 'state' / 'plans'

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
            "GET /api/plans",
            "POST /api/plans",
            "PATCH /api/plans/<id>"
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


@app.route('/api/plans')
def list_plans():
    """List all plans from state/plans/ directory."""
    plans = []
    if PLANS_DIR.exists():
        for plan_file in PLANS_DIR.glob('*.yaml'):
            try:
                with open(plan_file) as f:
                    plan = yaml.safe_load(f)
                    if plan:
                        # Use filename (without .yaml) as id if not specified
                        if 'id' not in plan:
                            plan['id'] = plan_file.stem
                        # Normalize created_at to string for consistent sorting
                        if 'created_at' in plan and not isinstance(plan['created_at'], str):
                            plan['created_at'] = str(plan['created_at'])
                        plans.append(plan)
            except Exception as e:
                # Skip invalid plan files
                pass
    # Sort: pending first, then by created_at descending (newest first)
    pending = [p for p in plans if p.get('status') == 'pending']
    others = [p for p in plans if p.get('status') != 'pending']
    pending.sort(key=lambda p: p.get('created_at', ''), reverse=True)
    others.sort(key=lambda p: p.get('created_at', ''), reverse=True)
    return jsonify(pending + others)


@app.route('/api/plans', methods=['POST'])
def create_plan():
    """Create a new plan."""
    data = request.json or {}
    plan_id = data.get('id')
    title = data.get('title')
    worker = data.get('worker', 'unknown')
    steps = data.get('steps', [])
    auto_approve = data.get('auto_approve', False)

    if not plan_id or not title:
        return {"error": "id and title required"}, 400

    plan = {
        'id': plan_id,
        'title': title,
        'worker': worker,
        'steps': steps,
        'status': 'approved' if auto_approve else 'pending',
        'auto_approve': auto_approve,
        'created_at': datetime.utcnow().isoformat() + 'Z'
    }

    PLANS_DIR.mkdir(parents=True, exist_ok=True)
    plan_file = PLANS_DIR / f"{plan_id}.yaml"
    with open(plan_file, 'w') as f:
        yaml.dump(plan, f, default_flow_style=False)

    return jsonify(plan), 201


@app.route('/api/plans/<plan_id>', methods=['PATCH'])
def update_plan(plan_id):
    """Update a plan's status."""
    data = request.json or {}
    new_status = data.get('status')

    if new_status not in ('approved', 'rejected'):
        return {"error": "status must be 'approved' or 'rejected'"}, 400

    plan_file = PLANS_DIR / f"{plan_id}.yaml"
    if not plan_file.exists():
        return {"error": "plan not found"}, 404

    try:
        with open(plan_file) as f:
            plan = yaml.safe_load(f)

        plan['status'] = new_status

        with open(plan_file, 'w') as f:
            yaml.dump(plan, f, default_flow_style=False)

        return {"status": "updated", "plan": plan}
    except Exception as e:
        return {"error": str(e)}, 500


if __name__ == '__main__':
    tmux.ensure_session()
    app.run(host='0.0.0.0', port=5001, debug=True)
