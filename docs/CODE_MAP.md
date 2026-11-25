# Code map

Read the [product map](prd/README.md) for requirements, this file for implementation entry points, and [PLAN.md](../PLAN.md) for unfinished work. The [interaction bug review](verification/interaction-bug-review.md) covers the latest corrections. The [Records structure verification](verification/records-structure.md) records the latest refactor; the [November 6 report](verification/code-structure.md) preserves the earlier snapshot and runtime cleanup. This is a code map, not another task or ownership board.

## Dependency direction

Screens and components render read-only views and dispatch intent. Hooks coordinate inputs, lifecycle and effects. `logic/` owns deterministic transitions, validation and queries; `adapters/` owns browser storage, locks, clocks and sound. Contracts are the shared language between these layers. The renderer's pure contact geometry also lives in `logic/`; its outputs are presentation, never accounting.

| Change you need | Start here | Boundary to preserve |
| --- | --- | --- |
| Root navigation, announcements, update protection | `src/App.tsx`, `hooks/useScreenNavigation.ts`, `hooks/useFocusTaskBack.ts` | One browser-history owner and one app-level live region; input and pending writes block updates |
| Focus preparation and timer controls | `screens/HomeScreen.tsx`, `hooks/useDurationChoice.ts`, `components/FocusPanel.tsx` | Choosing a duration does not start it |
| Focus card stepping aside and full-screen room | `hooks/useFocusChrome.ts`, `logic/focus-chrome.ts`, `hooks/useSceneFit.ts`, `logic/scene-fit.ts` (`wideRoomFit`, `shownTimeDrop`, `awayGroup`), `styles/focus-v35.css` | Presentation only: never reads or writes timer state; a pat never calls the card; scale the room, never the creature; in portrait the time sits one bubble above the head in every state, and while the card is away the spare height is shared between sky and floor |
| Paused focus and rest tools | `components/PauseTools.tsx`, `screens/HomeScreen.tsx`, `hooks/useClockApp.ts` | The pause receipt identifies the original session. Its tools open the existing encouragement reader, marker command or thought editor. |
| Bottom sheets and confirmations | `components/FocusPanel.tsx`, `components/ConfirmPopover.tsx`, `hooks/useSheetDrag.ts`, `screens/SettingsScreen.tsx`, `logic/scene-fit.ts` (`fitSceneArt`) | One modal surface at a time over an inert page; closing keeps drafts; a stray tap on the dimmed page closes nothing; the companion looks over a sheet at its own size or steps out |
| Timing and session settlement | `logic/timer.ts`, `logic/app.ts`, `hooks/useClockApp.ts` | Deadline-based accounting; one transaction coordinator; stable session IDs |
| Thought editor and recovery | `hooks/useThoughts.ts`, `logic/thoughts.ts`, `components/ThoughtPanel.tsx`, `styles/thoughts.css` | Preserve ownership, drafts, revisions and pending-save truth; draft switches keep usable controls and input focus |
| Encouragement policy and quote favorites | `hooks/useFeedback.ts`, `logic/feedback-host.ts`, `logic/feedback.ts`, `hooks/useQuoteFavorites.ts` | Main logic decides eligibility and save truth; animation consumes permitted cues |
| Records layout | `screens/RecordsScreen.tsx`, `components/records/book/` | Screen shell, chapter roots, detail routing, shared memory leaf and footer compose the existing book |
| Opening Records from the room | `components/scene-journal/`, `hooks/useScreenNavigation.ts` | The scene prop and the Records tab share one navigation action. The moving cover and page are inert copies of the presentation |
| Records browsing and return position | `hooks/records/useBookNavigation.ts`, `hooks/records/book-navigation.ts` | Each breadcrumb carries its chapter, item, search input and reading position; browser effects stay in the hook |
| Records editing and page intents | `hooks/records/useRecordsBook.ts`, `hooks/records/types.ts` | One coordinator connects reading to existing thought/favorite controllers; it never persists independently |
| Records query and saved-only totals | `hooks/records/book-data.ts`, `logic/records-query.ts`, `hooks/useViews.ts`, `logic/stats.ts` | Combined focus/rest history, full-list thought search and 20-item pages. Totals use confirmed focus records |
| Settings | `screens/SettingsScreen.tsx`, `hooks/useSettingsForm.ts`, `logic/settings.ts`, `styles/settings.css` | New settings apply to future sessions; one queue receipt retires only its own optimistic form patch |
| Shared stylesheet entry | `styles/app.css`, `styles/thoughts.css` | App and Focus preview import the same ordered cascade; the book imports its own scoped CSS |
| Snapshot format and compatibility | `logic/snapshot.ts`, `logic/snapshot/` | Keep the stable entry point; protect old and newer raw data |
| Storage and concurrency | `adapters/storage.ts`, `adapters/browser-store.ts`, `adapters/locks.ts` | Read latest, transition, write under one short lock |
| Companion appearance and motion | `components/companion/`, `hooks/companion/`, `logic/scene-*.ts`, `data/scene-*.ts` | Rendering can be interrupted or disabled without changing saved facts |
| Where an activity's items stand, and each hand's path | `logic/scene-pose.ts` (`BOAT_TRAY`, block and tea constants), `logic/scene-food-rig.ts` (`FOOD_DISHES`, `FOOD_BOWL`), `logic/scene-arm-clearance.test.ts` | An arm keeps its length and never lies over an item it is not handling; move the item or lean the body rather than lengthen the arm |
| Companion's performance across a focus session | `logic/focus-presence.ts`, `hooks/companion/useFocusPresence.ts`, `logic/scene-pose.ts` (`FOCUS_ATTENTION`, `FLIPPER_ARM`) | A pure function of main's elapsed time; frames only around a gesture; an arm moves only where it stays clear of every item |
| Day and night in the scene | `logic/daylight.ts`, `data/scene-light.ts`, `hooks/companion/useSceneLight.ts`, `components/companion/CompanionScenery.tsx` | Follows the device clock; presentation only; the page's sky and floor match the art, and the clock text stays readable at every level |
| Defaults and bounds | `data/app-spec.json`, `logic/spec.ts` | Runtime settings are validated independently of legacy artwork |
| Retained install icon | `test/fixtures/legacy-icon.json`, `test/legacy-icon.ts`, `test/icon.test.ts` | Tooling only; retain provenance; generated public SVG must match byte-for-byte |
| Browser checks and visual review | `scripts/`, `scripts/lib/browser.mjs` | All tools use the same explicit executable/channel policy |

