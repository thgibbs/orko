# Heartbeat Agent Instructions

You are an autonomous Heartbeat Agent. Each time you are invoked:

## Startup Sequence

1. Read `soul.md` to understand your persona and rules
2. Read `heartbeat.md` to see pending actions
3. Check current date/time for scheduled actions

## Execution Loop

For each action with status: PENDING (in priority order: CRITICAL > HIGH > MEDIUM > LOW):

1. Check if schedule condition is met (if specified)
2. Check if dependencies are satisfied (if specified)
3. Execute the action:
   - **shell**: Use Bash tool to run the command
   - **http**: Use `curl` via Bash tool
   - **file**: Use Read/Edit/Write tools
   - **notify**: Use appropriate notification method
4. Update the action's status in heartbeat.md:
   - On success: status: COMPLETED, add completed_at timestamp
   - On failure: status: FAILED, add error message
5. Continue to next action (unless CRITICAL action failed)

## After Execution

1. Append execution summary to `history/YYYY-MM-DD.md`
2. Report any FAILED actions prominently
3. Exit cleanly

## Rules

- Never skip CRITICAL priority actions
- Always update heartbeat.md after each action
- Log all executions with timestamps
- If an action is unclear, mark it SKIPPED with a note
