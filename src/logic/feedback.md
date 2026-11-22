# Feedback and copy module

The pure reducer in `feedback.ts` turns committed app events into one status line, at most one encouragement phrase and at most one announcement. `feedback-host.ts` feeds it from the real timer model, and `src/hooks/useFeedback.ts` connects that host to the app. Animation never supplies facts.

## Content and random selection (2026-11-22)

`src/data/encouragement.zh-CN.json` contains 177 versioned entries: 56 eligible automatic lines (RET/STA/END/BRK: 12 each, ZER: 8), 96 requested lines (24 per category), and 25 retained legacy tool lines that no longer trigger automatically. Fixed interface/error text remains separate. The [PRD catalog](../../docs/prd/09-encouragement.md) mirrors every runtime entry.

The owner explicitly requested direct random selection, not editorial order or a shuffled bag. The hook obtains a fresh crypto-derived seed on each mount; the pure reducer advances a deterministic PRNG only when it selects a phrase. It filters by pool, state and facts and excludes only that pool's immediately previous ID. It may repeat a phrase before using the entire pool. Reloading resets this ephemeral state and may coincidentally choose the same first phrase. Tags and length metadata do not impose selection order. No display history, mood or random state is persisted.

The parser validates IDs, versions, states, facts and tags, rejects markup/duplicates, and requires at least two universally usable requested phrases per declared state. Pool sizes and light/deep order are not hard-coded.

## Event mapping

| Event | Optional phrase | Preconditions |
| --- | --- | --- |
| Initial ready-page entry | RET | Existing saved focus participation/record or rest memory; visible, saved, enabled, no active session, no standing focus result; at most once after successful initial recovery per mount; any intervening interaction cancels it |
| Focus start | STA | Committed running focus |
| Focus end | END / ZER | Committed ready result, actual nonnegative elapsed; zero also needs saved participation |
| Rest start | BRK | Committed running rest |
| Pause/resume, note save, rest end | None | Functional status only; existing semantic animation cues remain independent |
| Explicit request/change | Selected ASK category | User request; a new request defaults to ASKG; reading never auto-rotates |
| Tick, restore, synchronization, navigation | None | Restore facts without replaying missed speech or consuming a random draw |

Automatic selection shares one 30-second cooldown, updated only when an eligible line is selected for an available surface. Hidden pages and covered local panels consume the operation without consuming a draw/cooldown or queuing speech. Explicit support bypasses this cooldown. Automatic text leaves when navigation, a local panel, technical trouble or Focus chrome takes over; calling the card back never replays it. Requested text survives temporary editing and confirmation, and errors remain truthful.

The host keeps this memory above navigation. Event IDs deduplicate logical results; a failed operation can succeed once on retry without a new ID. Initial greeting is presentation only and writes no timer, scene, reward or history state.

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
