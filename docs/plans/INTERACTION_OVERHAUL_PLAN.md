# Interaction Overhaul Plan (PRD v26)

**Status:** revision 2, implemented and approved for publication on 2026-11-01. The owner approved the soft mockup ("Yes, keep it") and then asked for the overhaul to be implemented and pushed. Revision 2 below is authoritative. Revision 1 (the rest of this document) is kept as the analysis record; where it conflicts with revision 2, revision 2 wins.

## Revision 2 — what was implemented (2026-11-01)

Inputs:
- the owner's direction: the companion is the main frame; core actions are visible and done in place; only a custom length, writing a thought and confirming an end use a local panel; scene–button fusion is kept without ink-wash; quiet does not mean small or dull;
- CodeX's review (six corrections, all verified against the code);
- the approved mockup in [assets/interaction-mockups](assets/interaction-mockups/) ([before/after](assets/interaction-mockups/screens/compare-375.jpg)).

### Focus page

| Area | Implemented |
|---|---|
| Layout | Full-height page: the scene fills the space above a cream plate with rounded top corners, and the opaque tab bar sits below. The art keeps one crop (viewBox x 24–216, up to the support edge at y 171). It is sized by the art box (`min(available − top band, 88vw, 470px)`), so the creature is about 250px tall at 375×812, about 180px at 320×568 and about 280px at 430×932. The sky colour continues above the art for each setting (workroom, garden, dusk, plain). |
| Size jump | Removed. The ready creature uses the same rig scale and anchor as every scene (`scale(.75) translate(42 38)` in `BlueCompanion.tsx`), so starting, pausing and ending never resize or move it. This is the only change inside CodeX-owned art code, and it is a single wrapper with no restyle. |
| Plate | 34px tabular digits (30px on short screens), one status line, one row (5/15/25 chips + 「其他」, short/long rest chips, or a 6px progress bar), a single pill primary of about 220×44, light dot-text secondary actions, and one note line for receipts and save state. Visual sizes are small; every target is extended to at least 44px. |
| Primary | 「开始专注」 (25 minutes by default, one tap), 「暂停」, 「继续专注」 (warm colour), 「暂停休息」/「继续休息」 (mint), and 「休息 N 分钟」 after a focus session. One element, which keeps the press identity guard. |
| Secondary | Ready: 留个标记 · 写想法 · 休息一下. Running/paused: 留个标记 · 写想法 · 结束专注. Rest: 留个标记 · 写想法 · 结束休息. After a focus session: 再专注 N 分钟 · 换个时长 · 写想法. |
| Duration | The chips change only the prepared value. 「其他」 opens a local panel with −/+ and a whole-minute field (1–120); invalid drafts stay editable, with 「恢复上次值」. Enter accepts and never starts anything. The separate five-minute start and the `cards` layout are removed. |
| Small step | 「＋ 这一小步」 in the status line becomes an inline field. Enter or blur collapses it and never starts. |
| Local panels | `FocusPanel` (non-modal, `role="dialog"`) rests on the plate and docks above the soft keyboard. It holds the custom length, the thought editor (with the collapsible 「本段想法」 list) and the end confirm (「先不结束」/「结束并记录」). The time, pause and navigation stay visible and usable. |
| Feedback | The companion's line is a bubble in the sky. Requested encouragement shows 「换一句」/「收到鼓励了」 and 「换一种鼓励」 (the four categories) inside the bubble. Thought receipts, undo, 「补一句」, save errors with 「重试保存」, and the memory-only/read-only state use the note line. The elapsed time appears once as a sentence (「本段计时 … · 已保存」) and once as muted digits, rounded down to match. |
| Rest end | Ending or finishing a rest lands directly on focus ready (「休息好了 · 本次休息 …」). 「开始专注」 is one tap. |
| Header | The "Whale Focus" wordmark row is removed. Settings opens from the gear in the scene's top band and returns with 「‹ 回到专注」. Notices float above the page instead of pushing it down. |

**Final labels (owner, 2026-11-01).** The owner renamed these after the release:

| Earlier | Final |
|---|---|
| 结束这段 | 结束专注 |
| 先记一下 | 留个标记 |
| 写想法 | 写想法 (unchanged) |
| 加一句 | 补一句 |
| 按现在的需要选 | 换一种鼓励 |
| 收起 (encouragement bubble) | 收到鼓励了 |

The end panel's question follows the same naming: 「现在结束专注？」. Rest keeps 「结束休息」. The copy registry (`UI05`, `UI12`, `UI13`) and Records' 「补一句」 match. Functional labels in the thought panel now say 标记 instead of 记号 (「标记 1」, 「确认只留下标记」). The companion's own lines (`NME` pool) keep 记号 as reviewed copy. Revision 1 below still uses the earlier names as a record.

### Records and Settings

- **Records.** The 7/30-day switch updates only the summary and trend: loaded history, the expanded entry and the scroll position stay. History is one day-by-day list with 「加载更早」, 「已显示到 …」 and 「没有更早的记录了」. Day headings read 「今天 · 11月1日 周日」 and 「昨天 · …」. Rows show 「14:05–14:30」, or the end time only when the start is unknown, and show the save state only when it isn't saved. A thought written on another day keeps its date. The styling matches the soft pills.
- **Settings.** Same fields; header with back; soft card style.

### CodeX corrections applied

1. The companion is larger in every state, and the art box sets a minimum share before the controls.
2. Tap counts are reported honestly below; Settings typing already committed on blur.
3. Memory-only still allows timer and thought operations, and the note line says 「仅在此页」. Only read-only disables writes, which is how `canEdit` already worked.
4. 「留个标记」 is available in ready and rest states, creating an independent marker; only running/paused focus binds thoughts to the session.
5. The landscape layout puts the scene and plate side by side. Creature size is held constant by sharing the rig, not by identical bounding boxes.
6. Duration intent order: Focus picks record the count of default-length requests made in Settings. A delayed settings save clears only picks made before that request (`keepsDurationChoice`, unit-tested).

### Tap counts (from Focus, nothing open)

| Task | Before | Now | Kind |
|---|---|---|---|
| Start default 25 | 1 | 1 | same, clearer |
| Start 5 or 15 | 1 (5) / 3 (15) | 2 | 5: one more tap (single start, PRD v26); 15: fewer |
| Start 40 (one-off) | not possible without changing Settings | 3 + typing | new |
| Pause / resume / marker | 1 | 1 | same, never moves |
| End early | 2 (centred modal) | 2 (local panel, clock visible) | clearer |
| Rest after focus | 1 | 1 | same |
| Long rest after focus | 2–3 | 2 | fewer |
| Focus again after focus | 1 | 1 (「再专注 N 分钟」) | same |
| Focus after rest | 2 | 1 | fewer |
| Records 7→30 days | 1, list reset | 1, list kept | clearer |

### Not in this change

These remain open in revision 1 and the PRD:
- daily chapters (DAY05) and process gains;
- favourites and 我的收藏;
- mementos;
- backup, restore and clear;
- the 2-line clamp with a 「全文」 reader;
- the system-change tap guard beyond the existing press-identity guard;
- per-command pending states;
- real-device, screen-reader and soft-keyboard trials.

**Sources:**
- PRD v26: the user-supplied `番茄钟_产品PRD_v26.md` (5,643 lines; not yet copied into the repo, see M0), cited as L‹n›.
- Gap analysis rows: F‹n› for Focus, R‹n› for Records, S‹n› for Settings.
- The live audit of the current build at 375×812 and 320×640.
- Code maps of `afd95cf`, cited as `file:line`.

Chinese UI labels are quoted exactly. UI keys come from B.5 (L1948–2004), and error keys come from the error table (ERR05 at L2016, ERR11 at L2022). A label that is the plan's own wording is marked *(proposed)*.

## Summary

**What is wrong today.** At 375×812 the Focus page is about 834px tall and already scrolls.
- The countdown appears only in a 111×42 corner badge, about 450px above the button it belongs to. Pausing changes only a 10px word.
- When a session starts, the creature shrinks by 25% and jumps about 38px.
- About seven secondary controls styled as text links compete with the primary button. One of them is a second start button.
- Feedback is split between a speech bubble, a bottom slot and notices that push the page down. The ended state shows the elapsed time three times.
- Every panel is a centred modal that hides the clock.
- At 320×640, controls end up under the floating tab bar.
- On Records, the first entry starts around y≈600.

**Target experience.**
- The creature sits on one support edge (the "sill").
- The time and a single blue primary button sit on the sill's front face, in a fixed block that never moves.
- Each state shows only its own controls, in fixed slots, and frequent entries keep one position in every state.
- There is one feedback band and one local panel, and the panel never hides the time.
- Typical tasks need fewer taps: 15 minutes drops from 3–4 to 2, and the other rest type from 5 to 2.

**What stays.** The rough.js blue creature, its palette, line quality, poses, touch gestures and the 11-activity catalogue keep their drawing style. We only re-compose, crop, resize, re-anchor, re-time and reduce frequency.

**What is deferred.** These are deferred, and layout slots are reserved for them:
- daily chapters (DAY05) and process gains;
- favourites and mementos;
- backup and restore;
- the cat composition;
- chapter-based scene selection;
- the ink-wash restyle.

---

## 1. Sources and scope

### 1.1 PRD v26 sections used

| Area | PRD references |
|---|---|
| State and next-action table | L165–173 |
| RULE-START, DURATION, END, REST, NOTE, DRAFT, UNDO | L187, L191, L193, L201, L205, L219–234 (800 ms marker merge at L234) |
| Shell, panel, feedback, 1px and target rules | L643, L645 |
| Action lifecycle and local feedback | §5.1.1 L649–662 (no page-wide lock, L651) |
| Focus first screen, per-state table, time/primary relation | L668, L672–679 (rest "抬手时不误发下一次操作", L676) |
| Attention policy, support edge, motion budget | L703, L705, L713 |
| Medium (ink-wash, **overridden for this round**) | L719 |
| Records modes, summary and window | L739–780 |
| Settings; accessible name equals visible action | L824–826; L832 |
| Feedback priority table | L1617–1627 (real state events at L1620; 30 s rule at L1621; one line per 记下并返回 at L1622) |
| Fixed UI copy and the `{elapsed}` format | B.5 L1948–2004 (UI30 at L1983, `{elapsed}` at L2002) |
| Error copy | ERR05 (L2016), ERR11 (L2022) |
| Confirm and screen-reader labels | L2099 (「结束并记录」「暂不结束」) |
| Action IDs | ACT-A01–A14 (L2213–2226), B01–B15, C02/C03, E02 (L2330) |
| Tests | T-QF01–04 (L2886–2889), T-EN01–05 (L2899–2903), T-Q05/06/08/17, T-FQ01–11, T-BD01–03/13, T-UX01–24, T-REC set, T-PH set |
| Timer ring dossier | S04 (L1203–1217); L3294 allows a non-ring form |
| Retired start entries (v12) | L3710 |
| Stale appendix | A.1 (L954–957) |

### 1.2 Scope

