# Client-specific instructions

See `../AGENTS.md` for shared rules.

- Use CodeGraph and targeted ranges for `src/game/GameBoard.tsx`; do not read the whole component by default.
- Search specific selectors in `src/game/game.css` instead of reading the stylesheet in full.
- Do not read `src/assets/rokugan-provinces.svg` in full unless editing map geometry; search the required province or element ID.
- Treat `shared/` contracts and API response types as the source of truth; do not duplicate Worker-owned game rules in UI code.
- Preserve reconnect, room restoration, session persistence and effect cleanup.
- Preserve both Russian and English localization, map geometry and keyboard/pointer behavior unless the task explicitly changes them.
