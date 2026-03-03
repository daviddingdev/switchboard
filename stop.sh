#!/bin/bash

cd "$(dirname "$0")"

echo "Stopping Orchestrator..."

systemctl --user stop orchestrator-web.service 2>/dev/null && echo "  Stopped web server"
systemctl --user stop orchestrator-api.service 2>/dev/null && echo "  Stopped API"

# Clean up stale pid files from old start.sh
rm -f logs/api.pid logs/web.pid

echo "Done"
echo ""
echo "Note: tmux session 'orchestrator' still running."
echo "To kill it: tmux -L orchestrator kill-session -t orchestrator"
