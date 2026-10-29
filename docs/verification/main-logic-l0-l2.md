# Main logic L0–L2: implementation and verification

Date: 2026-10-29. Branch: `claude/main-logic-l0-l2`, based on `fb3f77f`. This is local main-logic work for review, not a deployment, and it does not approve the open product proposals in [PLAN.md](../../PLAN.md) §4. Animation-owned files were not edited.

## What changed

### L0: presentation contract `C2-P1`

- `src/contracts/presentation.ts` publishes the main → animation boundary. It contains a read-only `CompanionView`, a transient `PresentationCue` and explicit `CompanionCallbacks`. The types live in `src/logic/presentation.ts`.
- A cue has its own identity (`cue:<operation id>`), separate from the screen-reader announcement ID. Main emits a cue only for a fresh, announced, error-free result on a visible screen. Save-dependent kinds also need confirmed persistence; an explicit encouragement request does not, because it writes nothing. Restore, sync, stale, duplicate and hidden-screen results get no cue.
- The cue kinds are `welcome`, `begin`, `pause`, `resume`, `settle`, `rest`, `thought-saved` and `support`. None identifies a species, asset, reward or ranking.
- `src/contracts/presentation-fixtures.ts` generates 19 named fixtures by running the real reducer and feedback host: ready, start/pause/resume, full/early/zero endings, empty/text thoughts, rest start/end, requested encouragement, pending save, retry, restore, sync, stale result, hidden screen and motion disabled. A renderer can use them without a timer or storage. Their published outcomes are asserted in `presentation-fixtures.test.ts`.
- `useFeedback` now returns `cue` and `view`. The old `cueId` (which was the announcement ID) has been removed. `HomeScreen` passes `cue?.id` into the existing `BlueCompanion` prop, so the renderer's interface did not change.

### L1: F1 and data foundation

- Snapshot **v4**, with an additive migration from v3 that preserves IDs, totals, dates, unknown legacy starts and the paused/running state. It adds `session.step`, `record.step`, `lastFocusMinutes`, `thoughts` and `thoughtDraft`. A v3 build that opens v4 data treats it as newer and read-only, so thoughts cannot be silently dropped.
- An optional small step can be entered at start ("这一小步", UI10/UI11). It is normalized, never scored, and copied onto the record whether the session ends manually or at its deadline.
- One-off lengths: "换个时长" reveals `timer.quickChoicesMinutes` (5/15/25, configurable). An explicit choice is remembered in `lastFocusMinutes` and used by the primary button ("开始这段 · N 分钟"). The configured default does not change. When the user saves a new focus default in Settings, the remembered one-off length is cleared.
- End summary fix: action results (`UI30`/`UI31` recorded time, `UI32`/`UI33` thought saved, `UI36` rest ended) are now marked `status.result` and always appear alongside the encouragement. Manual and deadline endings are treated the same way.
- In Settings, an invalid duration is no longer silently reverted on blur. The range error stays visible with an explicit "恢复为 N 分钟" action, and the saved value is unchanged.
- New saved preference `encouragementEnabled` ("节点鼓励"). When it is off, event encouragement stops, but explicit requests still work. Older snapshots default to on without reporting a repair.
- The unused legacy `reaction`/`announcement` state was removed from `useClockApp`. The app still has a single live region.

### L2: thought capture

- Pure logic lives in `src/logic/thoughts.ts`, and the actions are in `src/logic/app.ts` (`markThought`, `saveThoughtText`, `saveThoughtDraft`, `discardThoughtDraft`, `putAwayThought`, `reopenThought`, `deleteThought`, `restoreThought`).
- "先记一下" saves an empty marker with one tap and does not open the keyboard. A thought taken during focus is linked to that session; a thought taken during rest or with no session is standalone. Neither adds focus time or participation. Opening the panel or saving never pauses or resumes the timer.
- "加一句" opens a text box. Text is attached to the latest empty marker created on this page. Draft text is written after typing pauses (600 ms), when the panel closes and when the page is hidden. A saved draft survives a reload, and saving the text clears the draft in the same write.
- Typed text stays on screen until its save is confirmed. A failed write shows ERR04 or ERR05, and a later successful write upgrades the status.
- An accidental double tap or held press creates one marker (800 ms coalescing in the hook). Repeated delivery of the same thought ID is idempotent in the reducer.
- Records shows each session's step and linked thoughts, plus a thought list that is not limited by date. That list supports put away/reopen and delete. Undo is available for the latest marker ("撤销这次记录") and the latest deletion ("撤销删除").
- Conflict rule: each thought carries a `rev`. The higher `rev` wins a merge, and at equal `rev` a deletion wins, so a stale tab cannot resurrect a deleted thought. An edit aimed at a deleted thought is rejected, and its text is kept as a draft for a new thought. Deleted text is kept for `thoughts.undoPeriodSeconds` (600 s) so the deletion can be undone, then cleared; the deletion marker remains. Thoughts from different dataset generations never merge.

## Checks run

- `npm run check`: strict TypeScript plus **230 tests in 19 files**, all passed. That is 37 more than the 193 at baseline: 13 tests for thoughts, steps and one-off lengths, 23 for contract fixtures and 1 for the encouragement preference. Existing tests were updated for v4.
- `BASE_PATH=/clock/ npm run build` passed (20 precache entries). `git diff --check` passed. Dependencies and the lockfile are unchanged.
- The production build was served at `/clock/` and checked in the Claude desktop app's built-in browser pane at 375 px. Flow checked:
  1. Typed a step and started a one-off 15-minute session.
  2. Double-tapped "先记一下", which created one marker linked to the session; the timer stayed running.
  3. Typed text and reloaded mid-draft. The draft was restored and still attached to the marker.
  4. Saved the text. It was stored on the same thought, the draft was cleared and the timer stayed running.
  5. Ended the session. "本段计时36秒。" was shown together with the encouragement.
  6. Records showed the step, the duration and the linked thought.
  7. Delete and undo restored the thought without changing totals.
  8. In Settings, an out-of-range 500 stayed visible with its error, and restore went back to 25.
- 320 px at 100% and 200% root text: no horizontal overflow, including with the duration choices open.
- The only console errors came from service-worker registration. The built-in pane refuses to fetch `/clock/sw.js` even though a plain fetch of it returns 200. PWA code was not changed in this work, so offline reopening is **unverified in this pass**.

## Not done or not verified

- L3 (day-grouped records, 7/30-day ranges, rewards/mementos, bookmarks and Collections) and L4 (backup, restore and clear-all) have not started.
- Thought-panel status text (UI34/UI35 and errors) is plain text; only note-saved results go through the main live region. Whether delete/undo results should be announced needs a review.
- Two real tabs were not driven in a browser. Cross-tab behavior is covered by the reducer/merge unit tests and the existing storage tests.
- Not checked: physical devices, real screen readers, the soft keyboard and 430 px.
- Animation follow-up, owned by the animation workstream: `useCompanionView`/`companion.ts` still derive cues from the announcement and pool. They can switch to the main-supplied `PresentationCue` and handle the new `pause`, `resume`, `rest` and `thought-saved` kinds.