Paths in the table are relative to `src/` unless another prefix is present.

## Snapshot modules

`logic/snapshot.ts` remains the public API: `createSnapshot`, `decodeSnapshot`, `encodeSnapshot`, `mergeSnapshots`, `hasMissingRecords`, and migration exports. Callers keep this import; internal files do not import the facade.

| Internal file | Responsibility |
| --- | --- |
| `snapshot/migrations.ts` | Ordered v1–v11 upgrade transforms and migration runner |
| `snapshot/read.ts` | Field readers and repair diagnostics for the current model |
| `snapshot/merge.ts` | Same-generation merge and missing-data detection |
| `snapshot/guards.ts` | Small shared predicates used by migration and readers |

Snapshot v11 preserves the original time plan and schedule revisions for mid-session edits. Running edits re-anchor the remaining interval, and paused edits preserve the frozen state. Snapshot v10 adds durable ended rests keyed by session ID. A v9 snapshot can supply at most its last evidenced rest ending. The original archive date, short/long break kind, ending reason or scene can be unknown. The v9 migration still preserves the identity of an automatic rest suggestion separately from an explicitly prepared rest. See the [iOS review](verification/ios-design-review.md). Existing schema migrations and inert v5 scene history remain necessary compatibility paths. Full backup/restore, dataset replacement and authored story collection remain unfinished; moving files does not implement them.

## Records modules

`RecordsScreen` composes the book shell and ribbon tabs. It consumes `useRecordsBook` and renders views; it does not own navigation effects, save transactions or queries.

