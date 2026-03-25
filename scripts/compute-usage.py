#!/usr/bin/env python3
"""
Compute usage analytics from Claude Code session files.

Scans ~/.claude/projects/ for session JSONLs, aggregates token usage,
and writes stats to state/usage-stats.json.

Run: python3 scripts/compute-usage.py
Cron: 0 2 * * 0 cd ~/switchboard && python3 scripts/compute-usage.py
"""

import json
import os
import re
import sys
import time
import yaml
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"
HISTORY_FILE = CLAUDE_DIR / "history.jsonl"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = PROJECT_ROOT / "state"
OUTPUT_FILE = STATE_DIR / "usage-stats.json"

CHUNK_SIZE = 1024 * 1024  # 1MB chunks for large file regex scanning

CONFIG_FILE = PROJECT_ROOT / "config.yaml"

DEFAULT_PRICING = {
    'subscription': 100,
    'models': {
        'claude-opus-4-5': {'input': 5, 'output': 25},
        'claude-opus-4-6': {'input': 5, 'output': 25},
        'claude-sonnet-4-5': {'input': 3, 'output': 15},
        'claude-sonnet-4-6': {'input': 3, 'output': 15},
        'claude-haiku-4-5': {'input': 1, 'output': 5},
    },
    'cache': {
        'read_discount': 0.90,
        'creation_premium': 0.25,
    }
}


def load_pricing():
    """Load pricing from config.yaml, falling back to defaults."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                cfg = yaml.safe_load(f) or {}
            if 'pricing' in cfg:
                p = cfg['pricing']
                return {
                    'subscription': p.get('subscription', DEFAULT_PRICING['subscription']),
                    'models': p.get('models', DEFAULT_PRICING['models']),
                    'cache': p.get('cache', DEFAULT_PRICING['cache']),
                }
        except Exception:
            pass
    return DEFAULT_PRICING


def get_model_pricing(model_id, pricing):
    """Match a full model ID (e.g., claude-opus-4-5-20251101) to pricing config."""
    models = pricing['models']
    for key in sorted(models.keys(), key=len, reverse=True):
        if model_id.startswith(key):
            return models[key]
    return None


def calculate_cost(tokens, model_id, pricing):
    """Calculate estimated API cost in USD for token counts from a specific model."""
    model_pricing = get_model_pricing(model_id, pricing)
    if not model_pricing:
        return 0.0

    input_rate = model_pricing['input']
    output_rate = model_pricing['output']
    cache_read_rate = input_rate * (1 - pricing['cache']['read_discount'])
    cache_creation_rate = input_rate * (1 + pricing['cache']['creation_premium'])

    cost = (
        tokens.get('input', 0) / 1_000_000 * input_rate +
        tokens.get('output', 0) / 1_000_000 * output_rate +
        tokens.get('cache_read', 0) / 1_000_000 * cache_read_rate +
        tokens.get('cache_creation', 0) / 1_000_000 * cache_creation_rate
    )
    return round(cost, 4)


def utc_to_local_date(utc_str):
    """Convert UTC ISO timestamp to local date string (YYYY-MM-DD)."""
    try:
        dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
        return dt.astimezone().strftime('%Y-%m-%d')
    except Exception:
        return None


def utc_to_local_hour(utc_str):
    """Convert UTC ISO timestamp to local hour (0-23)."""
    try:
        dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
        return dt.astimezone().hour
    except Exception:
        return None


def build_session_project_map():
    """Build sessionId -> project path from history.jsonl."""
    mapping = {}
    if not HISTORY_FILE.exists():
        return mapping
    try:
        with open(HISTORY_FILE) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    sid = entry.get('sessionId', '')
                    project = entry.get('project', '')
                    if sid and project:
                        mapping[sid] = project
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass
    return mapping


def build_dir_name_map():
    """Build sanitized_dir_name -> real project path from history.jsonl.

    Claude Code stores sessions under sanitized paths like -home-user-project.
    history.jsonl has the real paths. This lets us recover the actual project
    name (os.path.basename) instead of guessing from the sanitized form.
    """
    mapping = {}
    if not HISTORY_FILE.exists():
        return mapping
    try:
        with open(HISTORY_FILE) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    project = entry.get('project', '')
                    if project:
                        sanitized = project.replace('/', '-')
                        mapping[sanitized] = project
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass
    return mapping


def load_project_aliases():
    """Load project name aliases from config.yaml."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE) as f:
                cfg = yaml.safe_load(f) or {}
            return cfg.get('project_aliases', {}) or {}
        except Exception:
            pass
    return {}


