# Home Screen Redesign — Design QA

- Source visual truth: `C:\Users\tomko\AppData\Local\Temp\codex-clipboard-974145b7-5c23-45c7-a151-7761a8cd767a.png`
- Implementation screenshot: `D:\coding\BattleForRokugan\home-implementation-final.png`
- Combined comparison: `D:\coding\BattleForRokugan\home-design-comparison.png`
- Responsive evidence: `D:\coding\BattleForRokugan\home-mobile-390x844-final.png`
- Desktop viewport: 1414 × 757 CSS px at devicePixelRatio 1
- Source pixels: 1414 × 757
- Implementation pixels: 1414 × 757
- Density normalization: none required; source and implementation are equal pixel dimensions
- State: Russian locale, empty player name and room code, default disabled primary action

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Typography: the Mincho/Georgia display stack preserves the source's historical tone while the larger title establishes a stronger game-first hierarchy. Body copy and form labels remain readable without wrapping defects.
- Spacing and layout rhythm: the redesign intentionally replaces the inset rounded card with a flatter full-viewport game-table frame. The form, feedback action, map, and map caption fit within the 1414 × 757 viewport without document overflow.
- Colors and visual tokens: the existing red, charcoal, parchment, and muted-gold palette is preserved and extended with the in-game sumi backdrop. Disabled, focus, error, and active button states retain the existing semantic colors.
- Image quality and asset fidelity: both visible raster assets are existing production game assets. The 1536 × 1024 map remains sharp, uses its authored ornamental frame, and is not replaced or reconstructed with CSS/SVG art.
- Copy and content: all existing localized home-screen copy is preserved. The empty kanji token next to the title is intentionally removed per the redesign brief.
- Accessibility: labels, semantic buttons, image alt text, keyboard Enter behavior, focus styling, and reduced-motion handling are present.

**Full-view comparison evidence**

- `home-design-comparison.png` places the supplied source and final implementation side by side at the same 1414 × 757 state.
- The comparison confirms the requested intentional changes: larger map presence, game artwork as the page backdrop, no title token, flatter/brighter game framing, and no page scroll.

**Focused region comparison evidence**

- A separate crop was not needed: at 1414 × 757 the side-by-side image keeps the title, form controls, map borders, and caption readable at full size.
- Browser inspection additionally confirmed the map loaded at its natural 1536 × 1024 resolution and the title contains zero decorative token spans.

**Interaction and browser verification**

- Player-name input enables the create-room action.
- Invalid room code submitted with Enter shows the localized six-character validation error without introducing page overflow.
- Feedback dialog opens and closes from its labeled controls.
- Desktop document dimensions are exactly 1414 × 757; mobile document dimensions are exactly 390 × 844.
- Console errors checked: none.

**Comparison history**

1. First browser pass — `home-implementation-01.png`
   - P2: grid children used their min-content height and extended below the intended hero track, clipping the feedback action and map caption even though the document itself did not scroll.
   - Fix: added a zero minimum height to the content column and separated vertical/horizontal responsive padding so the grid can shrink to the viewport.
2. Final browser pass — `home-implementation-final.png`
   - Post-fix evidence: all home content and the full caption are visible inside the 1414 × 757 frame; document scroll width/height equal the viewport; no P0/P1/P2 findings remain.
3. Responsive pass — `home-mobile-390x844-final.png`
   - The map, title, inputs, primary/join actions, language toggle, and feedback action remain visible with no page scroll or overlap.

**Implementation Checklist**

- [x] Remove the decorative kanji token.
- [x] Use the in-game sumi backdrop.
- [x] Make the map the dominant visual region.
- [x] Keep create/join behavior and feedback dialog functional.
- [x] Prevent desktop and mobile document scrolling at the tested viewports.
- [x] Respect `prefers-reduced-motion`.

**Follow-up Polish**

- None required for handoff.

final result: passed
