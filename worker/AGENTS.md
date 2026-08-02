# Worker-specific instructions

See `../AGENTS.md` for shared rules.

- `worker/RoomObject.ts` is 126+ KiB. Do not read it in full by default; locate the required class or method with CodeGraph and read targeted ranges. Read the whole file only for a confirmed cross-cutting change.
- Treat Durable Object class names, bindings, migrations and stored state as persistent production contracts.
- Do not rename `RoomObject`, `ChatObject`, bindings or deployed Worker identifiers without a migration plan.
- Prefer additive state changes and defaults because existing rooms may lack newly added fields.
- Preserve serialization guarantees around `requestQueue`, `patchQueue`, `fetch` and request dispatch; await state-changing work before returning.
- Preserve route methods, status codes and payload shapes; validate external input and never expose player tokens or internal exceptions.
