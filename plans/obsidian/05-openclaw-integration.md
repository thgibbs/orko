# OpenClaw Integration (Optional)

## Overview

**Note**: OpenClaw integration is **optional**. The core heartbeat system works with just Claude Code + cron. OpenClaw adds messaging capabilities if you want chat-based interaction.

[OpenClaw](https://docs.openclaw.ai/) is a multi-platform messaging gateway that bridges communication channels with AI agents. Integrating the heartbeat agent with OpenClaw enables:

- **Alternative scheduling** via OpenClaw's cron system (instead of system cron)
- **Chat-driven actions** - Add actions via Slack/Discord/Telegram messages
- **Richer notifications** - Native channel integration
- **Session persistence** - Maintain conversation context

## OpenClaw Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                        │
│                   ws://127.0.0.1:18789                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ WhatsApp │  │ Telegram │  │ Discord  │  │  Slack   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴──────┬──────┴─────────────┘          │
│                            │                               │
│                     ┌──────▼──────┐                        │
│                     │   Sessions  │                        │
│                     └──────┬──────┘                        │
│                            │                               │
│              ┌─────────────┼─────────────┐                 │
│              │             │             │                 │
│        ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐          │
│        │    Pi     │ │   Cron    │ │ Heartbeat │          │
│        │   Agent   │ │   Jobs    │ │   Agent   │          │
│        └───────────┘ └───────────┘ └───────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Cron Integration

OpenClaw has a built-in cron system that can wake our heartbeat agent on schedule.

### Configuration

```json
// ~/.openclaw/openclaw.json
{
  "cron": {
    "jobs": [
      {
        "id": "heartbeat-wake",
        "schedule": "*/5 * * * *",
        "prompt": "Check heartbeat.md and execute pending actions",
        "session": "heartbeat",
        "isolated": true,
        "wakeMode": "next-heartbeat"
      }
    ]
  }
}
```

### Cron Job Parameters

| Parameter | Description |
|-----------|-------------|
| `id` | Unique job identifier |
| `schedule` | Cron expression (5-field) |
| `prompt` | System message for the job |
| `session` | Session to run in |
| `isolated` | Run in dedicated session |
| `wakeMode` | `next-heartbeat` or `now` |
| `timezone` | IANA timezone (default: local) |

### Wake Modes

- **`next-heartbeat`**: Queues for scheduled execution, runs with full context
- **`now`**: Triggers immediate processing

### CLI Management

```bash
# Add heartbeat cron job
openclaw cron add \
  --id heartbeat-wake \
  --schedule "*/5 * * * *" \
  --prompt "Wake heartbeat agent" \
  --isolated

# List jobs
openclaw cron list

# View run history
openclaw cron runs heartbeat-wake

# Manual trigger
openclaw cron run heartbeat-wake
```

## Session Management

### Session Types

| Type | Key Format | Use Case |
|------|------------|----------|
| Main | `agent:<id>:main` | Direct messages |
| Group | `agent:<id>:group:<id>` | Group chats |
| Cron | `cron:<jobId>` | Scheduled jobs |
| Webhook | `hook:<uuid>` | External triggers |

### Heartbeat Session

Configure a dedicated session for the heartbeat agent:

```json
{
  "agents": {
    "heartbeat": {
      "workspace": "~/.heartbeat",
      "session": {
        "resetDaily": false,
        "idleMinutes": 0
      }
    }
  }
}
```

### Session Files

```
~/.openclaw/agents/heartbeat/sessions/
├── sessions.json           # Session metadata
├── heartbeat.jsonl         # Conversation history
└── cron-heartbeat-wake.jsonl
```

## Bootstrap Files

When using OpenClaw, these files work alongside your Claude Code configuration:

| File | Purpose | Used By |
|------|---------|---------|
| `CLAUDE.md` | Agent instructions | Claude Code (primary) |
| `soul.md` | Agent persona | Claude Code (read on startup) |
| `AGENTS.md` | OpenClaw-specific instructions | OpenClaw (optional) |

**Note**: If using Claude Code directly (recommended), your `CLAUDE.md` and `soul.md` files (see [[06-configuration]]) serve the same purpose as OpenClaw's bootstrap files.

### AGENTS.md (OpenClaw-specific)

If using OpenClaw scheduling instead of system cron:

```markdown
# Heartbeat Agent

You are an autonomous agent that manages scheduled tasks.

## On Each Wake

1. Read heartbeat.md for pending actions
2. Execute in priority order (CRITICAL > HIGH > MEDIUM > LOW)
3. Update statuses in heartbeat.md
4. Log to history/

## Rules

- Always check dependencies before executing
- Stop on CRITICAL action failure
- Continue on HIGH/MEDIUM/LOW failures
- Log all executions with timestamps
```

### soul.md (Works with both)

This file is read by Claude Code on startup (same content works for OpenClaw):

```markdown
# Soul - Heartbeat Agent

You are a reliable, efficient task executor.

## Values
- Reliability over speed
- Clarity over brevity
- Safety over convenience

## Communication
- Brief, factual updates
- Clear error messages
- Structured output
```

## Channel Notifications

### Configuration

```yaml
# config.yaml
notify:
  channels:
    slack:
      webhook: ${SLACK_WEBHOOK}
      default_channel: "#heartbeat"
    telegram:
      bot_token: ${TELEGRAM_TOKEN}
      chat_id: "-100123456789"
    discord:
      webhook: ${DISCORD_WEBHOOK}

  rules:
    on_failure: slack
    on_critical: [slack, telegram]
    daily_summary: slack
```

### Notification Action

```markdown
### [HIGH] Notify on failure
- **id**: notify-failure
- **type**: notify
- **channel**: slack
- **message**: |
    :x: Action failed: ${failed_action}
    Error: ${error_message}
    Time: ${timestamp}
- **condition**: any_failed
- **status**: pending
```

### OpenClaw Delivery

Use OpenClaw's native delivery:

```typescript
// Send via OpenClaw
await gateway.sendMessage({
  channel: 'telegram',
  target: chatId,
  message: formatNotification(result)
});
```

## Message-Driven Actions

### Receiving Actions via Chat

```
User: /heartbeat add "Check API" --type http --url https://api.example.com
Bot: Added action "Check API" (id: check-api-001) scheduled for next wake.
```

### Command Processing

```typescript
// Parse incoming messages for commands
function handleMessage(message: string): void {
  const match = message.match(/^\/heartbeat\s+(\w+)\s*(.*)/);
  if (!match) return;

  const [, command, args] = match;

  switch (command) {
    case 'add':
      addAction(parseActionArgs(args));
      break;
    case 'list':
      listPendingActions();
      break;
    case 'status':
      showStatus();
      break;
    case 'run':
      triggerWake();
      break;
  }
}
```

### Queue Mode

Configure how messages are handled during execution:

```json
{
  "messages": {
    "queueMode": "followup"
  }
}
```

| Mode | Behavior |
|------|----------|
| `steer` | Inject mid-turn, skip remaining tools |
| `followup` | Queue until turn complete |
| `collect` | Batch for next wake |

## NO_REPLY Convention

For silent background operations, start output with `NO_REPLY`:

```typescript
// Suppress user delivery during background tasks
function executeQuietly(action: Action): string {
  const result = execute(action);
  return `NO_REPLY\n${result}`; // Not sent to user
}
```

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Heartbeat Agent                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐        │
│  │  Parser    │    │  Executor  │    │  Notifier  │        │
│  └─────┬──────┘    └─────┬──────┘    └─────┬──────┘        │
│        │                 │                 │                │
│        └─────────────────┼─────────────────┘                │
│                          │                                  │
│                   ┌──────▼──────┐                           │
│                   │   OpenClaw  │                           │
│                   │   Adapter   │                           │
│                   └──────┬──────┘                           │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Gateway   │
                    │  WebSocket  │
                    └─────────────┘
```

## Setup Checklist

- [ ] Install OpenClaw: `npm install -g openclaw@latest`
- [ ] Run onboarding: `openclaw onboard --install-daemon`
- [ ] Configure workspace in `openclaw.json`
- [ ] Create bootstrap files (AGENTS.md, SOUL.md)
- [ ] Add heartbeat cron job
- [ ] Configure notification channels
- [ ] Test cron execution: `openclaw cron run heartbeat-wake`
- [ ] Verify notifications

## Next Steps

- [[04-implementation-phases#Phase 3|Phase 3 Implementation Tasks]]
- [[06-configuration]] - Full configuration reference
