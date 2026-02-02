# Action System

## Overview

Actions are tasks that Claude Code executes. Each action type maps to Claude Code's native tools - no custom handlers needed.

| Action Type | Claude Code Tool | Description |
|-------------|------------------|-------------|
| `shell` | Bash tool | Execute shell commands |
| `http` | Bash + curl | Make HTTP requests |
| `file` | Read/Edit/Write | File operations |
| `notify` | Bash + curl | Send notifications |
| `agent` | (recursive) | Delegate to another Claude invocation |

## Shell Actions

Execute shell commands using Claude Code's Bash tool.

```markdown
### [MEDIUM] Run backup script
- **id**: backup-001
- **type**: shell
- **command**: ./scripts/backup.sh --full
- **working_dir**: /app
- **timeout**: 10m
- **status**: PENDING
```

Claude Code executes this by calling its Bash tool with the command.

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Shell command to execute |
| `working_dir` | No | Working directory (Claude uses `cd` first) |
| `timeout` | No | Max execution time |
| `env` | No | Environment variables (Claude sets these) |

### Examples

```markdown
### [HIGH] Check disk space
- **id**: disk-check
- **type**: shell
- **command**: df -h / | awk 'NR==2 {print $5}' | grep -q "^[89][0-9]%" && echo "WARNING: Disk usage high"
- **status**: PENDING

### [LOW] Cleanup temp files
- **id**: temp-cleanup
- **type**: shell
- **command**: find /tmp -user $USER -mtime +7 -delete
- **status**: PENDING
```

## HTTP Actions

Make HTTP requests using curl via Claude Code's Bash tool.

```markdown
### [HIGH] Health check
- **id**: health-001
- **type**: http
- **method**: GET
- **url**: https://api.example.com/health
- **headers**:
  - Authorization: Bearer ${API_TOKEN}
- **expect_status**: 200
- **timeout**: 30s
- **status**: PENDING
```

Claude Code converts this to a curl command:
```bash
curl -X GET "https://api.example.com/health" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -w "%{http_code}" -o /dev/null -s
```

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Request URL |
| `method` | No | HTTP method (default: GET) |
| `headers` | No | Request headers |
| `body` | No | Request body (for POST/PUT) |
| `expect_status` | No | Expected status code |
| `timeout` | No | Request timeout |

### Examples

```markdown
### [HIGH] POST to webhook
- **id**: webhook-post
- **type**: http
- **method**: POST
- **url**: https://hooks.slack.com/services/XXX
- **headers**:
  - Content-Type: application/json
- **body**: '{"text": "Heartbeat alive"}'
- **status**: PENDING

### [MEDIUM] Check API response
- **id**: api-check
- **type**: http
- **url**: https://api.example.com/status
- **expect_status**: 200
- **expect_body**: '"status":"ok"'
- **status**: PENDING
```

## File Actions

File operations using Claude Code's Read/Edit/Write tools.

```markdown
### [LOW] Archive old logs
- **id**: archive-logs
- **type**: file
- **operation**: move
- **source**: ./logs/*.log
- **destination**: ./archive/
- **older_than**: 7d
- **status**: PENDING
```

Claude Code uses shell commands for complex file operations:
```bash
find ./logs -name "*.log" -mtime +7 -exec mv {} ./archive/ \;
```

**Operations:**
- `read` - Read file content (Claude uses Read tool)
- `write` - Write content to file (Claude uses Write tool)
- `append` - Append to file (Claude uses Edit or shell `>>`)
- `delete` - Delete files (Claude uses `rm`)
- `move` - Move files (Claude uses `mv`)
- `copy` - Copy files (Claude uses `cp`)

### Examples

```markdown
### [MEDIUM] Create daily report
- **id**: daily-report
- **type**: file
- **operation**: write
- **path**: ./reports/daily-$(date +%Y%m%d).md
- **content**: |
  # Daily Report - $(date)

  ## Summary
  Actions executed: ${action_count}
  Failures: ${failure_count}
- **status**: PENDING

### [LOW] Cleanup old reports
- **id**: report-cleanup
- **type**: file
- **operation**: delete
- **pattern**: ./reports/daily-*.md
- **older_than**: 30d
- **status**: PENDING
```

## Notification Actions

Send notifications via external services.

```markdown
### [HIGH] Alert on failure
- **id**: alert-001
- **type**: notify
- **channel**: slack
- **webhook**: ${SLACK_WEBHOOK}
- **message**: |
  :warning: Action failed
  Error: ${last_error}
- **condition**: any_failed
- **status**: PENDING
```

Claude Code converts this to a curl command targeting the webhook.

