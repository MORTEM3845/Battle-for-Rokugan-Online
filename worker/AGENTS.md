# Worker-specific instructions

These rules apply to files under `worker/` and override broader repository guidance when more specific.

## Durable Object safety

- Treat Durable Object class names, bindings and migrations as persistent production contracts.
- Do not rename `RoomObject`, `ChatObject`, bindings or deployed Worker identifiers without an explicit migration plan.
- Existing room state may outlive the currently deployed code. New reads must tolerate missing fields when feasible.
- Prefer additive state changes and defaults over destructive format rewrites.
- Do not assume rollback restores Durable Object data; it only restores code.

## Concurrency

- Preserve per-room request serialization and existing queue guarantees.
- Before changing `requestQueue`, `patchQueue`, `fetch` or request dispatch, inspect all callers and overrides with CodeGraph.
- Await state-changing work before returning a response.
- Avoid detached promises unless they are deliberately passed to the execution context and failure handling is defined.
- Keep chat and room registration consistent when create or join operations succeed.

## API behavior

- Preserve route paths, methods, status codes and response payload shapes unless explicitly changing the API.
- Validate external input at the Worker boundary.
- Do not expose player tokens, internal state or exception details in responses.
- Keep `cache-control: no-store` for mutable room data.
- Return deterministic JSON errors and log actionable server-side details separately.

## Validation

For Worker changes run:

```powershell
npm run typecheck
npm run test:rules
npm run build
```

For bindings, migrations or deployment configuration also run:

```powershell
npm run deploy:dry
```

For state or multiplayer changes, mention any manual two-client scenario that still requires verification.