| Module | Responsibility |
| --- | --- |
| `hooks/records/useBookNavigation.ts` | Reading visit, chapter/page history, keyboard/swipe intents, inert page-turn animation, scroll and focus restoration |
| `hooks/records/useRecordsBook.ts` | Search/month/page intents, writing and deletion return, undo location, saved-state feedback, accessible page labels |
| `hooks/records/book-navigation.ts` | Visit/location types, initial chapter state and DOM anchor helpers; the app retains the visit across screen changes |
| `hooks/records/book-data.ts` | Project existing read-only views into memory pages and notes, then memoize the chapter's entries |
| `logic/records-query.ts` | Pure month/text filtering, full-list search, memory order, activity source indexes and 20-item page windows |
| `components/records/book/BookChapters.tsx` | The four chapter roots: memories, thoughts, room and favorites |
| `components/records/book/BookContent.tsx` | Route reading/editing detail pages within the current chapter |
| `components/records/book/BookMemory.tsx` | One memory leaf shared by the main chapter and room source details |
| `components/records/book/BookFooter.tsx` | Contextual return and page navigation |
| `components/records/book/BookPaper.tsx`, `BookWriting.tsx`, `BookTools.tsx` | Reusable paper elements, thought/quote reading, filters, pagination, statistics and status |

Edits still go through the app's existing writing controllers. `motion.ts` animates an inert copy while the destination already accepts input. Confirmed-only search and artwork eligibility are applied before page slicing; pending history and unknown dates remain visible with their existing meaning.

## Cleanup decisions

The November 21 pass traced the current book, both application entry points and browser scripts. It removed the superseded list browser, old record/room/notebook components, the unused `FocusTaskDialog`, and five obsolete Records stylesheets. Shared thought editing and Settings styles now have their own files; `styles/app.css` keeps the app and Focus preview aligned. The former list-query implementation was replaced by the primitives actually consumed by the book. Tests now cover those live queries and their view projection.

The earlier November 6 decisions remain relevant:

1. **Trace actual consumers.** Most existing layers are useful. The old character renderer and pose data were used only by legacy tests and the retained install icon. `data/scene-rules.ts` was a forwarding file used by one test. The old `verify-focus.cjs` still clicked retired controls and was superseded by the production suite.
2. **Compare module boundaries.** Keep the established logic/adapter/hook/view architecture. A repository-wide move to feature folders would cause unrelated import churn; splitting every small function would scatter coupled behavior. Split the real responsibility boundaries: snapshot migration/validation/merge, Records composition/browsing, runtime settings/icon tooling, and shared browser selection.
3. **Review what must survive.** Keep old data migrations, original icon provenance and historical reports. Keep one transaction queue in `useClockApp`; time-intent semantics need their own targeted investigation (PRD bridge D06), not an incidental change during this refactor. Do not rewrite animation geometry or introduce unimplemented story APIs.

Removed: unused legacy eating pose, captions, reaction timings, general legacy-character renderer and their obsolete tests; the unused scene-rule alias; the retired Focus smoke script. The icon keeps only the ordered idle parts needed to reproduce the existing SVG. The v5 compatibility script now checks the exported current schema version rather than hard-coding v7. The Records search grids use explicit shrinkable columns so large Chinese text cannot force horizontal overflow.

## Checks to run

```bash
npm run check
BASE_PATH=/clock/ npm run build
npm run test:e2e
node scripts/verify-v5-compatibility.mjs
python3 scripts/check-prd-docs.py
```

Browser scripts default to Playwright's installed Chromium. Set `SCENE_BROWSER_CHANNEL=chrome` for an installed Chrome, or `SCENE_BROWSER_EXECUTABLE=/absolute/path/to/chromium` for a custom executable; an explicit executable takes precedence. Do not add a browser binary to application dependencies.

Architecture tests resolve nested relative imports, distinguish type-only imports and block test/tooling imports from application modules. Two existing deterministic contact-geometry modules are explicitly allowed in companion renderers; business and browser-effect modules are not.
