#!/bin/bash

cd "$(dirname "$0")"

# Create logs dir if needed
mkdir -p logs

echo "Starting Orchestrator..."

# Create tmux session if not exists (using -L orchestrator socket)
if ! tmux -L orchestrator has-session -t orchestrator 2>/dev/null; then
  tmux -L orchestrator new-session -d -s orchestrator -n partner -c "$(pwd)"
  tmux -L orchestrator send-keys -t orchestrator:partner "unset CLAUDECODE && claude" Enter
  echo "  Created tmux session with partner"
fi

# Start API in background
echo "  Starting API server..."
cd api
nohup python3 server.py > ../logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > ../logs/api.pid
cd ..

# Start web dev server
echo "  Starting web server..."
cd web
nohup npm run dev > ../logs/web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../logs/web.pid
cd ..

# Wait for servers to start
sleep 2

# Check if they're running
if ! kill -0 $API_PID 2>/dev/null; then
  echo "  [error] API failed to start. Check logs/api.log"
fi

if ! kill -0 $WEB_PID 2>/dev/null; then
  echo "  [error] Web server failed to start. Check logs/web.log"
fi

echo ""
echo "Orchestrator running:"
echo "  Web UI:  http://localhost:3000"
echo "  API:     http://localhost:5001"
echo ""
echo "To attach to partner session:"
echo "  tmux -L orchestrator attach -t orchestrator:partner"
echo ""
echo "To stop: ./stop.sh"