def dir_name_to_project(dir_name, aliases=None, dir_name_map=None):
    """Convert sanitized dir name to readable project name.

    Uses dir_name_map (from history.jsonl) to recover the real path and
    extract os.path.basename. Falls back to heuristic if no mapping exists.
    Applies aliases last to merge renamed projects.
    """
    # Try exact match from history.jsonl mapping
    if dir_name_map and dir_name in dir_name_map:
        real_path = dir_name_map[dir_name]
        name = os.path.basename(real_path.rstrip('/')) or real_path
    else:
        # Fallback heuristic: strip known home prefixes
        # Handles -home-user-project and -Users-user-project
        parts = dir_name.lstrip('-').split('-')
        if len(parts) >= 3 and parts[0] in ('home', 'Users'):
            name = '-'.join(parts[2:])
        elif len(parts) >= 2:
            name = '-'.join(parts[1:])
        else:
            name = dir_name
    if aliases and name in aliases:
        return aliases[name]
    return name


def extract_tokens_chunked(filepath):
    """Extract token counts from a JSONL file using chunked regex.
    Memory-safe for files of any size.
    """
    tokens = {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    message_count = 0
    tool_call_count = 0
    models = defaultdict(lambda: {'messages': 0, 'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0})

    # Patterns
    p_output = re.compile(r'"output_tokens"\s*:\s*(\d+)')
    p_input = re.compile(r'"input_tokens"\s*:\s*(\d+)')
    p_cache_read = re.compile(r'"cache_read_input_tokens"\s*:\s*(\d+)')
    p_cache_create = re.compile(r'"cache_creation_input_tokens"\s*:\s*(\d+)')
    p_tool_use = re.compile(r'"type"\s*:\s*"tool_use"')
    p_model = re.compile(r'"model"\s*:\s*"([^"]+)"')

    try:
        file_size = filepath.stat().st_size
        with open(filepath, 'r') as f:
            if file_size > 50 * 1024 * 1024:
                # Large file: chunked regex, don't parse JSON
                overlap = ''
                while True:
                    chunk = f.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    data = overlap + chunk
                    # Keep last 500 chars for overlap (in case a match spans chunks)
                    overlap = data[-500:] if len(data) > 500 else ''

                    for m in p_output.finditer(data):
                        tokens['output'] += int(m.group(1))
                    for m in p_input.finditer(data):
                        tokens['input'] += int(m.group(1))
                    for m in p_cache_read.finditer(data):
                        tokens['cache_read'] += int(m.group(1))
                    for m in p_cache_create.finditer(data):
                        tokens['cache_creation'] += int(m.group(1))
                    tool_call_count += len(p_tool_use.findall(data))
                    # Count assistant messages by counting "type":"assistant" occurrences
                    message_count += data.count('"type":"assistant"') + data.count('"type": "assistant"')
                    # Track models
                    for m in p_model.finditer(data):
                        model_name = m.group(1)
                        if model_name.startswith('claude'):
                            models[model_name]['messages'] += 1
            else:
                # Normal file: line-by-line JSON parsing
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    # Quick string check before parsing
                    if '"type":"assistant"' not in line and '"type": "assistant"' not in line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    if obj.get('type') != 'assistant':
                        continue

                    msg = obj.get('message', {})
                    if not isinstance(msg, dict):
                        continue

                    message_count += 1
                    usage = msg.get('usage', {})
                    tokens['input'] += usage.get('input_tokens', 0)
                    tokens['output'] += usage.get('output_tokens', 0)
                    tokens['cache_read'] += usage.get('cache_read_input_tokens', 0)
                    tokens['cache_creation'] += usage.get('cache_creation_input_tokens', 0)

                    # Count tool uses in content
                    content = msg.get('content', [])
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get('type') == 'tool_use':
                                tool_call_count += 1

                    # Track model
                    model = msg.get('model', '')
                    if model and model.startswith('claude'):
                        models[model]['messages'] += 1
                        models[model]['input'] += usage.get('input_tokens', 0)
                        models[model]['output'] += usage.get('output_tokens', 0)
                        models[model]['cache_read'] += usage.get('cache_read_input_tokens', 0)
                        models[model]['cache_creation'] += usage.get('cache_creation_input_tokens', 0)

    except Exception as e:
        print(f"  Error reading {filepath.name}: {e}", file=sys.stderr)

    return tokens, message_count, tool_call_count, dict(models)


def extract_daily_breakdown(filepath):
    """Extract per-day and per-hour stats from a session file.
    Returns (daily_stats, hourly_counts).
    """
    daily = defaultdict(lambda: {'sessions': set(), 'messages': 0, 'tool_calls': 0,
                                  'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0,
                                  'by_model': defaultdict(lambda: {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0})})
    hourly = defaultdict(int)
    session_id = filepath.stem

    try:
        file_size = filepath.stat().st_size
        if file_size > 50 * 1024 * 1024:
            # For large files, extract timestamps via regex
            p_ts = re.compile(r'"timestamp"\s*:\s*"(\d{4}-\d{2}-\d{2}T[^"]+)"')
            p_output = re.compile(r'"output_tokens"\s*:\s*(\d+)')
            p_input = re.compile(r'"input_tokens"\s*:\s*(\d+)')
            p_cache_read = re.compile(r'"cache_read_input_tokens"\s*:\s*(\d+)')
            p_cache_create = re.compile(r'"cache_creation_input_tokens"\s*:\s*(\d+)')

            first_date = None
            with open(filepath, 'r') as f:
                # Just read first line to get the date for this session
                first_line = f.readline()
                ts_match = p_ts.search(first_line)
                if ts_match:
                    first_date = utc_to_local_date(ts_match.group(1))
                    hour = utc_to_local_hour(ts_match.group(1))
                    if hour is not None:
                        hourly[hour] += 1

            if first_date:
                # We already have total tokens from extract_tokens_chunked
                daily[first_date]['sessions'].add(session_id)
            return dict(daily), dict(hourly)

        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                ts = obj.get('timestamp')
                if not ts:
                    continue

                if isinstance(ts, (int, float)):
                    # Unix milliseconds
                    dt = datetime.fromtimestamp(ts / 1000)
                    date_str = dt.strftime('%Y-%m-%d')
                    hour = dt.hour
                else:
                    date_str = utc_to_local_date(ts)
                    hour = utc_to_local_hour(ts)

                if not date_str:
                    continue

                daily[date_str]['sessions'].add(session_id)

                if hour is not None:
                    hourly[hour] += 1

                if obj.get('type') == 'assistant':
                    msg = obj.get('message', {})
                    if isinstance(msg, dict):
                        usage = msg.get('usage', {})
                        daily[date_str]['messages'] += 1
                        daily[date_str]['input'] += usage.get('input_tokens', 0)
                        daily[date_str]['output'] += usage.get('output_tokens', 0)
                        daily[date_str]['cache_read'] += usage.get('cache_read_input_tokens', 0)
                        daily[date_str]['cache_creation'] += usage.get('cache_creation_input_tokens', 0)

                        # Track per-model tokens per day for cost calculation
                        model = msg.get('model', '')
                        if model and model.startswith('claude'):
                            daily[date_str]['by_model'][model]['input'] += usage.get('input_tokens', 0)
                            daily[date_str]['by_model'][model]['output'] += usage.get('output_tokens', 0)
                            daily[date_str]['by_model'][model]['cache_read'] += usage.get('cache_read_input_tokens', 0)
                            daily[date_str]['by_model'][model]['cache_creation'] += usage.get('cache_creation_input_tokens', 0)

                        content = msg.get('content', [])
                        if isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict) and block.get('type') == 'tool_use':
                                    daily[date_str]['tool_calls'] += 1

    except Exception as e:
        print(f"  Error in daily breakdown {filepath.name}: {e}", file=sys.stderr)

    return dict(daily), dict(hourly)


def compute_all():
    """Main compute function. Scans all sessions, builds stats."""
    start_time = time.time()
    print("Computing usage stats...")

    pricing = load_pricing()
    aliases = load_project_aliases()
    dir_name_map = build_dir_name_map()

    session_project_map = build_session_project_map()
    print(f"  Found {len(session_project_map)} sessions in history")

    # Aggregate structures
    overview = {
        'total_sessions': 0,
        'total_messages': 0,
        'total_tool_calls': 0,
        'total_tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0},
        'days_active': 0,
        'first_session': None,
        'projects_count': 0,
    }
    daily_agg = defaultdict(lambda: {
        'sessions': 0, 'messages': 0, 'tool_calls': 0,
        'tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    })
    project_agg = defaultdict(lambda: {
        'sessions': 0, 'messages': 0, 'tool_calls': 0,
        'tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    })
    model_agg = defaultdict(lambda: {
        'messages': 0,
        'tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    })
    project_model_agg = defaultdict(lambda: defaultdict(lambda: {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}))
    daily_model_agg = defaultdict(lambda: defaultdict(lambda: {'messages': 0, 'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}))
    daily_project_agg = defaultdict(lambda: defaultdict(lambda: {'sessions': 0, 'messages': 0, 'tool_calls': 0}))
    hourly_agg = defaultdict(int)
    unpriced_models = set()
    all_dates = set()

    if not PROJECTS_DIR.exists():
        print("  No projects directory found")
        return None

    project_dirs = [d for d in PROJECTS_DIR.iterdir() if d.is_dir()]
    print(f"  Scanning {len(project_dirs)} project directories...")

    for proj_dir in sorted(project_dirs):
        proj_name = dir_name_to_project(proj_dir.name, aliases, dir_name_map)
        # Include both direct sessions and subagent sessions
        jsonl_files = list(proj_dir.glob("*.jsonl"))
        subagent_files = list(proj_dir.glob("*/subagents/*.jsonl"))
        all_files = jsonl_files + subagent_files

        if not all_files:
            continue

        print(f"  {proj_name}: {len(jsonl_files)} sessions + {len(subagent_files)} subagents", end='')

        for jsonl_path in all_files:
            session_id = jsonl_path.stem

            # Skip subagent dirs (they're directories, not files)
            if jsonl_path.is_dir():
                continue

            file_size = jsonl_path.stat().st_size
            if file_size == 0:
                continue

            # Extract tokens
            tokens, msg_count, tool_count, models = extract_tokens_chunked(jsonl_path)

            if tokens['output'] == 0 and tokens['input'] == 0:
                continue

            # Extract daily/hourly breakdown
            daily_data, hourly_data = extract_daily_breakdown(jsonl_path)

            # Update overview
            overview['total_sessions'] += 1
            overview['total_messages'] += msg_count
            overview['total_tool_calls'] += tool_count
            for k in tokens:
                overview['total_tokens'][k] += tokens[k]

            # Update project aggregates
            project_agg[proj_name]['sessions'] += 1
            project_agg[proj_name]['messages'] += msg_count
            project_agg[proj_name]['tool_calls'] += tool_count
            for k in tokens:
                project_agg[proj_name]['tokens'][k] += tokens[k]

            # Update model aggregates
            for model, m_data in models.items():
                model_agg[model]['messages'] += m_data['messages']
                for k in ['input', 'output', 'cache_read', 'cache_creation']:
                    model_agg[model]['tokens'][k] += m_data.get(k, 0)
                # Track per-project model usage for cost
                for k in ['input', 'output', 'cache_read', 'cache_creation']:
                    project_model_agg[proj_name][model][k] += m_data.get(k, 0)
                # Check for unpriced models
                if get_model_pricing(model, pricing) is None:
                    unpriced_models.add(model)

            # Update daily aggregates
            for date_str, day_data in daily_data.items():
                all_dates.add(date_str)
                sessions_count = len(day_data['sessions']) if isinstance(day_data['sessions'], set) else 1
                daily_agg[date_str]['sessions'] += sessions_count
                daily_agg[date_str]['messages'] += day_data.get('messages', 0)
                daily_agg[date_str]['tool_calls'] += day_data.get('tool_calls', 0)
                for k in ['input', 'output', 'cache_read', 'cache_creation']:
                    daily_agg[date_str]['tokens'][k] += day_data.get(k, 0)
                # Per-project per-day
                daily_project_agg[date_str][proj_name]['sessions'] += sessions_count
                daily_project_agg[date_str][proj_name]['messages'] += day_data.get('messages', 0)
                daily_project_agg[date_str][proj_name]['tool_calls'] += day_data.get('tool_calls', 0)
                # Accumulate per-model-per-day tokens for cost
                for model, m_tokens in day_data.get('by_model', {}).items():
                    daily_model_agg[date_str][model]['messages'] += day_data.get('messages', 0)
                    for k in ['input', 'output', 'cache_read', 'cache_creation']:
                        daily_model_agg[date_str][model][k] += m_tokens.get(k, 0)

            # Update hourly aggregates
            for hour, count in hourly_data.items():
                hourly_agg[hour] += count

        print()

    # Warn about unpriced models
    if unpriced_models:
        for m in sorted(unpriced_models):
            total = sum(model_agg[m]['tokens'].get(k, 0) for k in ['input', 'output', 'cache_read', 'cache_creation'])
            print(f"  WARNING: No pricing config for model '{m}' ({total:,} tokens)", file=sys.stderr)

    # Compute derived stats
    overview['days_active'] = len(all_dates)
    overview['first_session'] = min(all_dates) if all_dates else None
    overview['projects_count'] = len(project_agg)

    # Build daily array (sorted by date) with cost
    daily_list = []
    for date_str in sorted(daily_agg.keys()):
        d = daily_agg[date_str]
        day_cost = sum(
            calculate_cost(m_tokens, model, pricing)
            for model, m_tokens in daily_model_agg.get(date_str, {}).items()
        )
        daily_list.append({
            'date': date_str,
            'sessions': d['sessions'],
            'messages': d['messages'],
            'tool_calls': d['tool_calls'],
            'tokens': d['tokens'],
            'cost': round(day_cost, 2),
        })

    # Build weekly aggregates
    weekly_agg = defaultdict(lambda: {
        'sessions': 0, 'messages': 0, 'tool_calls': 0, 'cost': 0,
        'tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    })
    for day in daily_list:
        try:
            dt = datetime.strptime(day['date'], '%Y-%m-%d')
            iso_cal = dt.isocalendar()
            week_key = f"{iso_cal[0]}-W{iso_cal[1]:02d}"
            # Compute week start (Monday)
            week_start = (dt - timedelta(days=dt.weekday())).strftime('%Y-%m-%d')
        except Exception:
            continue

        weekly_agg[week_key]['week_start'] = week_start
        weekly_agg[week_key]['sessions'] += day['sessions']
        weekly_agg[week_key]['messages'] += day['messages']
        weekly_agg[week_key]['tool_calls'] += day['tool_calls']
        weekly_agg[week_key]['cost'] += day.get('cost', 0)
        for k in day['tokens']:
            weekly_agg[week_key]['tokens'][k] += day['tokens'][k]

    weekly_list = []
    for week_key in sorted(weekly_agg.keys()):
        w = weekly_agg[week_key]
        weekly_list.append({
            'week': week_key,
            'week_start': w.get('week_start', ''),
            'sessions': w['sessions'],
            'messages': w['messages'],
            'tool_calls': w['tool_calls'],
            'tokens': w['tokens'],
            'cost': round(w['cost'], 2),
        })

    # Build comparison (this week vs last week)
    today = datetime.now()
    iso_cal = today.isocalendar()
    this_week_key = f"{iso_cal[0]}-W{iso_cal[1]:02d}"
    last_week = today - timedelta(weeks=1)
    iso_cal_last = last_week.isocalendar()
    last_week_key = f"{iso_cal_last[0]}-W{iso_cal_last[1]:02d}"

    this_week = weekly_agg.get(this_week_key, {'sessions': 0, 'messages': 0, 'tool_calls': 0, 'cost': 0, 'tokens': {'output': 0}})
    last_week_data = weekly_agg.get(last_week_key, {'sessions': 0, 'messages': 0, 'tool_calls': 0, 'cost': 0, 'tokens': {'output': 0}})

    def pct_change(new, old):
        if old == 0:
            return 100 if new > 0 else 0
        return round((new - old) / old * 100)

    comparison = {
        'this_week': {
            'sessions': this_week['sessions'],
            'messages': this_week['messages'],
            'tool_calls': this_week['tool_calls'],
            'tokens_output': this_week['tokens'].get('output', 0),
            'cost': round(this_week.get('cost', 0), 2),
        },
        'last_week': {
            'sessions': last_week_data['sessions'],
            'messages': last_week_data['messages'],
            'tool_calls': last_week_data['tool_calls'],
            'tokens_output': last_week_data['tokens'].get('output', 0),
            'cost': round(last_week_data.get('cost', 0), 2),
        },
        'change_pct': {
            'sessions': pct_change(this_week['sessions'], last_week_data['sessions']),
            'messages': pct_change(this_week['messages'], last_week_data['messages']),
            'tool_calls': pct_change(this_week['tool_calls'], last_week_data['tool_calls']),
            'tokens_output': pct_change(
                this_week['tokens'].get('output', 0),
                last_week_data['tokens'].get('output', 0)
            ),
            'cost': pct_change(this_week.get('cost', 0), last_week_data.get('cost', 0)),
        },
    }

    # Build project list (sorted by output tokens desc) with cost
    project_list = []
    for name, data in sorted(project_agg.items(), key=lambda x: x[1]['tokens']['output'], reverse=True):
        proj_cost = sum(
            calculate_cost(m_tokens, model, pricing)
            for model, m_tokens in project_model_agg[name].items()
        )
        project_list.append({
            'name': name,
            'sessions': data['sessions'],
            'messages': data['messages'],
            'tool_calls': data['tool_calls'],
            'tokens': data['tokens'],
            'cost': round(proj_cost, 2),
        })

    # Build model dict with cost
    model_dict = {}
    for model, data in model_agg.items():
        model_dict[model] = {
            'messages': data['messages'],
            'tokens': data['tokens'],
            'cost': round(calculate_cost(data['tokens'], model, pricing), 2),
        }

    # Build hourly dict
    hourly_dict = {str(h): hourly_agg.get(h, 0) for h in range(24)}

    # Load existing snapshots
    snapshots = []
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE) as f:
                existing = json.load(f)
                snapshots = existing.get('snapshots', [])
        except Exception:
            pass

    # Append snapshot if new week
    today_str = today.strftime('%Y-%m-%d')
    existing_weeks = {s.get('week') for s in snapshots}
    if this_week_key not in existing_weeks:
        snapshots.append({
            'date': today_str,
            'week': this_week_key,
            'overview': {
                'total_sessions': overview['total_sessions'],
                'total_messages': overview['total_messages'],
                'total_tokens_output': overview['total_tokens']['output'],
            }
        })

    # Compute total cost from model aggregates (most accurate)
    overview['total_cost'] = round(sum(
        calculate_cost(data['tokens'], model, pricing)
        for model, data in model_agg.items()
    ), 2)
    overview['subscription_monthly'] = pricing['subscription']

    duration = time.time() - start_time

    # Build daily_by_project: {date: {project: {messages, sessions}}}
    daily_by_project = {}
    for date_str in sorted(daily_project_agg.keys()):
        daily_by_project[date_str] = {
            proj: {'messages': data['messages'], 'sessions': data['sessions']}
            for proj, data in daily_project_agg[date_str].items()
        }

    # Build daily_by_model: {date: {model: {messages, tokens}}}
    daily_by_model = {}
    for date_str in sorted(daily_model_agg.keys()):
        daily_by_model[date_str] = {
            model: {
                'messages': data['messages'],
                'input': data['input'],
                'output': data['output'],
                'cache_read': data['cache_read'],
                'cache_creation': data['cache_creation'],
            }
            for model, data in daily_model_agg[date_str].items()
        }

    result = {
        'computed_at': datetime.now(timezone.utc).isoformat(),
        'compute_duration_secs': round(duration, 1),
        'overview': overview,
        'daily': daily_list,
        'weekly': weekly_list,
        'by_project': project_list,
        'by_model': model_dict,
        'by_hour': hourly_dict,
        'daily_by_project': daily_by_project,
        'daily_by_model': daily_by_model,
        'comparison': comparison,
        'snapshots': snapshots,
        'pricing': {
            'subscription': pricing['subscription'],
            'models': pricing['models'],
            'cache': pricing['cache'],
        },
        'unpriced_models': sorted(unpriced_models) if unpriced_models else [],
    }

    # Merge with archived daily data (survives if Claude purges old sessions)
    ARCHIVE_FILE = STATE_DIR / 'usage-archive.json'
    archived_daily = {}
    if ARCHIVE_FILE.exists():
        try:
            with open(ARCHIVE_FILE) as f:
                archive = json.load(f)
                for d in archive.get('daily', []):
                    archived_daily[d['date']] = d
        except Exception:
            pass

    # Merge: keep the higher count per date (Claude Code prunes old session files,
    # so fresh scans may find fewer sessions than the archive recorded)
    for d in daily_list:
        date = d['date']
        if date in archived_daily:
            old = archived_daily[date]
            archived_daily[date] = {
                'date': date,
                'sessions': max(old.get('sessions', 0), d['sessions']),
                'messages': max(old.get('messages', 0), d['messages']),
                'tool_calls': max(old.get('tool_calls', 0), d.get('tool_calls', 0)),
                'tokens': {
                    k: max(old.get('tokens', {}).get(k, 0), d.get('tokens', {}).get(k, 0))
                    for k in ['input', 'output', 'cache_read', 'cache_creation']
                },
                'cost': max(old.get('cost', 0), d.get('cost', 0)),
            }
        else:
            archived_daily[date] = d

    merged_daily = [archived_daily[k] for k in sorted(archived_daily.keys())]

    # Save archive (append-only, never loses data)
    archive_data = {
        'last_updated': datetime.now(timezone.utc).isoformat(),
        'daily': merged_daily,
    }
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARCHIVE_FILE, 'w') as f:
        json.dump(archive_data, f, indent=2)

    # Use merged daily for the main output (includes historical data)
    result['daily'] = merged_daily

    # Recompute weekly from merged daily
    merged_weekly_agg = defaultdict(lambda: {
        'sessions': 0, 'messages': 0, 'tool_calls': 0, 'cost': 0,
        'tokens': {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}
    })
    for day in merged_daily:
        try:
            dt = datetime.strptime(day['date'], '%Y-%m-%d')
            iso_cal = dt.isocalendar()
            wk = f"{iso_cal[0]}-W{iso_cal[1]:02d}"
            ws = (dt - timedelta(days=dt.weekday())).strftime('%Y-%m-%d')
        except Exception:
            continue
        merged_weekly_agg[wk]['week_start'] = ws
        merged_weekly_agg[wk]['sessions'] += day['sessions']
        merged_weekly_agg[wk]['messages'] += day['messages']
        merged_weekly_agg[wk]['tool_calls'] += day.get('tool_calls', 0)
        merged_weekly_agg[wk]['cost'] += day.get('cost', 0)
        for tk in day.get('tokens', {}):
            merged_weekly_agg[wk]['tokens'][tk] += day['tokens'][tk]

    result['weekly'] = [
        {'week': wk, 'week_start': merged_weekly_agg[wk].get('week_start', ''),
         'sessions': merged_weekly_agg[wk]['sessions'], 'messages': merged_weekly_agg[wk]['messages'],
         'tool_calls': merged_weekly_agg[wk]['tool_calls'], 'tokens': merged_weekly_agg[wk]['tokens'],
         'cost': round(merged_weekly_agg[wk]['cost'], 2)}
        for wk in sorted(merged_weekly_agg.keys())
    ]

    # Update overview with merged totals (archive may have higher counts from
    # sessions that Claude Code has since pruned from disk)
    result['overview']['days_active'] = len(merged_daily)
    merged_sessions = sum(d.get('sessions', 0) for d in merged_daily)
    merged_messages = sum(d.get('messages', 0) for d in merged_daily)
    merged_tool_calls = sum(d.get('tool_calls', 0) for d in merged_daily)
    result['overview']['total_sessions'] = max(result['overview']['total_sessions'], merged_sessions)
    result['overview']['total_messages'] = max(result['overview']['total_messages'], merged_messages)
    result['overview']['total_tool_calls'] = max(result['overview']['total_tool_calls'], merged_tool_calls)

    # Write output
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\nDone in {duration:.1f}s")
    print(f"  Sessions: {overview['total_sessions']}")
    print(f"  Messages: {overview['total_messages']}")
    print(f"  Tool calls: {overview['total_tool_calls']}")
    print(f"  Output tokens: {overview['total_tokens']['output']:,}")
    print(f"  Est. API cost: ${overview['total_cost']:,.2f}")
    print(f"  Written to: {OUTPUT_FILE}")

    return result


if __name__ == '__main__':
    compute_all()
