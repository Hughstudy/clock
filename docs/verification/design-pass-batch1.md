# Design pass, batch 1

On November 5, 2026 the owner asked for a review of the design, interface and animation against Apple's guidance and current animation practice. The review's suggestions were shown as a private before/after page ([Blue Companion Design Pass](https://claude.ai/artifact/RhG9CnPzPA9zZzoE1rovEz)). On November 6 the owner started batch 1. While reviewing, they pointed at the empty band above 「给我一句鼓励」 and asked for it to be compacted. This report records what batch 1 changed, the decisions behind it and what was verified.

## Owner decisions

- Start batch 1 as shown on the design page (2026-11-06).
- Compact the empty space above 「给我一句鼓励」 (2026-11-06). This settles the page's first open decision ("how much room the card takes") in favour of one reserved row.

The other decisions on the page remain open: small text on the dusk scene, the card's opacity, a night palette for Focus, a sound offer, and the install icon and name.

## What changed

### A compact Focus card

- The card reserves one voice row instead of two (`--console` in `focus.css`). It grows upward over the companion's feet only while something needs the room: a note, a passing line's 「查看全文」 link, the encouragement reader or the duration ruler. The status row, the timer controls and the thought tools never move.
- Notes (a new mark, a draft, a save problem) take a row at the top of the card instead of floating as a chip over the companion's feet. The card no longer opens an empty band when a note appears.
- A new install opens quietly. 「已准备好离线使用」 is listed in Settings › 应用状态 and no longer appears as a note on Focus.
- The companion's art box grows with the freed row. The `F4` scene's end-to-end check then caught a regression: the larger drawing pushed the kettle past the edge of a 375 px screen. Hands and handled props were sampled through every scene's actions. The farthest reach is 34% of the art's width from its centre (the `F4` kettle), so `fitSceneArt` now caps the drawn width at 1.44 × the scene width (`ART_MAX_SCENE_RATIO`). At 375 × 812 the companion's drawn width goes from 485 to 540 px.

### When a session ends

- A finished focus session reads as what was done: 「25 分钟」, 「3 分 12 秒」, 「40 秒」 (`formatElapsedParts`). It replaces 25:00, which looked the same as an unstarted timer. The figure fades in over 240 ms, rounds down and has no celebration. The status line keeps the exact 「本段计时 … · 已保存」 text.
- The finished activity stays on screen while its saved result is shown, including after a mark or an encouragement. It changes only when a rest starts or focus is prepared. This needed presentation contract `C2-P4` (below).
- Coming back after a session finished. The design page's "Now" screenshot for this was wrong. That test fired the expiry timer before reloading, so the session had already been settled in the open tab. In a true cold open the stored session settles on load and its result already appeared. What was actually missing:
  - An ending settled while the page was open but hidden, followed by a reload within the hour, showed only the rest suggestion. It now shows the saved result and the finished scene (`standingFocusResult`), without replaying a line or animation.
  - A break suggested by a deadline more than 60 minutes before the page opens is retired to focus preparation. The threshold is `timer.restSuggestionStaleMinutes`, validated to 1–1440. Only the page's opening settle does this (`{ type: 'reconcile', opening: true }`), never a person's own command, so a just-chosen rest can't flip under their hand. The long-break count is unchanged.

### Focus polish

- The band above the room and the floor band under the card use the drawn wall and floor colours, so neither edge of the art shows a seam. The workroom floor is `#edcfaf` and the dusk floor `#c2b5b6`.
- Deeper secondary text: the secondary capsule uses each tone's deep accent (blue 3.70:1 → 5.43:1), 「＋ 这一小步」, note actions and the selected tab use the deep blue, and the phase label uses `#46546a`.
- The two timer capsules and 「给我一句鼓励」 draw at 40 px inside unchanged 44 px targets.
- The 「随手记」 label is gone. 「本段想法（n）」 is now a compact 44 px icon with a count at the end of the tools row. Its accessible name and title are unchanged. When it first appears, 「留个标记」 moves 26 px at 320 and 375 px, less than a third of its own width, so a quick second tap still lands on it. The row fits at 320 px without the hidden second line it had before.

### Accessibility and platform

- The thought field, the step field and the rest-length select use at least 16 px text, so iOS no longer zooms the page when they get focus.
- Opening Settings moves focus to its heading. 「回到专注」 returns focus to the 设置 button. 「查看结果」 on the Records banner moves focus to Focus's primary action. Settings and Records have their own document titles, and their titles are `h1`.
- Fields inside a panel keep an inset focus ring that the panel's scroller can't clip. Controls over the scene and the companion use a two-tone ring that shows on every sky.

### Companion motion

Two CSS rules in `companion-scenes.css`, an animation-owned file, fix eye motion. Closed or happy eyes no longer blink in the `R1` and `R3` rest scenes. A pause no longer freezes open eyes half shut. No geometry changed.

## Contract change

`C2-P4` (`src/contracts/presentation.ts`). While main keeps a saved result on screen, `companionSceneOf` keeps that ending as an `ended` scene after later cues. It reuses the settle cue that already played, or a stable `ending:<session>` id after a reload, so nothing replays or restarts. Ending motion still starts only for a fresh matching settle cue, so renderers need no change. Field shapes are unchanged.

## Not in this batch

- System Back from Settings or Records still leaves the app. It needs one history stack shared with `useFocusTaskBack`, which this batch didn't change.
- The open decisions listed above.
- Settings and Records polish (batch 3) and the motion work that needs the animation owner (batch 2).

## Verification

Environment: desktop Chrome 156.0.8078.80 on macOS, phone emulation. No physical iPhone or Safari.

- `tsc -b` passes. Vitest: 36 files, 392 tests, including new model tests for the stale break, the standing result, the shown-ending projection, the result readout and the art width cap.
- `npm run build` with the `/clock/` base passes.
- `npm run test:e2e` (scene, focus interactions, records companion, persistence, update and panels) passes: 395 checks, no browser page errors. Two expectations changed with intended behaviour: Records now has its own document title, and a tab opened within the hour of a finished session shows that result before 「准备专注」. Three checks that dismissed the first-launch note now assert that Focus shows none.

Measured in the dev build, 375 × 812 unless noted:

| State | Card top | Companion drawn width | Primary action | Notes |
| --- | ---: | ---: | --- | --- |
| Idle, before (batch 0) | 500 (visible card 544) | 485 | 26, 642, 157 × 44 | Empty reserved row inside the plate |
| Idle | 544 | 540 | unchanged | No empty band |
| Running after a mark | 500 | 540 | unchanged | Note row on the card; 「留个标记」 moves 26 px |
| Reading with a note | 456 | 540 | unchanged | Reader adds one row; controls unchanged |
| Result (F2) after a mark | 500 | 540 | unchanged | Flower stays; readout 「25分钟」 |
| Reload 26 min after a background settle | 544 | 540 | unchanged | Result and finished scene shown |
| Reload 2 h later | 544 | 540 | unchanged | Focus preparation, 25:00 |
| 320 × 568 after a mark | 256 | 135 | unchanged | Tools row fits; nothing hidden |

The smallest hit area on the plate was 44 px in every state measured. No console errors were logged.

Not verified: a physical iPhone, Safari's focus zoom, VoiceOver, and a battery or power measurement.
