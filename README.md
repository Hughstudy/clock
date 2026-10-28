# Whale Focus

A mobile-first Pomodoro-style focus timer that runs entirely in the browser,
saves progress in `localStorage`, works offline, and can be installed to a
phone home screen. Whale-chan keeps you company: finish a focus session and
she gets a bowl of rice; reset one early and she cries (nothing is lost).
Built with React 18, TypeScript, Vite and rough.js.

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
| `src/logic/` | Pure domain functions: timer transitions, accounting, calendar/streak, snapshot validation and merging, seeded rough.js sketches. No React, DOM, storage or clock access. |
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
- Writes need the Web Locks API; without it, saved data is shown read-only.
- Service-worker caches are namespaced `whale-focus`; cache cleanup never
  touches saved progress.
- When a new version is deployed, the app offers a reload between sessions
  rather than forcing one during a countdown.

## Credits

Whale-chan is a fan-made, non-commercial character inspired by the Chinese
community's DeepSeek Whale-chan (character designs by Bilibili artists
ZipZipPipe and 上善无形). She is drawn in code from the shapes in
`src/data/pet-spec.json`; no fan artwork is included in this repository.
This project is not affiliated with or endorsed by DeepSeek.
