# Configuration

## Overview

The heartbeat agent uses a layered configuration system:

1. **Default values** - Built-in sensible defaults
2. **Config file** - `config.yaml` in workspace
3. **Environment variables** - Override specific values
4. **Command-line flags** - Runtime overrides

## Configuration File

### Location

```
~/.heartbeat/config.yaml           # Default location
./config.yaml                      # Working directory
HEARTBEAT_CONFIG=/path/to/config   # Environment override
--config /path/to/config           # CLI override
```

### Full Schema

```yaml
# config.yaml

# Agent identity
agent:
  name: heartbeat-agent
  version: "1.0"

# Heartbeat file settings
heartbeat:
  path: ./heartbeat.md
  backup:
    enabled: true
    max_backups: 10
    path: ./history/backups/
  lock:
    timeout: 30s
    stale_threshold: 5m

# Scheduling
schedule:
  default_interval: 5m
  timezone: UTC
  daily_reset: "04:00"

# Execution settings
execution:
  max_concurrent: 1
  default_timeout: 5m
  max_timeout: 1h

# Retry policies
retry:
  default_max_attempts: 3
  default_backoff: exponential
  backoff_base: 1s
  backoff_max: 60s

# Logging
logging:
  level: info
  format: json
  file: ./logs/agent.log
  max_size: 10MB
  max_files: 5

# History
history:
  enabled: true
  path: ./history/
  retention_days: 30

# Action handlers
actions:
  shell:
    default_shell: /bin/sh
    allowed_commands: []  # Empty = all allowed
    blocked_commands:
      - rm -rf /
      - sudo
    working_dir: ./

  http:
    timeout: 30s
    max_redirects: 5
    user_agent: "heartbeat-agent/1.0"

  agent:
    model: claude-3-sonnet
    max_tokens: 4096
    temperature: 0

  notify:
    default_channel: slack
    rate_limit: 10/minute

# Notification channels
notify:
  slack:
    webhook: ${SLACK_WEBHOOK}
    username: Heartbeat Agent
    icon_emoji: ":heartbeat:"

  discord:
    webhook: ${DISCORD_WEBHOOK}

  telegram:
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}

  email:
    smtp_host: smtp.example.com
    smtp_port: 587
    username: ${SMTP_USER}
    password: ${SMTP_PASS}
    from: heartbeat@example.com
    to: alerts@example.com

# OpenClaw integration
openclaw:
  enabled: false
  gateway: ws://127.0.0.1:18789
  cron:
    enabled: true
    job_id: heartbeat-wake
    schedule: "*/5 * * * *"
    isolated: true
  session:
    id: heartbeat
    reset_daily: false
  bootstrap:
    agents_md: ./AGENTS.md
    soul_md: ./SOUL.md

# Security
security:
  sandbox_mode: false
  allowed_paths:
    - ./
    - /tmp/heartbeat/
  blocked_paths:
    - /etc/
    - /var/
  env_whitelist:
    - PATH
    - HOME
    - USER
```

## Environment Variables

All config values can be overridden via environment variables:

```bash
# Format: HEARTBEAT_<SECTION>_<KEY>
HEARTBEAT_AGENT_NAME=my-agent
HEARTBEAT_SCHEDULE_DEFAULT_INTERVAL=10m
HEARTBEAT_LOGGING_LEVEL=debug
HEARTBEAT_OPENCLAW_ENABLED=true

# Secrets (use these, never put in config files)
SLACK_WEBHOOK=https://hooks.slack.com/...
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=123456:ABC...
```

## CLI Flags

```bash
heartbeat wake \
  --config ./config.yaml \
  --heartbeat ./heartbeat.md \
  --log-level debug \
  --dry-run \
  --timeout 10m
```

| Flag | Description |
|------|-------------|
| `--config` | Config file path |
| `--heartbeat` | Heartbeat file path |
| `--log-level` | Log verbosity |
| `--dry-run` | Parse and validate only |
| `--timeout` | Max execution time |
| `--no-notify` | Disable notifications |
| `--force` | Ignore schedule, run all |

## Configuration Validation

```bash
# Validate configuration
heartbeat config validate

# Show effective config (with env overrides)
heartbeat config show

# Check specific section
heartbeat config show --section openclaw
```

## Profiles

Support multiple configurations for different environments:

```yaml
# config.yaml
profiles:
  development:
    logging:
      level: debug
    execution:
      max_concurrent: 1
    notify:
      default_channel: null  # Disable

  production:
    logging:
      level: info
    execution:
      max_concurrent: 5
    security:
      sandbox_mode: true
```

```bash
# Use specific profile
heartbeat wake --profile production

# Or via environment
HEARTBEAT_PROFILE=production heartbeat wake
```

## Secrets Management

### Environment Variables (Recommended)

```bash
# .env file (never commit!)
SLACK_WEBHOOK=https://hooks.slack.com/services/xxx
TELEGRAM_BOT_TOKEN=123456:ABC-xyz

# Load in shell
source .env && heartbeat wake
```

### Secret References

```yaml
notify:
  slack:
    webhook: ${SLACK_WEBHOOK}  # Environment variable
    webhook: file:///secrets/slack-webhook  # File reference
    webhook: cmd://pass show slack/webhook  # Command output
```

### Encrypted Config

```bash
# Encrypt sensitive values
heartbeat config encrypt --key $ENCRYPTION_KEY

# Decrypt at runtime
HEARTBEAT_ENCRYPTION_KEY=xxx heartbeat wake
```

## Default Values Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `heartbeat.path` | `./heartbeat.md` | Heartbeat file location |
| `schedule.default_interval` | `5m` | Default action interval |
| `execution.max_concurrent` | `1` | Parallel action limit |
| `execution.default_timeout` | `5m` | Action timeout |
| `retry.default_max_attempts` | `3` | Retry count |
| `logging.level` | `info` | Log verbosity |
| `history.retention_days` | `30` | History cleanup |

## OpenClaw-Specific Configuration

When using OpenClaw integration, additional config goes in `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "heartbeat": {
      "workspace": "~/.heartbeat",
      "model": "claude-3-sonnet",
      "tools": {
        "exec": {
          "applyPatch": false
        }
      },
      "session": {
        "resetDaily": false,
        "idleMinutes": 0
      }
    }
  },
  "cron": {
    "jobs": [
      {
        "id": "heartbeat-wake",
        "schedule": "*/5 * * * *",
        "prompt": "Wake and process heartbeat.md",
        "session": "heartbeat",
        "isolated": true
      }
    ]
  }
}
```

## Migration Guide

### From v0.x to v1.x

```yaml
# Old format (v0.x)
interval: 5m
timeout: 30s

# New format (v1.x)
schedule:
  default_interval: 5m
execution:
  default_timeout: 30s
```

Run migration:
```bash
heartbeat config migrate --from 0 --to 1
```

## Troubleshooting

### Config Not Loading

```bash
# Check effective config path
heartbeat config path

# Validate syntax
heartbeat config validate --verbose

# Show resolution order
heartbeat config debug
```

### Environment Variables Not Applied

```bash
# List recognized env vars
heartbeat config env

# Test specific override
HEARTBEAT_LOGGING_LEVEL=debug heartbeat config show
```

## Next Steps

- [[04-implementation-phases]] - Start implementation
- [[05-openclaw-integration]] - OpenClaw setup
