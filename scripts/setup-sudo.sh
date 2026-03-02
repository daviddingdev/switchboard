#!/bin/bash
# Set up passwordless sudo for orchestrator update commands.
# Run once: sudo bash scripts/setup-sudo.sh

set -e

USER=$(whoami)
if [ "$EUID" -ne 0 ]; then
  echo "Run with sudo: sudo bash $0"
  exit 1
fi

SUDOERS_FILE="/etc/sudoers.d/orchestrator-updates"

cat > "$SUDOERS_FILE" << EOF
# Orchestrator: allow system updates without password
$SUDO_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get update *
$SUDO_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get upgrade *
$SUDO_USER ALL=(ALL) NOPASSWD: /usr/bin/snap refresh *
EOF

chmod 440 "$SUDOERS_FILE"
echo "Sudoers configured at $SUDOERS_FILE"
echo "Orchestrator can now run apt-get and snap updates."
