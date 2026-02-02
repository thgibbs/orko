# Action Templates

## Overview

These templates provide reusable patterns for common action types. Copy and customize as needed.

---

## Shell Actions

### Basic Command

```markdown
### [MEDIUM] Run script
- **id**: script-001
- **type**: shell
- **command**: ./scripts/my-script.sh
- **status**: pending
```

### Command with Environment

```markdown
### [MEDIUM] Deploy application
- **id**: deploy-001
- **type**: shell
- **command**: ./deploy.sh
- **working_dir**: /app
- **timeout**: 15m
- **env**:
  - ENVIRONMENT: production
  - VERSION: ${VERSION}
- **status**: pending
```

### Piped Commands

```markdown
### [LOW] Count log errors
- **id**: count-errors
- **type**: shell
- **command**: grep ERROR /var/log/app.log | wc -l
- **capture_output**: true
- **status**: pending
```

---

## HTTP Actions

### Health Check

```markdown
### [HIGH] API Health Check
- **id**: health-api
- **type**: http
- **method**: GET
- **url**: https://api.example.com/health
- **expect_status**: 200
- **timeout**: 30s
- **retry**: 3
- **retry_delay**: exponential:5s,60s
- **status**: pending
```

### Authenticated Request

```markdown
### [MEDIUM] Fetch user data
- **id**: fetch-users
- **type**: http
- **method**: GET
- **url**: https://api.example.com/users
- **headers**:
  - Authorization: Bearer ${API_TOKEN}
  - Accept: application/json
- **expect_status**: 200
- **capture_output**: true
- **output_file**: /tmp/users.json
- **status**: pending
```

### POST Request

```markdown
### [MEDIUM] Submit report
- **id**: submit-report
- **type**: http
- **method**: POST
- **url**: https://api.example.com/reports
- **headers**:
  - Content-Type: application/json
  - Authorization: Bearer ${API_TOKEN}
- **body**: |
  {
    "date": "${DATE}",
    "status": "completed",
    "metrics": ${output:collect-metrics}
  }
- **expect_status**: 201
- **status**: pending
```

### Webhook Trigger

```markdown
### [LOW] Trigger build
- **id**: trigger-build
- **type**: http
- **method**: POST
- **url**: https://ci.example.com/webhooks/build
- **headers**:
  - X-Webhook-Secret: ${WEBHOOK_SECRET}
- **body**: |
  {
    "branch": "main",
    "triggered_by": "heartbeat"
  }
- **status**: pending
```

---

## File Actions

### Clean Old Files

```markdown
### [LOW] Clean temp files
- **id**: clean-temp
- **type**: file
- **operation**: delete
- **pattern**: /tmp/heartbeat-*.log
- **older_than**: 7d
- **status**: pending
```

### Rotate Logs

```markdown
### [LOW] Rotate logs
- **id**: rotate-logs
- **type**: file
- **operation**: move
- **source**: /var/log/app/current.log
- **target**: /var/log/app/archive/app-${DATE}.log
- **compress**: true
- **status**: pending
```

### Watch for Changes

```markdown
### [BG] Watch config changes
- **id**: watch-config
- **type**: file
- **operation**: watch
- **pattern**: /etc/app/config.yaml
- **on_change**: reload-config
- **status**: pending
```

---

## Agent Actions

### Summarize Logs

```markdown
### [MEDIUM] Summarize daily logs
- **id**: summarize-logs
- **type**: agent
- **prompt**: |
  Review the application logs from today:
  - /var/log/app/$(date +%Y-%m-%d).log

  Provide a summary including:
  1. Error count and types
  2. Warning patterns
  3. Unusual activity
  4. Recommendations

  Write summary to /reports/daily/$(date +%Y-%m-%d).md
- **model**: claude-3-sonnet
- **max_tokens**: 4096
- **context_files**:
  - /var/log/app/$(date +%Y-%m-%d).log
- **status**: pending
```

### Analyze and Fix

```markdown
### [HIGH] Investigate error spike
- **id**: investigate-errors
- **type**: agent
- **prompt**: |
  Error rate increased by 50% in the last hour.

  1. Analyze recent logs in /var/log/app/
  2. Identify the root cause
  3. Suggest a fix
  4. If confident, apply the fix

  Report findings to /reports/incidents/$(date +%Y%m%d-%H%M).md
- **model**: claude-3-opus
- **max_tokens**: 8192
- **tools**:
  - read
  - exec
  - write
- **status**: pending
```

### Code Review

```markdown
### [MEDIUM] Review recent commits
- **id**: review-commits
- **type**: agent
- **prompt**: |
  Review commits from the last 24 hours:

  ```
  git log --oneline --since="24 hours ago"
  ```

  For each commit:
  1. Check for potential bugs
  2. Identify security issues
  3. Note code quality concerns

  Write review to /reports/code-review/$(date +%Y-%m-%d).md
- **model**: claude-3-sonnet
- **status**: pending
```