**In scope:**
- The interaction model, controls, labels, state behaviour and layout geometry for Focus, Records and Settings.
- Placement, crop, size and anchoring of the existing artwork.
- How often motion plays and how long each beat lasts.
- Copy alignment to B.5 and the error table.

**Out of scope:**
- Any change to the drawing medium.
- Backend, accounts, sync, multiple characters, task trees and new reward mechanics.
- The chapter and story engine.
- Backup, restore and clear.
- An IndexedDB migration.

**The owner's instruction overrides PRD L719 for this round.** L719 confirms 写意水墨 (ink-wash) as the direction. This round keeps the current rough.js look, and M0 records this as a dated deviation directed by the owner.

### 1.3 Unchanged invariants (AGENTS.md)

- **Timing.** Timing is deadline-based. An expired session settles once, and nothing chains automatically.
- **Persistence.** Each change is one versioned snapshot written under a short Web Lock. The saved, pending, memory-only, read-only and failed states are shown truthfully.
- **Pure logic.** `src/logic/` stays pure: no React, DOM, clock or storage. Layout measurement lives in hooks and CSS, never in `src/logic`.
- **Ownership.** Main/animation ownership and the C2-P3 contract stay in force. Animation completion never saves, starts or gates anything.
- **Static renderer.** Main must pass every functional check with a static renderer or none.
- **Stack.** React 18, strict TypeScript, Vite, and the PWA base `/clock/`.
- **No snapshot change in the default plan.**
  - Every action maps onto the existing reducer actions (`src/logic/app.ts:19-20`) and the snapshot v7 fields.
  - `lastFocusMinutes` already accepts 1–120 (`app.ts:72,144`), and a settings reset clears it (`app.ts:185`).
  - `FocusRecord` and `Thought` store no time zone (`src/logic/types.ts:68-80,97-108`), and `startedAt` may be `null` for legacy records. Records time-of-day labels therefore follow D23, whose default keeps v7. Unknown legacy start times are never fabricated.

---

## 2. Diagnosis (ranked)

| # | Problem | Evidence | PRD |
|---|---|---|---|
| 1 | **The time is lost.** The countdown is only in a 111×42 corner badge (time 16px, status 10px). The badge overlaps the scene and sits about 450px above the primary. Pausing changes one 10px word. | Audit; `ClockBadge.tsx`, `focus.css:144-152` (F4) | L674, L679, A06 (L2218) |
| 2 | **The creature jumps.** The ready pose is drawn at 1×. Sessions use `scale(.75)` with the body at (42,38), so the creature shrinks 25% and moves about 38px right and 34px down. F4 (tea) moves it again, to (90,45). | `BlueCompanion.tsx:74-93` vs `CompanionSceneArt.tsx:129,172`; `scene-pose.ts:235,248` (F6) | L705, L713 |
| 3 | **The layout is unstable and feedback has two homes.** A 60px bubble and a 48px slot are both fixed-height and scroll internally. The marker receipt appears in both. Notices are inserted above `main`. The secondary row wraps or changes its item count. | `focus.css:136-138,179-182`; `CompanionFeedback.tsx:56` + `HomeScreen.tsx:206`; `App.tsx:76-87` (F13) | L643, L645, T-QF03, T-FQ09 |
| 4 | **Too many controls look the same.** There are about 7 link-styled 13px controls, and a second start, 「开始 5 分钟专注」. Mode switch, thought tools and start actions show together in ready and ended. `visibility:hidden` leaves the visible pair off-centre. | Audit; `HomeScreen.tsx:165-201`, `focus.css:31` (F1, F7) | L668, T-EN01, T-Q05, L3710 |
| 5 | **The page is taller than the screen.** It is about 834px at 375×812. At 320×640 and in Safari, rows sit under the floating tab bar. Empty fixed reserves of 60, 48 and 44px are kept anyway. | Audit (F14) | L643, L645 |
| 6 | **Panels hide the time.** There are six centred `<dialog>` modals with a backdrop. In the end confirm, 「先不结束」 sits in a far header corner. | `FocusTaskDialog.tsx`, `focus.css:183-208`, `HomeScreen.tsx:213,231-235` (F10, F15) | L643, A08, B04 |
| 7 | **Choosing a duration or rest is slow.** 15 minutes takes 3–4 taps through a modal. Any other length means changing the Settings default, which takes 6+ taps and changes future sessions. A long rest that is not suggested takes 5 taps. | `HomeScreen.tsx:183,214-221`, `pet-spec.json:30-34` (F2, F8) | L187–193, A01–A03 |
| 8 | **The result state is confusing.** Elapsed time appears three times. 「再开一段」 starts focus directly. After a rest there is a "rest ended" state whose primary only prepares focus; the real start is a 13px secondary. | Audit; `HomeScreen.tsx:122-127,193` (F11, F12) | L172, A09/A10, RULE-REST, E02, T-EN05 |
| 9 | **The small step needs a modal.** Setting it opens a modal. While running, it is a button that opens a modal showing text that is already visible. | `HomeScreen.tsx:159-162,230` (F9) | L1387, A04 |
| 10 | **The touch target is wrong.** The whole 292px character is a `<button>` that ignores pointer clicks. A fixed rect catches touch but does not follow the scene creature. | `CompanionFeedback.tsx:44-48`, `BlueCompanion.tsx:102` (F17) | B14, T-QF02 |
| 11 | **Records is slow to scan.** The first row is at y≈600. The 7↔30 switch filters the list and resets paging. There are three paging mechanisms. Dates are raw ISO strings with no time of day. Undo renders after the whole list. | `useViews.ts:88-92`, `StatsScreen.tsx:156,172-187` (R1–R6) | L739–780, C03.2, T-Q06 |
| 12 | **Settings writes on every tap.** Each ± tap is a separate write, so 25→45 is 20 writes. − and + sit at opposite edges of the row. The reset button is far from the durations. | `useSettingsForm.ts:78-82`, `focus.css:49-50` (S2, S3) | L824–826, T-UX08 |
| 13 | **One flag locks every control.** A single `canEdit` flag disables all controls, with no state per action. | `HomeScreen.tsx:30,159-185` | L649–652, L818 |

---

## 3. Target Focus page

### 3.1 Skeleton (portrait)

```
┌─────────────────────────────────────────────┐ safe-area-top
│ TOP BAND 44   [给我一句鼓励]   [写想法] [⚙]    │ same three slots in every state
├─────────────────────────────────────────────┤
│ SCENE TRACK (1fr) — slack collects at top   │
│   ART BOX (aspect 240:172, bottom-anchored) │
│   creature + props rest on the sill         │
╞═══ SILL LINE + remaining-proportion bar (4) ═╡ ← support edge
│ PLATE (sill front face, fixed per tier)      │
│   FEEDBACK BAND  (2 lines, fixed)            │
│   ROW 1   专注｜休息  /  计时中 / 本段计时… │
│   DIGITS  24:58   (tabular, fixed box)       │
│   ROW 2   这一小步 / 休息类型 / —             │
│   [        PRIMARY  开始专注 / 暂停 …       ] │
│   ROW A   5｜15｜25 · 其他时长  or  actions   │
├─────────────────────────────────────────────┤
│ TAB BAR (fixed)  专注 | 记录                  │ + safe-area-bottom
└─────────────────────────────────────────────┘
```

**Shell**
- **Grid.** The Focus root is a grid of height `calc(100svh − tab − safe-bottom)`, with rows `[top band] [scene 1fr] [plate]`. Use `svh`, not `dvh`, so the Safari toolbar collapsing never relayouts the page.
- **Tab bar.**
  - It is `position:fixed; bottom:0`, full width and opaque, replacing the floating pill (`focus.css:39-42`).
  - Every screen reserves its height plus `env(safe-area-inset-bottom)` as bottom padding (Focus in the grid; Records, Settings and Focus at 200% text in the document), so no content ever renders under it.
  - At 100% text the Focus document does not scroll, so the toolbar never collapses there.
  - On scrolling screens the bar follows the visual bottom when the Safari toolbar collapses. Focus's `svh` grid then leaves a strip of up to about 80px between the plate and the bar, painted in the plate tint so the sill block reads as continuous. No element moves.
  - The 「专注」 tab stays marked as current while Settings is open (C02).
- **Header.** Remove the "Whale Focus" header row (`AppHeader.tsx:5-13`, about 60px) and add a visually hidden `<h1>专注</h1>`. Keep the document title until a product name is decided.
- **Gutters.** 16px below 360 wide, 20px for 360–413, 24px from 414, plus `env(safe-area-inset-left/right)`.

**Why this order**
- The digits sit about 52px above the primary, so the two read as one block (L679, A06).
- The primary is in thumb reach.
- Duration chips sit in their own row **below** the primary. This keeps value-picking separate from Start (T-EN03), and the primary's y never depends on what Row A contains.
- The feedback band is the first row under the sill. Companion lines read as coming from the creature just above it, and receipts and errors with inline actions sit within about 110px of the primary.
- The alternative order, with chips above the primary, is decision D6.

**Fixed tracks.** Every track except the scene has a size that depends only on the height tier, text size and safe area, never on state or content. The scene track absorbs whatever is left (L679).

### 3.2 Tokens by height tier (H = app `svh`)

| Token | S (H<620) | M (620–759) | L (≥760) |
|---|---|---|---|
| Top band | 44 | 44 | 44 |
| Sill line + bar | 4 | 4 | 4 |
| Plate padding top/bottom | 4 / 8 | 6 / 10 | 8 / 12 |
| Feedback band (2 lines) | 44 | 48 | 48 |
| Row 1 (mode / status) | 44 | 44 | 44 |
| Digits box | 44 | 56 | 64 |
| Row 2 (subject) | 44 | 44 | 44 |
| Gap / primary / gap | 8 / 48 / 8 | 8 / 52 / 8 | 8 / 56 / 8 |
| Row A | 44 | 44 | 44 |
| **Plate total (incl. sill)** | **300** | **324** | **340** |
| Tab bar (+ safe-bottom) | 50 | 56 | 56 |
| Art box | min 112 tall, max 440 wide | same | same |

- Primary top = plate top + sill + top padding + band + Row 1 + digits + Row 2 + gap. That is +192 in tier S, +210 in M and +220 in L.
- Primary width: `min(320px, 100% − 2×gutter)`, centred.
- Art box: `inline-size: min(100cqw, 100cqh × 1.395, 440px); aspect-ratio: 240/172`, bottom-anchored. The `aspect-ratio` is reserved before rough.js paints.
- Creature height is about 0.69 × the art box height.

### 3.3 Budgets per viewport (portrait, CSS px; to be validated by the M1 mock)

