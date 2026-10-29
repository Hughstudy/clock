# Whale Focus

This branch continues the supplied 2026-10-29 PRD v3 handoff, including the first focus slice: start, pause/resume,
manual early ending, actual-time history, participation at start, and automatic
recovery from the saved deadline. The final character and product name remain
undecided. The user selected a soft, round blue creature with expressive arms for this working prototype. The home screen now uses original rough.js artwork, short event-driven gestures, quiet focus and reduced-motion poses. Read [PLAN.md](PLAN.md),
[AGENTS.md](AGENTS.md), and the [shared development register](https://chatgpt.com/library?file_id=libfile_c81e264086d88191828a7654a36d7421&account_id=personal)
for ownership and handoffs. Thought capture, full 7/30-day review, rewards,
backup/import/clear UI and final visual design are still pending. Nothing on this branch has been published.

The companion module is connected to actual saved start/pause/resume/end/rest events. Click the creature for encouragement; Enter works too. Copy never rotates on a countdown tick. Early and full endings have equal gestures, and reload/cross-tab recovery never replays them. Animation can be disabled in Settings; the operating system’s reduced-motion preference always wins. Focus and Records are the two main destinations, with Settings in the header.

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

See [the continuation report](docs/verification/friendly-companion.md) for source comparison, checks, browser evidence and remaining device work. The [supplied handoff](docs/handoff-20261029/README.md) and PRD are retained as immutable reference snapshots, not a live task board.

## Credits

Whale-chan is a fan-made, non-commercial character inspired by the Chinese
community's DeepSeek Whale-chan (character designs by Bilibili artists
ZipZipPipe and 上善无形). She is drawn in code from the shapes in
`src/data/pet-spec.json`; no fan artwork is included in this repository.
This project is not affiliated with or endorsed by DeepSeek.

The blue creature in `src/data/companion-spec.json` is new original procedural artwork, separate from the retained legacy character and install icons. Its named parts, palette, poses and animation timings are validated and cached; animations cannot change time or saved records.
