# Heartbeat AI Agent - Implementation Plan

## Overview

This notebook outlines the implementation of an autonomous AI agent that uses a **heartbeat.md** file to manage its wakeup cycle, read pending actions, and execute tasks.

**Key Innovation**: This design uses **Claude Code CLI** as the agent runtime, requiring **little to no custom code**. Claude Code natively handles file reading, command execution, and state updates—we just need to configure the bootstrap files and scheduler.

## Core Concept

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Scheduler │───▶│ Claude Code  │───▶│   Actions   │
│  (cron/sys) │    │   (agent)    │    │  (execute)  │
└─────────────┘    └──────────────┘    └─────────────┘
        ▲               │  │                  │
        │               │  ▼                  │
        │          ┌────────────┐             │
        │          │heartbeat.md│◀────────────┘
        │          │  soul.md   │    (update state)
        │          └────────────┘
        └─────────────────────────────────────┘
```

**How it works:**
1. **Wake** - Cron/scheduler invokes `claude` CLI with system prompt
2. **Read** - Claude Code reads `heartbeat.md` and `soul.md` using its native Read tool
3. **Execute** - Claude Code runs shell commands, makes HTTP calls, updates files
4. **Update** - Claude Code updates `heartbeat.md` with results using Edit/Write tools

**No custom code required** - Claude Code IS the parser, executor, and state manager.

## Notebook Structure

| File | Purpose |
|------|---------|
| [[01-architecture]] | System architecture using Claude Code |
| [[02-heartbeat-mechanism]] | heartbeat.md file format |
| [[03-action-system]] | Action types Claude Code can execute |
| [[04-implementation-phases]] | Setup phases (mostly configuration) |
| [[05-openclaw-integration]] | Optional OpenClaw integration |
| [[06-configuration]] | Claude Code and scheduler configuration |
| [[templates/action-template]] | Template for defining new actions |

## Key Design Principles

1. **Claude Code as Runtime** - Use Claude Code CLI, not custom code
2. **File-First State** - All state persisted in readable markdown files
3. **Idempotent Actions** - Safe to re-run on failure
4. **Observable Execution** - Clear logging via Claude Code's output
5. **Human-Editable** - heartbeat.md can be manually modified
6. **Zero Custom Code** - Configuration over implementation

## Quick Links

- [[04-implementation-phases#Phase 1|Start Here: Phase 1 Setup]]
- [[02-heartbeat-mechanism#File Format|heartbeat.md Format Specification]]
- [[01-architecture#Claude Code Invocation|How to Run Claude Code]]

## Status

- [ ] Phase 1: Create bootstrap files (soul.md, heartbeat.md)
- [ ] Phase 2: Set up scheduler (cron/systemd)
- [ ] Phase 3: Optional OpenClaw integration
- [ ] Phase 4: Advanced workflows

---

*Powered by [Claude Code CLI](https://github.com/anthropics/claude-code)*