| Viewport (safe top / bottom) | Tier | Top | Plate | Tab | Scene track | Art box | Creature | Primary y |
|---|---|---|---|---|---|---|---|---|
| 320×568 PWA (20/0) | S | 64 | 300 | 50 | 154 | 215×154 | ≈106 | 410–458 |
| 320×≈460 Safari | S | 44 | 300 | 50 | 66 → **art collapsed**, sill rule stays | — | — | 302–350 |
| 375×≈548 Safari | S | 44 | 300 | 50 | 154 | 215×154 | ≈106 | 390–438 |
| 375×667 PWA (20/0) | M | 64 | 324 | 56 | 223 | 311×223 | ≈154 | 497–549 |
| 375×≈664 Safari | M | 44 | 324 | 56 | 240 | 335×240 | ≈166 | 494–546 |
| 375×812 PWA (44/34) | L | 88 | 340 | 90 | 294 | 335×240 (54 slack) | ≈166 | 602–658 |
| 430×932 PWA (59/34) | L | 103 | 340 | 90 | 399 | 382×274 (125 slack) | ≈189 | 722–778 |

- **Check at 375×812.** The plate runs from 382 to 722: digits at 486–550, primary at 602–658 and Row A at 666–710.
- **Creature size.** Today the creature is ≈192px in ready and ≈144px in a session. The proposal keeps it at a constant ≈166px in every state.
- **Collapse rule.** Below a 112px art height the art is hidden (`display:none`) and a 1px sill rule remains. A hidden scene keeps the full control set (L713). Decoration shrinks first (L643).

**200% text (estimates):**
- Every fixed token becomes `max(token, n·lh + 8px)`, and the digits become `max(tier, 2.5rem)`. Labels may wrap to two lines. Track sizes are computed per text size, so states never drift at a given size.
- At 375×812 the plate is ≈410–455 and the art ≈110–160, so the art shrinks to its minimum or collapses. The page does not scroll.
- At 320×568 the art collapses and the page scrolls about 40–90px as **one** document scroll, never a nested one. At scroll 0 the primary is fully visible at about y 350–410, and Row A needs a short scroll. The fixed tab bar's padding rule from §3.1 applies.

**Landscape (H ≤ 500):**
- Two columns: the scene on the left, and on the right a 300–340px control column holding the top band, plate and Row A.
- The tab bar becomes a 56px left rail, so it costs width instead of height. The sill line runs across both columns at the plate's top.
- At 812×375 the art is ≈324×232 with a creature of ≈160. At 568×320 the art is ≈188×135 with a creature of ≈93.
- The rail-or-bottom-bar choice is decision D21, needed before M2.

**Soft keyboard:**
- The background grid never relayouts. The only input in the plate is the inline small step.
- When `visualViewport` shows the keyboard covering that row, the row lifts above the keyboard as a fixed overlay until blur.
- Panels follow §3.7.
- Do not rely on `interactive-widget=resizes-visual`. It is already Chrome Android's default.

**Font:**
- Keep the bundled Nunito Variable (`styles.css:3-7`).
- Preload it and use a metric-matched fallback (`size-adjust`), so the font swap never reflows the page.
- Geometry tests run after `document.fonts.ready`.

### 3.4 Time readout (replaces `ClockBadge`, main-owned)

| Element | Rule |
|---|---|
| Remaining-proportion bar | 4px along the sill line, full content width. The fill is the remaining fraction, anchored left. Neutral and full in ready; focus tone while running; dashed and frozen while paused; rest tone during rest; static in result. It updates once per second with no transition and is `aria-hidden`, because text carries the state. **It replaces the S04 ring (L1203–1217) and needs owner confirmation (D5).** The S04 acceptance carries over: full at start, half at 2:30 of 5:00, static when paused, empty at the end, never reversing, and clamped against device-clock changes. |
| Digits | `tabular-nums`, weight 700, size set by the tier. The box has a fixed width sized from the target string: 5ch for `mm:ss`, 6ch for 100–120-minute targets. The text is right-aligned inside it, so `100:00`→`99:59` never shifts a glyph sideways. The box itself is centred (L679). `role="timer"` keeps `aria-live=off`, so nothing is announced each second. |
| Result | Row 1 shows UI30 「本段计时{elapsed}。」 (e.g. "本段计时24秒。", "本段计时1小时5分钟。") or UI31 「已开始过这一段。」 for 0 s, as **visible** text followed by the save state. The live region announces it once. The digits box keeps its geometry and shows the same value as a muted, `aria-hidden` `mm:ss`, with the bar static and empty, so it does not read as time remaining. Elapsed time is now shown twice (Row 1 and the digits), down from three. Showing the digits alone is a B.5 deviation and is not proposed (D5). |
| Restoring | 「--:--」 in the same box. 25:00 is never flashed (L668, L672). |
| Paused | The digits keep full contrast in a paused tone. Row 1 shows a pause glyph and 「已暂停」. Together with 「继续专注」 these are the most prominent elements (A06). |

### 3.5 Per-state control inventory

"—" means the row is kept but empty, at the same height. Row A has a fixed number of slots in each state, and every label fits on one line at 320 with normal text.

**Fixed-slot rule.** 鼓励, 写想法 and ⚙ hold the same top-band positions in every state except restoring. 写想法 reads 「继续写想法」 when a draft exists. A frequent entry therefore never jumps between states (L643); the tradeoff is in D11.

| State | Top band | Feedback band | Row 1 | Digits | Row 2 | Primary | Row A |
|---|---|---|---|---|---|---|---|
| Restoring | ⚙ only | Reason only if slow or failed, + 「重试读取」 | 「正在读取…」 | `--:--` | — | 「开始专注」, disabled | Chips, disabled |
| Ready, focus | 鼓励 · 写想法 · ⚙ | WEL once (when built); UI36 after a rest; offline/update notices | Segment 「专注｜休息」 (A01) | Prepared value `25:00` | 「＋ 这一小步」 → inline input → 「这一小步：…」 | 「开始专注」 (UI02) | Radiogroup 「5 分钟｜15 分钟｜25 分钟」 + a separate 「其他时长」 button (shows 「40 分钟」 when a custom value is active) |
| Ready, rest | same | — | Segment, 休息 selected | `05:00` | Segment 「短休息 5 分钟｜长休息 15 分钟」, the suggested one tagged 「建议」 | 「开始休息」 (UI08) | 「其他时长」 |
| Focus running | same | UI29 on restore; STA once per start; UI32 + 「加一句」「撤销这次记录」; UI33; errors + 「重试保存」 (marker failure: ERR05 + 「重试记录」) | 「专注 · 计时中」 (UI27) | Remaining | The step as plain text, or 「目标 25 分钟」 | 「暂停」 (UI03), soft fill | 「结束这段」·「先记一下」 |
| Focus paused | same | UI28 on restore; PAU (first only, 30 s rule L1621) | ⏸ 「专注 · 已暂停」 (UI26) | Remaining, paused tone | same | 「继续专注」, solid | same |
| End confirm open | same | unchanged | live | live (keeps running or stays paused) | live | Still operable (pause or resume) | Unchanged; the confirm is in the panel (§3.7) |
| Focus result | same | END/ZER **only after save**; or ERR01 + 「重试保存」 | UI30/UI31 + 「· 已保存」 / 「· 正在保存…」 / 「· 未能保存」 | Elapsed, muted (§3.4) | Rest segment 「短休息 5 分钟｜长休息 15 分钟」, suggested one preselected (RULE-REST; long after every 4th natural expiry) | 「开始休息」 | 「准备下一段」 (UI45) |
| Rest running | same | UI29 on restore; BRK once per rest start | 「短休息 · 计时中」 | Remaining | 「短休息 5 分钟」 as text | 「暂停休息」 | 「结束休息」 |
| Rest paused | same | UI28 on restore | 「短休息 · 已暂停」 | Paused tone | same | 「继续休息」 | same |
| Rest ends or expires | → **Ready, focus** | UI36 「休息计时已结束。」 once; not replayed after dismissal or reload | — | — | — | Guarded (see notes) | — |

**Notes:**
- **Thoughts.** 写想法 is standalone outside sessions (RULE-NOTE, L167) and session-bound inside them, always from the same top-band slot. Result Row A holds only 「准备下一段」, so the result follows L172's next steps and T-Q05.
- **Markers during rest.** None, because B01 requires focus to be running or paused.
- **Restore copy.** In-app restore copy uses UI28 and UI29, and only for restored paused or running sessions (L1981–1982). Results use UI30 and UI31, and the rest end uses UI36. **UI43 and UI44 are system-notification strings (L1996–1997).** They are reserved for OS notifications, which are not built.
- **Mode segment.** Switching mode never starts anything and keeps each mode's prepared value for the visit.
- **Option rows.**
  - Each is a single-select `radiogroup` (「专注时长」) holding only the fixed values. Arrow keys move the selection, and Enter or Space selects and never activates Start.
  - 「其他时长」 is a **separate button after the group**, never a radio, so arrowing never lands on it.
  - When a custom value is active, no radio is checked, and the button shows 「40 分钟」 with `aria-pressed="true"`.
  - The selected state is a fill plus a check glyph, not colour alone.
  - At 320 the row is 3 × 64px + a 76px button.
- **Secondary actions** are outlined "quiet" buttons, 44px tall. They are visibly a different level from the primary and the chips, and no longer look like hyperlinks (L645).
- **The primary** is one element with one React key on the whole page. Only its label and fill change. Press feedback changes `box-shadow` only, never a transform (L713).
- **Primary guards.**
  - Keep the `TimerActionButton` identity guard (pointer-down to click) and the `detail > 1` guard (T-UX02).
  - **Add a system-change guard.** When the state changes without a user command (expiry, a restore, a sync from another tab), the primary ignores activations whose pointerdown came before the new label was painted, and all activations for 600 ms after it *(tunable, proposed)*. This covers L676 「抬手时不误发下一次操作」: a tap aimed at 「暂停休息」 just as the rest expires must not start focus.
  - Drop the `aria-label` override, so the accessible name equals the visible text (L832). For example, the time is read from the digits, not built into the label.
- **A pure mapping** `focusControls(view) → {topBand, row1, row2, primary, rowA[], feedbackPolicy}` in `src/logic/` makes the table exhaustive and unit-testable (T-Q05). It lands in M2 (§8).

### 3.6 Scene and companion placement (animation-owned, through C2-P4; style unchanged)

1. **One rig scale.**
   - Draw the ready creature inside the same rig the scenes use: `scale(.75)`, with the body at (42,38). The art box renders larger to compensate.
   - Acceptance: the creature's bounding box matches within 1 viewBox unit and 2 CSS px across ready, t=0 and the final frame of all 11 scenes, and the reduced-motion stills.
   - **F4 tea** (`scene-pose.ts:248`, body at 90,45): either move the table so the body stays at (42,38), or use an in-scene walk of 2 s or less from (42,38). A cut is not acceptable.
2. **Sill crop.**
   - Change the viewBox from `0 0 240 190` to `0 0 240 172` (rig y ≤ 229). The ground line (rig y 220 → 165) and every prop resting on it stay visible.
   - The orchard card's rounded bottom (rig y 231) is cut, so the card reads as a **window whose bottom edge is the sill**. This is L668's window-and-sill composition, made from the existing art with no redraw.
   - The mat (rig y≈238) loses about 9 units. Animation either accepts the crop or raises the mat.
   - Export `SCENE_ART_VIEWBOX {w:240,h:172}` and `SCENE_SILL_Y = 172`, and use `preserveAspectRatio="xMidYMax meet"`.
