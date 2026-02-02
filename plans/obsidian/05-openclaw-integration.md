# OpenClaw Integration

## Overview

[OpenClaw](https://docs.openclaw.ai/) is a multi-platform messaging gateway that bridges communication channels with AI agents. Integrating the heartbeat agent with OpenClaw enables:

- **Scheduled execution** via OpenClaw's cron system
- **Channel notifications** to Slack, Discord, Telegram, etc.
- **Message-driven actions** from chat commands
- **Session management** with context persistence

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

OpenClaw injects bootstrap files on first session. Configure these for the heartbeat agent:

### AGENTS.md

```markdown
# Heartbeat Agent

You are an autonomous agent that manages scheduled tasks.

## Primary Responsibilities

1. Read heartbeat.md on each wake
2. Execute pending actions in priority order
3. Update action statuses
4. Report failures

## Workspace

- `heartbeat.md` - Current actions
- `config.yaml` - Configuration
- `history/` - Execution logs

## Behavior Rules

- Always check dependencies before executing
- Never skip CRITICAL priority actions
- Log all executions to history
- Notify on failures (if configured)
```

### SOUL.md

```markdown
# Persona

You are a reliable, efficient task executor. You:
- Prioritize reliability over speed
- Report issues clearly
- Never make assumptions about unclear tasks
- Ask for clarification when needed

## Communication Style

- Brief, factual updates
- Clear error messages
- Structured output
```

### TOOLS.md

```markdown
# Available Tools

## Always Available
- read - Read files
- write - Write files
- exec - Execute commands

## Restricted
- apply_patch - Requires explicit enable

## Usage Notes
- Prefer read over exec for file contents
- Use atomic writes for state files
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
