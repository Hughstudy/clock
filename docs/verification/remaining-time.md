# Editing the remaining time in a session

The November 23, 2026 change starts from `746926ea6bcf7b6aef26acae46ff28a4a683df3b`. The owner selected the in-session edit from the [timer interaction review](../prd/22-timer-interaction-research.md). The [product rule](../prd/02-features.md#adjust-remaining) covers running and paused focus, short breaks and long breaks.

## Accounting and recovery

The timer keeps its original session ID, start, zone, thought links and initial duration. On acceptance the new total is the elapsed running time plus the chosen whole minutes. A running session gets a new deadline. A paused session keeps the new remainder until an explicit resume. The limits of 120, 60 and 90 minutes apply to the entire session. Settings and the remembered focus start value keep their own values.

Snapshot v11 reads v10 clocks and history with their existing duration. An edited session stores its initial plan, and an edited record retains its final plan and actual time. The original activity timeline also survives a reload. Shortening the countdown leaves the companion at its reached pose. After extending beyond the original activity length, the completed activity can rest in place.

## Checks

- Timer and storage tests exercise exact elapsed milliseconds, pause and resume, recovery before and after expiry, repeated edits, mode-specific limits, competing schedules and write retries. They check that a shortened focus session counts once on natural expiry and that a manually ended session contributes only its actual time.
- View and presentation tests exercise shortening and extension at the same elapsed instant, recovery of the ending pose, focus history, and the original duration used to select companion copy.
- A production build with the Pages base of `/clock/` passed. Vite reported its existing 500 kB chunk-size advisory.
- `npm run check` passed strict TypeScript and 558 tests in 41 files. The local production end-to-end suite passed in Chrome 157.0.8103.80. Its Focus interaction suite also passed all 123 checks with the new cases included. They cover 320, 375 and 430 CSS pixels, 200% text, restricted height, the tucked clock, keyboard focus, reload, expiry during editing and a concurrent change in another tab.
- In a separate production-browser fault run, rejecting the Web Lock preserved the typed value and canceling it kept the original deadline through automatic retry. Failing the storage write after acceptance and retrying 12 seconds later persisted the same session and the already accepted deadline.

If storage keeps rejecting writes, one tab can provisionally finish a shortened session and explicitly start a successor while a second tab extends the original. When storage recovers, the saved schedule wins for the original and its provisional expiry is discarded. The later session keeps its actual time, ID and notes. Its historical interval can overlap the original in this case. An adapter regression test covers that recovery.

Browser validation uses desktop emulation. Physical devices and screen-reader testing remain open.