---

## Notification Actions

### Slack Alert

```markdown
### [HIGH] Alert on failure
- **id**: alert-failure
- **type**: notify
- **channel**: slack
- **target**: "#alerts"
- **message**: |
  :x: *Heartbeat Action Failed*

  **Action:** ${failed_action}
  **Error:** ${error_message}
  **Time:** ${timestamp}

  <${log_url}|View Logs>
- **condition**: any_failed
- **status**: pending
```

### Daily Summary

```markdown
### [LOW] Daily summary
- **id**: daily-summary
- **type**: notify
- **channel**: slack
- **target**: "#heartbeat"
- **message**: |
  :heartbeat: *Daily Heartbeat Summary*

  **Date:** ${date}
  **Actions Run:** ${total_actions}
  **Successful:** ${successful_count}
  **Failed:** ${failed_count}

  ${summary_details}
- **schedule**: daily:18:00
- **status**: pending
```

### Multi-Channel Alert

```markdown
### [CRITICAL] Critical system alert
- **id**: critical-alert
- **type**: notify
- **channels**:
  - slack:#critical
  - telegram
  - email:oncall@example.com
- **message**: |
  CRITICAL: System requires immediate attention

  ${alert_details}
- **condition**: action_failed:critical-check
- **status**: pending
```

---

## Composite Actions

### Daily Maintenance

```markdown
### [MEDIUM] Daily maintenance
- **id**: daily-maintenance
- **type**: composite
- **mode**: sequential
- **actions**:
  - clean-temp
  - rotate-logs
  - backup-database
  - health-check
- **fail_fast**: false
- **schedule**: daily:02:00
- **status**: pending
```

### Parallel Checks

```markdown
### [HIGH] System health checks
- **id**: health-checks
- **type**: composite
- **mode**: parallel
- **actions**:
  - health-api
  - health-database
  - health-cache
  - health-queue
- **timeout**: 2m
- **status**: pending
```

### Conditional Workflow

```markdown
### [MEDIUM] Backup workflow
- **id**: backup-workflow
- **type**: composite
- **mode**: sequential
- **actions**:
  - check-disk-space
  - create-backup
  - verify-backup
  - upload-backup
  - notify-complete
- **on_failure**:
  - notify-failure
  - cleanup-partial
- **status**: pending
```

---

## Scheduled Actions

### Every 5 Minutes

```markdown
### [HIGH] Frequent health check
- **id**: frequent-health
- **type**: http
- **url**: https://api.example.com/health
- **schedule**: every:5m
- **status**: pending
```

### Hourly

```markdown
### [MEDIUM] Hourly metrics
- **id**: hourly-metrics
- **type**: shell
- **command**: ./scripts/collect-metrics.sh
- **schedule**: every:1h
- **status**: pending
```

### Daily at Specific Time

```markdown
### [LOW] Daily cleanup
- **id**: daily-cleanup
- **type**: shell
- **command**: ./scripts/cleanup.sh
- **schedule**: daily:03:00
- **timezone**: America/New_York
- **status**: pending
```

### Cron Expression

```markdown
### [MEDIUM] Weekly report
- **id**: weekly-report
- **type**: agent
- **prompt**: Generate weekly activity report
- **schedule**: cron:0 9 * * MON
- **status**: pending
```

### Weekdays Only

```markdown
### [LOW] Business hours check
- **id**: business-check
- **type**: http
- **url**: https://internal.example.com/status
- **schedule**: cron:*/15 9-17 * * MON-FRI
- **status**: pending
```

---

## Conditional Actions

### File Exists

```markdown
### [MEDIUM] Process upload
- **id**: process-upload
- **type**: shell
- **command**: ./scripts/process-upload.sh
- **condition**: file_exists:/uploads/pending/*
- **status**: pending
```

### Time-Based

```markdown
### [LOW] Off-hours maintenance
- **id**: off-hours-maint
- **type**: shell
- **command**: ./scripts/heavy-maintenance.sh
- **condition**: time_after:22:00 AND time_before:06:00
- **status**: pending
```

### Dependency-Based

```markdown
### [MEDIUM] Post-backup verification
- **id**: verify-backup
- **type**: shell
- **command**: ./scripts/verify-backup.sh
- **depends_on**: create-backup
- **condition**: action_completed:create-backup
- **status**: blocked
```

---

## Template Usage

To use a template:

1. Copy the template to your `heartbeat.md`
2. Update the `id` to be unique
3. Customize parameters for your use case
4. Set status to `pending`

Example customization:

```markdown
### [HIGH] Production API Health
- **id**: health-prod-api
- **type**: http
- **method**: GET
- **url**: https://api.mycompany.com/v2/health
- **headers**:
  - X-API-Key: ${PROD_API_KEY}
- **expect_status**: 200
- **timeout**: 10s
- **retry**: 3
- **schedule**: every:2m
- **on_failure**: notify:slack:#prod-alerts
- **status**: pending
```
