#!/bin/bash
set -e
cd "$(dirname "$0")"

# Unset CLAUDECODE to allow spawning Claude Code sessions from within Claude Code
unset CLAUDECODE

mkdir -p logs

# Read port from config
PORT=$(python3 -c "
import yaml
try:
    with open('config.yaml') as f:
        print(yaml.safe_load(f).get('port', 5001))
except: print(5001)
" 2>/dev/null || echo 5001)

# Skip setup wizard for existing installations
if [ ! -f state/setup-complete ]; then
    if [ -f state/workers.json ] || [ -f state/usage-stats.json ]; then
        touch state/setup-complete
    fi
fi

# Check if already running via PID file
if [ -f logs/api.pid ] && kill -0 $(cat logs/api.pid) 2>/dev/null; then
    echo "Switchboard already running (PID $(cat logs/api.pid))"
    echo "  URL: http://localhost:${PORT}"
    exit 0
fi

# Clean up stale PID file
rm -f logs/api.pid

# Check if port is occupied by an orphaned process
EXISTING=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
    echo "Port $PORT in use by PID(s): $EXISTING — stopping them first"
    echo "$EXISTING" | xargs kill 2>/dev/null || true
    sleep 2
    STILL=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$STILL" ]; then
        echo "  Force-killing: $STILL"
        echo "$STILL" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# Build frontend if needed
if [ ! -d "web/dist" ]; then
    echo "Building web frontend..."
    (cd web && npm run build)
fi

echo "Starting Switchboard..."
nohup python3 api/server.py > logs/api.log 2>&1 &
echo $! > logs/api.pid
sleep 2

if kill -0 $(cat logs/api.pid) 2>/dev/null; then
    echo ""
    echo "Switchboard running:"
    echo "  URL:  http://localhost:${PORT}"
    echo "  Logs: logs/api.log"
    echo "  Stop: ./stop.sh"
else
    echo "[error] Failed to start. Check: cat logs/api.log"
    rm -f logs/api.pid
    exit 1
fi
