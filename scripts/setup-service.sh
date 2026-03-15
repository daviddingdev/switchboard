#!/bin/bash
# Install Helm as a systemd user service for auto-start on boot.
# Run once: bash scripts/setup-service.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"

mkdir -p "$SERVICE_DIR"
cp "$SCRIPT_DIR/helm.service" "$SERVICE_DIR/"

# Reload and enable
systemctl --user daemon-reload
systemctl --user enable helm.service

# Enable lingering so user services start at boot (not just at login)
sudo loginctl enable-linger "$USER"

echo "Helm service installed and enabled."
echo "  Start now:    systemctl --user start helm"
echo "  Check status: systemctl --user status helm"
echo "  View logs:    journalctl --user -u helm -f"
echo ""
echo "Helm will auto-start after reboot."
