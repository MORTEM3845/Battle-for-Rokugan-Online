# Design QA — tabletop paper game board

- Source visual truth: `C:/Users/tomko/AppData/Local/Temp/codex-clipboard-41087494-e80b-4513-a67e-a24b65f3f545.png`
- Implementation screenshot: `D:/coding/Battle For Rakugan Online/Battle-for-Rokugan-Online/implementation-tabletop.png`
- Combined comparison evidence: `D:/coding/Battle For Rakugan Online/Battle-for-Rokugan-Online/design-comparison.png`
- Viewport: desktop in-app browser, game setup state.
- Source pixels: 1278 × 937. Implementation pixels: 1265 × 764. Both are browser captures at CSS density 1; comparison preserves each capture's native density and places them vertically.
- State: five-player game, initial setup; the bottom rack is visible. No console warnings or errors were recorded.

## Findings

- No actionable P0/P1/P2 mismatches for the requested direction.
- The implementation intentionally retains the existing Rokugan map, game data, and placement flow. It now matches the reference's key visual language: paper panels, dark tabletop surround, wood-framed map, clan medallions, and a persistent personal rack.
- Numeric token strength remains live UI data rather than art: `BattleToken` renders `token.strength` in a `<b>` badge. The same badge treatment was applied to placed orders.

## Required fidelity surfaces

- Fonts and typography: serif hierarchy and compact tactical labels are retained; paper panels use dark ink text for contrast.
- Spacing and layout rhythm: top player strip, central board + right instruction rail, and bottom private rack remain aligned at desktop width.
- Colors and visual tokens: warm washi paper, sepia ink, dark wood/table background, and clan-colored medallions are consistent.
- Image quality and asset fidelity: the game uses the existing high-detail Rokugan map and a generated washi-paper texture at `public/assets/ui/washi-paper-texture.png`; no placeholder asset replaces a required visual.
- Copy and content: existing game copy and controls remain unchanged.

## Comparison history

1. Applied paper-panel, framed-board, medallion, and numeric-badge styling.
2. Captured and compared the reference and browser-rendered setup screen in `design-comparison.png`.
3. Confirmed the layout and visual direction; no P0/P1/P2 correction was required.

## Follow-up polish

- [P3] Replace the remaining text-based tactical symbols with a bespoke icon set if a fully illustrated token face is desired.

final result: passed
