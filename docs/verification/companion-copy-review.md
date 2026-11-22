# Companion copy review — 2026-11-22

Baseline: `b132621d8dc090600270a94f25531d972b6b0fd9`. The owner requested editing each runtime text for suitability, natural wording and excessive repetition. The earlier [random-language report](companion-language.md) remains historical evidence for the 177-entry release; it is not the current catalog.

The publication also incorporates upstream documentation-only commits through `f576a0278f75d2fe0ec0ef9c24827fef134d051b`. Their timer research/current-flow modules and map entries are preserved; this review uses module 24 to avoid a numbering collision.

## Editorial scope

The [Chinese review ledger](../prd/24-copy-review.md) covers every item in the baseline resource: 177 spoken entries, 19 fixed interface strings, two errors and one welcome note (199 total). It records original text, retain/revise/remove, the revised text and an individual reason. Across these items, 38 are unchanged, 45 revised and 116 removed. Spoken entries alone retain 19 original lines, revise 42 and remove 116, producing 61 current lines.

| Current pool | Count |
| --- | --- |
| RET / STA / END / ZER / BRK | 5 / 5 / 4 / 2 / 6 (22 automatic) |
| ASKG / ASKS / ASKB / ASKT | 11 / 10 / 8 / 10 (39 requested) |

The removed entries include all 25 already-silent PAU/RES/NME/NTX/BRE lines. Those retired pools are no longer required by the parser or mapped to speech. Their existing functional status and semantic animation behavior remain. Stable IDs are not renumbered or reused. Automatic text/welcome now use `companion-moments-v2`; requested text uses `companion-voice-v3`; fixed copy is tagged `prd-v37`.

The edit reduces redundant permission-giving, invented relationship pressure, forced metaphors, repetitive book/boat analogies and promises of conversations the App cannot support. Fixed zero elapsed now reads `本段计时0秒。`; the rest notification states only that rest timing ended. The welcome note gives a short introduction and practical choices. The [current catalog](../prd/09-encouragement.md), [voice rules](../prd/08-voice.md), [scenario map](../prd/21-language-scenes.md) and product/engineering maps are synchronized.

Direct random draws, per-pool adjacent-repeat avoidance, the fresh opening seed, shared automatic cooldown and existing reading/withdrawal behavior are unchanged. No new artwork, animation, triggers, background dialogue, personality values or storage fields were introduced. Existing favorites retain their saved text and version even if the source entry is removed; cancellation still works. A revised phrase refreshes only after explicit cancellation and re-favoriting.

## Verification

Local environment: Linux executor, Node 24.22.3, npm 11.19.1, existing lockfile/dependencies.

- `npm run check`: strict types and 508 tests in 41 files passed. Relevant tests cover legal pool selection, seeded reproducibility, non-adjacent repetition before exhausting a pool, quiet tool actions, precise zero-time status and favorite compatibility for both removed and revised entries.
- `BASE_PATH=/clock/ npm run build`: production build and service-worker generation passed.
- `python3 scripts/check-prd-docs.py`: 25 PRD modules, 623 local links, 602 unique explicit anchors, 48 dialogue candidate IDs and all 61 runtime/PRD text pairs passed.
- A separate extraction cross-check verified all 199 review rows against the baseline resource, all 83 surviving resource texts against the final catalog, and decision/count consistency.
- `git diff --check`: passed.

Local Chromium was already established to be unavailable because the executor denies its process-singleton socket. No local browser pass is claimed. The main-triggered Pages workflow runs the existing complete production-browser suite before deployment, including the language flow and longest-current-copy layout/keyboard checks. The published commit's Actions result is the release evidence; test code existing is not itself a browser pass.

The review covers the listed runtime resource, not every hard-coded UI label or the 30 dormant PRD assets, 48 daily-dialogue candidates and future story drafts. Editorial review does not establish audience preference. Desktop browser emulation does not establish physical-device or screen-reader acceptance.
