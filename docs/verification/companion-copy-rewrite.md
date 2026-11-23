# Companion catalog rewrite and conditional copy verification

Date: 2026-11-23. Baseline: `12d7bfcde2cb97fe6d6a6a41256dbbada1585219`.

The owner authorized applying the archived learning to the catalog, directly replacing or deleting unsuitable lines. The final catalog contains 239 entries: 158 optional automatic lines and 81 requested texts. Pool sizes are RET 24, STA 71, END 13, ZER 4, BRK 46, ASKG 35, ASKS 15, ASKB 15 and ASKT 16. Compared with the previous published 61 entries, 11 texts are retained, 46 rewritten, four removed and 182 added. Against the unpublished 260-entry draft, 25 are retained, 188 rewritten, 47 removed and 26 added. These comparisons use IDs and exact text, not subjective quality scores.

The node copy version is `companion-moments-v3`; requested copy is `companion-voice-v4`. Current PRD 09 mirrors the resource. The learning record explains editorial decisions, while prior research and review reports retain their historical scope. New text includes concrete preferences, observations, small accomplishments and independent stories, with direct responses retained for ordinary moments. Automatic text has at most 30 characters in this revision; requested text has at most 79. These are descriptive measurements, not permanent schema limits.

The existing uncommitted conditional-selection implementation is included after review. `form` and `topic` are editorial only. `when` filters authored facts using presentation-time local hour, captured focus duration and the enabled session scene. Missing context excludes conditional lines. Random draws still exclude only the immediately preceding ID in the same pool; a fresh app opening obtains a fresh seed. Hour changes do not trigger speech. Existing 30-second automatic cooldown, approximately four-second Focus step-aside, silent tool events, explicit-reader priority, timer accounting and persistence remain unchanged. Saved favorite snapshots retain their original text and version until explicit cancellation and re-favoriting.

## Validation

- Final TypeScript and all 41 unit-test files passed (537 tests); the production build passed. The build emitted a Vite chunk-size advisory at the 500 kB threshold.
- Documentation checks passed: 26 PRD files, 13 learning files, 747 local links, 602 unique explicit PRD anchors, 48 separate dialogue candidates and all 239 current runtime entries matched. `git diff --check` passed.
- The conditional-selection tests cover unknown facts, daypart and duration boundaries, combined conditions, enabled scenes, deterministic direct draws and generic fallback without hard-coding editorial pool sizes.
- The production-language suite now selects the longest real requested text (currently ASKT26, 79 characters) through the normal category control. It checks 320/375/430-pixel widths, 100%/200% root text size, complete text, viewport containment and keyboard access. Only the existing ID entropy is fixed for repeatability; the runtime catalog and UI are not replaced.
- Local browser execution was attempted through the existing launcher. The installed Chromium process was blocked by `process_singleton` socket permission; no sandbox bypass was attempted. Production-browser checks therefore run in the main-triggered CI before Pages deployment. A browser result is not claimed from local unit tests.

Publication, CI and Pages deployment are separate outcomes. This increment does not claim a physical-device study, clinical effectiveness, two-month user acceptance, finished story collection or final art acceptance.

## First CI attempt and scene-reader coverage

Run [45165982534](https://github.com/Hughstudy/clock/actions/runs/45165982534), for `c47b490`, passed the full 537-test unit suite and all 214 production-language checks, including the longest requested text at every target width and text size. A later scene check stopped at F8 because `inspectSpeech` assumed every requested quote used the head bubble; the longer ASKG25 selected the existing console-reader fallback, so bubble geometry was absent. The failed attempt did not deploy. The follow-up corrects both `scene-e2e.mjs` and the same assumption in `verify-v35-panels.mjs`. It validates the complete, accessible fallback with unobstructed controls, then uses the existing next-phrase control to reach a head-sized phrase at the original viewport and retains the bubble tail/hand/clock assertions for each scene. Longest-copy, favorites, keyboard, resize and stable-target checks remain. Both scripts pass syntax and whitespace checks; the complete CI is rerun before deployment.

## Completed production verification

Follow-up commit `ac71962a721d1d4fedaf0c1ecb97b1e17f6d4e47` passed [run 45166987178](https://github.com/Hughstudy/clock/actions/runs/45166987178). Both build and Pages deployment completed successfully. The Linux runner installed Chrome for Testing 151.0.7922.34 (Playwright Chromium v1234). All 537 unit tests, 214 language checks and the complete existing production suite passed, including every scene's head-bubble geometry and actual long-text fallbacks, longest requested text at three phone widths and 200% text, saved favorites, timer/record flows, panels, updates and interaction regressions. The site at https://hughstudy.github.io/clock/ serves this application revision. This final documentation-only record changes no deployed application files.
