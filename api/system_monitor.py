"""System metrics, hardware monitoring, and update management for Switchboard."""

import json
import os
import platform
import re
import subprocess
import threading
import time

import psutil
import requests as http_requests
from flask import Blueprint, request, jsonify

from shared import data_hash

bp = Blueprint('system_monitor', __name__)
_ctx = None

# Module-local state
_prev_net = None
_prev_disk = None
_prev_time = None
_smart_cache = {'data': None, 'time': 0}
_update_lock = threading.Lock()
_update_proc = None
_update_status = {'running': False, 'category': None, 'error': None}


def init(ctx):
    """Initialize with shared context."""
    global _ctx
    _ctx = ctx


def _gpu_metrics():
    """Read GPU metrics via configured command (default: nvidia-smi)."""
    gpu_cfg = _ctx.config.get('monitor', {}).get('gpu', {})
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
    services_cfg = _ctx.config.get('monitor', {}).get('services', [{'name': 'Ollama', 'process': 'ollama'}])
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


def _disk_smart():
    """Read NVMe SMART health via smartctl. Cached for 5 minutes."""
    smart_cfg = _ctx.config.get('monitor', {}).get('smart', {})
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

    now = time.time()
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
            'space_pct': round(psutil.disk_usage(_ctx.config.get('monitor', {}).get('disk_path', '/')).percent),
        },
        'system': {
            'uptime_secs': round(now - psutil.boot_time()),
            'processes': len(psutil.pids()),
        },
    }

    # Network and disk I/O are rates -- need delta from previous call
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


@bp.route('/api/metrics')
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
        return _ctx.config.get('spark', {})

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


# Lazy-initialized after init()
_platform = None


def _get_platform():
    global _platform
    if _platform is None:
        _platform = PlatformClient()
    return _platform


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


@bp.route('/api/system/updates')
def system_updates():
    """Return categorized available updates from apt, snap, and platform dashboard."""
    apt_pkgs = _parse_apt_updates()
    apt_cats = _categorize_apt_packages(apt_pkgs)
    snap_pkgs = _parse_snap_updates()

    plat = _get_platform()
    # Check platform dashboard update
    platform_available = False
    platform_error = None
    if plat.configured:
        try:
            data = plat.get_updates()
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
        'name': _ctx.config.get('spark', {}).get('label', 'Platform Update'),
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
        'supported': is_linux or plat.configured,
    })


@bp.route('/api/system/update', methods=['POST'])
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

    plat = _get_platform()

    # Platform update goes through dashboard API
    if 'platform' in categories:
        if not plat.configured:
            return jsonify({'error': 'Platform dashboard not configured'}), 400
        try:
            with _update_lock:
                _update_status = {'running': True, 'category': 'platform', 'error': None}
            plat.trigger_update()
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


def bg_metrics_monitor():
    """Push system metrics every 2s."""
    prev = None
    while True:
        if _ctx.has_clients():
            try:
                data = _get_metrics_data()
                h = data_hash(data)
                if h != prev:
                    prev = h
                    _ctx.socketio.emit('metrics:update', data)
            except Exception:
                pass
        _ctx.socketio.sleep(2)
