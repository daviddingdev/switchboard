#!/bin/bash
# Install orchestrator as a systemd user service for auto-start on boot.
# Run once: bash scripts/setup-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"

mkdir -p "$SERVICE_DIR"
cp "$SCRIPT_DIR/orchestrator.service" "$SERVICE_DIR/"

# Reload and enable
systemctl --user daemon-reload
systemctl --user enable orchestrator.service

# Enable lingering so user services start at boot (not just at login)
sudo loginctl enable-linger "$USER"

echo "Orchestrator service installed and enabled."
echo "  Start now:    systemctl --user start orchestrator"
echo "  Check status: systemctl --user status orchestrator"
echo "  View logs:    journalctl --user -u orchestrator -f"
echo ""
echo "The orchestrator will auto-start after reboot."
