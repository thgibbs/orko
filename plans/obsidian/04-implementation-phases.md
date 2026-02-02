# Implementation Phases

## Overview

With Claude Code as the runtime, implementation is primarily **configuration**, not coding. The phases focus on setting up files and scheduler.

```
Phase 1        Phase 2        Phase 3        Phase 4
┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
│Create│ ───▶ │Setup │ ───▶ │Test &│ ───▶ │Advanc│
│Files │      │Sched │      │Refine│      │ed    │
└──────┘      └──────┘      └──────┘      └──────┘
   │             │             │             │
   ▼             ▼             ▼             ▼
 soul.md       cron        validate      webhooks
 heartbeat   systemd       tune         workflows
 CLAUDE.md   launchd      optimize      multi-agent
```

**Total estimated effort**: A few hours of configuration, not weeks of coding.

---

## Phase 1: Create Bootstrap Files

**Goal:** Create the files Claude Code needs to operate.

### Deliverables

1. **CLAUDE.md** - Instructions for Claude Code
2. **soul.md** - Agent persona and behavior rules
3. **heartbeat.md** - Initial action file
4. **Directory structure** - history/, config/

### Tasks

- [ ] Create workspace directory
- [ ] Write CLAUDE.md with agent instructions
- [ ] Write soul.md with persona definition
- [ ] Create initial heartbeat.md with test action
- [ ] Create history/ directory
- [ ] Test manually: `claude --print "Process heartbeat"`

### CLAUDE.md Template

```markdown
# Heartbeat Agent Instructions

You are an autonomous Heartbeat Agent. Each time you are invoked:

## Startup Sequence

1. Read `soul.md` to understand your persona and rules
2. Read `heartbeat.md` to see pending actions
3. Check current date/time for scheduled actions

## Execution Loop

For each action with status: PENDING (in priority order: CRITICAL > HIGH > MEDIUM > LOW):

1. Check if schedule condition is met (if specified)
2. Check if dependencies are satisfied (if specified)
3. Execute the action:
   - **shell**: Use Bash tool to run the command
   - **http**: Use `curl` via Bash tool
   - **file**: Use Read/Edit/Write tools
   - **notify**: Use appropriate notification method
4. Update the action's status in heartbeat.md:
   - On success: status: COMPLETED, add completed_at timestamp
   - On failure: status: FAILED, add error message
5. Continue to next action (unless CRITICAL action failed)

## After Execution

1. Append execution summary to `history/YYYY-MM-DD.md`
2. Report any FAILED actions prominently
3. Exit cleanly

## Rules

- Never skip CRITICAL priority actions
- Always update heartbeat.md after each action
- Log all executions with timestamps
- If an action is unclear, mark it SKIPPED with a note
```

### soul.md Template

```markdown
# Soul - Heartbeat Agent

## Identity

You are a reliable, efficient task executor. You prioritize:
- Reliability over speed
- Clear reporting over brevity
- Safety over convenience

## Behavior

- Execute actions in priority order
- Report errors clearly with context
- Never make assumptions about unclear tasks
- Ask for clarification by marking actions NEEDS_CLARIFICATION

## Communication Style

- Brief, factual status updates
- Include timestamps in all logs
- Use structured output for machine parseability

## Constraints

- Only execute commands listed in heartbeat.md
- Never modify files outside the workspace without explicit action
- Never execute destructive commands without confirmation flag
- Rate limit notifications to avoid spam
```

### heartbeat.md Template

```markdown
---
version: 1
last_wake: null
status: idle
---

# Heartbeat

## Pending Actions

### [LOW] Test Action - Hello World
- **id**: test-001
- **type**: shell
- **command**: echo "Heartbeat agent is alive! $(date)"
- **status**: PENDING

## Completed Today

(none yet)

## Notes

Initial heartbeat file created.
```

### Acceptance Criteria

- [ ] `claude --print "Read heartbeat.md and tell me what actions exist"` works
- [ ] `claude --print "Execute the test action and update heartbeat.md"` works
- [ ] heartbeat.md is updated with status: COMPLETED after execution
- [ ] history/YYYY-MM-DD.md file is created with log entry

---

## Phase 2: Setup Scheduler

**Goal:** Automate Claude Code invocation on a schedule.

### Deliverables

1. **Scheduler configuration** - cron, systemd, or launchd
2. **Logging setup** - Capture output for debugging
3. **Environment setup** - API keys, paths

### Tasks

- [ ] Choose scheduler (cron recommended for simplicity)
- [ ] Configure environment variables (ANTHROPIC_API_KEY)
- [ ] Set up cron job
- [ ] Configure output logging
- [ ] Test scheduled execution
- [ ] Monitor first few runs

### Cron Setup (Recommended)

```bash
# 1. Ensure Claude Code is installed and API key is set
which claude
echo $ANTHROPIC_API_KEY

# 2. Create a wrapper script for environment
cat > ~/heartbeat/run-heartbeat.sh << 'EOF'
#!/bin/bash
cd ~/heartbeat
export ANTHROPIC_API_KEY="your-key-here"
claude --print "Wake up and process heartbeat" >> logs/heartbeat.log 2>&1
EOF
chmod +x ~/heartbeat/run-heartbeat.sh

# 3. Add to crontab
crontab -e
# Add: */15 * * * * ~/heartbeat/run-heartbeat.sh
```

### Systemd Setup (Linux)

