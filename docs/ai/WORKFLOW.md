# Token-efficient Codex workflow

Use one focused chat for small changes. Ask Codex to use CodeGraph first, name the symptom and acceptance criterion, and require only relevant validation.

For larger work, copy `TASK.md` to a task-specific file and use separate contexts:

1. **Analysis** — fill `## Task`, investigate with CodeGraph and record confirmed findings in `## Handoff`.
2. **Implementation** — read `AGENTS.md` and the task file, implement without repeating broad exploration, then validate.
3. **Review** — inspect the Git diff against acceptance criteria and report concrete regressions only.

Useful prompts:

```text
Read AGENTS.md and the task file. Use CodeGraph before broad search.
Do not edit code. Record exact call paths, symbols, evidence and the minimal change in ## Handoff.
```

```text
Read AGENTS.md and the completed task file. Implement the confirmed minimal change.
Review the diff and run relevant checks. Do not repeat broad exploration.
```

Keep one task per chat. Do not paste whole logs or attach binary assets unless they are required. Preserve durable findings in the task handoff instead of making the next chat rediscover them.
