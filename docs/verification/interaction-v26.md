# Interaction overhaul (PRD v26) — verification

Date: 2026-11-01. Scope: the revision-2 interaction overhaul described in [INTERACTION_OVERHAUL_PLAN.md](../plans/INTERACTION_OVERHAUL_PLAN.md). Every check was run in desktop Chrome with mobile viewport emulation. **No physical-device, screen-reader or real soft-keyboard trial has been done**, so those remain unverified.

## Automated checks

| Check | Result |
|---|---|
| `tsc -b` (strict) | pass |
| `vitest run` | 354 tests pass. New tests cover duration intent order and custom-length drafts (`logic/prepare.test.ts`), day headings (`logic/calendar.test.ts`) and the elapsed clock (`components/format.test.ts`). |
| `BASE_PATH=/clock/ npm run build` | pass; 20 precached entries |
| `scripts/scene-e2e.mjs` (Chrome 156.0.8078.74) | 60 app checks, 30/30 touch fixture checks and 67/67 scene checks pass. Includes the start/pause target staying fixed, no horizontal overflow at 320/375/430 or at 200% text, the primary staying on screen at 200% text, reduced motion, offline reload and a single live region. |
| `scripts/verify-focus-interactions.mjs` | 22 checks pass. The ones that cover new behaviour are listed below. |
| `scripts/verify-records-companion.mjs` | 48 checks pass. The ones that cover new behaviour are listed below. |

`npm run test:e2e` used `SCENE_BROWSER_CHANNEL=chrome`, because the local Playwright headless shell is not installed. CI installs its own Chromium. `scripts/verify-scenery.mjs` was updated for the new selectors but was not run; it is not part of `test:e2e`.

### New focus-interaction checks

- Choosing a chip changes only the ready display.
- An invalid custom length stays editable and never starts.
- Escape returns focus to 「其他」 and keeps the choice.
- A marker and its undo do not move the primary or the tab bar by more than 1px, or change the page height.
- 「加一句」 opens from the 本段想法 list inside the thought panel.
- A failed save keeps 「重试保存」 reachable without moving the controls.
- Ending a rest lands on a one-tap 「开始专注」.
- A held 「暂停」 released after expiry cannot start the suggested rest.

### New Records checks

- History keeps older days while the summary counts only the window.
- The list ends with 「没有更早的记录了」.
- Switching to 30 days changes only the total and its dates, and keeps the expanded entry.
- A thought written on another day keeps its date, e.g. 「10月24日 · 跨日想法」.
- Historical dates are read from day headings, so they survive travel.

## Manual browser review (emulated)

| Viewport | Observed |
|---|---|
| 375×812 | Ready, running, paused (warm), end-confirm panel, result (mint, 「休息 5 分钟」 · 「再专注 25 分钟」), rest, rest end → ready, 「其他」 panel with invalid and valid drafts, thought panel and Records. The creature keeps the same size and position across ready, running and result. |
| 320×568 | Every control is visible above the tab bar; the creature is about 180px tall. |
| 430×932 | The creature is about 280px tall; the plate is unchanged. |
| 812×375 landscape | The scene is on the left and the plate on the right. |
| 430×850 at 200% text | No horizontal overflow. Rows wrap and the art shrinks first. |

Screenshots are in [interaction-v26/](interaction-v26/):
- [ready](interaction-v26/ready-375.png)
- [running at 320](interaction-v26/scene-320.png), [375](interaction-v26/scene-375.png) and [430](interaction-v26/scene-430.png)
- [200% text](interaction-v26/text-200.png)
- [Records](interaction-v26/records-375.png)

The approved mockups and the before/after comparison are in [plans/assets/interaction-mockups](../plans/assets/interaction-mockups/).

## Found and fixed during review

- **Hidden scroll in the scene.** Focus restoration could scroll the clipped scene box by 82×42px. It now uses `overflow: clip`.
- **Primary colour on hover.** The primary kept a blue hover fill while paused. Colours now come from per-state variables.
- **Elapsed digits rounding.** Result digits rounded up (00:10) while the sentence said 9 秒. Elapsed digits now round down.
- **200% text.** The plate column grew past the viewport. Rows now wrap and the digits row grows.

## Not verified

- **Physical devices.** iPhone Safari and Android Chrome, the installed PWA, safe areas and the real soft keyboard (panel docking uses `visualViewport` and is untested on devices).
- **Assistive technology and real users.** VoiceOver/TalkBack, and first-time user observation for the PRD L713 gates.
- **GitHub Pages deployment.** Recorded separately after push.
