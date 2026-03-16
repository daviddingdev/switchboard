#!/bin/bash
# Install Switchboard as a systemd user service for auto-start on boot.
# Run once: bash scripts/setup-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"

mkdir -p "$SERVICE_DIR"
cp "$SCRIPT_DIR/switchboard.service" "$SERVICE_DIR/"

# Reload and enable
systemctl --user daemon-reload
systemctl --user enable switchboard.service

# Enable lingering so user services start at boot (not just at login)
sudo loginctl enable-linger "$USER"

echo "Switchboard service installed and enabled."
echo "  Start now:    systemctl --user start switchboard"
echo "  Check status: systemctl --user status switchboard"
echo "  View logs:    journalctl --user -u switchboard -f"
echo ""
echo "Switchboard will auto-start after reboot."
