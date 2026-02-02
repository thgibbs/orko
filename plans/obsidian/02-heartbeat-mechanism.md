# Heartbeat Mechanism

## Overview

The `heartbeat.md` file is the central control file for the agent. Claude Code reads this file directly on each invocation - no custom parsing code is needed. The file is human-readable and editable, following a structured markdown format that Claude understands natively.

## File Format

### Basic Structure

```markdown
---
version: 1
last_wake: 2024-01-15T10:30:00Z
next_wake: 2024-01-15T10:35:00Z
status: idle
---

# Heartbeat

## Pending Actions

### [HIGH] Check API health
- **id**: action-001
- **type**: http
- **target**: https://api.example.com/health
- **schedule**: every:5m
- **status**: PENDING

### [MEDIUM] Sync database backup
- **id**: action-002
- **type**: shell
- **command**: ./scripts/backup.sh
- **schedule**: daily:02:00
- **status**: PENDING

## Completed Today

- [x] action-000: System startup check (10:00:00)

## Notes

Agent initialized successfully.
```

### Frontmatter Schema

```yaml
---
version: 1                        # Schema version
last_wake: 2024-01-15T10:30:00Z   # Last execution timestamp
next_wake: 2024-01-15T10:35:00Z   # Scheduled next wake (informational)
status: idle | running | error    # Current agent status
error_count: 0                    # Consecutive errors
last_error: null                  # Last error message
---
```

**Note**: Claude Code updates this frontmatter automatically. No custom code needed.

## Action Block Format

Each action is a level-3 heading with structured content:

```markdown
### [PRIORITY] Action Name
- **id**: unique-identifier
- **type**: shell | http | file | notify
- **status**: PENDING | RUNNING | COMPLETED | FAILED | SKIPPED
- **schedule**: schedule_expression (optional)
- **retry**: max_attempts (optional, default: 1)
- **timeout**: duration (optional, default: 5m)
- **depends_on**: action-id (optional)
- **condition**: expression (optional)
- **params**:
  - key1: value1
  - key2: value2
```

### Priority Levels

| Priority | Label | Behavior |
|----------|-------|----------|
| Critical | `[CRITICAL]` | Execute first, stop on failure |
| High | `[HIGH]` | Execute early, continue on failure |
| Medium | `[MEDIUM]` | Standard execution order |
| Low | `[LOW]` | Execute if time permits |
| Background | `[BG]` | Non-blocking, async execution |

Claude Code understands these priorities and executes accordingly.

### Status Values

| Status | Meaning |
|--------|---------|
| `PENDING` | Awaiting execution |
| `RUNNING` | Currently executing (set by Claude) |
| `COMPLETED` | Successfully finished |
| `FAILED` | Execution failed |
| `SKIPPED` | Skipped due to condition/dependency |
| `NEEDS_CLARIFICATION` | Claude couldn't understand the action |

## Schedule Expressions

Claude Code interprets these schedule expressions:

```yaml
# One-time (ISO 8601)
schedule: at:2024-01-15T14:00:00Z

# Interval-based
schedule: every:5m
schedule: every:1h
schedule: every:30s

# Named schedules
schedule: daily:02:00
schedule: hourly
schedule: startup
schedule: weekdays:09:00
```

Claude Code checks the current time and `last_wake` to determine if a scheduled action is due.

## How Claude Code Processes This File

When Claude Code is invoked with "Process heartbeat", it:

1. **Reads heartbeat.md** using its Read tool
2. **Parses the content** using its natural language understanding
3. **Identifies PENDING actions** and their priorities
4. **Checks schedules** against current time
5. **Executes each action** using appropriate tools (Bash, Edit, etc.)
6. **Updates the file** with new status using Edit tool
7. **Logs to history** using Write tool

**No custom parser needed** - Claude understands markdown natively.

## Update Operations

### Mark Action Complete (done by Claude)

```markdown
# Before
### [HIGH] Check API health
- **id**: action-001
- **status**: PENDING

# After (Claude updates this)
### [HIGH] Check API health
- **id**: action-001
- **status**: COMPLETED
- **completed_at**: 2024-01-15T10:32:15Z
- **duration**: 1.2s
- **result**: OK (200)
```

### Handle Failure (done by Claude)

```markdown
### [HIGH] Check API health
- **id**: action-001
- **status**: FAILED
- **failed_at**: 2024-01-15T10:32:15Z
- **error**: Connection timeout after 30s
- **retry_count**: 2/3
```

## Concurrency Note

Since Claude Code processes heartbeat.md synchronously in a single invocation, file locking is typically not needed. The scheduler should ensure only one instance runs at a time (cron handles this by default).

If you need concurrent access:
- Use systemd's `ExecStart` with `flock`
- Or ensure cron jobs don't overlap with reasonable intervals

## Examples

### Minimal heartbeat.md

```markdown
---
version: 1
status: idle
---

# Heartbeat

## Pending Actions

### [MEDIUM] Hello World
- **id**: hello-001
- **type**: shell
- **command**: echo "Agent is alive"
- **status**: PENDING
```

### Production heartbeat.md

```markdown
---
version: 1
last_wake: 2024-01-15T10:30:00Z
status: idle
---

# Heartbeat

## Pending Actions

### [CRITICAL] Database health check
- **id**: db-health
- **type**: shell
- **command**: pg_isready -h localhost
- **schedule**: every:5m
- **status**: PENDING

### [HIGH] API endpoint monitor
- **id**: api-monitor
- **type**: shell
- **command**: curl -sf https://api.example.com/health || exit 1
- **schedule**: every:5m
- **status**: PENDING

### [MEDIUM] Daily backup
- **id**: daily-backup
- **type**: shell
- **command**: ./scripts/backup.sh
- **schedule**: daily:03:00
- **status**: PENDING

### [LOW] Cleanup old logs
- **id**: log-cleanup
- **type**: shell
- **command**: find ./logs -mtime +7 -delete
- **schedule**: daily:04:00
- **status**: PENDING

## Completed Today

- [x] db-health: OK (10:30:00)
- [x] api-monitor: OK (10:30:05)

## Notes

System running normally.
```

## Best Practices

1. **Keep it concise** - Claude reads the entire file each invocation
2. **Use clear action names** - Helps Claude understand intent
3. **Include error context** - If manually fixing failed actions
4. **Archive completed actions** - Move to Completed Today section
5. **Use meaningful IDs** - Makes logs easier to follow

## Next Steps

- [[03-action-system]] - Action types Claude Code can execute
- [[04-implementation-phases]] - Setup guide
- [[templates/action-template]] - Action templates
