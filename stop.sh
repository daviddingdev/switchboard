#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping Switchboard..."

if [ -f logs/api.pid ]; then
    PID=$(cat logs/api.pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        # Wait up to 5 seconds for clean shutdown
        for i in 1 2 3 4 5; do
            kill -0 "$PID" 2>/dev/null || break
            sleep 1
        done
        if kill -0 "$PID" 2>/dev/null; then
            echo "  Process $PID didn't stop, sending SIGKILL"
            kill -9 "$PID" 2>/dev/null
        fi
        echo "  Stopped API (PID $PID)"
    else
        echo "  Stale PID file (process $PID not running)"
    fi
    rm -f logs/api.pid
else
    echo "  No PID file found"
fi

# Safety net: kill anything still holding the port
PORT=$(python3 -c "
import yaml
try:
    with open('config.yaml') as f:
        print(yaml.safe_load(f).get('port', 5001))
except: print(5001)
" 2>/dev/null || echo 5001)

REMAINING=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
    echo "  Killing remaining processes on port $PORT: $REMAINING"
    echo "$REMAINING" | xargs kill 2>/dev/null || true
    sleep 1
    # Force-kill if still alive
    STILL=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$STILL" ]; then
        echo "$STILL" | xargs kill -9 2>/dev/null || true
    fi
fi

echo "Done"
echo ""
echo "Note: tmux session may still be running."
echo "To kill it: tmux -L switchboard kill-session -t switchboard"
