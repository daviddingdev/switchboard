#!/usr/bin/env python3
"""
Extract token usage from Claude Code session logs for Orchestrator.

Reads ~/.claude/projects/ data and generates a usage report.
Run: python3 tools/usage_report.py
"""

import json
import re
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

def utc_to_local(utc_str):
    """Convert UTC ISO timestamp to local date string (YYYY-MM-DD)."""
    try:
        dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
        local_dt = dt.astimezone()
        return local_dt.strftime('%Y-%m-%d')
    except:
        return 'unknown'

CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"

def extract_session_tokens(jsonl_path):
    """Sum all tokens from a session JSONL file."""
    tokens = {'input': 0, 'output': 0, 'cache_read': 0, 'cache_creation': 0}

    try:
        with open(jsonl_path, 'r') as f:
            content = f.read()
            for match in re.finditer(r'"output_tokens":(\d+)', content):
                tokens['output'] += int(match.group(1))
            for match in re.finditer(r'"input_tokens":(\d+)', content):
                tokens['input'] += int(match.group(1))
            for match in re.finditer(r'"cache_read_input_tokens":(\d+)', content):
                tokens['cache_read'] += int(match.group(1))
            for match in re.finditer(r'"cache_creation_input_tokens":(\d+)', content):
                tokens['cache_creation'] += int(match.group(1))
    except Exception as e:
        print(f"Error reading {jsonl_path}: {e}")

    return tokens

def extract_jsonl_metadata(jsonl_path):
    """Extract date, summary, and message count from a JSONL file."""
    first_timestamp = None
    first_user_msg = None
    msg_count = 0

    try:
        with open(jsonl_path, 'r') as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                msg = obj.get('message', {})
                if isinstance(msg, dict) and 'timestamp' in msg and not first_timestamp:
                    first_timestamp = msg['timestamp']

                if obj.get('type') == 'user':
                    msg_count += 1
                    if not first_user_msg:
                        content = msg.get('content', '') if isinstance(msg, dict) else ''
                        if isinstance(content, str):
                            first_user_msg = content[:50]
                        elif isinstance(content, list):
                            for c in content:
                                if isinstance(c, dict) and c.get('type') == 'text':
                                    first_user_msg = c['text'][:50]
                                    break
    except Exception:
        pass

    if not first_timestamp:
        mtime = jsonl_path.stat().st_mtime
        date_str = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')
    else:
        date_str = utc_to_local(first_timestamp)

    summary = (first_user_msg or '(no summary)') + ('...' if first_user_msg and len(first_user_msg) >= 50 else '')
    return date_str, summary, msg_count

def get_project_sessions(project_path):
    """Get all sessions for a project with their metadata and tokens."""
    sessions = []
    indexed_ids = set()

    index_path = project_path / "sessions-index.json"
    if index_path.exists():
        with open(index_path) as f:
            index = json.load(f)

        for entry in index.get('entries', []):
            session_id = entry['sessionId']
            indexed_ids.add(session_id)
            jsonl_path = project_path / f"{session_id}.jsonl"

            if not jsonl_path.exists():
                continue

            tokens = extract_session_tokens(jsonl_path)
            created = entry.get('created', '')
            date_str = utc_to_local(created) if created else 'unknown'

            sessions.append({
                'session_id': session_id[:8],
                'full_id': session_id,
                'date': date_str,
                'summary': entry.get('summary', entry.get('firstPrompt', '')[:50] + '...'),
                'messages': entry.get('messageCount', 0),
                'tokens': tokens,
            })

    for jsonl_path in project_path.glob("*.jsonl"):
        session_id = jsonl_path.stem
        if session_id in indexed_ids:
            continue

        tokens = extract_session_tokens(jsonl_path)
        if tokens['output'] == 0 and tokens['input'] == 0:
            continue

        date_str, summary, msg_count = extract_jsonl_metadata(jsonl_path)

        sessions.append({
            'session_id': session_id[:8],
            'full_id': session_id,
            'date': date_str,
            'summary': summary,
            'messages': msg_count,
            'tokens': tokens,
        })

    return sessions

def format_tokens(n):
    """Format token count with K/M suffix."""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1000:
        return f"{n/1000:.1f}K"
    return str(n)

def generate_report(output_path=None):
    """Generate usage report and optionally write to file."""
    all_sessions = []

    for p in PROJECTS_DIR.iterdir():
        # Match orchestrator project paths
        if 'orchestrator' in p.name.lower():
            sessions = get_project_sessions(p)
            all_sessions.extend(sessions)

    if not all_sessions:
        return "No orchestrator sessions found."

    by_date = defaultdict(list)
    for s in all_sessions:
        by_date[s['date']].append(s)

    lines = []
    lines.append("# Claude Code Usage Log — Orchestrator")
    lines.append("")
    lines.append("Token usage per session for Orchestrator project.")
    lines.append("")
    lines.append("**Token Types:**")
    lines.append("- **Output**: Tokens generated by Claude (main cost driver)")
    lines.append("- **Input**: New tokens sent to Claude")
    lines.append("- **Cache**: Tokens read from cache (discounted)")
    lines.append("")
    lines.append("---")
    lines.append("")

    grand_output = 0
    grand_input = 0
    grand_cache = 0

    for date in sorted(by_date.keys(), reverse=True):
        date_sessions = by_date[date]

        lines.append(f"## {date}")
        lines.append("")
        lines.append("| Session | Description | Msgs | Output | Input | Cache Read |")
        lines.append("|---------|-------------|------|--------|-------|------------|")

        day_output = 0
        day_input = 0
        day_cache = 0

        for s in sorted(date_sessions, key=lambda x: x['session_id']):
            desc = s['summary'][:40] + ('...' if len(s['summary']) > 40 else '')
            out = s['tokens']['output']
            inp = s['tokens']['input']
            cache = s['tokens']['cache_read']

            day_output += out
            day_input += inp
            day_cache += cache

            lines.append(f"| `{s['session_id']}` | {desc} | {s['messages']} | {format_tokens(out)} | {format_tokens(inp)} | {format_tokens(cache)} |")

        grand_output += day_output
        grand_input += day_input
        grand_cache += day_cache

        lines.append("")
        lines.append(f"**Daily Total:** {format_tokens(day_output)} output, {format_tokens(day_input)} input, {format_tokens(day_cache)} cache")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(f"**All-Time Total:** {format_tokens(grand_output)} output | {format_tokens(grand_input)} input | {format_tokens(grand_cache)} cache")
    lines.append("")
    lines.append(f"*Last updated: {datetime.now().strftime('%B %d, %Y')}*")

    report = "\n".join(lines)

    if output_path:
        with open(output_path, 'w') as f:
            f.write(report)
        print(f"Report written to {output_path}")

    return report

if __name__ == '__main__':
    import sys

    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_path = project_root / "USAGE.md"

    if len(sys.argv) > 1:
        if sys.argv[1] == '--stdout':
            print(generate_report())
        else:
            generate_report(sys.argv[1])
    else:
        generate_report(output_path)
