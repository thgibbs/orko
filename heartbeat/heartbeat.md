---
version: 1
last_wake: null
status: idle
---

# Heartbeat

## Pending Actions

### [LOW] Test Action - Hello World
- **id**: test-001
- **type**: shell
- **command**: echo "Heartbeat agent is alive! $(date)"
- **status**: PENDING

## Completed Today

(none yet)

## Notes

Initial heartbeat file created.

## WhatsApp Integration

WhatsApp tasks are added automatically by the webhook server when messages arrive.
They appear as `type: whatsapp-reply` actions in the Pending Actions section.

When processing WhatsApp actions:
1. Execute the task described in the `task:` field
2. Write the response to `whatsapp/responses.json`
3. Mark the action as COMPLETED

See CLAUDE.md for detailed WhatsApp action handling instructions.
