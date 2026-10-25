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

---

# Clan picker design QA

final result: passed

## Visual evidence

- Source: `C:/Users/tomko/.codex/generated_images/01a1700b-6113-7303-b6a5-1ad9f84b28ac/exec-7683b84b-c754-4cab-89e9-b039af69f0c7.png`.
- Desktop: `tmp/clan-picker-qa/desktop-lobby.png`, component crop `tmp/clan-picker-qa/desktop.png`.
- Combined comparison: `tmp/clan-picker-qa/comparison.png` (source left, implementation right).
- Mobile: `tmp/clan-picker-qa/mobile.png`.
- Desktop viewport: 1368 x 1000 CSS pixels, density 1; full-page capture 1368 x 1239, component crop 1180 x 517.
- Source: 1786 x 880 pixels; panel crop 1734 x 821, proportionally normalized to 1180 x 559. No stretching. The shorter implemented panel intentionally uses the existing lobby typography and compact spacing requested by the user.
- Mobile viewport: 390 x 844 CSS pixels, density 1. Page width stays within the viewport; only the banner row scrolls (305 CSS pixels visible, 846 CSS pixels content).
- Comparison state: Crane selected, Dragon previewed, Scorpion occupied. The occupied player's actual test name is Bot 1 instead of the mock's Akira.

## Findings and comparison history

No remaining actionable P0/P1/P2 findings in the combined final comparison.

Earlier browser captures exposed two visual issues: a masked shadow made the selected hem too subtle, and the mobile row used a white native scrollbar. The selected state now uses the real banner silhouette with an ivory lower edge; the scrollbar is thin muted bronze. Both fixes are visible in the final desktop/mobile evidence. Banner labels also prevent accidental text selection during pointer interaction.

## Required fidelity surfaces

- Typography: existing Georgia headings and inherited sans-serif body; readable names, rule text and token labels. Existing lobby heading size intentionally replaces the mock's oversized heading.
- Spacing/layout: seven equal tracks on desktop, one shared description strip, stable minimum height, no nested cards. Narrow screens retain one scrolling row and stack the token below the description.
- Colors/tokens: muted clan colors against the existing brown panel; ivory selected hem, visible keyboard focus, subdued occupied clans. A plain divider intentionally replaces the decorative wooden rod.
- Images: existing clan mons reused unchanged. One generated textile image supplies the actual banner silhouette and texture; no drawn substitute icons. The texture was resized and encoded as a 60,750-byte transparent WebP for delivery.
- Copy/content: authoritative shared rules and existing English clan data are preserved. Russian and English selection/status text checked. No new game statistics or confirmation step.

The full comparison shows all seven names and rule/token text clearly at component scale; an additional focused crop was unnecessary. The mobile capture separately verifies wrapping and the last banner's selected edge.

## Interaction and runtime checks

- Click selects a free clan and updates player status.
- Pointer preview and keyboard focus show another clan's ability without changing selection.
- Leaving the row without a focused banner restores the selected clan's description.
- Occupied clans remain reachable for inspection; Enter does not select them.
- Ready state blocks selection while still allowing keyboard inspection; Enter on another banner preserves the selected clan.
- Mobile selection works at both ends of the scrolling row.
- Russian/English switch and reconnect after a full reload preserve the selected clan.
- Browser console checked: an earlier development hot-refresh context warning occurred while shared translations were being edited; after a full reload there were no new warnings or errors.
- `pnpm run typecheck`, `pnpm run test:rules`, and `pnpm run build` passed. The environment provides pnpm rather than npm; these execute the repository's existing scripts.

## Asset provenance

Built-in ImageGen; reusable neutral ivory linen banner, front-facing, shallow pointed hem, subtle seams, transparent background, no pole, text or emblem. Final project asset: `public/assets/ui/clan-banner-cloth.webp`. The original generated PNG remains in the generator's output directory.

## Implementation checklist

- [x] Seven desktop banners and shared preview.
- [x] Selection, preview, occupied and ready states verified.
- [x] Narrow viewport and both languages verified.
- [x] Final combined visual comparison reviewed.
- [x] Existing API and shared game rules preserved.

Follow-up polish: none required for this scope.

## Follow-up: one shared rail, wind and wear

The user's accepted follow-up replaces the selected ivory rim/lift with one stationary wooden rail, slight wind on the cloth during hover/focus, and a worn cloth variant for the selected clan. All banner hit areas keep the same size.

- Source baseline: `tmp/clan-picker-qa/desktop.png`, interpreted with that explicit follow-up brief.
- Latest implementation: `tmp/clan-picker-qa/rail-desktop.png`; context: `tmp/clan-picker-qa/rail-desktop-viewport.png`.
- Combined before/after evidence: `tmp/clan-picker-qa/rail-comparison.png`.
- Responsive evidence: `tmp/clan-picker-qa/rail-1024.png` and `tmp/clan-picker-qa/rail-390.png`.
- Desktop CSS viewport 1368 x 1000; native capture 1353 x 989. The DOM-measured component region was cropped in native screenshot coordinates and proportionally normalized to 1180 x 517, matching the baseline component size.
- State: Crane selected, Dragon previewed, Scorpion occupied. All five fidelity surfaces above retain the existing lobby styling and authoritative rule content. The new rail and worn texture are actual raster assets.
- Widths 901, 1024, 1280, 1368 and 1920 CSS pixels: seven banners, exactly one rail, no row overflow, every clan name inside its banner. At 390 pixels, only the row scrolls (305 pixels visible, 846 pixels content), with no document overflow.
- Before and after choosing another clan at the desktop viewport, every banner measured 148 x 252 CSS pixels. Root button and rail transforms are `none`; only the inner cloth has the running `clan-banner-breeze` animation. The reduced-motion rule disables that animation.
- The selected banner uses `clan-banner-worn.webp` with a gently frayed silhouette. There is no extra border, enlargement, vertical lift, or selected-only rail segment.
- Final visual comparison: no actionable P0/P1/P2 findings. Existing typecheck, rules and build scripts passed for this follow-up.
- Built-in ImageGen assets: `public/assets/ui/clan-banner-rail.webp` (11,224 bytes; prompt: one uninterrupted slender dark walnut rail, plain ends, transparent background) and `public/assets/ui/clan-banner-worn.webp` (77,354 bytes; edit prompt: preserve the existing neutral cloth and proportions, add restrained edge abrasion and a few frayed nicks, no pole/text/emblem). Originals stay in the generator output directory; delivery files are optimized WebP.

final result: passed
