# Heartbeat Mechanism

## Overview

The `heartbeat.md` file is the central control file for the agent. It defines pending actions, tracks status, and maintains execution history. The file is human-readable and editable, following a structured markdown format.

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
- **type**: http_check
- **target**: https://api.example.com/health
- **schedule**: every:5m
- **status**: pending

### [MEDIUM] Sync database backup
- **id**: action-002
- **type**: shell
- **command**: ./scripts/backup.sh
- **schedule**: daily:02:00
- **status**: pending

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
next_wake: 2024-01-15T10:35:00Z   # Scheduled next wake
status: idle | running | error    # Current agent status
error_count: 0                    # Consecutive errors
last_error: null                  # Last error message
config_hash: abc123               # Config file hash for change detection
---
```

## Action Block Format

Each action is a level-3 heading with structured content:

```markdown
### [PRIORITY] Action Name
- **id**: unique-identifier
- **type**: action_type
- **status**: pending | running | completed | failed | skipped
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
| Critical | `[CRITICAL]` | Execute immediately, block on failure |
| High | `[HIGH]` | Execute first, continue on failure |
| Medium | `[MEDIUM]` | Standard execution order |
| Low | `[LOW]` | Execute if time permits |
| Background | `[BG]` | Non-blocking, async execution |

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting execution |
| `running` | Currently executing |
| `completed` | Successfully finished |
| `failed` | Execution failed |
| `skipped` | Skipped due to condition/dependency |
| `blocked` | Waiting on dependency |

## Schedule Expressions

### Supported Formats

```yaml
# One-time (ISO 8601)
schedule: at:2024-01-15T14:00:00Z

# Interval
schedule: every:5m
schedule: every:1h
schedule: every:30s

# Cron expression
schedule: cron:*/5 * * * *
schedule: cron:0 2 * * *

# Named schedules
schedule: daily:02:00
schedule: hourly
schedule: startup
schedule: on_change:path/to/watch
```

### Schedule Evaluation

```
Current Time: 10:32:00

Action A (every:5m, last_run: 10:30:00) → Due at 10:35:00 → SKIP
Action B (every:5m, last_run: 10:25:00) → Due at 10:30:00 → EXECUTE
Action C (cron:*/10 * * * *, last_run: 10:20:00) → Due at 10:30:00 → EXECUTE
```

## Parsing Algorithm

```python
def parse_heartbeat(content: str) -> HeartbeatState:
    # 1. Extract frontmatter
    frontmatter = extract_yaml_frontmatter(content)

    # 2. Find action blocks
    actions = []
    for block in find_h3_blocks(content):
        action = parse_action_block(block)
        if action.status == 'pending':
            if is_due(action.schedule):
                if check_dependencies(action, actions):
                    if evaluate_condition(action.condition):
                        actions.append(action)

    # 3. Sort by priority
    actions.sort(key=lambda a: PRIORITY_ORDER[a.priority])

    return HeartbeatState(
        metadata=frontmatter,
        actions=actions
    )
```

## Update Operations

### Mark Action Complete

```markdown
# Before
### [HIGH] Check API health
- **id**: action-001
- **status**: pending

# After
### [HIGH] Check API health
- **id**: action-001
- **status**: completed
- **completed_at**: 2024-01-15T10:32:15Z
- **duration**: 1.2s
- **result**: OK (200)
```

### Handle Failure

```markdown
### [HIGH] Check API health
- **id**: action-001
- **status**: failed
- **failed_at**: 2024-01-15T10:32:15Z
- **error**: Connection timeout after 30s
- **retry_count**: 2/3
- **next_retry**: 2024-01-15T10:37:15Z
```

## File Locking

To prevent concurrent modifications:

```python
def update_heartbeat(path: str, updates: dict):
    lock_path = path + '.lock'

    with file_lock(lock_path, timeout=30):
        content = read_file(path)
        state = parse_heartbeat(content)

        # Apply updates
        for action_id, changes in updates.items():
            state.update_action(action_id, changes)

        # Write atomically
        write_atomic(path, state.render())
```

## Backup and Recovery

```bash
# Automatic backup before each wake
cp heartbeat.md history/heartbeat-$(date +%Y%m%d-%H%M%S).md

# Recovery from corruption
if ! validate_heartbeat heartbeat.md; then
    cp history/heartbeat-latest-valid.md heartbeat.md
fi
```

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
- **schedule**: every:1h
- **status**: pending
```

### Complex heartbeat.md

See [[templates/action-template]] for more examples.

## Next Steps

- [[03-action-system]] - Define action types and execution
- [[06-configuration]] - Agent configuration options
