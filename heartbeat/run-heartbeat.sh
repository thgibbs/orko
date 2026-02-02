#!/bin/bash
# Heartbeat Agent Runner Script
# This script is called by the scheduler (cron/launchd) to wake the agent

set -e

# Configuration
HEARTBEAT_DIR="${HEARTBEAT_DIR:-$(dirname "$0")}"
LOG_FILE="${HEARTBEAT_DIR}/logs/heartbeat.log"

# Change to heartbeat directory
cd "$HEARTBEAT_DIR"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Log start time
echo "=== Heartbeat wake: $(date -Iseconds) ===" >> "$LOG_FILE"

# Run Claude Code with the heartbeat prompt
# Note: ANTHROPIC_API_KEY should be set in environment or launchd plist
claude --print "Wake up and process heartbeat" >> "$LOG_FILE" 2>&1

# Log end time
echo "=== Heartbeat complete: $(date -Iseconds) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