3. **Edge contract.** The creature and props stand on the sill with contact shadows. Nothing enters the top band or crosses below the sill. Extra height becomes slack above the art, never a bigger creature.
4. **Rendering size.** rough.js output is in user units, so the look is identical at 1.06–1.59 px per unit. Do not use `vector-effect: non-scaling-stroke`. Sketches are cached by seed and never redrawn on resize or on a timer tick.
5. **Hit area and touch.**
   - Every art node gets `pointer-events:none`. Remove the fixed rect (`BlueCompanion.tsx:102`) and the 292px wrapper button (`CompanionFeedback.tsx:44-48`).
   - Animation exports a pure `creatureBounds(frame)`, extending `src/logic/blue-touch.ts`. It updates only when a pose settles.
   - Main places one native `<button>` named 「摸摸伙伴」 over those bounds. It is at least 44×44 and never overlaps the band, the plate or the top band.
   - **The button only forwards input.** It passes `{phase: 'down'|'move'|'up'|'cancel', pointerId, point}` in art coordinates to animation through the C2-P4 callback `onCreatureTouch`.
     - Animation keeps the existing two-phase gestures (press and release, contact ring, cancel) and the `blueTouchKind` mapping: upper centre is pat, lower is squish, sides are high-five.
     - Keyboard activation sends `{phase:'tap', point:null}`, which animation maps to the existing keyboard response.
     - Collapsing touch to a single response is **not** proposed. If chosen, it would be an owner decision (D15).
   - It is **last in the Focus tab order**, with no visible hint and a visible focus ring.
   - It does not move during an active press, and it never writes data or advances the story.
6. **Plate surface (main-owned).** A flat surface in the scenery's ground tint with a 1px top rule in the soft-line colour. No texture and no animation.

**Interim (before C2-P4 lands):** main bottom-anchors the current SVG with `xMidYMax meet`, so the card's bottom sits on the sill line. Main works with the existing renderer and with a static one.

### 3.7 Local panel (replaces all `FocusTaskDialog` centred modals)

**General rules:**
- **One panel at a time.** It is anchored to the sill and grows upward over the scene track. Top corners are rounded and the bottom is square, so it "rests on the sill".
- **No backdrop.** A light veil covers the art only. The plate stays visible and live, so the timer is always readable (B04, A08).
- **Semantics.** The panel is a non-modal `role="dialog"` with a labelled heading.
  - Focus moves into the panel on open and returns to the opener on close.
  - Esc runs the panel's cancel action.
  - Closing never undoes an accepted command.
- **Attention.** While a panel is open, the creature holds a still pose (`allowBeats:false`, `HomeScreen.tsx:66`, already present). There is no catch-up afterwards (L703).
- **Compact mode.** It applies when a text field has focus and the keyboard covers the plate, or when the panel is taller than the scene track (200% text, collapsed art, or the thought panel in tier S).
  - The panel becomes `position:fixed` inside `visualViewport`, using the existing `--visible-top/--visible-height` logic moved into `useVisualViewport`.
  - The text area flexes, and the action row is pinned above the keyboard (L643).
  - A compact timer row appears at the top in this mode only: status · mm:ss · 「暂停」/「继续专注」.

**Panels:**

| Panel | Opened by | Contents | Close label |
|---|---|---|---|
| End confirm (≈132px) | 「结束这段」 | A line that depends on the state: 「计时仍在继续。结束后会记录实际计时。」 or 「计时已暂停。结束后会记录实际计时。」. Two side-by-side 48px buttons: the cancel (label per D9) and 「结束并记录」, which uses an ink tone, never blue. Initial focus and Esc go to the cancel. Neither button appears where the finger that opened the panel is, because the opener is in Row A below the plate. | Cancel (D9: 「先不结束」 / 「暂不结束」) |
| 其他时长 (≈196px in M/L; **≤132px compact layout in tier S**, so it fits the 154px scene track and never covers the digits) | The 「其他时长」 button | Stepper `[−][56px numeric input][+]` with adjacent controls, and the hint 「1–120 分钟」 (rest: 1–60 / 1–90). The digits preview the draft live (A02). An invalid draft (0, 121, 2.5, empty) stays editable and shows ERR11 「专注时长可以设为1到120之间的整数分钟。」 + 「恢复上次值」 inline. That action restores the value in effect before the panel opened, e.g. 40, not the default (L193). Rest ranges get their own line *(proposed, D9)*: 「短休息可以设为1到60之间的整数分钟。」 / 「长休息可以设为1到90之间的整数分钟。」. 「用这个时长」 stays disabled while the draft is invalid. Enter accepts and **never starts**. Accepting returns focus to the 「其他时长」 button, not to Start. Cancel, Esc or a tap outside restores the previous value (T-EN02). The primary is disabled while the panel is open. In tier S the heading sits inline with the stepper, and the hint and error share one line. | 「取消」 |
| 写想法 / 加一句 (≈210px) | The top band, or 「加一句」 in the band | See "写想法 / 加一句 panel details" below this table. | UI16 「回到这一步」 when a current step exists; UI17 「回到计时」 in a session with no step; 「返回」 outside sessions |
| 给我一句鼓励 (≈196px) | Top band | The line (2–4 lines). 「换一句」 replaces it in place. A collapsed 「按现在的需要选」 offers 4 categories. A slot for 「收藏这句」 is reserved and **not rendered** (B15). The companion turns once (B10). | 「收起」 |
| Reading (「全文」) | Band overflow | The full message | 「收起」 |

**写想法 / 加一句 panel details:**
- **Fields.** Field name UI14 「想法先放这里」, placeholder UI15 「想记什么都可以，也可以留空。」, a 「0 / 500」 counter and 「保存想法」.
- **本段想法 list.** A collapsed 「本段想法（N）」 list replaces the hidden 看本段想法 button (`HomeScreen.tsx:201`).
- **Ownership.** 「加一句」 binds to that marker's ID (RULE-NOTE). The thought belongs to the session that was visible when editing began, and expiry never closes the panel (T-FQ05).
- **Save failure.** The panel stays open with the error, 「重试保存」 and the text kept.
- **Closing without saving** keeps the draft, and the top band then shows 「继续写想法」.
- **Existing B07 / RULE-DRAFT states are kept in the panel** (copy in `focus-copy.ts:19-23`):
  - Draft conflict: switchDraft, with 「继续当前草稿」 / 「放弃草稿并切换」 / 「另写一条」.
  - Concurrent edit: 「另存为新想法」 / 「查看最新版本」.
  - Clearing an existing thought's text: 「保存后只留下记号。」 + 「确认只留下记号」.

The read-only step modal is deleted.

### 3.8 Feedback band (single slot, main-owned)

- **What it replaces:** the bubble (`focus.css:136-138`), the bottom slot (`focus.css:179-182`) and the notices above `main` (`App.tsx:76-87`).
- **Geometry:** fixed height, `overflow:hidden`, text clamped to 2 lines (L645). Overflow shows 「全文」, which opens the reading panel. There is no internal scrolling.
- **Inline actions:** at most two per message, each with a 44px hit area. For example, 「已记下一个标记。」 + 「加一句」 「撤销这次记录」 is about 270px and fits at 320. Marker taps within 800 ms merge (RULE-UNDO, L234).

**Priority (L1617–1627), extended in `feedback-host.ts`, highest first:**
1. A data error or unknown state, with 「重试保存」, 「重试读取」, or 「重试记录」 for a marker (ERR05).
2. Requested encouragement. It shows in its own panel, and the band is left unchanged.
3. Real state events (L1620): STA (start), END/ZER after save, BRK (rest start), UI36 (rest end), UI28/UI29 (restore). Each event has at most one line, which replaces the current line in place and never queues.
4. Item receipts: UI32, UI33, UI35.
5. Node lines for PAU/RES/BCK (pause, resume, hold, return): first occurrence only, with the 30 s rule (L1621). One 记下并返回 gets at most one line (L1622), and there is no BCK line after a save receipt.
6. Notices: offline-ready, and update-ready with 「更新」「稍后」.

**Rules:**
- A message of higher or equal priority replaces the current one in place. Nothing queues or replays.
- An error is never replaced by an unrelated success (L659).
- Success text shows only after the write is confirmed.
- **Update-notice placement is a design choice, not an AGENTS invariant.** Show it in the ready state only. Never reloading a running or paused session *is* the AGENTS PWA rule.
- **Announcements:** one main-owned live region (`App.tsx:115-117`). Visual cue identity stays separate from announcement identity.

### 3.9 Action lifecycle (L649–662)

- **Per-command state.** Each command has its own state: not accepted → accepted/pending → committed / conflict / failed / unknown. This replaces the single page-wide `canEdit` lock.
  - `useClockApp` holds a pending map keyed by command identity.
  - A pure `commandConflicts(pending, command)` in `src/logic/` decides which other controls to disable.
- **What gets disabled.** Only conflicting operations are disabled, for example a second end while an end is pending, or Start while a start is pending. Pause, resume and thoughts stay available during an unrelated pending save (L651, L818).
- **Where the state shows.** The pending, failed or unknown state appears locally: on the control (a busy glyph that keeps its label and width), and in the band per §3.8. Unknown states say so truthfully and offer 「重试读取」.
- **Read-only and memory-only** storage still disables writes globally, explained in Row 1 or the band.

---

## 4. Task flows: before and after

Taps are counted from the Focus tab with nothing open.

| Task | Now | Target | How |
|---|---|---|---|
| Start the default 25 | 1 | 1 | 「开始专注」. The digits already show 25:00 beside the button. |
| Start 5 | 1 (shortcut) | 2, or 1 after first use | Chip, then start. RULE-DURATION memory preselects the last started value on a cold open (`lastFocusMinutes`). |
| Start 15 | 3–4 (modal) | 2 | Chip, then start. |
| Start 40 | 6+, and changes the default | 3 + typing, one-off | 其他时长 → type → 「用这个时长」 → start. The default is never changed. |
| Small step, then start | 4 + typing (modal) | 2 + typing | Tap the Row 2 pill, type, start. Enter or blur only collapses the field. |
| Pause / resume | 1 / 1 | 1 / 1, same position | Paused is now unmistakable (A06). |
| Marker | 1 (receipt shown twice) | 1 | The receipt shows once, in the band, with undo. |
| Marker + words | 3 + typing | 3 + typing | 先记一下 → 加一句 → type → save, with the timer visible. |
| Write a thought | 2 + typing (modal) | 2 + typing | Same top-band slot in every state; the timer stays live. |
| End early | 2 (modal hides the clock) | 2 | Panel; the clock keeps running. |
| Rest after focus (suggested) | 1 | 1 | Primary 「开始休息」 |
| Other rest type after focus | 5 | 2 | Pick it in the Row 2 segment, then start. |
| Focus again after focus | 1 (direct start) | 2 | 「准备下一段」 → 「开始专注」 (A10, L172; D10) |
| Focus after a rest ends | 1 via the 13px secondary / 2 via the primary | 1 via the primary | The app lands in focus ready. |
| Long rest from ready | 4–5 | 3 | 休息 → 长休息 → 「开始休息」 |
| Yesterday's thought (Records) | 2–4 + scanning ISO dates | 2 | 「记录」 → expand the row under 「昨天 · 10月31日 周六」 |
| Edit a thought from Records | 4–5 (modal) | 4 | In place; focus returns to the entry. |
| Default focus 25→45 | 21 (20 writes) | 3 + typing (1 write) | ⚙ → type 45 → blur |

