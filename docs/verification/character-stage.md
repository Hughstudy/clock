# Focus screen: character stage (main-owned layout)

Date: 2026-10-29. Branch: `claude/character-stage`. Local work for review; not deployed.

## Direction

The user asked for less emphasis on words and the clock and more on the character: a playful creature the user can touch, with a clock somewhere in the scene rather than at its centre. This is a layout and composition change only. The character, its touch responses and base animation are CodeX's committed result `a5709e7` (`codex/blue-companion-touch`), merged unchanged. CodeX's uncommitted work in its own worktree was not included.

## What changed (main-owned files only)

- `HomeScreen.tsx`: the companion is now a large stage. The intro heading, the footnote and the large dial are gone. The clock is a small `ClockBadge` in the top-right corner of the stage, showing the time, a thin progress ring and the phase/status. It keeps `role="timer"` and the spoken label.
- `CompanionFeedback.tsx`: new `quietStatus` option. On Focus, routine timer status ("计时中", "准备好时…") is left to the badge. Encouragement, recorded-time results, thought results and persistence errors still appear.
- The speech bubble overlays the creature's lower half and grows upward, so the controls never move when a phrase appears. The visible "给我一句鼓励" invite text is visually hidden; it remains the button's accessible name.
- The optional small step is a "＋ 这一小步" chip that turns into a one-line input in the same fixed-height row. Start, Pause and Resume therefore stay in the same place across ready, step entry, running and ended states.
- `TimerDial.tsx` was removed (now unused); the related rules in `focus.css` were pruned.

## Checks

- `npm run check`: 238 tests in 20 files passed. This includes CodeX's touch tests.
- `BASE_PATH=/clock/ npm run build` passed.
- Built-in browser pane, production build at `/clock/`, 375×812:
  - Tapping the creature played CodeX's touch reaction and showed a phrase.
  - The primary button's top stayed at 497 px in the ready, step-open, running and ended states, and when a bubble appeared.
  - After an ending, the bubble showed "本段计时1秒。" together with the phrase.
- 320 px at 200% text: no horizontal overflow. The bubble stayed inside the stage and covered more of the creature, but no controls.

## Not done or not verified

- The first synthetic click after a page load in the preview pane sometimes did not register. This was not investigated, and real touch devices were not tested.
- Not checked: a real screen reader, the soft keyboard, 430 px and the rest-phase visuals.
- Stale preview tabs that were still open on the same origin rewrote old data after `localStorage` was cleared by hand. Because they held a higher revision, one of them replaced a session that had just started in another tab. This happens only when storage is wiped outside the app, but L4 clear-all must advance `datasetGeneration` rather than rely on emptying storage.
- Contact between the creature and the clock badge or buttons (shared-surface scenes) needs anchors that main does not expose yet.
