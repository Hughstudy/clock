# Whale Focus

The implementation baseline `e6daa66` contains the supplied 2026-10-29 PRD v3 handoff and
the blue companion integration. This includes start, pause/resume, manual early
ending, actual-time history, participation at start, and recovery from the saved
deadline. On 2026-10-29 the user requested committing and pushing this baseline
and the English workstream plans. Check [GitHub Actions](https://github.com/Hughstudy/clock/actions)
for deployment results. This publishes the current prototype; the planned P0
features below are not yet complete.

The user selected a soft, round blue creature with expressive arms for the
working prototype. Home uses original rough.js artwork, short event-driven
gestures, quiet focus and reduced-motion poses. Final artwork, product name and
brand assets remain open. Thought capture and draft recovery are implemented. Full history/reflection,
additional rewards and favorites, backup/restore/clear UI and final branding remain pending.

The English [PLAN.md](PLAN.md) is the current review draft: it records the PRD
gaps, proposed choices, shared interface and integration order. Work is split into
the [Animation Plan](docs/plans/ANIMATION_PLAN.md) (art, poses, contact and motion)
and [Main Logic Plan](docs/plans/MAIN_LOGIC_PLAN.md) (timer, thoughts, records,
rewards, persistence and functional screens). Main logic provides read-only
results and permitted cues; animation never changes time, saved data or rewards.
Both can be developed independently against the agreed interface. The approved
2026-10-31 refinement is implemented: eleven immediately available scenes, shared
rounded-hand contact poses, progress-based activity development, C2-P3 and snapshot v6.
See [animation verification](docs/verification/animation-refinement.md).
See [AGENTS.md](AGENTS.md) for
engineering and collaboration rules. The [supplied handoff](docs/handoff-20261029/README.md),
[PRD v3](docs/handoff-20261029/番茄钟_产品PRD_v3.md) and
[register snapshot](docs/handoff-20261029/番茄钟_开发协作.md) are historical source
references, preserved in their original language; no cloud register has been
updated. Maintained local project documentation uses English. This documentation
preference does not change the application's UI language.

The companion module is connected to actual saved start/pause/resume/end/rest events. Click the creature for encouragement; Enter works too. Copy never rotates on a countdown tick. Early and full endings have equal gestures, and reload/cross-tab recovery never replays them. Animation can be disabled in Settings; the operating system’s reduced-motion preference always wins. Focus and Records are the two main destinations, with Settings in the header.

Open **记录** to see the orchard at the device’s local hour. Expand a saved focus entry to see which discovery the blue companion found in its book. Its story stays with that entry. [Records design and browser checks](docs/plans/RECORDS_COMPANION_PLAN.md)

A mobile-first Pomodoro-style focus timer built with React 18, TypeScript,
Vite and rough.js. Early and full endings receive equal supportive feedback.
Actual time excludes pauses, includes sub-minute sessions, and is saved locally.
The optional five-minute start does not change the default 25-minute setting.

See [PLAN.md](PLAN.md) for scope, invariants and acceptance checks, and
[AGENTS.md](AGENTS.md) for architecture rules.

## Develop

Requires Node.js 20.19+ (CI uses Node 24).

```bash
npm ci            # install from the lockfile
npm run dev       # dev server at http://localhost:5173/ (service worker disabled)
npm test          # unit and architecture tests (Vitest)
npm run typecheck # strict TypeScript, including a DOM-free check of src/logic
npm run build     # typecheck + production build into dist/
```

Preview the production build under the same subpath GitHub Pages uses:

```bash
BASE_PATH=/clock/ npm run build && BASE_PATH=/clock/ npm run preview
# open http://localhost:4173/clock/
```

`npm run icons` redraws `public/favicon.svg` from Whale-chan's face and
regenerates the PNG install icons from it. A test fails if the SVG drifts from
the drawing data.

## Layout

| Path | Contents |
| --- | --- |
| `src/logic/` | Pure domain functions: timer transitions, accounting, calendar, snapshot validation and merging, seeded rough.js sketches. No React, DOM, storage or clock access. |
| `src/data/pet-spec.json` | Tunable timer defaults and bounds, cadence, calendar week start, sketch seeds, palette, and Whale-chan's parts, poses, captions and reaction timings. Validated by `src/logic/spec.ts`. |
| `src/data/companion-spec.json` | Original blue companion shapes, palette, semantic poses and animation timings. |
| `src/adapters/` | Browser effects: `localStorage` snapshot store, Web Locks, local calendar dates, sound, page lifecycle. |
| `src/hooks/` | React coordination between adapters and logic. |
| `src/components/`, `src/screens/` | Presentation only. |

## Deploy

`.github/workflows/deploy.yml` deploys on every push to `main`: it installs
from `package-lock.json`, runs the tests, builds with the repository's Pages
base path (from `actions/configure-pages`), and publishes `dist/`.
One-time setup: in the repository's **Settings → Pages**, set **Source** to
**GitHub Actions**.

## Data and updates

- All data lives in one versioned snapshot under the `whale-focus:snapshot`
  key. Unreadable or partially invalid data is copied to a
  `whale-focus:snapshot:backup:<timestamp>` key before anything is replaced;
  if no copy can be made, the original is left untouched.
- Schema v3 migrates v1/v2 completions to ended focus records and participation,
  preserving IDs, totals and dates. Unknown legacy start times remain null.
- Start, pause, resume and end write immediately under a short lock. A running
  session continues while the page is hidden or closed, capped at its saved
  deadline. Reopening settles at most that one session, silently. A paused
  session stays paused. There is no reliance on an unload event or background
  execution, and no guarantee of a locked-screen alarm.
- The UI distinguishes saving, saved, pending, memory-only and read-only.
  Failed writes keep memory state and retry; a process killed before a write
  succeeds cannot recover that unsaved change. Browser data eviction/clearing
  can remove local history. No cloud backup is implied.
- Writes need the Web Locks API; without it, saved data is shown read-only.
- Service-worker caches are namespaced `whale-focus`; cache cleanup never
  touches saved progress.
- When a new version is deployed, the app offers a reload between sessions
  rather than forcing one during a countdown.

## Current verification

See [the continuation report](docs/verification/friendly-companion.md) for source
comparison, checks, browser evidence and remaining device work. Its branch and
integration status describe the time of testing; the baseline and publication request above
reflect subsequent actions. The documentation update did not rerun application
tests. The [supplied handoff](docs/handoff-20261029/README.md) and PRD remain
immutable reference snapshots, not a live task board.

## Credits

Whale-chan is a fan-made, non-commercial character inspired by the Chinese
community's DeepSeek Whale-chan (character designs by Bilibili artists
ZipZipPipe and 上善无形). She is drawn in code from the shapes in
`src/data/pet-spec.json`; no fan artwork is included in this repository.
This project is not affiliated with or endorsed by DeepSeek.

The blue creature in `src/data/companion-spec.json` is new original procedural artwork, separate from the retained legacy character and install icons. Its named parts, palette, poses and animation timings are validated and cached; animations cannot change time or saved records.

## Animation review and keyframes

The workbench in `preview/animation` supports exact contact scrubbing, normal/slow playback and interruption fixtures. Catalogue and contact sheets share the production renderer; regenerate them with `python3 docs/plans/assets/build-storyboards.py`.

```bash
node scripts/animation-review.mjs
node scripts/record-scene-motion.mjs
SCENE_BROWSER_CHANNEL=chrome npm run test:e2e
```

These commands use isolated browser profiles and print their artifact directory. Set `ANIMATION_REVIEW_OUTPUT`, `ANIMATION_VIDEO_OUTPUT` or `SCENE_E2E_OUTPUT` to retain results at a chosen path. Desktop browser evidence is separate from physical-phone acceptance.
