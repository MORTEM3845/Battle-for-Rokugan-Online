# Worker-specific instructions

See `../AGENTS.md` for shared rules.

- Treat Durable Object class names, bindings, migrations and stored state as persistent production contracts.
- Do not rename `RoomObject`, `ChatObject`, bindings or deployed Worker identifiers without a migration plan.
- Prefer additive state changes and defaults; existing rooms may lack newly added fields.
- Preserve request serialization and queue guarantees around `requestQueue`, `patchQueue`, `fetch` and request dispatch.
- Await state-changing work before returning; avoid detached promises without execution-context and failure handling.
- Keep room and chat registration consistent after create and join operations.
- Preserve route methods, status codes and payload shapes unless the task explicitly changes the API.
- Validate external input, keep mutable room responses uncached and never expose player tokens or internal exceptions.
