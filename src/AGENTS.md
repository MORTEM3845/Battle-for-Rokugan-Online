# Client-specific instructions

These rules apply to files under `src/`.

## React and state

- Preserve existing component boundaries and state ownership unless the task requires restructuring.
- Do not duplicate server-owned game rules in UI code when a shared or Worker implementation already exists.
- Treat API response types and `shared/` contracts as the source of truth.
- Keep reconnect, room restoration and session persistence behavior intact.
- Avoid effects that repeatedly fetch or mutate because of unstable dependencies.
- Clean up timers, event listeners, media objects and subscriptions.

## UI behavior

- Preserve Russian and English localization when changing user-visible text.
- Do not hardcode a translated string in only one language.
- Keep the map responsive and avoid changing province coordinates, borders or asset geometry unless the task explicitly concerns the map.
- Do not replace established controls or interaction patterns during unrelated fixes.
- Maintain keyboard and pointer usability for interactive elements.

## Context economy

- Use CodeGraph for component dependencies, hooks, shared types and API call paths.
- Use targeted text search for localization keys, CSS selectors and asset references.
- Do not inspect large images, audio files or the rules PDF unless directly required.

## Validation

For client changes run:

```powershell
npm run typecheck
npm run build
```

Run `npm run test:rules` as well when the UI change affects game actions, phases, orders or scoring.