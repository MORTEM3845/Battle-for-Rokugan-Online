# Battle for Rokugan Online

- `src/`: React/Vite client; `shared/`: contracts and game data; `worker/`: Worker and Durable Objects.
- Production uses `RoomObjectPatched` over `RoomObject`; preserve serialization, authorization, stored-state compatibility and client/Worker API parity.
- Make the smallest coherent change; avoid unrelated refactors, renames, dependencies and formatting churn.
- Validate relevant changes with `npm run typecheck`, `npm run test:rules` and `npm run build`; Worker configuration also requires `npm run deploy:dry`.
- Report only checks actually run and their results.
- Use `docs/ai/TASK.md` only when work continues in a new chat.
