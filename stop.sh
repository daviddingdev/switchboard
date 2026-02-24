#!/bin/bash

cd "$(dirname "$0")"

echo "Stopping Orchestrator..."

# Kill API
if [ -f logs/api.pid ]; then
  PID=$(cat logs/api.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID && echo "  Stopped API (pid $PID)"
  fi
  rm -f logs/api.pid
fi

# Kill web
if [ -f logs/web.pid ]; then
  PID=$(cat logs/web.pid)
  if kill -0 $PID 2>/dev/null; then
    kill $PID && echo "  Stopped web server (pid $PID)"
  fi
  rm -f logs/web.pid
fi

# Kill any remaining processes on ports (fallback)
lsof -ti:5001 2>/dev/null | xargs -r kill 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs -r kill 2>/dev/null

echo "Done"
echo ""
echo "Note: tmux session 'orchestrator' still running."
echo "To kill it: tmux -L orchestrator kill-session -t orchestrator"
