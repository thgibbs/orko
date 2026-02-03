#!/bin/bash
# Start Orko Telegram bot

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[Orko Telegram]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[Orko Telegram]${NC} $1"
}

error() {
  echo -e "${RED}[Orko Telegram]${NC} $1"
}

# Check for required tools
if ! command -v node &> /dev/null; then
  error "Node.js is required but not installed"
  exit 1
fi

# Check for .env file
if [ ! -f "../.env" ]; then
  warn ".env file not found at ../. Create it from .env.example"
  if [ -f "../.env.example" ]; then
    echo "Copy and configure: cp ../.env.example ../.env"
  fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  log "Installing dependencies..."
  npm install
fi

# Create PID file directory
mkdir -p /tmp/orko-telegram

# Start the bot
log "Starting Telegram bot..."
node server.js &
SERVER_PID=$!
echo $SERVER_PID > /tmp/orko-telegram/server.pid

log "Bot started with PID $SERVER_PID"
log ""
log "To stop: ./stop.sh"
log ""

# Wait for server to start
sleep 1

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
  log "Orko Telegram integration is running!"
else
  error "Bot failed to start"
  exit 1
fi

# Keep running in foreground if requested
if [ "$1" = "--foreground" ] || [ "$1" = "-f" ]; then
  log "Running in foreground. Press Ctrl+C to stop."
  trap "./stop.sh" INT TERM
  wait $SERVER_PID
fi
