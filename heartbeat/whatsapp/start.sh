#!/bin/bash
# Start Orko WhatsApp webhook server with ngrok tunnel

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[Orko WhatsApp]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[Orko WhatsApp]${NC} $1"
}

error() {
  echo -e "${RED}[Orko WhatsApp]${NC} $1"
}

# Check for required tools
if ! command -v node &> /dev/null; then
  error "Node.js is required but not installed"
  exit 1
fi

if ! command -v ngrok &> /dev/null; then
  error "ngrok is required but not installed"
  echo "Install with: brew install ngrok"
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
mkdir -p /tmp/orko-whatsapp

# Get port from .env or use default
PORT=${WEBHOOK_PORT:-3000}

# Start ngrok in background
log "Starting ngrok tunnel on port $PORT..."
ngrok http $PORT --log=stdout > /tmp/orko-whatsapp/ngrok.log 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > /tmp/orko-whatsapp/ngrok.pid

# Wait for ngrok to start
sleep 2

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)

if [ -z "$NGROK_URL" ]; then
  error "Failed to get ngrok URL. Check if ngrok started correctly."
  error "Ngrok log: $(cat /tmp/orko-whatsapp/ngrok.log)"
  kill $NGROK_PID 2>/dev/null || true
  exit 1
fi

log "ngrok tunnel active: $NGROK_URL"
log ""
log "Configure Twilio webhook URL to:"
echo -e "${YELLOW}  $NGROK_URL/webhook${NC}"
log ""

# Start the webhook server
log "Starting webhook server..."
node server.js &
SERVER_PID=$!
echo $SERVER_PID > /tmp/orko-whatsapp/server.pid

log "Server started with PID $SERVER_PID"
log ""
log "To stop: ./stop.sh"
log "To view ngrok dashboard: http://localhost:4040"
log ""

# Wait for server to start
sleep 1

# Check if server is running
if kill -0 $SERVER_PID 2>/dev/null; then
  log "Orko WhatsApp integration is running!"
else
  error "Server failed to start"
  kill $NGROK_PID 2>/dev/null || true
  exit 1
fi

# Keep running in foreground if requested
if [ "$1" = "--foreground" ] || [ "$1" = "-f" ]; then
  log "Running in foreground. Press Ctrl+C to stop."
  trap "./stop.sh" INT TERM
  wait $SERVER_PID
fi
