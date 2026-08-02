# Token-efficient Codex workflow

This directory contains optional task artifacts. Codex does not need to read them for small fixes.

## Small task

Use one chat and keep the scope narrow:

1. Ask Codex to use CodeGraph first.
2. Name the symptom, relevant feature and acceptance criterion.
3. Let it inspect only related symbols and files.
4. Require the relevant checks and a concise final report.

Example:

```text
Use CodeGraph first. Find the client-to-Worker path for the Unicorn swap action.
Do not scan unrelated UI or assets. Fix only the missing event notification.
Run typecheck, rule tests and build. Report changed files and remaining risks only.
```

## Large task

Use separate contexts:

1. **Analysis chat** — investigate and write a short task handoff.
2. **Implementation chat** — read only the task and handoff, then edit and validate.
3. **Review chat** — inspect the Git diff for concrete regressions only.

This avoids carrying a long exploratory conversation into implementation.

## Analysis request

```text
Read AGENTS.md and the active task file.
Use CodeGraph before broad search.
Do not edit code.
Return exact call paths, affected symbols, evidence and the minimal proposed change.
Write the result into the handoff file.
```

## Implementation request

```text
Read AGENTS.md, the task file and its handoff.
Implement the confirmed minimal change without repeating broad exploration.
Review the diff and run the required checks.
```

## Review request

```text
Review the current Git diff against AGENTS.md and the task acceptance criteria.
Focus on regressions, API/storage compatibility, concurrency and missing validation.
Do not rewrite code unless a concrete defect is found.
```

## Rules

- Do not paste whole logs when timestamps and the failing sequence are sufficient.
- Do not attach the rules PDF or binary assets unless the task concerns them.
- Prefer one task per chat.
- Start a fresh chat when the current chat contains completed implementation history.
- Store durable findings in a short handoff instead of asking the next chat to rediscover them.
- Delete or move completed task artifacts when they become stale.