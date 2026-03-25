#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Switchboard Setup ==="
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
  echo "Ubuntu/Debian:"
  echo "  sudo apt update && sudo apt install tmux python3 python3-pip nodejs npm"
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

# Reset package-lock.json to avoid platform-specific drift showing in git status
git -C web checkout package-lock.json 2>/dev/null || true

echo "Building web frontend..."
cd web && npm run build && cd ..

# Create directories
mkdir -p state/proposals
mkdir -p logs/workers

# Create config from example if needed
if [ ! -f config.yaml ]; then
  echo "Creating default config.yaml..."
  cp config.yaml.example config.yaml

  # Platform-specific adjustments
  if [ "$(uname)" = "Darwin" ]; then
    python3 -c "
import yaml
with open('config.yaml') as f:
    cfg = yaml.safe_load(f)
cfg.setdefault('monitor', {}).setdefault('gpu', {})['enabled'] = False
cfg['monitor']['services'] = []
with open('config.yaml', 'w') as f:
    yaml.dump(cfg, f, default_flow_style=False)
" 2>/dev/null || true
    echo "  (adjusted defaults for macOS — GPU monitoring disabled)"
  fi
fi

# Configure Claude Code hooks for instant idle detection
echo "Setting up Claude Code hooks..."
bash scripts/setup-hooks.sh 2>/dev/null || echo "  (skipped — hooks can be set up later with scripts/setup-hooks.sh)"

echo ""
echo "=== Switchboard setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Ensure your projects have CLAUDE.md files (auto-discovered)"
echo "  2. Edit config.yaml if needed"
echo "  3. Run ./start.sh"
