#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Updating Switchboard ==="

./stop.sh

echo ""
echo "Pulling latest..."
git pull

echo ""
./setup.sh

./start.sh

echo ""
echo "=== Update complete ==="
