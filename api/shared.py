"""Shared context object for Switchboard modules."""

import hashlib
import json
import threading


class AppContext:
    """Shared state bag passed to all modules at init time."""

    def __init__(self, socketio, config):
        self.socketio = socketio
        self.config = config

        # Worker state (owned by server.py)
        self.worker_sessions = {}      # name -> session file path
        self.worker_models = {}        # name -> model id
        self.worker_spawn_times = {}   # name -> timestamp

        # Idle detection state (owned by idle_detector)
        self.idle_state = {}           # name -> bool (True = idle)
        self.idle_state_lock = threading.Lock()
        self.hook_last_seen = {}       # name -> timestamp of last hook event

        # Connected clients tracking
        self.connected_clients = 0
        self.clients_lock = threading.Lock()

    def has_clients(self):
        """Check if any WebSocket clients are connected."""
        return self.connected_clients > 0


def data_hash(data):
    """Hash data for change detection."""
    return hashlib.md5(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()
