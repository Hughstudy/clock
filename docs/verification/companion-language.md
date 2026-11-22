# Companion language implementation — 2026-11-22

Baseline: `e4eacd3ce8ed30cbdb6cf46381d9ca90493a34fc`. The owner requested richer runtime text and random variation in entry, focus and rest, then explicitly chose direct random draws on every opening. The Chinese product sources are [voice rules](../prd/08-voice.md), [exact catalog](../prd/09-encouragement.md) and [scenario map](../prd/21-language-scenes.md).

## Implemented scope

| Surface | Catalog and behavior |
| --- | --- |
| Returning ready page | 12 RET greetings; saved prior use, visible healthy ready page, no active session/standing focus result, preference on; after successful initial recovery, canceled by intervening interaction; first installation stays quiet |
| Focus start / focus end / rest start | 12 STA / 12 END / 12 BRK lines; truthful event/state/persistence eligibility |
| Exactly zero elapsed | 8 ZER lines, saved participation required; often suppressed by the shared cooldown after start |
| Explicit support | 24 lines per category, 96 total; 40 additions and four factual-scope edits to earlier wording |
| Tool actions | 25 PAU/RES/NME/NTX/BRE lines retained as assets but not automatically selected; fixed statuses and semantic animation cues remain |

The complete catalog has 177 entries. Automatic version is `companion-moments-v1`; requested version is `companion-voice-v2`. Existing quote favorites retain original text/version, including an earlier ASKG06 snapshot tested against the revised runtime text. Snapshot v10 and timer accounting are unchanged.

A fresh seed is injected by the hook on each App mount. Each eligible event draws directly from its pool, excluding only the immediately previous ID in that pool. There is no shuffle bag, unread queue, fixed first line or requirement to exhaust a pool. A fresh opening may coincidentally select the same phrase as a previous opening. Tags do not impose a hidden order. Re-rendering, ticking, restoring, synchronizing or switching pages does not draw. No phrase-display history or emotional profile is persisted.

Automatic lines share a 30-second cooldown. Hidden/covered operations do not consume a draw or queue a phrase. Focus chrome dismissal removes passing text without bringing it back with the controls. Explicit reading bypasses automatic cooldown and survives temporary editing/confirmation. Fixed time/error/save facts are never randomized. These words express general habits and choices without adding props, animation, conversation branches or new story facts.

## Local verification

Environment: Linux executor, Node 24.22.3, npm 11.19.1. Dependencies installed from the existing lockfile.

- `npm run check`: strict types and all 505 tests in 41 files passed; covers random eligibility/reproducibility, repeats before pool exhaustion, no adjacent repeats, initial greeting guards, hidden/covered events, shared cooldown measured from presentation after delayed saving, quiet tool actions, explicit-request priority, errors, deduplication and original favorite snapshots.
- `BASE_PATH=/clock/ npm run build`: production build and service-worker generation passed.
- `python3 scripts/check-prd-docs.py`: 22 PRD modules, 560 local links, 602 anchors and exact parity for all 177 runtime lines passed.
- `git diff --check`: whitespace validation passed.

Local production-browser checks were attempted with `/usr/bin/chromium`, but the executor denied Chromium's process-singleton socket before any page could open (`socket() failed: Operation not permitted`). No local browser or screenshot pass is claimed. This is an environment limitation, not evidence that the UI passed or failed.

## Production-browser release gate

The existing main-triggered Pages workflow runs `npm run test:e2e` before deployment. It now also includes `scripts/verify-companion-language.mjs`, which builds production assets and exercises 320/375/430 CSS-pixel widths with reduced motion, first-use silence, eligible random speech, no tick rotation, chrome withdrawal, repeated requested draws, editor return, favorites, 200% text, keyboard focus, recovery, ready greeting, shared cooldown and rest speech. It checks browser errors and emits a report/screenshots in `.preview/companion-language` on its runner. Existing Focus, persistence and other browser suites remain in the gate.

**First CI run.** [Run 45027666015](https://github.com/Hughstudy/clock/actions/runs/45027666015) passed the unit suite and the earlier production checks up to the panel suite. That suite still required a particular sentence to appear within 14 clicks, an obsolete assumption after direct random selection; the combined text/clipping assertion failed and deployment was skipped. Its geometry fixture now injects deterministic feedback entropy to select the longest current interrupted phrase, while preserving random UUID suffixes and the clipping/keyboard/layout assertions. The ordinary language-flow suite continues using real random seeds.

**Second CI run.** [Run 45028169030](https://github.com/Hughstudy/clock/actions/runs/45028169030) passed the longest-line geometry checks across all 11 panel configurations, including 200% text, and reached the older automatic full-text case. That case still expected pause to produce speech. It now verifies pause silence and checks the same full-text fallback using an actual start in a fresh profile. The language-flow suite runs first for faster feedback; all existing suites remain.

**Startup integration fix.** [Run 45028625248](https://github.com/Hughstudy/clock/actions/runs/45028625248) exercised real-random draws, editor return, favorites, large text, keyboard operation, recovery and the shared cooldown successfully, then exposed an entry-greeting race: initial recovery cleared the phrase before it could remain visible. The host now waits for the successful initial recovery receipt before selecting a greeting. Starting, requesting support, opening a panel, hiding the page or encountering a recovery failure cancels that one opportunity. Added unit coverage reproduces saving → recovered and cancellation paths; the production flow asserts the greeting remains stable after recovery.

The publication's Actions run is the authoritative result of these browser checks; adding the test is not itself a passing result. Deployment happens only if the workflow succeeds. Desktop emulation does not establish physical iPhone/Android acceptance, live screen-reader listening, soft-keyboard behavior or user preference for the new writing.

## Boundaries

The 48 daily-dialogue candidates, touch text, object conversations, complete authored stories and story collection remain pending. This increment does not claim those PRD modules or the full language acceptance matrix are complete. The global cooldown and writing remain tunable after actual use.
