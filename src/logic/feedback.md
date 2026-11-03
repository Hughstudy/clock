# Feedback and copy module

The pure reducer in `feedback.ts` turns committed app events into one status line, at most one encouragement phrase and at most one announcement. `feedback-host.ts` feeds it from the real timer model, and `src/hooks/companion/useFeedback.ts` connects that host to the app. Animation never supplies facts.

## Content

`src/data/encouragement.zh-CN.json` holds only the copy the app uses: node phrases, requested phrases, fixed interface strings, errors and the welcome note. Text for features that are not built yet (welcome and return phrases, records views, mementos, new content and their interface strings) stays in the [PRD snapshot](../../docs/handoff-20261102/番茄钟_产品PRD_v35.md); add it back along with the feature that uses it.

`src/data/encouragement.ts` validates the catalog at import. The parser checks structure rather than total counts: unique IDs, known pools, states, facts and tags, no template or markup, and a complete rotation for each pool the reducer can pick from. Node pools rotate 01 to 05. Requested pools follow `ASK_ORDER` and never repeat a phrase back to back.

## Event mapping

| Committed action | Event | Required facts beyond current phase/status |
| --- | --- | --- |
| New focus session | `focus-started` | saved, focus running |
| Pause/resume | `paused` / `resumed` | saved, corresponding focus state; rest uses functional text only |
| Manual/deadline end | `focus-ended` | saved, ready, true elapsedMs; zero additionally needs participationSaved |
| Empty/text note save | `note-saved` | saved, actual hasText; no per-keystroke events |
| Start/end rest | `break-started` / `break-ended` | saved and matching rest/ready state; no earned-rest condition |
| User asks/changes phrase | `encouragement-requested` | user origin; missing category always means ASKG |
| Tick/state refresh | `reconcile` | current facts only; never selects a new phrase |
| Close phrase | `dismissed` | clears the current phrase without a goodbye or warning |

Event IDs identify individual logical results, not just the session. A retry of the same failed write keeps its ID, so the saved result can still appear once. Recovered or cross-window events use `origin: restore` or `sync`, which restore functional status without replaying encouragement.

Keep `FeedbackMemory` above page routing so a remount retains the current phrase and cursors. Do not serialize it as a mood profile.

## Truthful status and accessibility

`persistence` is an actual operation result, never assumed saved. Saving, pending, memory-only and read-only all suppress node encouragement and show the technical status first. An explicit request for encouragement still works, because it writes nothing.

`result.announcement` is emitted once for a newly handled action. Duplicate delivery and ticks return null. The app has one live region, owned by `App.tsx`.

## Rendering

`companionPresentation` exposes semantic stances and optional cues without species or reward identifiers. Zero, short and full endings have identical presentation. Errors have a neutral static stance. Reduced motion removes cues without changing copy. `CompanionFeedback` is the pat button around the character. It never starts or pauses time, writes storage or awards content.

Quote favorites are a separate contract: see `src/contracts/favorites.ts`.

## Verification on 2026-10-29

Historical record of the original isolated module. Its counts and bookmark notes describe that version, not the current trimmed catalog.

The module was checked on top of F1 commit `4e7c9d50261af0b81a880716a36a691ede3b004f`, without modifying F1 files or dependencies. `npm run check` passed strict types and 166 tests in 14 files, including 49 new module cases. `BASE_PATH=/clock/ npm run build` and `git diff --check` passed. A direct extraction comparison confirmed all 136 IDs/texts match PRD revision 7 exactly. The ordered ID/text map (JSON with sorted keys, UTF-8, default JSON spacing) has SHA-256 `6579d82d7522f7f159e13cd84a99e5e3d9b0423517b288c90941f23b1aca85ef`.

An isolated Vite production harness rendered the actual exported component and reducer in Chromium 153.0.8010.0 with synthetic events. Start/pause, equal zero/one-second ending presentation, failed-save priority, explicit support alongside failure, silent paused recovery and node-off/requested-on flows passed. Widths 320/375/430 had no horizontal overflow; 320px at 200% body text retained the complete long phrase, wrapping controls and keyboard operation. Enter changed the phrase with focus retained; reduced-motion mode remained static; there was one live region and no console/page errors. Screenshots were inspected, including the long phrase at 200%. Noto Sans SC was supplied only by the test environment; no font dependency/CDN was added to the app.

These are isolated-module checks. Actual page wiring, live screen-reader listening, bookmark/reward persistence and real iPhone/Android acceptance remain integration work. A main-app build passing does not mean this as-yet-unmounted module is present in its production bundle.
