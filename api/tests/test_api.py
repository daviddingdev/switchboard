"""
Basic API tests using Flask test client.
Mocks tmux operations to avoid needing a real tmux session.
"""

import json
import os
import sys
import tempfile
import shutil
from unittest.mock import patch, MagicMock

import pytest

# Add api/ to path so server module can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def state_dir(tmp_path):
    """Create a temp state directory for proposals."""
    proposals_dir = tmp_path / 'state' / 'proposals'
    proposals_dir.mkdir(parents=True)
    return tmp_path


@pytest.fixture
def client(state_dir):
    """Create a Flask test client with mocked tmux and temp state."""
    with patch.dict(os.environ, {'CLAUDECODE': ''}):
        # Mock tmux before importing server
        with patch('tmux_manager.configure'), \
             patch('tmux_manager.ensure_session', return_value='inactive'), \
             patch('tmux_manager.list_windows', return_value=[]), \
             patch('tmux_manager.spawn_worker', return_value={
                 'name': 'test', 'directory': '/tmp', 'status': 'starting', 'pid': 123, 'log_file': '/tmp/test.log'
             }), \
             patch('tmux_manager.setup_worker'), \
             patch('tmux_manager.kill_worker', return_value=True), \
             patch('tmux_manager.send_keys', return_value=True), \
             patch('tmux_manager.capture_output', return_value='> hello'):

            import server
            # Point proposals to temp dir
            server.PROPOSALS_DIR = state_dir / 'state' / 'proposals'
            server.app.config['TESTING'] = True

            with server.app.test_client() as c:
                yield c


class TestHealth:
    def test_health_returns_ok(self, client):
        resp = client.get('/api/health')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['status'] == 'ok'

    def test_404_api_route(self, client):
        resp = client.get('/api/nonexistent')
        assert resp.status_code == 404


class TestProcesses:
    def test_list_processes(self, client):
        resp = client.get('/api/processes')
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_spawn_requires_name(self, client):
        resp = client.post('/api/processes',
                           json={'directory': '/tmp'})
        assert resp.status_code == 400
        assert 'name' in resp.get_json()['error']

    def test_spawn_success(self, client):
        resp = client.post('/api/processes',
                           json={'name': 'test', 'directory': '/tmp'})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['name'] == 'test'
        assert data['status'] == 'starting'

    def test_kill_nonexistent(self, client):
        resp = client.delete('/api/processes/nonexistent')
        assert resp.status_code == 404

    def test_send_keys(self, client):
        resp = client.post('/api/processes/test/send',
                           json={'text': 'hello'})
        assert resp.status_code == 200

    def test_get_output(self, client):
        resp = client.get('/api/processes/test/output')
        assert resp.status_code == 200
        assert 'output' in resp.get_json()


class TestProposals:
    def test_list_empty(self, client):
        resp = client.get('/api/proposals')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_create_proposal(self, client):
        resp = client.post('/api/proposals', json={
            'id': 'test-1',
            'title': 'Test proposal',
            'worker': 'test',
            'steps': ['step 1', 'step 2'],
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['id'] == 'test-1'
        assert data['status'] == 'pending'

    def test_create_requires_id_and_title(self, client):
        resp = client.post('/api/proposals', json={'id': 'x'})
        assert resp.status_code == 400

        resp = client.post('/api/proposals', json={'title': 'x'})
        assert resp.status_code == 400

    def test_create_rejects_bad_id(self, client):
        resp = client.post('/api/proposals', json={
            'id': '../etc/passwd',
            'title': 'evil',
        })
        assert resp.status_code == 400

    def test_create_rejects_non_list_steps(self, client):
        resp = client.post('/api/proposals', json={
            'id': 'test-2',
            'title': 'Test',
            'steps': 'not a list',
        })
        assert resp.status_code == 400

    def test_approve_proposal(self, client):
        # Create
        client.post('/api/proposals', json={
            'id': 'approve-test',
            'title': 'Approve me',
            'steps': [],
        })
        # Approve
        resp = client.patch('/api/proposals/approve-test',
                            json={'status': 'approved'})
        assert resp.status_code == 200
        assert resp.get_json()['proposal']['status'] == 'approved'

    def test_reject_proposal(self, client):
        client.post('/api/proposals', json={
            'id': 'reject-test',
            'title': 'Reject me',
            'steps': [],
        })
        resp = client.patch('/api/proposals/reject-test',
                            json={'status': 'rejected'})
        assert resp.status_code == 200

    def test_invalid_status_update(self, client):
        client.post('/api/proposals', json={
            'id': 'bad-status',
            'title': 'Test',
            'steps': [],
        })
        resp = client.patch('/api/proposals/bad-status',
                            json={'status': 'invalid'})
        assert resp.status_code == 400

    def test_delete_proposal(self, client):
        client.post('/api/proposals', json={
            'id': 'delete-test',
            'title': 'Delete me',
            'steps': [],
        })
        resp = client.delete('/api/proposals/delete-test')
        assert resp.status_code == 200

        # Verify deleted
        resp = client.delete('/api/proposals/delete-test')
        assert resp.status_code == 404

    def test_patch_bad_id(self, client):
        resp = client.patch('/api/proposals/bad id!',
                            json={'status': 'approved'})
        assert resp.status_code == 400

    def test_delete_bad_id(self, client):
        resp = client.delete('/api/proposals/bad id!')
        assert resp.status_code == 400
