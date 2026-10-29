# T30 companion/copy module

This is an independently testable module, not a claim that encouragement, bookmarks or rewards are already connected to the app. It does not modify the existing central hook, timer, storage, pages, mascot or public F1 contracts. The integration owner maps committed business results into its input types.

## Content

`src/data/encouragement.zh-CN.json` preserves the PRD v3 §7.10 revision 7 text and IDs: 80 node phrases, 56 requested phrases (24 deep candidates), 44 fixed UI strings, 14 error strings and the welcome note. All copy retains `reviewStatus: candidate`. Each phrase carries its pool, level, allowed states, required facts, semantic tags, copy version and collectibility. No duration, participation threshold or character identity is determined by this file. The new generic technical fallbacks in `feedback.ts` also need normal product copy review.

The data adapter `src/data/encouragement.ts` validates the catalog at import and supplies it to the pure reducer; the logic layer never imports data. Nodes rotate 01–05. Requested pools rotate 01,09,02,10,03,11,04,12,05,13,06,14,07,08. Cross-pool semantic clashes skip to an eligible alternative; if none exists the functional status remains. Static record/memento copy is cached and never announced or redrawn because a date or filter changed.

## Event mapping for the integrator

| Committed action or view | Event | Required facts beyond current phase/status |
| --- | --- | --- |
| Initial/returning ready view | `welcome` | initialized; firstVisit supplied by host; no active session |
| New focus session | `focus-started` | saved, focus running |
| Pause/resume | `paused` / `resumed` | saved, corresponding focus state; rest uses functional text only |
| Manual/deadline end | `focus-ended` | saved, ready, true elapsedMs; zero additionally needs participationSaved |
| Empty/text note save | `note-saved` | saved, actual hasText; no per-keystroke events |
| Return to focus | `returned` | active focus state preserved |
| Start/end rest | `break-started` / `break-ended` | saved and matching rest/ready state; no earned-rest condition |
| Read records | `records-viewed` | explicit history readable/empty/nonempty/filtered-empty state |
| Open memento | `memento-viewed` | user origin, mementoSaved |
| New content ready/viewed | `new-content` | rewardApproved, rewardContentReady, rewardSaved, quiet moment or explicit view |
| User asks/changes phrase | `encouragement-requested` | user origin; missing category always means ASKG |
| Tick/state refresh | `reconcile` | current facts only; never selects a new phrase |
| Close phrase | `dismissed` | clears current phrase without a goodbye or warning |

Event IDs must identify individual logical results, not just the session. Keep the same ID when retrying the same failed write; the saved result can then appear once. Supply injected milliseconds for cooldowns, preferably a monotonic interaction clock. `reason` on focus endings does not affect quality, pool or presentation. To coalesce one save-and-return workflow, pass the same `interactionId` to its child events. Note marking, text save and return additionally share a configurable cooldown; pause and resume each have their own. Start/end and explicit encouragement are never rate-limited by that cooldown.

Use `origin: restore` or `sync` for recovered/cross-window events, including expired sessions settled on recovery. These restore functional status without replaying welcome/start/end/reward encouragement. Use navigation only for ready welcome/static views. The host still owns dataset generation, stale async-result rejection, durable exactly-once accounting and cross-window event ownership. The memory's bounded 128-key deduplication is presentation protection, not a durable event ledger.

```ts
const result = transitionFeedback(memory, {
  id: operationId,
  atMs: interactionTimeMs,
  origin: 'user',
  kind: 'focus-ended',
  elapsedMs: savedRecord.elapsedMs,
  reason: 'manual',
}, {
  initialized: true,
  phase: 'break',
  status: 'ready',
  persistence: 'saved',
  participationSaved: true,
}, feedbackCatalog, { nodeEncouragement: settings.nodeEncouragement })
```

Keep `FeedbackMemory` above page routing so a normal component remount retains the current phrase/cursors. Do not serialize this memory as a mood profile or public business snapshot. A fresh app launch uses fresh memory and restore/sync events; an active requested category belongs only to the current explicit interaction. “换一句” may pass that category while its panel is open; a new general request omits it and starts with ASKG. There is no timer callback that rotates copy.

## Truthful status and accessibility

`persistence` is an actual operation result, never assumed saved. Saving/pending/memory-only/read-only/unavailable/unknown suppress node encouragement and preserve technical information. An explicit request for support remains available alongside that technical status, with the error first and no success animation. ERR04 only claims a retained draft when `draftRetained` is true; ERR09 only claims unchanged data when `originalDataUnchanged` is true. ERR11 uses supplied current bounds, not a hard-coded 120. Render retry buttons only when the corresponding operation exists.

`result.announcement` is emitted once for a newly handled action. Duplicate delivery, ticks and static views return null. The component has one live region and keeps ordinary text outside it. To prevent replay when mounting a different page, keep announcement consumption above routing: consume the token once and render a newly mounted component with `announcement: null`. Do not separately put the same status in another live region. Running recovery and paused recovery never use ready-state invitations. The visual status and encouragement stay until replaced, dismissed or context changes; animation duration never dismisses text.

## Replaceable rendering and bookmarks

`companionPresentation` exposes semantic stances and optional cues without whale/rice/cry identifiers. Zero, short and full endings have identical presentation. Errors have a neutral static stance. Reduced motion or disabled dynamics remove cues without changing copy. `CompanionFeedback` accepts a `renderCharacter` slot; the shipped blue abstract face is only a static, unbranded placeholder. No physical interaction or final mascot is selected.

The component's optional callbacks expose only capabilities the host actually supplies. It never starts or pauses time, changes participation, writes storage, awards content or marks a bookmark saved. `createEncouragementBookmark` returns `{copyId, text, copyVersion}` for the host's save command. Deduplicate persisted bookmarks by copyId, retain the chosen text snapshot when the catalog later changes, and set `bookmarkState: saved` only after successful persistence. Deletion/import/conflict rules remain with the storage owner.

The isolated module has deterministic scenario tests and server-rendered accessibility/slot checks. Its hook adapter (`src/hooks/companion/useCompanionView.ts`) keeps the component free of business selection logic and suppresses cues when there is no new announcement token.

## Verification on 2026-10-29

The module was checked on top of F1 commit `4e7c9d50261af0b81a880716a36a691ede3b004f`, without modifying F1 files or dependencies. `npm run check` passed strict types and 166 tests in 14 files, including 49 new module cases. `BASE_PATH=/clock/ npm run build` and `git diff --check` passed. A direct extraction comparison confirmed all 136 IDs/texts match PRD revision 7 exactly. The ordered ID/text map (JSON with sorted keys, UTF-8, default JSON spacing) has SHA-256 `6579d82d7522f7f159e13cd84a99e5e3d9b0423517b288c90941f23b1aca85ef`.

An isolated Vite production harness rendered the actual exported component and reducer in Chromium 153.0.8010.0 with synthetic events. Start/pause, equal zero/one-second ending presentation, failed-save priority, explicit support alongside failure, silent paused recovery and node-off/requested-on flows passed. Widths 320/375/430 had no horizontal overflow; 320px at 200% body text retained the complete long phrase, wrapping controls and keyboard operation. Enter changed the phrase with focus retained; reduced-motion mode remained static; there was one live region and no console/page errors. Screenshots were inspected, including the long phrase at 200%. Noto Sans SC was supplied only by the test environment; no font dependency/CDN was added to the app.

These are isolated-module checks. Actual page wiring, live screen-reader listening, bookmark/reward persistence and real iPhone/Android acceptance remain integration work. A main-app build passing does not mean this as-yet-unmounted module is present in its production bundle.
