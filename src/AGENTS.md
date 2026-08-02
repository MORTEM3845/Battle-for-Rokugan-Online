# Client-specific instructions

See `../AGENTS.md` for shared rules.

- Preserve component boundaries and state ownership unless restructuring is required.
- Treat `shared/` contracts and API response types as the source of truth; do not duplicate Worker-owned game rules in UI code.
- Keep reconnect, room restoration and session persistence behavior intact.
- Avoid effects with unstable dependencies and clean up timers, listeners, media objects and subscriptions.
- Preserve both Russian and English localization when changing user-visible text.
- Keep map coordinates, borders and asset geometry unchanged unless the task concerns the map.
- Maintain keyboard and pointer usability for interactive elements.