**Channels:**
| Channel | Implementation |
|---------|----------------|
| `slack` | curl POST to Slack webhook |
| `discord` | curl POST to Discord webhook |
| `telegram` | curl POST to Telegram Bot API |
| `email` | curl to email API (Mailgun, SendGrid, etc.) |
| `webhook` | curl to any generic webhook |

### Examples

```markdown
### [MEDIUM] Daily Slack summary
- **id**: slack-summary
- **type**: notify
- **channel**: slack
- **webhook**: ${SLACK_WEBHOOK}
- **message**: |
  :heartbeat: Daily Heartbeat Summary
  - Actions completed: ${completed_count}
  - Failures: ${failure_count}
  - Next check: ${next_wake}
- **schedule**: daily:09:00
- **status**: PENDING

### [HIGH] Telegram alert
- **id**: telegram-alert
- **type**: notify
- **channel**: telegram
- **bot_token**: ${TELEGRAM_BOT_TOKEN}
- **chat_id**: ${TELEGRAM_CHAT_ID}
- **message**: "Critical failure detected!"
- **condition**: any_critical_failed
- **status**: PENDING
```

## Composite Actions

Group multiple actions together.

```markdown
### [MEDIUM] Daily maintenance
- **id**: maint-001
- **type**: composite
- **actions**:
  - cleanup-temp
  - rotate-logs
  - backup-db
- **mode**: sequential
- **fail_fast**: false
- **status**: PENDING
```

Claude Code executes each sub-action in order, checking for failures based on `fail_fast` setting.

## Execution Lifecycle

```
┌──────────┐
│ PENDING  │
└────┬─────┘
     │ Claude reads heartbeat.md
     ▼
┌──────────┐
│ RUNNING  │  (Claude updates status)
└────┬─────┘
     │
     ├─── success ──────────────▶ ┌───────────┐
     │                            │ COMPLETED │
     │                            └───────────┘
     │
     └─── failure ──┬── retries left ──▶ Keep PENDING
                    │                    (increment retry_count)
                    │
                    └── no retries ────▶ ┌──────────┐
                                         │  FAILED  │
                                         └──────────┘
```

Claude Code manages this lifecycle automatically based on the instructions in CLAUDE.md.

## Dependencies

Actions can depend on other actions:

```markdown
### [HIGH] Create database
- **id**: create-db
- **type**: shell
- **command**: createdb myapp
- **status**: PENDING

### [HIGH] Run migrations
- **id**: run-migrations
- **type**: shell
- **command**: ./migrate.sh
- **depends_on**: create-db
- **status**: PENDING
```

Claude Code checks if `create-db` is COMPLETED before executing `run-migrations`.

## Conditions

Actions can have conditions:

```markdown
### [MEDIUM] Alert if disk full
- **id**: disk-alert
- **type**: notify
- **channel**: slack
- **message**: "Disk space critical!"
- **condition**: disk_usage > 90%
- **status**: PENDING
```

Claude Code evaluates conditions before executing. Common conditions:
- `any_failed` - Any action failed this run
- `all_completed` - All actions completed
- `file_exists:/path` - File exists
- `time_after:09:00` - Current time after 09:00
- `weekday:mon,tue,wed` - Current day is Mon, Tue, or Wed

## Retry Behavior

```markdown
### [HIGH] Flaky API call
- **id**: api-001
- **type**: http
- **url**: https://flaky.example.com/api
- **retry**: 3
- **retry_delay**: 30s
- **status**: PENDING
```

If the action fails, Claude Code keeps it as PENDING and increments `retry_count`. On the next invocation (or after delay), it retries up to the `retry` limit.

## Variable Substitution

Claude Code understands these variables in action definitions:

| Variable | Meaning |
|----------|---------|
| `${date}` | Current date (YYYY-MM-DD) |
| `${time}` | Current time (HH:MM:SS) |
| `${timestamp}` | ISO 8601 timestamp |
| `${last_error}` | Last error message |
| `${action_count}` | Number of actions this run |
| `${completed_count}` | Completed actions this run |
| `${failure_count}` | Failed actions this run |
| `${ENV_VAR}` | Environment variable |

## Best Practices

1. **Use shell for most tasks** - Most flexible, Claude handles it well
2. **Be explicit about timeouts** - Prevents hung actions
3. **Include meaningful IDs** - Easier to track in logs
4. **Use conditions sparingly** - Keep logic simple
5. **Test actions manually first** - Verify commands work before adding to heartbeat

## Next Steps

- [[02-heartbeat-mechanism]] - heartbeat.md format
- [[04-implementation-phases]] - Setup guide
- [[templates/action-template]] - Action templates
