#!/bin/bash
cd "$(dirname "$0")"

echo "Stopping Switchboard..."

if [ -f logs/api.pid ]; then
    PID=$(cat logs/api.pid)
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" && echo "  Stopped API (PID $PID)"
    fi
    rm -f logs/api.pid
else
    echo "  No PID file found"
fi

echo "Done"
echo ""
echo "Note: tmux session may still be running."
echo "To kill it: tmux -L switchboard kill-session -t switchboard"
