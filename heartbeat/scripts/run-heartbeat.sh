#!/bin/bash
# Heartbeat Agent Wrapper Script
# This script is designed to be invoked by cron, systemd, or launchd

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEARTBEAT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to heartbeat workspace
cd "$HEARTBEAT_DIR" || exit 1

# Load environment variables if .env exists
if [ -f "$HEARTBEAT_DIR/.env" ]; then
    # shellcheck source=/dev/null
    source "$HEARTBEAT_DIR/.env"
fi

# Ensure logs directory exists
mkdir -p "$HEARTBEAT_DIR/logs"

# Log file with date
LOG_FILE="$HEARTBEAT_DIR/logs/heartbeat-$(date +%Y%m%d).log"

# Timestamp for log entry
echo "" >> "$LOG_FILE"
echo "=== Heartbeat run at $(date -Iseconds) ===" >> "$LOG_FILE"

# Run Claude Code to process heartbeat
# Use --print for non-interactive mode
claude --print "Wake up and process heartbeat" >> "$LOG_FILE" 2>&1

# Capture exit code
EXIT_CODE=$?

# Log completion
echo "=== Completed with exit code $EXIT_CODE ===" >> "$LOG_FILE"

exit $EXIT_CODE
