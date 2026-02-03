#!/bin/bash
# Stop Orko Telegram bot

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[Orko Telegram]${NC} $1"
}

PID_DIR="/tmp/orko-telegram"

# Stop server
if [ -f "$PID_DIR/server.pid" ]; then
  SERVER_PID=$(cat "$PID_DIR/server.pid")
  if kill -0 $SERVER_PID 2>/dev/null; then
    log "Stopping Telegram bot (PID $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null
  fi
  rm -f "$PID_DIR/server.pid"
else
  log "No server PID file found"
fi

# Clean up any orphaned processes
pkill -f "node.*server.js" 2>/dev/null || true

log "Orko Telegram integration stopped"
