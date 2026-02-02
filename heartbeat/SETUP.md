# Heartbeat Agent Setup Guide

## Quick Start

### 1. Test Manual Invocation

First, verify the agent works manually:

```bash
cd /Users/tantongibbs/.multiclaude/wts/orko/jolly-owl/heartbeat

# Test reading heartbeat
claude --print "Read heartbeat.md and tell me what actions exist"

# Test executing actions
claude --print "Execute the test action and update heartbeat.md"

# Verify results
cat heartbeat.md  # Should show status: COMPLETED
ls history/       # Should have a log file
```

### 2. Configure API Key

Set your Anthropic API key:

```bash
# Option A: Export in shell
export ANTHROPIC_API_KEY="your-key-here"

# Option B: Add to ~/.zshrc or ~/.bashrc
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.zshrc
```

### 3. Setup Scheduler (macOS launchd)

```bash
# Copy plist to LaunchAgents
cp config/com.heartbeat.agent.plist ~/Library/LaunchAgents/

# Edit to set your API key
nano ~/Library/LaunchAgents/com.heartbeat.agent.plist

# Load the agent
launchctl load ~/Library/LaunchAgents/com.heartbeat.agent.plist

# Verify it's running
launchctl list | grep heartbeat
```

### 4. Monitor Execution

```bash
# Watch logs
tail -f logs/heartbeat.log

# Check scheduler logs
tail -f /tmp/heartbeat-stdout.log
tail -f /tmp/heartbeat-stderr.log
```

### 5. Stop/Unload Scheduler

```bash
launchctl unload ~/Library/LaunchAgents/com.heartbeat.agent.plist
```

## Adding Actions

Edit `heartbeat.md` to add new actions:

```markdown
### [HIGH] Check server status
- **id**: check-001
- **type**: shell
- **command**: curl -s https://api.example.com/health
- **status**: PENDING
```

Priority levels: CRITICAL > HIGH > MEDIUM > LOW

## Troubleshooting

- **Agent not running**: Check `launchctl list | grep heartbeat`
- **No output**: Verify ANTHROPIC_API_KEY is set in plist
- **Errors**: Check `/tmp/heartbeat-stderr.log`
