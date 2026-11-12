# Code map

Read the [product map](prd/README.md) for requirements, this file for implementation entry points, and [PLAN.md](../PLAN.md) for unfinished work. The [structure verification](verification/code-structure.md) records this refactor's evidence. This is a code map, not another task or ownership board.

## Dependency direction

Screens and components render read-only views and dispatch intent. Hooks coordinate inputs, lifecycle and effects. `logic/` owns deterministic transitions, validation and queries; `adapters/` owns browser storage, locks, clocks and sound. Contracts are the shared language between these layers. The renderer's pure contact geometry also lives in `logic/`; its outputs are presentation, never accounting.

| Change you need | Start here | Boundary to preserve |
| --- | --- | --- |
| Root navigation, announcements, update protection | `src/App.tsx`, `hooks/useScreenNavigation.ts`, `hooks/useFocusTaskBack.ts` | One browser-history owner and one app-level live region; input and pending writes block updates |
| Focus preparation and timer controls | `screens/HomeScreen.tsx`, `hooks/useDurationChoice.ts`, `components/FocusPanel.tsx` | Choosing a duration does not start it |
| Focus card stepping aside and full-screen room | `hooks/useFocusChrome.ts`, `logic/focus-chrome.ts`, `hooks/useSceneFit.ts`, `logic/scene-fit.ts` (`wideRoomFit`, `shownTimeDrop`, `awayGroup`), `styles/focus-v35.css` | Presentation only: never reads or writes timer state; a pat never calls the card; scale the room, never the creature; in portrait the time sits one bubble above the head in every state, and while the card is away the spare height is shared between sky and floor |
| Bottom sheets and confirmations | `components/FocusPanel.tsx`, `components/FocusTaskDialog.tsx`, `components/ConfirmPopover.tsx`, `hooks/useSheetDrag.ts`, `screens/SettingsScreen.tsx`, `logic/scene-fit.ts` (`fitSceneArt`) | One modal surface at a time over an inert page; closing keeps drafts; a stray tap on the dimmed page closes nothing; the companion looks over a sheet at its own size or steps out |
| Timing and session settlement | `logic/timer.ts`, `logic/app.ts`, `hooks/useClockApp.ts` | Deadline-based accounting; one transaction coordinator; stable session IDs |
| Thought editor and recovery | `hooks/useThoughts.ts`, `logic/thoughts.ts`, `components/ThoughtPanel.tsx` | Preserve ownership, drafts, revisions and pending-save truth |
| Encouragement policy and quote favorites | `hooks/useFeedback.ts`, `logic/feedback-host.ts`, `logic/feedback.ts`, `hooks/useQuoteFavorites.ts` | Main logic decides eligibility and save truth; animation consumes permitted cues |
| Records layout | `screens/RecordsScreen.tsx`, `components/records/` | Featured session keepsake, date-grouped focus/rest memories, thought entries and secondary focus totals |
| Records browsing and return position | `hooks/records/useRecordsBrowser.ts`, `hooks/records/visit.ts` | Mode, page, expanded object, scroll anchor and focus restoration stay coordinated |
| Records query and saved-only totals | `hooks/records/useRecordsQuery.ts`, `logic/records-query.ts`, `hooks/useViews.ts`, `logic/stats.ts` | Combined focus/rest history, full-list thought search and 20-item pages. Totals use confirmed focus records |
| Settings | `screens/SettingsScreen.tsx`, `hooks/useSettingsForm.ts`, `logic/settings.ts` | New settings apply to future sessions |
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
| `snapshot/migrations.ts` | Ordered v1–v10 upgrade transforms and migration runner |
| `snapshot/read.ts` | Field readers and repair diagnostics for the current model |
| `snapshot/merge.ts` | Same-generation merge and missing-data detection |
| `snapshot/guards.ts` | Small shared predicates used by migration and readers |

Snapshot v10 adds durable ended rests keyed by session ID. A v9 snapshot can supply at most its last evidenced rest ending. The original archive date, short/long break kind, ending reason or scene can be unknown. The v9 migration still preserves the identity of an automatic rest suggestion separately from an explicitly prepared rest. See the [iOS review](verification/ios-design-review.md). Existing schema migrations and inert v5 scene history remain necessary compatibility paths. Full backup/restore, dataset replacement and authored story collection remain unfinished; moving files does not implement them.

## Records modules

`RecordsScreen` owns composition, status copy and the visible month selector. `useRecordsBrowser` owns the stateful reading session and its DOM restoration. Those responsibilities are intentionally different: moving all position effects into individual rows would make cross-page inserts, removals and returning from a source record harder to coordinate.

`ThoughtEntry` renders one thought, `RecordsFavorites` renders saved quotes and the welcome note, and `RecordsPagination` provides identical controls for history and favorites. `RecordEntry`, `RecordsRoom` and `WeekChart` remain the established reusable components. The hook dispatches existing edit callbacks; it does not write user data.

## Cleanup decisions

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
