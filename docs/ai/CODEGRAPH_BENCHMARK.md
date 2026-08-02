# CodeGraph A/B benchmark

Use this benchmark after a major CodeGraph or Codex update. Run both variants from the same commit, with the same model and reasoning effort, in fresh chats.

## Test prompts

### Architecture

```text
Find the production RoomObject exported by worker/index.ts.
Show its inheritance chain, overridden request entry points and serialized request queues.
Return exact files and symbols only.
```

### Impact analysis

```text
Determine every client and Worker path affected by changing the Unicorn swap action payload.
Return callers, shared contracts, route handlers and tests that need validation.
Do not edit code.
```

### Rule investigation

```text
Trace how an order placed on a province border is validated, stored, revealed and resolved.
Return the call path and exact symbols only. Do not inspect assets or unrelated UI.
```

## Variants

**Baseline:** explicitly disable CodeGraph use for the chat.

**Graph:** require CodeGraph before text search or file reads.

## Record

| Test | Variant | Duration | Tool calls | Files read | Full-file reads | Correct symbols | Misses |
|---|---|---:|---:|---:|---:|---:|---:|
| Architecture | Baseline | | | | | | |
| Architecture | Graph | | | | | | |
| Impact | Baseline | | | | | | |
| Impact | Graph | | | | | | |
| Rules | Baseline | | | | | | |
| Rules | Graph | | | | | | |

## Interpretation

Keep CodeGraph enabled when it reduces broad reads and tool calls without missing symbols. Do not judge it only by wall-clock time: MCP startup may make a small query slower while still reducing context usage. For literal strings, CSS, translations and asset references, targeted `rg` may remain the better tool.