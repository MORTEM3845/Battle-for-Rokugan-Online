# Codex repository instructions

## Context economy

- Use CodeGraph first for symbol discovery, call paths, inheritance and impact analysis.
- Reuse CodeGraph results already obtained in the current chat; do not repeat equivalent graph queries.
- Do not use repository-wide recursive search to discover symbols. Use targeted `rg` only for literals, CSS, localization, configuration, assets or when the graph is insufficient.
- Read only task-relevant ranges. Do not inspect `.git`, `.codegraph`, `.wrangler`, `node_modules`, `dist`, generated output, binary assets or `package-lock.json` unless required.
- Keep tool output, plans and reports concise; prefer exact paths, symbols, commands and evidence.

## Project constraints

- React, TypeScript and Vite client code is in `src/`; Cloudflare Worker and Durable Objects are in `worker/`; shared contracts are in `shared/`.
- Durable Object state, bindings, API routes and payloads are compatibility contracts.
- Make the smallest coherent change; avoid unrelated refactors, renames and formatting changes.
- Find all consumers before changing shared types, game rules or API contracts, and keep client and Worker behavior synchronized.
- Never commit secrets, tokens, Cloudflare identifiers or local environment values.

## Style

- Preserve four-space indentation and compact formatting; keep short signatures, calls and conditions on one line while readable.
- Prefer explicit domain types over `any`; do not hide type errors with broad assertions.

## Validation

Run the narrowest relevant checks first. For shared or production changes run:

```powershell
npm run typecheck
npm run test:rules
npm run build
```

Use `npm ci` when dependencies are missing or the lockfile changed. For Worker deployment changes also run `npm run deploy:dry`.
Never claim a check passed unless it was executed; report the exact failing command and first actionable error.

For work continued in a new chat, copy and complete `docs/ai/TASK.md` instead of repeating repository exploration.
