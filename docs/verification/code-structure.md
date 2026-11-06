# Code structure verification — 2026-11-06

## Scope and baseline

The owner requested removal of obsolete/redundant code and a considered module reorganization, with submission to `Hughstudy/clock`. Work started at `6a45adb`; the concurrent documentation-only update `d203aab6852a410ff1f51b5e1dd77c8435781561` was integrated before publication, preserving its character proposals and their pending status.

The three review passes and module decisions are in [the code map](../CODE_MAP.md). Changes preserve snapshot v8, storage keys, transition semantics and current companion artwork. This is not delivery of authored chapters, cottage collection, backup/restore or other open PRD work.

## Changes and removal evidence

| Area | Result | Evidence for removal or split |
| --- | --- | --- |
| Records | `StatsScreen.tsx` becomes `RecordsScreen.tsx`; composition drops from 466 to 168 lines. Browsing/position effects move together into `hooks/records/`; thought, favorite and pagination views have focused components | State, DOM focus/scroll return and view rendering were mixed. Existing return-position/large-list checks exercise the split |
| Snapshots | Public entry drops from 362 to 76 lines; migrations, field readers, merging and predicates have separate internal modules | Existing callers and all v1–v8 transforms remain. Round-trip, malformed data, merge, deletion and generation tests remain |
| Runtime configuration | `app-spec.json` replaces the combined `pet-spec.json`. Old eating pose, captions, reaction timing, full-frame machinery and generic legacy renderer are removed | Runtime import audit found no app consumer. Only the install-icon test used the old renderer; its required idle parts now live in a tooling fixture |
| Icon | Source is `test/fixtures/legacy-icon.json`; a small tooling renderer reproduces the existing public SVG | Byte-for-byte icon assertion passes; public icon assets and provenance are retained |
| Feedback | `useFeedback` moves out of `hooks/companion/` to main hook coordination | Eligibility, persistence truth and announcements belong to the main app, not drawing |
| Dead alias / old QA | Remove `data/scene-rules.ts` and `scripts/verify-focus.cjs` | Alias had only a test consumer; old smoke script used removed controls, and current production checks cover its user journeys |
| Browser selection | Ten browser tools share `scripts/lib/browser.mjs` | Previously some supported a custom executable and some only a channel. Existing channel option remains; explicit executable takes precedence |
| Compatibility audit | Remove hard-coded v7 assertions from the actual v5-client audit; compare with exported `SNAPSHOT_VERSION` | The old script failed with `8 !== 7` against the unchanged current schema; corrected audit verifies the old writer cannot overwrite upgraded data |
| Architecture checks | Resolve imports at any relative depth; detect inline type imports and prevent tooling from reentering runtime code | Prior checks covered only `../logic`, missing nested files. Two existing pure rendering-geometry modules are explicit renderer-only exceptions |
| Search layout defect | Give both Records tools/search grids `minmax(0, 1fr)` columns | At 320px/200% with Chinese glyphs, the thought search form expanded document width to 524px. After the fix, all four modes fit at 320/375/430px with 100%/200% text |

The user-facing layout change is limited to preventing horizontal search overflow. No dependency, lockfile, timer rules or saved-data version changes were needed. Historical source snapshots and reports were not rewritten. The old v5 scene metadata is intentionally retained as inert compatibility history.

## Executed checks

Environment: Linux desktop Chromium `153.0.8010.0`, Node `24.22.1`, repository-locked dependencies. Playwright's default browser download returned a truncated archive; checks used an explicitly supplied Chromium executable instead. No browser package was added to the repository. Desktop emulation is not physical-phone or screen-reader acceptance.

| Check | Result |
| --- | --- |
| Before changes: `npm run check` | 36 files / 397 tests passed |
| After changes: `npm run check` | 36 files / 393 tests passed |
| `BASE_PATH=/clock/ npm run build` | Passed; main JS 447.45 kB, gzip 143.46 kB (baseline 455.57 / 146.56 kB) |
| `scene-e2e.mjs` | 115 app assertions, 30 touch and 67 scene fixture checks passed |
| `verify-focus-interactions.mjs` | 101 checks passed |
| `verify-records-companion.mjs` | 114 checks passed, including the new three-width/200% thought search regression |
| `verify-v35-persistence.mjs` | 21 checks passed |
| `verify-v35-update.mjs` | 15 checks passed |
| `verify-v35-panels.mjs` | 143 checks passed |
| Actual v5-client compatibility audit | 6 checks passed; active timer/scene retained and old writers blocked |
| Additional Chinese-font layout inspection | 24 checks passed: four Records modes × three widths × two text sizes; start, mark, end and navigate before checking |
| Product-document links and diff whitespace | `python3 scripts/check-prd-docs.py` and `git diff --check` passed |

The unit count decreases by four because five tests solely for retired character poses/validation were removed and one runtime/tooling boundary test was added. Tests protecting current business behavior, migrations and the retained icon remain.

The production suite passed; Records was rerun after the final subview extraction and search fix. An optional repeat of the whole suite stalled during fixture bundling and was stopped; it is not counted as a pass. Final build, affected Records checks and the Chinese-font checks completed separately.

The default environment lacks Chinese fallback glyphs. An additional visual inspection loaded Noto Sans CJK SC as a test-only webfont, without adding it to application assets. Inspected the Focus view at 375px and Records at 320px/200%; readable content, navigation and controls remain reachable. The 24 additional checks cover no horizontal overflow; they do not replace a full assistive-technology audit.

Machine-readable results are under [code-structure/](code-structure/). They preserve actual check names and browser versions; temporary artifact locations have been omitted. The additional Chinese-font check is a supplemental one-time inspection; the durable search regression is in the main Records script.

## Publication boundary

This report records local implementation and executed checks. The commit containing this report is the code handoff; GitHub Actions separately reports its build and Pages deployment. A successful push does not by itself prove deployment or full PRD completion.
