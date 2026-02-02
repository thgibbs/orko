# Action System

## Overview

Actions are the executable units that the agent performs. Each action has a type, parameters, lifecycle, and execution semantics.

## Built-in Action Types

### Shell Actions

Execute shell commands.

```markdown
### [MEDIUM] Run backup script
- **id**: backup-001
- **type**: shell
- **command**: ./scripts/backup.sh --full
- **working_dir**: /app
- **timeout**: 10m
- **env**:
  - BACKUP_TARGET: s3://bucket/backups
- **status**: pending
```

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Shell command to execute |
| `working_dir` | No | Working directory |
| `timeout` | No | Max execution time |
| `env` | No | Environment variables |
| `shell` | No | Shell to use (default: /bin/sh) |

### HTTP Actions

Make HTTP requests.

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
- **status**: pending
```

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Request URL |
| `method` | No | HTTP method (default: GET) |
| `headers` | No | Request headers |
| `body` | No | Request body |
| `expect_status` | No | Expected status code |
| `expect_body` | No | Expected response pattern |

### File Actions

File system operations.

```markdown
### [LOW] Clean temp files
- **id**: clean-001
- **type**: file
- **operation**: delete
- **pattern**: /tmp/agent-*.log
- **older_than**: 7d
- **status**: pending
```

**Operations:**
- `read` - Read file content
- `write` - Write content to file
- `delete` - Delete files matching pattern
- `copy` - Copy files
- `move` - Move files
- `watch` - Watch for changes (triggers other actions)

### Agent Actions

Delegate to AI agent.

```markdown
### [MEDIUM] Summarize daily logs
- **id**: summarize-001
- **type**: agent
- **prompt**: |
    Review the logs in /var/log/app/ from today.
    Summarize any errors or warnings.
    Write summary to /reports/daily-$(date +%Y%m%d).md
- **model**: claude-3-sonnet
- **max_tokens**: 4096
- **status**: pending
```

**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `prompt` | Yes | Task prompt for agent |
| `model` | No | Model to use |
| `max_tokens` | No | Response limit |
| `tools` | No | Allowed tools |
| `context_files` | No | Files to include in context |

### Notification Actions

Send notifications.

```markdown
### [HIGH] Alert on failure
- **id**: alert-001
- **type**: notify
- **channel**: slack
- **target**: #alerts
- **message**: |
    :warning: Action ${failed_action} failed
    Error: ${error_message}
- **condition**: any_failed
- **status**: pending
```

**Channels:**
- `slack` - Slack webhook
- `discord` - Discord webhook
- `telegram` - Telegram bot
- `email` - SMTP email
- `webhook` - Generic webhook

### Composite Actions

Group multiple actions.

```markdown
### [MEDIUM] Daily maintenance
- **id**: maint-001
- **type**: composite
- **actions**:
  - clean-temp
  - rotate-logs
  - update-stats
- **mode**: sequential | parallel
- **fail_fast**: true
- **status**: pending
```

## Execution Lifecycle

```
┌──────────┐
│ PENDING  │
└────┬─────┘
     │ schedule due & deps met & condition true
     ▼
┌──────────┐
│ RUNNING  │
└────┬─────┘
     │
     ├─── success ──────────────▶ ┌───────────┐
     │                            │ COMPLETED │
     │                            └───────────┘
     │
     └─── failure ──┬── retries left ──▶ ┌──────────┐
                    │                    │ PENDING  │ (retry scheduled)
                    │                    └──────────┘
                    │
                    └── no retries ────▶ ┌──────────┐
                                         │  FAILED  │
                                         └──────────┘
```

### Lifecycle Hooks

```python
class ActionExecutor:
    def execute(self, action: Action) -> Result:
        # Pre-execution
        self.on_start(action)
        self.update_status(action, 'running')

        try:
            # Execute with timeout
            result = self.run_with_timeout(action)

            # Post-execution
            self.on_success(action, result)
            self.update_status(action, 'completed', result=result)
            return result

        except TimeoutError:
            self.on_timeout(action)
            return self.handle_retry(action, 'timeout')

        except Exception as e:
            self.on_error(action, e)
            return self.handle_retry(action, str(e))
```

## Dependency Management

### Explicit Dependencies

```markdown
### [HIGH] Create database
- **id**: create-db
- **type**: shell
- **command**: createdb myapp
- **status**: pending

### [HIGH] Run migrations
- **id**: run-migrations
- **type**: shell
- **command**: ./migrate.sh
- **depends_on**: create-db
- **status**: blocked
```

### Dependency Resolution

```python
def resolve_dependencies(actions: List[Action]) -> List[Action]:
    graph = build_dependency_graph(actions)

    # Topological sort
    resolved = []
    while graph.has_nodes():
        # Find actions with no pending dependencies
        ready = [a for a in graph.nodes()
                 if all(d.status == 'completed' for d in graph.deps(a))]

        if not ready:
            raise CircularDependencyError(graph.remaining())

        resolved.extend(sorted(ready, key=lambda a: a.priority))
        graph.remove(ready)

    return resolved
```

## Condition Expressions

```yaml
# Simple conditions
condition: file_exists:/path/to/file
condition: env_set:API_KEY
condition: time_after:09:00
condition: time_before:17:00
condition: weekday:mon,tue,wed,thu,fri

# Action result conditions
condition: action_completed:prev-action
condition: action_failed:check-health
condition: any_failed
condition: all_completed

# Composite conditions
condition: |
  file_exists:/tmp/trigger AND
  time_after:09:00 AND
  NOT action_failed:critical-check
```

## Retry Policies

```markdown
### [HIGH] Flaky API call
- **id**: api-001
- **type**: http
- **url**: https://flaky.example.com/api
- **retry**: 3
- **retry_delay**: exponential:1s,30s
- **retry_on**:
  - status:5xx
  - timeout
  - connection_error
- **status**: pending
```

**Retry Strategies:**
| Strategy | Format | Behavior |
|----------|--------|----------|
| Fixed | `fixed:5s` | Wait 5s between retries |
| Linear | `linear:5s` | 5s, 10s, 15s... |
| Exponential | `exponential:1s,60s` | 1s, 2s, 4s... max 60s |
| Immediate | `immediate` | Retry immediately |

## Output Handling

### Capturing Output

```markdown
### [MEDIUM] Get server status
- **id**: status-001
- **type**: shell
- **command**: ./status.sh
- **capture_output**: true
- **output_file**: /tmp/status-output.txt
- **status**: pending
```

### Using Output in Subsequent Actions

```markdown
### [MEDIUM] Process status
- **id**: process-001
- **type**: agent
- **prompt**: |
    Analyze the server status:
    ${output:status-001}

    Identify any concerning metrics.
- **depends_on**: status-001
- **status**: blocked
```

## Action Templates

Create reusable action patterns in [[templates/action-template]].

```markdown
### Template: Health Check
- **id**: health-${service}
- **type**: http
- **method**: GET
- **url**: ${endpoint}/health
- **expect_status**: 200
- **timeout**: 30s
- **retry**: 3
- **on_failure**: notify:slack:#alerts
```

## Custom Action Types

Extend with custom handlers:

```python
# actions/custom_handlers.py

@action_handler('database')
class DatabaseAction(ActionHandler):
    def execute(self, params: dict) -> Result:
        operation = params['operation']

        if operation == 'query':
            return self.run_query(params['sql'])
        elif operation == 'backup':
            return self.run_backup(params['target'])
        # ...
```

## Next Steps

- [[04-implementation-phases]] - Implementation roadmap
- [[templates/action-template]] - Action templates