M9 turns this table into scripted E2E paths, so the improvements are asserted rather than claimed.

**Lifecycle cases:**
- **Same-visit tab switch.** Focus is exactly as it was left, because `HomeScreen` stays mounted (`App.tsx:93-96`).
- **Cold reopen with an active session.** 「正在读取…」 / `--:--` first, then the real state with UI29 or UI28. No start line is replayed.
- **Expired while away.** One static result (UI30, static ending pose), settled once.
- **Expiry under the finger.** A tap that lands as the state changes is absorbed by the system-change guard (§3.5).
- **Next day.** Ready with the remembered value and at most one quiet line. No recap and no "debt".
- **Read-only or memory-only.** The truthful state appears at Row 1's right edge or in the band. Nothing claims 「已保存」.

---

## 5. Records and Settings

### 5.1 Records (main; art sizes from animation)

| Track | Geometry | Behaviour |
|---|---|---|
| Sticky header | 44 + safe-top | Segment 「全部记录｜只看想法」 (+ 「我的收藏」 only when favourites exist, D19). A visually hidden `<h1>记录</h1>`. Each mode keeps its own anchor (object ID + offset, not `window.scrollY`) and its own expanded item. A reserved single-line status strip (see "Notices on Records" below this table). |
| Greeting band | 96; scrolls away; hidden in tier S and when 伙伴小场景 is off | The existing `RecordsGreetingArt`, with the creature at ≈76–80px (today about 50–70). Same entrance of 2 s or less. Fix the self-cancel caused by scroll restoration (`StatsScreen.tsx:103-105` vs `useRecordsEntrance.ts:15-16`). |
| Summary | ≈100, not sticky | 「近7天｜近30天」 + 「趋势」 (`aria-expanded`). The range in words, 「10月26日–11月1日」, and 「累计计时{elapsed}」 (UI38). It shows in every mode with 「只统计所选范围的计时」 (L747 interim). **Switching the window updates only the summary and trend.** Remove the list filter (`useViews.ts:88-92`) and the reset (`StatsScreen.tsx:156`). Keep loaded days, the expanded item and the scroll position. Ignore stale query results (T-REC19). |
| Trend | +≈160 | rough.js bars unchanged. Value labels on the 7-day view. 「以文字查看」 shows a table. Unknown days show as 「未知」, never 0 (C03.3). |
| Active session row | 52 | 「专注 · 计时中 · 剩 12:30」 + 「回到专注」 (navigation only, T-REC06). Not counted in the totals. |
| Day header (sticky) | 36 | 「今天 · 11月1日 周日」, 「昨天 · 10月31日 周六」, 「10月30日 周五」, with the day total on the right. Built from the stored `dateKey` (the captured zone), so dates stay stable after travel (pure `dayHeading`). |
| Collapsed record | min 64 | Line 1: 「14:05–14:30 · 25分钟」 from `recordIdentity` (time zone per D23). When `startedAt` is null (legacy), only the end is shown, 「14:30 结束 · 25分钟」, and no start is invented. Line 2: 「这一小步：…」 and/or 「2 条想法 · 晚上取快递…」 or 「1 个标记」. The save state shows only when not saved (「待保存」 / 「仅在此页」). One chevron style for every row type. **The repeated date and the 32px story token are removed.** |
| Thought row | min 64 | 「21:40 · 想法」 or 「21:40 · 标记」 + a 2-line preview, same chevron. Time zone per D23. |
| Expanded (one at a time) | auto | Facts (「手动结束」 or 「到时结束」, 「目标 25 分钟」), the step, and linked thoughts with **the same actions as 只看想法**: 「编辑文字」/「加一句」, 「收起」/「放回待看」, 「删除」 (R7). The story from its snapshot at `clamp(200px, 70%, 300px)` wide, about 2.5× today's 108px. |
| Edit | in place inside the item | Textarea, 「保存想法」, 「取消」, plus the B07 conflict states from §3.7. No 「再写一条」 in a history context (R8). On save the item returns to reading with focus on it (L778). |
| Delete / undo | in place | The row becomes 「已删除。」 + 「撤销」 (undo within 10 minutes) and keeps its position. Focus moves to the next item, then the previous one, then the container with an explanation (L780). Status no longer renders after the list (`StatsScreen.tsx:184-187`). |
| End of list | 48 | One 「加载更早」 by calendar day, plus 「已显示到 10月19日」. When everything is loaded: 「没有更早的记录了」. On a read failure: 「重试读取」 (saves use 「重试保存」, L818). Entries dated after today go in one labelled group, 「日期晚于今天」, and unknown dates are labelled separately. This replaces 再看几天, 查看更早记录 and the `<details>`. |

