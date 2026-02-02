# Configuration

## Overview

With Claude Code as the runtime, configuration is simplified to:

1. **CLAUDE.md** - Instructions for Claude Code (what to do)
2. **soul.md** - Agent persona (how to behave)
3. **heartbeat.md** - Actions to execute (what tasks)
4. **Scheduler** - When to run (cron/systemd/launchd)
5. **Environment** - API keys and secrets

No complex config.yaml needed - the markdown files ARE the configuration.

## CLAUDE.md - Agent Instructions

This file is automatically read by Claude Code when invoked in the workspace.

### Location

```
workspace/
├── CLAUDE.md    # Claude Code reads this automatically
```

### Full Template

```markdown
# Heartbeat Agent Instructions

You are an autonomous Heartbeat Agent. Each time you are invoked:

## Startup Sequence

1. Read `soul.md` to understand your persona and rules
2. Read `heartbeat.md` to see pending actions
3. Note the current date/time for schedule evaluation

## Execution Loop

For each action with status: PENDING (process in priority order: CRITICAL > HIGH > MEDIUM > LOW):

1. **Check schedule** - If `schedule:` is specified, verify it's due:
   - `every:5m` - Check if 5+ minutes since last completion
   - `daily:02:00` - Check if current time matches
   - `hourly` - Check if 60+ minutes since last completion
   - No schedule = always due

2. **Check dependencies** - If `depends_on:` is specified, verify that action is COMPLETED

3. **Check conditions** - If `condition:` is specified, evaluate it

4. **Execute the action**:
   - `type: shell` → Use Bash tool to run `command`
   - `type: http` → Use curl via Bash tool
   - `type: file` → Use Read/Edit/Write tools
   - `type: notify` → Use curl to POST to webhook

5. **Update heartbeat.md**:
   - On success: Set `status: COMPLETED`, add `completed_at: <timestamp>`
   - On failure: Set `status: FAILED`, add `error: <message>`
   - If retries remain: Keep `status: PENDING`, increment `retry_count`

6. **Continue to next action** (unless a CRITICAL action failed)

## After All Actions

1. Update frontmatter in heartbeat.md:
   - Set `last_wake: <current timestamp>`
   - Set `status: idle`

2. Append summary to `history/YYYY-MM-DD.md`:
   ```
   ## HH:MM:SS
   - action-id: COMPLETED (duration)
   - action-id: FAILED (error message)
   ```

3. If any actions FAILED, report them prominently in your output

## Rules

- CRITICAL actions block further execution on failure
- HIGH/MEDIUM/LOW actions continue on failure
- Always update heartbeat.md after each action
- Never execute the same action twice in one invocation
- If an action is unclear, mark it `status: NEEDS_CLARIFICATION`

## Safety

- Never run destructive commands without explicit confirmation in the action
- Never modify files outside the workspace unless explicitly specified
- Never expose secrets in logs or output
```

## soul.md - Agent Persona

Defines personality and behavioral constraints.

### Full Template

```markdown
# Soul - Heartbeat Agent

## Identity

I am a reliable, autonomous task executor. My core values:

- **Reliability** over speed
- **Clarity** over brevity
- **Safety** over convenience
- **Transparency** over silence

## Behavior

### When executing actions:
- Follow instructions exactly as written
- Report errors with full context
- Never assume unclear instructions
- Mark ambiguous actions for human review

### When something fails:
- Capture the full error message
- Note the exact command that failed
- Continue with remaining actions (unless CRITICAL)
- Prominently report all failures

### When uncertain:
- Do not guess or improvise
- Mark the action as NEEDS_CLARIFICATION
- Explain what information is missing
- Continue with other actions

## Communication Style

- Brief, factual updates
- Structured output (lists, timestamps)
- No unnecessary elaboration
- Include actionable information

## Constraints

- Only execute actions defined in heartbeat.md
- Never modify heartbeat.md structure (only update statuses)
- Never access files outside workspace without explicit path in action
- Rate limit notifications (max 1 per channel per invocation)
- Never expose environment variables in output

## Emergency Stops

If I encounter any of these, stop immediately and report:
- `rm -rf /` or similar destructive commands
- Actions accessing `/etc/passwd`, `/etc/shadow`, or system files
- Actions that would expose credentials
- Infinite loops or runaway processes
```