```bash
# Create service file
sudo cat > /etc/systemd/system/heartbeat.service << 'EOF'
[Unit]
Description=Heartbeat Agent
After=network.target

[Service]
Type=oneshot
User=youruser
WorkingDirectory=/home/youruser/heartbeat
Environment="ANTHROPIC_API_KEY=your-key-here"
ExecStart=/usr/local/bin/claude --print "Wake up and process heartbeat"
StandardOutput=append:/var/log/heartbeat.log
StandardError=append:/var/log/heartbeat.log
EOF

# Create timer
sudo cat > /etc/systemd/system/heartbeat.timer << 'EOF'
[Unit]
Description=Run Heartbeat Agent every 15 minutes

[Timer]
OnCalendar=*:0/15
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable heartbeat.timer
sudo systemctl start heartbeat.timer
```

### launchd Setup (macOS)

```bash
# Create plist
cat > ~/Library/LaunchAgents/com.heartbeat.agent.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.heartbeat.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd ~/heartbeat && /usr/local/bin/claude --print "Wake up and process heartbeat"</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ANTHROPIC_API_KEY</key>
        <string>your-key-here</string>
    </dict>
    <key>StartInterval</key>
    <integer>900</integer>
    <key>StandardOutPath</key>
    <string>/Users/youruser/heartbeat/logs/heartbeat.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/youruser/heartbeat/logs/heartbeat.log</string>
</dict>
</plist>
EOF

# Load the agent
launchctl load ~/Library/LaunchAgents/com.heartbeat.agent.plist
```

### Acceptance Criteria

- [ ] Scheduler runs automatically at configured interval
- [ ] Logs are captured and accessible
- [ ] API key is securely configured
- [ ] Can verify execution via logs
- [ ] heartbeat.md is updated by scheduled runs

---

## Phase 3: Test and Refine

**Goal:** Validate the system works reliably and tune for your use case.

### Deliverables

1. **Real actions** - Replace test actions with actual tasks
2. **Error handling** - Verify failure modes work
3. **Optimization** - Tune schedule and prompts

### Tasks

- [ ] Add real actions to heartbeat.md
- [ ] Test failure handling (intentionally fail an action)
- [ ] Verify retry behavior works
- [ ] Test priority ordering
- [ ] Optimize Claude Code prompt for efficiency
- [ ] Consider using `--model haiku` for simple tasks

### Testing Checklist

```markdown
## Manual Tests

- [ ] Add PENDING action → runs on next wake
- [ ] Add CRITICAL action that fails → stops execution
- [ ] Add HIGH action that fails → continues to next
- [ ] Add action with `schedule: hourly` → only runs at correct time
- [ ] Add action with `depends_on: other-action` → waits for dependency

## Error Scenarios

- [ ] Network failure during HTTP action → marks FAILED
- [ ] Shell command returns non-zero → marks FAILED
- [ ] Timeout reached → marks FAILED with timeout message
- [ ] Malformed heartbeat.md → Claude reports error, doesn't crash
```

### Optimization Tips

```bash
# Use Haiku for simple, routine tasks (cheaper, faster)
claude --model haiku --print "Process heartbeat"

# Use Sonnet for complex actions requiring reasoning
claude --model sonnet --print "Process heartbeat"

# Reduce prompt size for faster execution
claude --print "Heartbeat"  # Relies on CLAUDE.md for full instructions
```

### Acceptance Criteria

- [ ] Real actions execute successfully
- [ ] Failures are handled gracefully
- [ ] Logs provide useful debugging info
- [ ] System runs reliably for 24+ hours

---

## Phase 4: Advanced Features

**Goal:** Add optional advanced capabilities.

### Optional Deliverables

1. **Webhooks** - Trigger actions via HTTP
2. **Notifications** - Slack/Discord/Telegram alerts
3. **Multi-agent** - Multiple heartbeat files
4. **OpenClaw integration** - Message-driven actions

### Webhook Trigger (Optional)

Simple webhook using a tiny server or serverless function:

```bash
# Using netcat (simplest possible)
while true; do
  echo -e "HTTP/1.1 200 OK\n\nTriggered" | nc -l 8080
  claude --print "Webhook triggered - process heartbeat"
done
```

Or use a cloud function (AWS Lambda, Cloudflare Workers, etc.)

### Notification Actions

Add to heartbeat.md:

```markdown
### [HIGH] Notify on daily summary
- **id**: notify-001
- **type**: shell
- **command**: |
    curl -X POST "https://hooks.slack.com/services/XXX" \
      -H "Content-Type: application/json" \
      -d '{"text": "Daily heartbeat summary: All tasks completed"}'
- **schedule**: daily:09:00
- **status**: PENDING
```

### OpenClaw Integration

See [[05-openclaw-integration]] for full details. Summary:

```json
// ~/.openclaw/openclaw.json
{
  "cron": {
    "jobs": [{
      "id": "heartbeat-wake",
      "schedule": "*/15 * * * *",
      "prompt": "Process heartbeat",
      "session": "heartbeat"
    }]
  }
}
```

---

## Timeline Summary

| Phase | Focus | Effort |
|-------|-------|--------|
| 1 | Create bootstrap files | ~1 hour |
| 2 | Setup scheduler | ~30 minutes |
| 3 | Test and refine | ~2-4 hours |
| 4 | Advanced features | As needed |

**Total: A few hours**, not weeks of development.

## Comparison: Traditional vs Claude Code Approach

| Aspect | Traditional (custom code) | Claude Code Approach |
|--------|---------------------------|---------------------|
| Development time | Weeks | Hours |
| Lines of code | 1000+ | 0 |
| Parser implementation | Required | Claude understands markdown |
| Executor implementation | Required | Claude's Bash tool |
| State management | Required | Claude's Edit tool |
| Error handling | Required | Claude's reasoning |
| Maintenance burden | High | Low (just update prompts) |

## Next Steps

Start with [[#Phase 1 Create Bootstrap Files|Phase 1]] - create your bootstrap files.
