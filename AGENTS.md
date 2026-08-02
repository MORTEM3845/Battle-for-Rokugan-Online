# Codex repository instructions

## Communication and output

- Speak to the user in Russian.
- Keep plans, internal notes, task specs and handoffs in concise English.
- Do not restate the request or narrate obvious actions.
- Progress updates should be one or two factual sentences.
- Final reports should contain only: changed files, validation performed and remaining risks.
- Prefer exact paths, symbols, commands and evidence over long explanations.

## Context economy

- Use CodeGraph first for symbol lookup, inheritance, callers, callees and impact analysis.
- Do not scan the whole repository when a symbol, route or directory can be queried directly.
- Read the smallest useful file range. Read a whole file only when safe editing requires it.
- Use `rg` only when graph lookup is insufficient or the task concerns literals, assets, translations or configuration.
- Never inspect `.git`, `.codegraph`, `.wrangler`, `node_modules`, `dist` or generated TypeScript output unless the task explicitly requires it.
- Do not open binary assets, audio, fonts or the rules PDF unless the task concerns that exact asset.
- Reuse findings already established in the current task. Do not repeat broad repository exploration.
- Use subagents only for independent, bounded investigations. Give each subagent a narrow scope and request only findings, symbols and evidence.
- Do not create large reports or architecture documents unless explicitly requested.

## Project overview

- Frontend: React 19, TypeScript and Vite.
- Backend: Cloudflare Worker with Durable Objects.
- `src/` contains the React client.
- `worker/` contains API routing, rooms, chat and Durable Object logic.
- `shared/` contains contracts and game data shared by client and Worker.
- `public/` contains static and binary assets.
- Room and chat state must remain compatible with deployed Durable Objects.

## Change discipline

- Make the smallest coherent change that solves the stated problem.
- Do not perform unrelated refactors, renames or formatting changes.
- Preserve public API payloads, route names, storage formats and Durable Object bindings unless the task explicitly changes them.
- Search for all consumers before changing a shared type, game rule or API contract.
- Keep client and Worker behavior synchronized when changing shared game state.
- Never add secrets, Cloudflare identifiers, tokens or local environment values to Git.

## TypeScript style

- Preserve the existing four-space indentation and compact formatting.
- Keep short signatures, calls, conditions and object literals on one line while readable.
- Do not vertically split short argument lists.
- Follow the repository's existing convention for single-statement conditions.
- Prefer explicit domain types over `any` and avoid unsafe casts.
- Do not silence TypeScript errors with broad assertions when the underlying type can be fixed.

## Required validation

Run the narrowest relevant checks first, then the full checks for shared or production changes:

```powershell
npm run typecheck
npm run test:rules
npm run build
```

- Use `npm ci` when dependencies are not installed or the lockfile changed.
- For Worker deployment changes, also run `npm run deploy:dry`.
- Never claim a check passed unless it was actually executed.
- On failure, report the exact failing command and the first actionable error.

## Task workflow

1. Inspect with CodeGraph and targeted reads.
2. State the minimal intended change.
3. Implement without unrelated edits.
4. Review the Git diff.
5. Run relevant validation.
6. Record a short handoff only when the task will continue in a new chat.

Templates for longer tasks are in `docs/ai/`.