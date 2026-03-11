#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Orchestrator Setup ==="
echo ""

# Check dependencies
check_dep() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "  [ok] $1"
    return 0
  else
    echo "  [missing] $1"
    return 1
  fi
}

echo "Checking dependencies..."
MISSING=0
check_dep python3 || MISSING=1
check_dep node || MISSING=1
check_dep npm || MISSING=1
check_dep tmux || MISSING=1
check_dep claude || MISSING=1

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "Install missing dependencies and run setup.sh again."
  echo ""
  echo "macOS:"
  echo "  brew install tmux python node"
  echo ""
  echo "Claude CLI:"
  echo "  npm install -g @anthropic-ai/claude-code"
  exit 1
fi

echo ""
echo "Installing Python dependencies..."
pip3 install -r api/requirements.txt --quiet --break-system-packages 2>/dev/null || \
pip3 install -r api/requirements.txt --quiet

echo "Installing Node dependencies..."
cd web && npm install --silent && cd ..

echo "Building web frontend..."
cd web && npm run build && cd ..

# Create directories
mkdir -p state/proposals
mkdir -p logs/workers

# Create config from example if needed
if [ ! -f config.yaml ]; then
  echo "Creating default config.yaml..."
  cp config.yaml.example config.yaml
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Ensure your projects have CLAUDE.md files (auto-discovered)"
echo "  2. Edit config.yaml if needed"
echo "  3. Run ./start.sh"
