# Codex repository instructions

## Context economy

- Use CodeGraph first for symbols, inheritance, callers, callees and impact analysis.
- Use targeted `rg` only for literals, CSS, localization, assets or when graph lookup is insufficient.
- Read the smallest useful file range and avoid repeated repository exploration.
- Never inspect `.git`, `.codegraph`, `.wrangler`, `node_modules`, `dist`, generated output or binary assets unless the task requires them.
- Use subagents only for independent, bounded investigations; request findings, symbols and evidence rather than narratives.
- Keep plans and final reports concise. Prefer exact paths, symbols, commands and evidence.

## Project

- Frontend: React 19, TypeScript and Vite in `src/`.
- Backend: Cloudflare Worker and Durable Objects in `worker/`.
- Shared contracts and game data are in `shared/`.
- Static and binary assets are in `public/`.
- Deployed Durable Object state, API payloads and route names are compatibility contracts.

## Change discipline

- Make the smallest coherent change that solves the stated problem.
- Do not perform unrelated refactors, renames or formatting changes.
- Find all consumers before changing shared types, game rules or API contracts.
- Keep client and Worker behavior synchronized when shared game state changes.
- Never commit secrets, Cloudflare identifiers, tokens or local environment values.

## TypeScript style

- Preserve four-space indentation and the existing compact formatting.
- Keep short signatures, calls, conditions and object literals on one line while readable.
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

## Workflow

1. Inspect with CodeGraph and targeted reads.
2. Implement the minimal change.
3. Review the Git diff.
4. Run relevant validation.
5. Record a handoff in `docs/ai/TASK.md` only when work continues in a new chat.
