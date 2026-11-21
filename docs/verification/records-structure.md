# Records structure verification — 2026-11-21

## Scope and baseline

The owner asked to reread current code, remove obsolete or redundant implementation, and reorganize it around clearer responsibilities. Work starts from `dccbfb72d57ccfd884aca201dc195ac85c120ee6`, including the November 12 bound-book interface and November 14 documentation. The earlier November 6 refactor is historical evidence, not the source layout for this change.

Snapshot v10, storage keys, timer accounting, saved identities, current copy and artwork are unchanged. No dependencies or lockfile changes are included. Authored chapters, persistent cottage accumulation and full backup/restore remain unfinished product work.

## Three review passes

1. **Trace consumers from the current entry points.** Follow application, animation preview, Focus preview and verification-script imports. The book replaced the old list/room/notebook interface, but its components, browser hooks and five stylesheets remained. Keep current thought editing, room illustrations, shared motion and historical data migrations. The full browser suite exposed one stale CSS import in the Focus preview; both entry points now share the same stylesheet entry.
2. **Choose responsibility boundaries.** Retain the established logic/adapter/hook/view direction. Keep reading history, page-turn effects and focus/scroll return together; keep editing/undo and page intents in a coordinator over that navigation. Split chapter roots, detail routing, shared memory content and footer presentation. Put actual filtering/order/pagination in pure logic instead of retaining a second, unused list-query path. Avoid unrelated timer/storage or renderer changes.
3. **Verify the final composition.** Exercise current user journeys, saved-state failures, source-aware returns and large collections. Compare the old and new production builds with identical data, clock, browser and fonts, then run the complete production suite and the real v5-client compatibility audit.

## Resulting boundaries

| Area | Result |
| --- | --- |
| Screen | `RecordsScreen.tsx` composes the shell and tabs; 363 lines become 97. Formatting differs, so this is an entry-point measure, not a complexity metric |
| Reading visit | `useBookNavigation` owns page/chapter history, inert page-turn rendering, browser Back, Escape, keyboard/swipe, and scroll/focus return |
| Page coordination | `useRecordsBook` connects current page intents, search/month/page changes, editing, deletion return, undo and announcements to existing controllers |
| View projection | `book-data` constructs memory/note views without persistence; confirmed artwork and unknown historical metadata retain their existing meaning |
| Queries | `records-query` implements the live book's month/text filters, oldest-first memory order, reverse source index and 20-item page windows |
| Presentation | `BookChapters`, `BookContent`, `BookMemory` and `BookFooter` compose with the existing paper, writing and tools views |
| Styles | `settings.css` and `thoughts.css` own their shared rules. `app.css` is the ordered import entry for both the app and Focus preview; book styles remain scoped to the book |

Twenty obsolete files were removed: eleven superseded record/room/notebook/illustration components, the unused `FocusTaskDialog`, three old list-browser/query/visit modules, and five Records stylesheets. Separately, active book projection and navigation definitions moved to clearer names and hook ownership. The current book's stable-scrollbar rule survives in `book.css`; shared editor and Settings styles were moved, not discarded. Original icon provenance, historical reports and compatibility migrations remain.

The old list-query tests are replaced by tests of the primitives the book actually uses and its view projection: confirmed source eligibility, focus/rest identity, unknown dates, note ownership, literal/canonical search, full-history filtering, page boundaries and peer insertions. Four query tests plus four projection tests replace eight obsolete-path tests; the total remains 491 across 41 files.

## Visual comparison

The same deterministic snapshot contains focus and rest memories, a thought and a saved quote. Baseline and refactored production builds run at 320×568, 375×812, 430×932, 375×812 with 200% root text, and 1024×768, using reduced motion and loaded Chinese fonts. Seven states per configuration cover Focus, Settings, writing and all four book chapters.

Across 35 before/after comparisons (70 screenshots), 34 are pixel-identical. The 320px Favorites comparison differs at one pixel by one blue-channel level: `(240, 231, 213)` versus `(240, 231, 212)`. All text matches and neither version introduces horizontal document overflow. Focused manual inspection of the rendered book and enlarged editor confirms readable content and reachable controls. These are sampled states, not an exhaustive visual proof. [Machine-readable comparison](records-structure/visual-comparison.json).

Production CSS falls from 108,997 to 87,775 bytes (21,222 bytes removed). This comes from deleting superseded selectors, not a visual redesign.

## Executed checks

Environment: Linux desktop Chromium `153.0.8010.0`, Node `24.22.3`, repository-locked dependencies. Playwright's default download returned an incomplete archive; checks used an explicitly supplied Chromium executable outside application dependencies. Desktop browser emulation and simulated keyboard viewport changes are not physical iPhone/iPad, Safari or screen-reader acceptance.

- Strict TypeScript, including the DOM-free logic boundary, and all 491 unit tests pass.
- The `/clock/` production build passes.
- The complete `npm run test:e2e` passes: 134 app, 30 touch, 67 scene, 110 Focus interaction, 13 grouped Records, 21 persistence, 13 update, 292 panel, 194 iOS-design, 41 navigation and 141 step-aside checks, plus the book-page suite. [Individual checks](records-structure/browser-checks.json).
- The actual v5-client compatibility audit passes all six checks against snapshot v10: active timer preservation and old-writer protection remain intact. [Result](records-structure/v5-compatibility.json).
- Product-document link validation and whitespace checks pass.

The existing regression scripts are preserved. They cover the book opening/turning and source returns, search and 1,000/10,000-record collections, pending writes, deletion/undo, multi-tab behavior, real service-worker updates, keyboard/focus restoration, small/large-text layouts and Focus stepping aside. A complete suite run caught and fixed the preview import before a final rerun.

## Publication boundary

This report records implementation and local verification. The containing commit is the code handoff. GitHub Actions separately establishes the build and Pages deployment; a successful commit alone does not establish deployment or full PRD acceptance.
