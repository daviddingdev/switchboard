#!/bin/bash

cd "$(dirname "$0")"

# Unset CLAUDECODE to allow spawning Claude Code sessions from within Claude Code
unset CLAUDECODE

# Create logs dir if needed
mkdir -p logs

echo "Starting Orchestrator..."

# Reload systemd in case service files changed
systemctl --user daemon-reload

# Start services
systemctl --user start orchestrator-api.service
systemctl --user start orchestrator-web.service

# Wait for services to come up
sleep 2

# Check status
API_STATUS=$(systemctl --user is-active orchestrator-api.service)
WEB_STATUS=$(systemctl --user is-active orchestrator-web.service)

if [ "$API_STATUS" != "active" ]; then
  echo "  [error] API failed to start. Check: journalctl --user -u orchestrator-api -n 20"
fi

if [ "$WEB_STATUS" != "active" ]; then
  echo "  [error] Web server failed to start. Check: journalctl --user -u orchestrator-web -n 20"
fi

echo ""
echo "Orchestrator running:"
echo "  Web UI:  http://localhost:3000"
echo "  API:     http://localhost:5001"
echo ""
echo "Spawn workers from the web UI or API."
echo "To stop: ./stop.sh"
