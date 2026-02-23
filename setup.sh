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
  echo "To install Claude CLI:"
  echo "  npm install -g @anthropic-ai/claude-code"
  exit 1
fi

echo ""
echo "Installing Python dependencies..."
pip3 install -r api/requirements.txt --quiet --break-system-packages 2>/dev/null || \
pip3 install -r api/requirements.txt --quiet

echo "Installing Node dependencies..."
cd web && npm install --silent && cd ..

# Create directories
mkdir -p state/proposals
mkdir -p logs

# Create projects file from example if not exists
if [ ! -f state/projects.yaml ]; then
  if [ -f state/projects.example.yaml ]; then
    cp state/projects.example.yaml state/projects.yaml
    echo ""
    echo "Created state/projects.yaml from example"
  fi
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit state/projects.yaml with your project paths"
echo "  2. (Optional) Create ~/SOUL.md - see docs/SOUL.example.md"
echo "  3. Run ./start.sh"
