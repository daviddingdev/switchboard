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

echo "Done"
echo ""
echo "Note: tmux session may still be running."
echo "To kill it: tmux -L switchboard kill-session -t switchboard"
