# Companion-first phone layout

The owner approved this implementation on November 3, 2026. It builds on `9bc55c4` and the v35 interaction increment.

## Focus

The preset row has been removed. On first use the readout is 25:00. A tap starts the displayed length. Holding Start for 450 ms or activating the time readout opens the same dial. The dial supports one-minute steps from 1 to 120, continuous rotation across twelve o'clock, keyboard input and direct number entry. A release leaves a preview. Applying the draft prepares that length and Cancel restores the previous choice. The next explicit start reuses the existing duration-memory and accounting rules.

Timer commands occupy the primary group. Marking and writing a thought remain separate one-step tools. Requested encouragement uses 56 first-person phrases across four categories. A speech bubble sits in measured clear space above the character. The controls share the plate with the thought toolbar. Tight layouts can place the phrase on the plate or use an independent reader with a timer summary. Quote IDs remain stable. Previously saved favorites retain their original text and content version.

## Records

All Records offers a narrow preview of the window room. Short screens, enlarged text and the hidden-scene preference can use a text entry. Opening Life Scenes shows the room and an illustrated shelf. Every confirmed focus record with a known activity contributes to that activity's picture tag, including zero-time records and records with unknown dates. Repeated assignments share one tag. Untagged records are still accessible in All Records. Rest, pending writes and initial furniture do not generate tags.

The picture and its text entry open the same paginated sources. Returning from an original record restores the originating item, and returning to the room restores the selected tag. The default history retains its own month, page and position. The shelf is a read-only view of existing records and requires no storage migration.

## Local verification

Environment: macOS 26.6.2, Node 26.12.1 and desktop Chrome 156.0.8078.80. Browser checks used isolated profiles and the production `/clock/` base. Touch and soft-keyboard checks used emulation. Physical iPhone/Android, installed-device behavior and real screen readers remain unverified.

Matched portrait measurements used the same viewport, default text size, reduced motion and an empty first-use profile. Heights below are CSS pixels rounded to the nearest pixel. The bottom navigation kept the same position in all three comparisons.

| Viewport | Previous scene height | New scene height |
| --- | ---: | ---: |
| 320 × 568 | 200 | 244 |
| 375 × 812 | 409 | 463 |
| 430 × 932 | 529 | 583 |

The underlying SVG also grew at every size. At 375 × 812 its rendered width increased from 518 to 588 CSS pixels. Opening encouragement preserves the scene, SVG, digits, timer action and navigation bounds. The character can change facial expression and arm pose. The visible bubble clears the face.

Reproducible checks:

```sh
npm run check
BASE_PATH=/clock/ npm run build
SCENE_BROWSER_CHANNEL=chrome npm run test:e2e
```

The browser suite covers a continuous touch from Start through rotation, release without starting, crossing twelve, system cancellation, stale releases after another tab starts a session and cancellation after switching tasks. Records checks include all eight picture tags at 320/375/430 pixels, equivalent text access, 20-item pages, 1,000 and 10,000 records, cross-tab insertions and source-aware Back. The persistence and PWA suites cover failed writes, retries, old favorite text, paused offline recovery and guarded updates.

Strict TypeScript and all 390 tests passed. The production browser run passed 60 timer/scene, 46 focus, 111 records, 21 persistence, 15 PWA and 81 adaptive-layout checks, plus 30 touch and 67 scene fixtures. The production build precached 20 entries.

An additional fresh-profile production check opened a bubble, favorited its phrase, set a 35-minute preparation, explicitly started, paused and ended it, found its saved activity through the room and returned to its tag. Local verification and the subsequent GitHub Pages deployment are separate.
