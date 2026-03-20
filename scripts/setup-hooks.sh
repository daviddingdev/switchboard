#!/usr/bin/env bash
# Merge Switchboard HTTP hooks into ~/.claude/settings.json.
# Preserves existing hooks — only adds Stop and UserPromptSubmit
# entries if not already present.
#
# Usage: ./scripts/setup-hooks.sh [port]
#   port  API port (default: 5001)

set -euo pipefail

PORT="${1:-5001}"
SETTINGS="$HOME/.claude/settings.json"

# Ensure directory exists
mkdir -p "$(dirname "$SETTINGS")"

# Create settings file if missing
if [ ! -f "$SETTINGS" ]; then
    echo '{}' > "$SETTINGS"
fi

# Use Python for safe JSON manipulation (jq not always available)
python3 - "$SETTINGS" "$PORT" << 'PYEOF'
import json, sys

settings_path = sys.argv[1]
port = sys.argv[2]
url_base = f"http://localhost:{port}/api/hooks"

with open(settings_path) as f:
    settings = json.load(f)

hooks = settings.setdefault("hooks", {})

# Hook entries to add
new_hooks = {
    "Stop": {
        "hooks": [{
            "type": "http",
            "url": f"{url_base}/stop",
            "timeout": 5
        }]
    },
    "UserPromptSubmit": {
        "hooks": [{
            "type": "http",
            "url": f"{url_base}/prompt",
            "timeout": 5
        }]
    }
}

changed = False
for event, config in new_hooks.items():
    existing = hooks.get(event, [])
    if not isinstance(existing, list):
        existing = [existing]

    # Check if our hook URL is already present
    already_present = False
    for entry in existing:
        for h in entry.get("hooks", []):
            if h.get("url", "").startswith(url_base):
                already_present = True
                break
        if already_present:
            break

    if not already_present:
        existing.append(config)
        hooks[event] = existing
        changed = True
        print(f"  Added {event} hook -> {config['hooks'][0]['url']}")
    else:
        print(f"  {event} hook already configured, skipping")

if changed:
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)
        f.write("\n")
    print(f"\nUpdated {settings_path}")
else:
    print(f"\nNo changes needed — hooks already configured")
PYEOF