**First row position** (with the plan's own target, ≤400 at 375×667. T-Q06 sets no number; it asks only for a concise summary and a compact stream):
- 375×812: y≈44+44+96+100+36 = **320**, against about 600 today.
- 375×667: ≈**296**.
- 320×568 with the greeting hidden: ≈**200**.

**Notices on Records:**
- Results tied to one object stay in that row.
- The reserved strip in the sticky header carries:
  - persistent conditions (read-only, memory-only);
  - **background failures not tied to a row**, such as a session that expires and fails to save while the user is on Records. It shows ERR text + 「重试保存」 or 「重试读取」, is announced once, and is never replaced by an unrelated success.
- Transient global notices (offline-ready, update-ready) appear only in the Focus band.
- **Landscape:** a single column, max 560 wide, centred.

### 5.2 Settings (main)

- **Header.** 「‹ 专注」 (44) + 「设置」. The tab bar marks 「专注」 as current (C02). The same single-line status strip as Records sits under the header for background save or read failures (「重试保存」 / 「重试读取」) and for read-only or memory-only conditions.
- **Group 1, 常用设置.**
  - **Duration rows** for 专注 / 短休息 / 长休息, each with a right-aligned cluster `[−][56px input][+] 分钟` (152px, adjacent controls).
  - **Commit rules:**
    - A typed value commits on blur.
    - A burst of ± taps commits one legal, changed patch about 700 ms after the last tap.
    - A draft shows a dashed underline and 「待生效」. While writing it shows 「正在保存…」. Only a confirmed write shows as active (T-UX08).
    - A blur with the same value is a no-op (T-UX07).
  - **「恢复默认时长」** sits directly under the three rows with 「从下一段开始生效」. It is its own commit, and it also clears the one-off memory (`app.ts:185`).
  - **Toggles, each with a "what it affects" hint:**
    - 到时提示音, with 「试听」, which never simulates expiry and writes nothing (C08, T-UX23);
    - 伙伴动画;
    - 伙伴小场景, with the hint corrected to name Focus scenes **and** Records art (R11, D20);
    - 节点鼓励.
- **Group 2, 你的数据.** A factual explanation that data is stored only on this device. No backup or clear buttons and no locked placeholders this round.
- **Group 3, 应用信息.** A collapsible 「添加到主屏幕」, a collapsible 「关于伙伴与素材」 (provenance kept per AGENTS.md), and the version.
- **Errors** for a field appear inline beside that field and never cover Focus controls.

---

## 6. Motion and attention budget (re-timing, not restyling; animation-owned data)

| Moment | Budget |
|---|---|
| Start | One opening of 2.5 s or less into the first working pose, then still. |
| Running | **No persistent ambient loops**: no breathing or texture loop, no endless pour or stir. The working pose is still. Story beats last 3 s or less, one at a time, spaced 90–180 s apart (today `beatMinMs` is 60 s and `beatMaxMs` 90 s, `src/data/scene-motion.ts:10-11`). Beats play only while the page is visible and no panel is open. Hands end in contact or at rest, never mid-air (T-QF04). An optional blink at most every 8 s (D13). |
| Pause / resume | A set-down or pick-up of 1.2 s or less. Resume never replays the opening (A07). |
| End / expiry | One settle of 3 s or less, then a still result pose. Expired while away: a static pose with no replay. |
| Touch | Local pat, squish or high-five response of 0.8 s or less, returning to the current pose (B14). Stays expressive. |
| Panel, confirm, recovery, reading, error, hidden page, reduced motion | Discrete still poses only. No catch-up (L703). |

- **Data and timing.** Values live in validated animation data, and the thresholds stay 待验证 (L713). Rapid taps cancel stale beats, and timing never waits for a beat.
- **Acceptance.** A pure scheduler test over a 25-minute run must show at least 90% still time, beats of 3 s or less, and never two concurrent actions.
- **Owner review.** The owner reviews a `record-scene-motion.mjs` recording against L713's two gates: 「看得出属于同一个空间」 and 「首次用户可以直接找到暂停」.
- **Records.** The greeting entrance stays at 2 s or less, with no per-row animation (T-PH13).

---

## 7. Copy and label alignment (`src/data/focus-copy.ts`)

| Current | PRD key / source | Proposed |
|---|---|---|
| 开始专注 · {n} 分钟 | UI02 | 「开始专注」. The digits show the time, and the accessible name equals the visible text (L832). |
| 开始 {n} 分钟专注 | Retired at L3710 | Removed |
| 开始休息 · {n} 分钟 | UI08 | 「开始休息」, with the minutes shown in Row 2 |
| 再开一段 · {n} 分钟 | A10, L172 | Removed (D10) |
| 回到准备 / 回到专注准备 | UI45 | 「准备下一段」 |
| 选时长 / 选短休息 / 休息模式 / 专注模式 | A01–A03 | Inline chips; segment 「专注｜休息」; 「其他时长」 button |
| 专注中 (`HomeScreen.tsx:64`) | UI27 | 「计时中」 |
| (status while paused) | UI26 | 「已暂停」 |
| 继续 | UI04 「继续」 vs L674/A06/A07 「继续专注」 | 「继续专注」 (D9) |
| 留个记号 | UI12 vs ACT-B01 | 「先记一下」 (D9) |
| 补充文字 | UI13 | 「加一句」 |
| 先不结束 | A08 「先不结束」 vs UI07 「返回计时」 vs L2099 「暂不结束」 | D9 chooses one |
| 回到计时 (thought panel, always) | UI16 / UI17 | 「回到这一步」 with a step; 「回到计时」 without one; 「返回」 outside sessions |
| 结束休息 / 暂停休息 / 继续休息 | A12, A14 | Kept |
| 本段实际投入 X · 已记录 | UI30 / UI31 + a separate save state | Row 1 shows UI30/UI31 visibly + 「· 已保存」; the digits show a muted, `aria-hidden` `mm:ss` |
| 已记下一个标记 (twice) | UI32 | Once, in the band |
| (marker save failure) | ERR05 | 「这个标记还没记下来，可以重试。」 + 「重试记录」 |
| (rest-ended screen) | UI36 | 「休息计时已结束。」 once, in the band. UI44 is reserved for OS notifications. |
| Thought field labels | UI14 / UI15 | Field name 「想法先放这里」; placeholder 「想记什么都可以，也可以留空。」 |
| Small step | UI10 / UI11 | 「这一小步」; placeholder 「接下来，想先做哪一步？」; 80 code points |
| Invalid duration | ERR11 (L2022), L193 | 「专注时长可以设为1到120之间的整数分钟。」 + 「恢复上次值」. The rest variants are *proposed* (D9). |
| Whale Focus (header) | — | Removed (D16) |
| 摸摸蓝色伙伴 | B14 | 「摸摸伙伴」 |

---

## 8. Milestones

**Conventions for every milestone:**
- **Main owns:** contracts, App and root, screens, `focus.css`, `companion.css`, `CompanionFeedback.tsx`, feedback and copy.
- **Animation owns** (currently the CodeX workstream; main does not edit these files):
  - `BlueCompanion.tsx`, `CompanionSceneArt.tsx`, `CompanionScenery.tsx`, `RecordsArt.tsx`;
  - `src/logic/{blue-companion,blue-touch,scene-*}.ts` and `src/data/scene-motion.ts`;
  - `blue-companion.css`, `companion-scenes.css`, `records-art.css`.
- **E2E scripts ship with the UI change they assert.** `npm run test:e2e` (`package.json:13`) runs `scene-e2e.mjs`, `verify-focus-interactions.mjs` and `verify-records-companion.mjs`, and `.github/workflows/deploy.yml` runs it before the build.
  - Whichever milestone removes or renames a selector updates every script that uses it **in the same commit**. That includes `verify-scenery.mjs`, which is not in `test:e2e`.
  - Edits to `scene-e2e.mjs` that only change selectors are made by main and announced to the animation owner. Scene assertions remain animation's.
  - Selector owners:
    - **M2:** `.clock-badge` (`scene-e2e.mjs:195`, `verify-focus-interactions.mjs:129`, `verify-scenery.mjs:41`) becomes `[data-testid="time-readout"]`; 「开始 5 分钟专注」 (`verify-focus-interactions.mjs:80`) is removed.
    - **M4:** 「选时长」 (`verify-focus-interactions.mjs:73-79`, `scene-e2e.mjs:240`), 「休息模式」 (`scene-e2e.mjs:224`) and 「摸摸蓝色伙伴」 (`verify-focus-interactions.mjs:86`).
    - **M5:** 「回到准备」 / 「回到专注准备」 / 「专注模式」 (`scene-e2e.mjs:49`, `verify-records-companion.mjs:37`, `verify-scenery.mjs:127`).
- **The layout gate grows by milestone.** `scripts/verify-focus-layout.mjs --gate` is added to `test:e2e` in `package.json` in M2. Each milestone enforces only the states that exist after it, and stricter checks begin later in baseline (report-only) mode:

| After | States checked (strict) | Strict assertions | Still baseline-only |
|---|---|---|---|
| M2 | restoring, ready, running, paused, end confirm (old dialog), result, rest running/paused, rest-ended | Top band, digits box, primary and tab-bar rects ≤1px across these states; band height fixed; no `scrollHeight` change from feedback; nothing under the tab bar; ≥44 targets in the top band and on the primary | Row A rect, one-line Row A, and no page scroll at 320×568 (the old control sets wrap until M4/M5) |
| M4 | + ready-focus/ready-rest segments, ready 15, 其他时长 invalid draft, inline step | Row A strict in ready states; ≥44 for all ready controls | Row A in session and result |
| M5 | + new end-confirm panel, new result, rest end → ready + UI36 | All plate rows strict in every state; no page scroll at 100% text in every portrait viewport | — |
| M6 | + thought, encouragement and reading panels; compact mode | The panel never covers the digits (except in compact mode, which shows the timer row) | Soft keyboard (emulation only) |

- **Gate order:**
  1. unit tests;
  2. `npm run check`;
  3. `BASE_PATH=/clock/ npm run build`;
  4. `npm run test:e2e`;
  5. a production-preview pass at 320×568, 375×667, 375×812, 430×932, 200% text, landscape 812×375 and reduced motion, with a clean console;
  6. push to `main`;
  7. verify the Actions run and the Pages deployment separately.
- **Evidence** goes in `docs/verification/interaction-v26/<milestone>.md` with real browser versions. Desktop emulation is labelled as emulation (L895).
- **Rollback** is `git revert`. There are no runtime feature flags, because they would add a second layout to test against the 1px rule.

| M | Scope | Owner | Contract | Tests and PRD acceptance | Files |
|---|---|---|---|---|---|
| **M0** Decisions and docs | Record the answers to §9. Point AGENTS.md and PLAN.md at v26, with dated deviations: L719 style, RULE-SELECT kept as bags, the cat out of scope, A.1 stale. Link this plan (`docs/plans/INTERACTION_OVERHAUL_PLAN.md`) from PLAN.md. Preserve a v26 snapshot under `docs/handoff-20261101/`. | Main (docs) | — | Doc-only: link and diff review; no app tests | `AGENTS.md`, `PLAN.md`, `docs/plans/`, `docs/handoff-20261101/` |
| **M1** Harness and mock (no product change) | `scripts/verify-focus-layout.mjs` (Playwright): see "M1 measurement harness" below this table. A `scripts/verify-start-flow.mjs` skeleton (localStorage before and after, for T-EN01/02). A **static mock** of all Focus states at 320/375/430, built from real frames via `scripts/export-scene-storyboards.mjs`, so the owner can sign off positions and sizes before code moves. | Main (animation supplies exported frames) | — | The baseline reproduces the audit facts: ≈834px page, time ~450px from the primary, transform jump, notice push. Owner sign-off on the mock gates M2–M4. | `scripts/`, `docs/verification/interaction-v26/` |
| **M2** Focus frame | See "M2 Focus frame scope" below this table. | Main | C2-P4 only if `FeedbackFrame['placement']` collapses to one slot (update `presentation-fixtures.ts`). Main-owned CSS tokens `--sill-y` and `--plate-h` are documented in PLAN.md. | Unit: `feedback-host.test.ts` (priority; STA/BRK as tier-3 events; 30 s rule only for PAU/RES/BCK; no duplicate success; error not replaced by success; notice lowest); `focus-controls.test.ts` (inventory for the M2 states). E2E: the layout gate at the M2 level. Acceptance: T-QF03, T-FQ09, T-BD13 (≤1px for the frame elements), T-FQ10, T-Q09, L679. F14 at 320×568 is reported until M5. | `App.tsx`, `AppHeader.tsx`, `TabBar.tsx`, `Notices.tsx`, `ClockBadge→TimeReadout.tsx`, `screens/HomeScreen.tsx`, `components/focus/*`, `CompanionFeedback.tsx`, `focus.css`, `companion.css`, `styles.css`, `logic/{feedback-host,focus-controls,spec}.ts`, `hooks/useViews.ts`, `data/{focus-copy.ts,pet-spec.json}`, `package.json`, `scripts/{scene-e2e,verify-focus-interactions,verify-scenery,verify-focus-layout}.mjs` |
| **M3** Scene re-composition and motion (parallel with M2 after the M1 sign-off) | One rig scale for ready and all scenes; the F4 anchor fix; the 240×172 sill crop with the exported constants; pure `creatureBounds`; the touch-forwarding handler (pat, squish and high-five kept); the internal touch rect removed; `pointer-events:none` on all art; the motion budget (§6). Re-export the 44 keyframes and 47 contact drawings and refresh the `animation-review` baselines in the same change. Note the change in `ANIMATION_REFINEMENT_PLAN.md`. | Animation | **C2-P4**: `SCENE_ART_VIEWBOX`, `SCENE_SILL_Y`, `creatureBounds`, `onCreatureTouch({phase, pointerId, point})`, motion-budget parameters, `framing:'sill'`. Both sides review it before main consumes it. | Unit: creature bbox in ready vs every scene's t=0, final frame and reduced-motion stills (±1 unit); scheduler ≥90% still; F4 continuity; touch kind from forwarded points. E2E: scene assertions in `scene-e2e.mjs` and `verify-scenery.mjs` (selectors already moved by M2). Acceptance: T-QF01 (informal), T-QF02, T-QF04, T-Q08, T-PH03/09/10/12, and the L713 gates by owner review. | The animation-owned files listed above |
| **M4** Ready area | Mode segment; chip radiogroup with a separate 「其他时长」 button; 其他时长 panel (compact in tier S) with `validateDurationDraft(mode, draft, spec)` and ERR11 / 「恢复上次值」; inline small step (UI10/UI11, 80 code points); restoring placeholder; pure `src/logic/prepare.ts` for RULE-DURATION precedence (visit choice > last started > default). A hook holds the visit choice: it survives a trip to Records, is not persisted, and is cleared by a real default change or a reset, as the `durationResetKey` effect does today (`HomeScreen.tsx:69`). Verify that `startBreak` validates custom rest ranges (`app.ts:19-20`). Mount the 「摸摸伙伴」 button from `creatureBounds` and `onCreatureTouch` once C2-P4 lands, with a bounded fallback box until then. | Main | `focus.ts`: none. Snapshot v7 unchanged (D18). | Unit: `prepare.test.ts` (precedence; ranges; invalid draft kept; 「恢复上次值」 restores the pre-panel value, not 25; a same-value blur keeps memory, T-UX07; a real default change or reset clears the visit choice and one-off memory, L191; cancel writes nothing, T-BD01); `app.test.ts` (starting with 40 captures 40; 5→15 gives zero records, and confirming gives one 15-minute session and one participation). E2E `verify-start-flow.mjs`: T-EN01–03, T-UX01/02 (CDP IME commit, Enter, keyboard dismiss, pointerdown on a chip with pointerup on the primary, double tap, arrow keys never reaching 「其他时长」). Acceptance: A01–A05, A11, A13, T-FQ01. | `HomeScreen.tsx`, `components/focus/{ReadyChoices,CustomDuration,StepField}.tsx`, `hooks/useClockApp.ts`, `logic/prepare.ts`, `focus.css`, `scripts/{scene-e2e,verify-focus-interactions,verify-start-flow}.mjs` |
| **M5** Session, result and rest | See "M5 Session, result and rest scope" below this table. | Main | C2-P4 note: a break scene no longer maps to a visible rest-ended view, so its fixture resolves to ready. Coordinate with animation. | Unit: `focus-controls.test.ts` (each state shows only its own controls, T-Q05); `feedback.test.ts` (UI36 once, no replay on reload or sync); `command-conflicts.test.ts` (only conflicting commands disabled, L651). E2E: T-FQ02/06/07, T-BD02/03, T-UX04/05, T-EN05, the L209 path (8m + 3m pause + 2m = 10m, 0 full), T-PH03, **tap 「暂停休息」 at the expiry instant → zero new sessions and zero participations (L676)**, and result Row 1 visible text equals its accessible name (L832). Acceptance: A05–A14, E02. | `HomeScreen.tsx`, `components/focus/{SessionActions,EndConfirm,ResultSummary}.tsx`, `hooks/useClockApp.ts`, `logic/{focus-controls,feedback,command-conflicts}.ts`, `focus-copy.ts`, `scripts/{scene-e2e,verify-records-companion,verify-scenery}.mjs` |
| **M6** Writing and reading panels | Thought panel (timer row in compact mode, UI14/15/16/17, the 本段想法 list, drafts, and the B07 conflict, concurrent-edit and empty-marker confirmation states); marker receipts in the band, with ERR05 / 「重试记录」; encouragement panel; reading panel; `useVisualViewport`. The Records edit reuses the panel logic in place. | Main | — | E2E: T-FQ03/04/05, T-UX09–16 (799 vs 800 ms merge, L234), **B07** (switch, keep or discard draft; another tab edits first → 「另存为新想法」/「查看最新版本」; clearing text needs 「确认只留下记号」), T-PH08, T-FQ11, T-BD12, T-Q07, T-Q17, T-REC22, B04, B10–B13. Soft keyboard in emulation, marked unverified on devices. | `FocusTaskDialog→LocalPanel.tsx`, `ThoughtPanel.tsx`, `HomeScreen.tsx`, `StatsScreen.tsx`, `App.tsx:102-106`, `hooks/useVisualViewport.ts`, `focus.css` |
| **M7** Records | All of §5.1; pure `dayHeading` and `recordIdentity` in `logic/calendar.ts` (D23 zone rule; end-only label when `startedAt` is null); calendar-day paging with an exhaustion flag; per-mode anchors; the trend text table; the header status strip for background failures. The animation owner supplies art sizes: greeting band, expanded story, row tokens removed, and the `focus.css:90,111` vs `records-art.css:8-9` precedence resolved. | Main + animation (art) | None under the D23 default (an option-b v8 is its own milestone, M7b) | Unit: the window never filters the list; paging; labels stable across zones from `dateKey`; legacy null `startedAt` gives an end-only label. E2E `verify-records-companion.mjs`: T-Q03/04/06/07, T-REC05/06/07/09/10/19/20/21/22/24, and an expiry save failure while on Records shows in the strip with 「重试保存」. New `verify-records-scale.mjs` with 1,000 and 10,000 synthetic sessions (L800). T-REC23 is partial (no favourites) and reported as such. Never called "the complete records page" (L856). | `StatsScreen.tsx`, `RecordEntry.tsx`, `WeekChart.tsx`, `hooks/useViews.ts`, `logic/{stats,calendar}.ts`, `App.tsx` (RecordsVisit); animation: `RecordsArt.tsx`, `records-art.css` |
| **M8** Settings | §5.2: groups, adjacent stepper, pending vs active, batching, reset placement, 「试听」, corrected scene-toggle hint, header status strip. | Main | None (D20 avoids v8) | Unit: `settings.test.ts` (a same-value blur is a no-op; reset clears the defaults plus the one-off memory). E2E: a ± burst gives one write; the preview writes nothing; a background save failure shows in the strip. Acceptance: T-UX07/08/23, C06–C08 (C09 deferred). | `SettingsScreen.tsx`, `hooks/useSettingsForm.ts`, `logic/settings.ts`, `adapters` (audio preview), `focus.css` |
| **M9** Integrated acceptance | All gates; the §4 tap counts as scripted paths; the C.2 status table for the 52 ACT IDs (implemented / reference-tested / adaptation / later); the T-UX01–24 matrix (T-UX19–22 deferred); a pass on physical iPhone Safari and Android Chrome (keyboard, safe areas, installed PWA, VoiceOver/TalkBack, background expiry); a first-time-user check for T-QF01 and the L713 gates, in the users' own words; PLAN.md §2/§9 updated. | Both | — | Acceptance L882: 主控可找, the scene and controls belong to one space, and long text never pushes the main control away. Only real-device and real-user checks are labelled "verified". | `docs/verification/interaction-v26.md`, `PLAN.md` |

**M1 measurement harness.** `scripts/verify-focus-layout.mjs` has two modes: `--baseline` records the current failures and never fails, and `--gate` is switched on in M2. It measures, for each state × viewport × text size × orientation:
- the rects of the primary, tab bar, top band, digits box and Row A;
- `scrollingElement.scrollHeight`;
- whether every interactive box is at least 44×44;
- `elementFromPoint` at each control's centre;
- the computed `pointer-events` of every SVG node.

**M2 Focus frame scope:**
- **Shell:** the `svh` grid shell; the fixed tab bar with padding on every screen, and 专注 marked current in Settings; the header removed.
- **Plate:** the top band (鼓励 / 写想法 / ⚙); the plate with fixed rows; `TimeReadout` (bar + digits box + `data-testid`); the single feedback band with its priority; notices routed out of the page flow; the `LocalPanel` container, with no users yet.
- **Control inventory:** pure `focusControls(view)`, used for the existing control sets. Row A keeps today's actions until M4/M5 replace them, and the M2 gate subset applies.
- **Dead CSS to remove:**
  - `focus.css:24,34-38,58,130,154-156`;
  - `styles.css:161-286`;
  - `blue-companion.css:3` (done through animation);
  - the duplicate `.record-summary` margins.
- **5-minute shortcut and `cards` variant removed (D2):**
  - `App.tsx:26`, `HomeScreen.tsx:56,165-181`, `focus-copy.ts:8`;
  - `quickFocusMinutes` in `pet-spec.json:29` **and** `spec.ts:53,251` **and** `useViews.ts:15,47`.
- **E2E:** move the M2 selectors as listed under the conventions, and add the gate to `test:e2e`.
- **Renderers:** works with the current renderer and with a static one.
- **Kept:** do **not** delete `RiceBowls`/`WhaleChan`. `useCharacter.test.ts:4,43` uses them, and they are out of scope.

**M5 Session, result and rest scope:**
- The primary stays in place, with the system-change guard (§3.5).
- Row A secondaries become outlined buttons.
- The end-confirm panel: wording depends on the state, the cancel label follows D9, and the primary stays operable.
- The result: UI30/UI31 visible in Row 1 with the save state, muted digits, the rest segment, 「准备下一段」, and END/ZER only after save.
- Rest flows: a rest end goes to focus ready + UI36, and the rest-ended view is deleted (`HomeScreen.tsx:122-127,193`).
- The per-command lifecycle (§3.9): the pending map and pure `commandConflicts`, replacing the single `canEdit` lock.

**Optional M7b (only if D23 option b is chosen).** Snapshot v8 adds `timeZone` to `FocusRecord` (copied from `Session.timeZone` at the end) and to `Thought` (captured at creation), with these safeguards:
- its own commit;
- migration tests (legacy rows keep no zone and use the D23 fallback);
- newer-version read-only protection for v7 tabs;
- multi-tab checks;
- forward-only migration.

**Sequencing:**
- M0 → M1 → (M2 ∥ M3) → M4 → M5 → M6 → (M7 ∥ M8) → M9.
- Main milestones never block on M3, because they run against the current or a static renderer.
- M3 must land before M5's result and rest states are judged visually.

---

## 9. Decisions needed from the owner

**[Supersedes]** marks items that replace an AGENTS.md or PLAN.md v5-era default or a recorded decision. **[Deviation]** marks items that depart from PRD v26.

1. **D1 Product source [Supersedes AGENTS "Current product source: v5", PLAN §1].** Adopt PRD v26 as the interaction source and keep v5 and v3 as historical snapshots. *Default: yes.* v26 is the current PRD, and this plan's gaps are measured against it.
2. **D2 Five-minute shortcut, `cards` variant and first-use 5-minute emphasis [Supersedes AGENTS "explicit five-minute shortcut… first-use five-minute emphasis", PLAN §4].** *Default: remove all three, and 5 becomes an ordinary chip.*
   - L3710 retires 首次5分钟主推 and 双启动卡, and T-EN01 requires exactly one 「开始专注」.
   - The cost (5 needs 2 taps instead of 1) is offset by RULE-DURATION memory.
3. **D3 Style [Deviation from L719].** *Default: keep the rough.js style this round and record the ink-wash deviation with a date* (the owner's instruction).
4. **D4 Scene content [Supersedes, in part, the orchard-workroom framing in PLAN/COMPANION_SCENERY].** *Default: keep the orchard art, re-framed by the 240×172 crop as a window over a sill, and draw no new cup, book or succulent props this round.*
   - No new art is needed, which keeps the risk inside the style constraint.
   - Alternative: redraw the L668 props in rough.js as an M3 follow-up if the L713 gate fails.
5. **D5 Timer form [Supersedes the PLAN §4 decision that the clock stays a separate badge; adapts PRD S04].** *Default: large tabular digits on the plate plus a 4px remaining-proportion bar along the sill; retire the ring. In result, UI30/UI31 stay visible in Row 1 and the digits are a muted supporting value.*
   - L3294 permits a non-ring form, and the S04 acceptance carries over to the bar.
   - Alternative A: a small remaining ring beside the digits.
   - Alternative B, a **[Deviation from B.5]**: digits only in result, with UI30 as the accessible name only. This is not recommended, because it breaks L832 and `00:24` can be misread as time remaining.
6. **D6 Ready row order.** *Default: chips below the primary* (thumb reach, T-EN03 separation, primary y independent of chip content). Alternative: chips between the digits and the primary, closer to the value they change.
7. **D7 Panel container.** *Default: one local panel resting on the sill, with no backdrop, docking above the keyboard. The end confirm also uses it, with the primary still operable. 其他时长 has a compact layout of 132px or less in tier S.*
   - This keeps the time readable (B04, A08, A02), and the destructive button never appears under the finger that opened the panel.
   - Alternative: swap the end confirm into the plate in place.
8. **D8 Feedback.** *Default: one fixed 2-line band as the first plate row; remove the speech bubble; route Focus notices into it, with the update notice shown in ready only; a header status strip on Records and Settings for background failures.*
   - L643 requires one shared slot.
   - Showing the update notice in ready only is a design choice, not an AGENTS rule.
9. **D9 Labels.** *Defaults:*
   - 「先记一下」 (UI12) over 留个记号.
   - 「继续专注」 (L674/A06/A07) over UI04 「继续」, to pair with 「继续休息」.
   - End-confirm cancel: 「先不结束」 (A08), over UI07 「返回计时」 (too close to UI17 「回到计时」) and L2099 「暂不结束」 (the screen-reader row). Choosing 「暂不结束」 instead keeps L2099 literal. Either way, the visible and accessible names stay equal.
   - 「结束休息」 (A14).
   - 「写想法」 / 「保存想法」.
   - UI16 / UI17 for the panel's return label.
   - UI32 for the marker receipt.
   - ERR05 「重试记录」 for marker failures and 「重试保存」 for other saves.
   - ERR11 with 「恢复上次值」 for focus. The new rest-range wording (「短休息可以设为1到60之间的整数分钟。」 / 「长休息可以设为1到90之间的整数分钟。」) is a copy decision.
10. **D10 Result next step [Supersedes PLAN §4 "another session secondary"].** *Default: the primary is 「开始休息」, with the short/long segment in Row 2 (the suggested one preselected); Row A has 「准备下一段」; the direct 「再开一段」 is dropped.* This follows A10 and L172. Starting focus again takes 2 taps.
11. **D11 Placement of the 写想法 entry.** *Default: one top-band slot in every state except restoring, also used for 「继续写想法」. It does not appear in Row A.*
    - This keeps a frequent entry from moving between states (L643) and keeps the result focused on L172's next steps.
    - Cost: during a session the entry is at the top, out of thumb reach, while 「先记一下」 stays in Row A for one-tap capture.
    - Alternative: Row A in sessions and top band otherwise, which moves the entry about 600px between states.
12. **D12 Rest end.** *Default: remove the rest-ended screen and land in focus ready, with UI36 「休息计时已结束。」 shown once and the system-change guard on the primary.* This follows RULE-REST, E02, T-EN05 and L676. UI44 is reserved for OS notifications.
13. **D13 Running motion [Supersedes PLAN §2 "persistent ambient loops"].** *Default: no running loops; beats of 3 s or less, 90–180 s apart; at least 90% still; a blink at most every 8 s; all tunable data.* This follows L713 and T-QF04. Touch and exploration stay expressive (R9).
14. **D14 Physical contact [Supersedes PLAN §4 option A "nudge an edge on start"].** *Default: no real control moves or deforms, and press feedback is a shadow change only.* This follows L713 「首版不搬动真实按钮」. Contact parameters stay 待验证.
15. **D15 Character touch.** *Default: a native, keyboard-reachable 「摸摸伙伴」 button sized to `creatureBounds`, last in the tab order, with no visible hint. It forwards pointer phase and position, so animation keeps pat, squish and high-five.*
    - This keeps today's touch and keyboard pat (B14, L645) while fixing the 292px target.
    - Alternative, not recommended: a single response for every touch.
16. **D16 Header, tab bar and Settings entry.** *Default: remove the "Whale Focus" row; put the gear in the top band; use a fixed tab bar with reserved padding; mark 「专注」 as current in Settings.*
    - This frees about 60px and fixes F14 and F21.
    - Provenance stays in Settings, and the name is still undecided.
17. **D17 Node encouragement.** *Default: on by default.* STA/BRK are one-per-event state lines, and PAU/RES/BCK fall under the 30 s rule, below errors, results and receipts.
18. **D18 Rest one-off memory.** *Default: none.* RULE-DURATION applies to focus only, and this avoids a snapshot v8.
19. **D19 Records.** *Defaults:*
    - Hide 我的收藏 until favourites exist. This is an owner choice; L745 only forbids pending-unlock slots inside it.
    - Keep the summary in every mode, labelled.
    - Remove the per-row story token.
    - Greeting band at 96px, hidden on short screens.
    - Expanded story up to 300px wide.
    - Mode bar and day headers sticky; the range control not sticky.
20. **D20 Records art toggle.** *Default: no new toggle; correct the 伙伴小场景 hint to name both surfaces.* It can be split later together with the memento toggle, a split that would need v8.
21. **D21 Landscape.** *Default: two columns with a left navigation rail.* Alternative: keep the bottom bar, at the cost of the art collapsing at 320px height.
22. **D22 Scope [Supersedes nothing; records deviations].** *Default: interaction and layout only.*
    - Scene selection stays the bag model (AGENTS "all eleven scenes… bags"), not RULE-SELECT (L327–329).
    - DAY05 and the cat composition (L705) are out of scope.
23. **D23 Time of day in Records [Supersedes nothing; affects the snapshot].** Records and thoughts store no time zone today.
    - *Default (a): format times in the device's current zone and keep v7.* Day headers still come from the captured `dateKey`. When a row's device-zone date differs from its header day, as after travel, the time carries its date, e.g. 「10月31日 23:40–00:05」, so a row never looks as if it belongs to another day. 「关于记录」 notes that times use the current zone.
    - *Alternative (b):* add `timeZone` to `FocusRecord` and `Thought` in a separate v8 milestone (M7b), with migration and protection for older tabs.
    - In both options, a null `startedAt` shows the end time only.

**Needed before:**
- D1–D5 and D22 before M0/M1.
- D6–D8, D16, D17 and D21 before M2.
- D13–D15 before M3.
- D9 and D18 before M4.
- D10–D12 before M5.
- D19, D20 and D23 before M7/M8.

---

## 10. Deferred and reserved slots

Reserved slots are laid out now. Nothing is shown as a locked placeholder.

| Deferred item | Reserved slot | Until built |
|---|---|---|
| Daily chapters: DAY05 「清出窗边的小桌」, DAY61/DAY04, RULE-STORY/SELECT/CONTINUITY (L310–329, L843; DAY05 alone is 3–6 person-days, L870) | The scene above the sill (constant creature anchor); a continuation hint 「接着…」 in the band, ready only, lowest priority (L161) | Current bag activities; no hint |
| "What this session left", 短章小记 / 完整章页, 过程所得 (L304, L314–317, T-PH14) | A one-line caption in the result's Row 2 area, under the rest segment, when there is content | Omitted, never blank (L333) |
| Story snapshot with origin and "look back" (L261, L770) | The expanded record's story area | The existing saved story |
| 收藏这句 / 已收藏 / 取消收藏 (B15, UI21–23) | The encouragement panel's action row, right of 「换一句」 | Not rendered |
| 我的收藏 mode (UI24, L745) | Third segment of the Records mode switch | Hidden (D19) |
| Welcome note WEL (L351), mementos, long-term illustrations (the 3/8/20 thresholds stay research only) | The band on first open; a Settings memento toggle (C09) | Not built |
| Backup, preview-replace, clear (D04–D07, T-UX20–22; still P0 in PLAN.md) | The Settings 你的数据 group, previewed in place | Explanation text only |
| Second composition, the cat at a bowl on a step (L705, DAY62) | The sill and primary geometry are constants independent of the scene | Out of scope; conflicts with "no multiple characters" |
| 写意水墨 restyle (L719) | Same rig, crop and contract, so a future medium swaps only the art | rough.js kept (D3) |
| Records time zone per entry | M7b (v8), if D23 (b) is chosen | Current-zone labels (D23 a) |
| Records search, month jump, filters, CSV (L851, L923); IndexedDB (L3696) | — | Not planned |
| OS notifications using UI43/UI44 | — | Not built |

---

## 11. Risks and verification

### 11.1 Risks

| # | Risk | L / I | Mitigation |
|---|---|---|---|
| R1 | Layout regressions across states, viewports and text sizes bring back the "mediocre positions" complaint | H / H | M1 baseline, then the gate in `test:e2e` from M2, tightened by milestone; fixed tracks; owner sign-off on the mock before code moves |
| R2 | A chip, Enter or an expiry-time tap falls through to Start, creating an unintended session and participation (T-EN03, L676) | M / H | Chips in a separate row below the primary; 「其他时长」 outside the radiogroup; primary disabled while 其他时长 is open; `TimerActionButton` identity guard plus the system-change guard; CDP IME, Enter, pointerdown/up and expiry-instant tests |
| R3 | The iOS keyboard hides the inline step field or a panel's Save | H / M | `useVisualViewport` lift and panel docking; emulation labelled as such; real-device check in M9 |
| R4 | Main and animation edit the same files, or E2E scripts break across the parallel M2/M3 | M / H | Per-milestone path lists, including scripts; main makes selector-only edits in the same commit and announces them; layout shared only through main-owned CSS tokens and the reviewed C2-P4; M3 handed to the animation owner |
| R5 | The rig and crop change invalidates the 44 keyframes, 47 contact drawings and review baselines | H / M | Re-export in the same M3 change; review diffs attached as evidence |
| R6 | The Pages deploy fails because E2E scripts lag behind UI labels | M / M | Selector owners named per milestone; run `test:e2e` locally before pushing; verify the Actions run |
| R7 | An optional v8 (D18, D20 or D23 alternatives) makes a revert unsafe | L / H | Defaults avoid it. If chosen: its own commit, migration tests, newer-version read-only protection for v7 tabs, multi-tab checks, forward-only |
| R8 | The single band double-announces or drops errors, or a background failure has nowhere to show off Focus | M / H | Pure priority function with tests; one live region; an error is never replaced by a success; the Records/Settings status strip; screen-reader pass in M9 |
| R9 | The reduced motion makes the companion feel lifeless (L866: static is not success) | M / M | Touch (pat, squish, high-five) and exploration stay expressive; only passive running motion is cut; the owner reviews a recording at M3 |
| R10 | The orchard crop does not read as "one space" with the plate (L713 gate) | M / M | Mock review first; fallback per the D4 alternative as a contained M3 follow-up |
| R11 | Records slows at 10,000 sessions once the list is no longer filtered by window | M / M | Calendar-day paging limits DOM size; thresholds in the scale script; virtualise only if measured |
| R12 | Delivery wording overclaims ("complete", "verified") | M / M | Evidence separates emulation from devices and partial from full coverage (L856, L895, L899) |
| R13 | A font swap or `aspect-ratio` gaps cause more than 1px of drift | M / M | Nunito preload with a metric-matched fallback; tests after `fonts.ready`; `aspect-ratio` reserved before paint |
| R14 | Replacing `canEdit` with per-command state lets conflicting commands run together | M / H | A pure `commandConflicts` with exhaustive tests; reducer-level guards stay authoritative; stale-identity tests |

### 11.2 Verification matrix

**Viewports:** 320×568, 375×667, 375×812, 430×932, 568×320 and 812×375, with text at 100% and 200%, and motion on and reduced.

**States** (the milestone that introduces each one into the gate is in brackets):
- restoring; ready 25; running; paused; result saved; result with an injected save failure; rest running; rest paused [M2];
- ready 15; ready rest; 其他时长 with an invalid draft (including tier S compact); small step editing [M4];
- the end-confirm panel; rest end → ready with UI36; a tap at rest expiry [M5];
- the thought panel (including the B07 states); the encouragement panel; band messages (marker + undo, marker failure + 「重试记录」, a long clamped message, offline-ready, update-ready) [M6];
- Records and Settings background failure in the status strip [M7/M8].

**Assertions** (growing per the §8 gate table):
- The primary, tab bar, top band, digits box and (from M4/M5) Row A rects stay within 1px across states for each viewport and text size.
- `scrollHeight` does not change because of feedback.
- `elementFromPoint` at each control's centre returns that control, and nothing sits under the tab bar.
- All art has `pointer-events:none` except 「摸摸伙伴」.
- The creature bbox stays within ±2px between ready and each scene's t=0.
- Every target is at least 44×44.
- Result Row 1's visible text equals its accessible name.

**Other checks:**
- Keyboard-only use, a screen reader (one announcement per result, no countdown), Chinese IME, and a grayscale or scene-masked run (T-QF02).
- Physical devices are recorded separately, with versions. Until then everything is reported as "emulated" or "reference-tested", never "verified".
