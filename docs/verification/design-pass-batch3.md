# Design pass, batch 3: Settings, Records and the visual system

Batch 3 follows [batch 2](design-pass-batch2.md) at the owner's request of November 6, 2026 ("do batch 2 and batch 3 one by one; I want to check the final result"). It covers the main-owned polish from the [design pass](https://claude.ai/artifact/RhG9CnPzPA9zZzoE1rovEz). It deletes one never-run animation-owned style block and changes no artwork.

## What changed

### Settings

- Subheadings 「声音」 and 「伙伴」 inside the existing 「常用偏好」 card, matching the PRD's grouping. The duration legend stays 「默认时长（分钟）」.
- Switches draw at the standard 56 × 32. The whole row (52 px) is the target, so they no longer need to be drawn bigger.
- The duration hint is split. 「更改从下一段开始生效。专注页调过的时长会沿用到下次。」 sits above 「恢复默认时长」, and 「改这里的专注时长或恢复默认后，专注页回到这里的时长。」 sits under it. Both rules are kept word for word.
- On Settings and Records, text fades out above the floating tab bar instead of running into it, and focus and anchors scroll clear of the bar (`scroll-padding-block-end`).
- Entering Settings slides it in 24 px from the trailing edge over 260 ms, and 「回到专注」 fades Focus back in over 180 ms (`@starting-style`). Tabs stay instant. The screen changes synchronously in the same tap, so nothing waits and no tap can land on the screen being left. A View Transition was tried first and dropped: it runs the update a frame later, and in that frame the old screen still takes taps, which the end-to-end suite caught. With Reduce Motion or the app's motion setting off, the change is instant.

### Records

- The search row fits on one line: 「搜索」 no longer breaks into two stacked characters. The visible label is visually hidden but still labels the field; the placeholder carries it on screen. The field uses 16 px text, so iOS doesn't zoom.
- The selected filter uses the encouragement reader's quiet selection: a soft blue fill and a ring, without the solid fill and ledge. Filter weights drop from 750 to 600 (700 when selected). The 2 × 2 layout and the paging stay, as the PRD specifies.
- The summary keeps 「查看统计」 at the end of its row when the sentence wraps.

### Visual system

- Radius tokens: `--radius-card` (20 px) for cards and panels, `--radius-field` (14 px) for fields, filters, the status button, the room preview and the summary, and capsules for buttons. Records and Settings cards (22 px), panels (22 px), filters (15 px), the summary (16 px), the search field (12 px), the room preview (15 px) and the status button (14 px) now use them.
- Settings disclosure headings drop from weight 800 to 700.

### Motion

- Panels and dialogs rise in over 240 ms (`opacity` and `translate` from 8 px, `--ease-out`, via `@starting-style`). They still close at once, so focus return and controls never wait.
- Press feedback is added to the duration steppers, notice actions, Records filters, the room preview, record rows (a background change) and link buttons (opacity). Buttons in thought forms scale instead of moving down 2 px.
- With Reduce Motion or the app's motion setting off, pressed controls no longer scale. The old reset lost on specificity against the Focus pair, the tabs and 「给我一句鼓励」.

### Dead code

- The Records room's entrance animations (`records-lift-*`, `records-butterfly`, `records-follow`, `records-tilt-leaf`, `records-draw-book`) never ran, because the only caller passed `animate={false}`. The styles and the prop are removed, and the room preview stays still.
- The legacy whale `breathe` keyframes in `styles.css` are removed.

## Not changed

- Press scaling still shrinks a button's box by up to 4%. Scaling a background layer instead would need every button style restructured, so the approved press look stays.
- System Back from Settings or Records still leaves the app.

## Verification

Environment: desktop Chrome 156.0.8078.80 on macOS, 375 × 812 emulation. No physical device.

- `tsc -b` passes; Vitest passes 36 files, 397 tests.
- In the browser: opening Settings moved focus to the 「设置」 heading and titled the page 「设置 — Whale Focus」. 「回到专注」 returned focus to the 设置 button. The switch measured 56 × 32 and both subheadings rendered. The thought panel started at opacity 0, 8 px low, and settled within 300 ms. Records' 「搜索」 button measured 60 × 44 on one line. No console errors.
- `npm run test:e2e` passes: six suites, 395 checks, no browser page errors. `scripts/animation-review.mjs` passes 425 checks, with a 95th-percentile frame time of 16.7 ms and none over 50 ms.

Not verified: `@starting-style` in Safari on a physical iPhone (it falls back to an instant change where unsupported).