## Environment Variables

Set these before invoking Claude Code:

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-..."

# Optional - for notifications
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."
export DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_CHAT_ID="-100123456789"

# Optional - for actions that need credentials
export API_TOKEN="..."
export DATABASE_URL="..."
```

### Secure Setup

**Never commit secrets to git!**

```bash
# Create a secrets file
cat > ~/heartbeat/.env << 'EOF'
export ANTHROPIC_API_KEY="sk-ant-..."
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."
EOF
chmod 600 ~/heartbeat/.env

# Source before running
source ~/heartbeat/.env && claude --print "Process heartbeat"
```

## Scheduler Configuration

### Cron (Recommended)

```bash
# Edit crontab
crontab -e

# Run every 15 minutes
*/15 * * * * cd ~/heartbeat && source .env && claude --print "Process heartbeat" >> logs/cron.log 2>&1

# Run every hour at :00
0 * * * * cd ~/heartbeat && source .env && claude --print "Process heartbeat" >> logs/cron.log 2>&1

# Run daily at 9am
0 9 * * * cd ~/heartbeat && source .env && claude --print "Process heartbeat" >> logs/cron.log 2>&1
```

### Systemd (Linux)

See [[04-implementation-phases#Systemd Setup Linux]] for full setup.

### launchd (macOS)

See [[04-implementation-phases#launchd Setup macOS]] for full setup.

## Claude Code CLI Options

```bash
# Basic invocation
claude --print "Process heartbeat"

# Use a specific model (cheaper for simple tasks)
claude --model haiku --print "Process heartbeat"

# Verbose output
claude --print --verbose "Process heartbeat"

# With timeout
claude --print --timeout 300000 "Process heartbeat"  # 5 min timeout

# Non-interactive mode (for scripting)
claude --print "Process heartbeat"
```

### Model Selection

| Model | Use Case | Cost |
|-------|----------|------|
| `haiku` | Simple, routine tasks | Cheapest |
| `sonnet` | Default, balanced | Medium |
| `opus` | Complex reasoning | Most expensive |

```bash
# Use Haiku for routine checks
claude --model haiku --print "Process heartbeat"

# Use Sonnet for tasks requiring more reasoning
claude --model sonnet --print "Process heartbeat"
```

## Directory Structure

```
~/heartbeat/
├── CLAUDE.md              # Agent instructions
├── soul.md                # Agent persona
├── heartbeat.md           # Current actions
├── .env                   # Secrets (chmod 600, gitignore)
├── .gitignore             # Ignore .env, logs/
├── history/
│   ├── 2024-01-15.md      # Daily logs
│   └── 2024-01-16.md
├── logs/
│   └── cron.log           # Scheduler output
└── scripts/               # Optional helper scripts
    └── backup.sh
```

### .gitignore

```gitignore
.env
*.log
logs/
history/
```

## Troubleshooting

### Claude Code not finding CLAUDE.md

Ensure you're in the correct directory:
```bash
cd ~/heartbeat
pwd  # Should show your workspace
claude --print "Process heartbeat"
```

### API key not set

```bash
# Check if set
echo $ANTHROPIC_API_KEY

# Set it
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Cron not running

```bash
# Check cron logs
grep CRON /var/log/syslog  # Linux
log show --predicate 'process == "cron"' --last 1h  # macOS

# Verify crontab
crontab -l

# Test manually
cd ~/heartbeat && source .env && claude --print "Process heartbeat"
```

### Actions not executing

1. Check heartbeat.md has actions with `status: PENDING`
2. Verify schedules are due (check `last_wake` timestamp)
3. Run manually and check output for errors

## Migration from Custom Code

If you had a custom heartbeat implementation, migration is simple:

1. Keep your `heartbeat.md` format (likely compatible)
2. Create `CLAUDE.md` with execution instructions
3. Create `soul.md` with behavioral rules
4. Remove custom parser/executor code
5. Set up scheduler to invoke Claude Code

## Next Steps

- [[04-implementation-phases]] - Step-by-step setup
- [[02-heartbeat-mechanism]] - heartbeat.md format
- [[05-openclaw-integration]] - Optional OpenClaw setup
