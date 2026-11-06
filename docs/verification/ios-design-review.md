# iOS design review and fixes — 2026-11-07

The final reviewed base is `c708f1e` on main: Claude's three design batches plus the PRD v37 migration and module-boundary refactor. The scheduled review began after the requested four-hour allowance from the clean local `4a94d44` checkout; fetching before publication revealed the three additional upstream commits. Those commits were preserved, the fixes were ported to the new Records and snapshot modules, and the current PRD map, relevant acceptance and code map were reviewed before repeating validation. Git status and file activity were checked before changing shared files. Work stayed on main, with file ownership coordinated among the reviewers. The blue companion, rough.js scenes, Chinese UI copy and supportive product rules were preserved.

The owner authorized autonomous correction and publication of concrete design, interaction and correctness issues. No unapproved story, backup, branding or platform expansion was implemented.

## Design basis

Official Apple guidance checked during this review: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) and [Typography](https://developer.apple.com/design/human-interface-guidelines/typography). The relevant principles are legible hierarchy, user-controlled text size, sufficient contrast, reachable targets, predictable focus/navigation and reduced motion. Native point measurements are not treated as literal CSS pixel conversions; this Web/PWA retains its existing minimum 44 CSS-pixel target requirement.

This is an implementation review using that guidance, not Apple certification or a claim that the entire PRD has passed acceptance.

## Corrections and observed results

| Finding in the reviewed baseline | Implemented behavior and evidence |
| --- | --- |
| The first marker moved the thought tools; repeating a tap at the original edge could open Write | The toolbar permanently reserves its count slot. Both tool rectangles stay unchanged before/after saving, and repeated edge taps create markers across all tested viewport/text combinations. The displayed count is capped at 99+ while its accessible name retains the full total. |
| At 320 px and 200% text, the expanding card covered the countdown | Large text uses a separate timer region and scrollable controls. DOM and keyboard order match the visible order. Landscape uses two columns; taller portrait screens retain a compact companion scene. Text and status content wrap without reducing the chosen font size. |
| Large-text duration panels could place Cancel above the clipped controls region | Plate-hosted panels become native modal dialogs in readable mode. Cancel and Apply remain reachable. Changing text size preserves the same input, value, caret and focus. |
| Press scaling shrank/moved targets during a gesture | Controls use brightness/opacity feedback with stable target geometry. The main target remains at least 44 px while pressed. |
| Paused dusk countdown contrast was about 2.27:1 | Dark ink `#14213b` against `#858eaf` gives about 4.95:1. The phase and title use the same legible treatment. |
| Reload inferred an automatic suggestion from historical records even after the person explicitly prepared rest | Snapshot v9 persists `restSuggestionSessionId`; only a deadline settlement creates it. Explicit preparation/start clears it, including preparing the same phase. Automatic suggestions can still expire after the configured hour; explicitly chosen rest cannot. |
| Offline readiness disappeared from both Home and Settings | New installations remain quiet on Focus; Settings → Application status exposes offline readiness. |
| Browser Back could leave the app from Settings/Records or mishandle transferred panels | Screen and local-task history have one presentation owner. Back closes the local task first, then returns through screens; Home Back can leave the app. Reload preserves the screen and recoverable draft without reopening a keyboard. |
| Back could unmount a valid focused Settings field before its blur save; WebKit did not restore a Records dialog's opener | Navigation blurs the old surface before unmounting. Valid edits persist through Back/reload; invalid drafts remain recoverable without corrupting the saved value. Records explicitly focuses its month/status opener before showing a dialog. |
| Rapid opposite-side touches jumped immediately between poses; keyboard pats did not move the body | Independent pose channels retain position and velocity when retargeted. Release-only keyboard contacts get a short presentation pulse and rebound. Reduced motion remains static. |

The root font respects the browser default and uses Safari's body text style where supported. A one-rem measurement selects the readable layout. Layout writes are scheduled outside ResizeObserver delivery; this eliminated the WebKit observer errors seen during the first review iteration.

## Data and contract safety

`C1-F2` now carries snapshot v9; the presentation contract remains `C2-P4`. The rest-suggestion identity merges atomically with the timer position. v8 cannot distinguish explicit idle rest from a suggested break, so migration preserves the timer mode and sets the identity to null instead of guessing. Historical idle rest therefore does not gain an inferred result or an automatic one-hour retirement. Active legacy timers still settle normally after migration. Records, totals, IDs, zones, drafts, preferences, favorites and scene assignments are preserved.

Unit and browser checks cover same-phase preparation, reload, delayed return, cross-tab prepare/start, failed writes and retry, late expiry, and older data. The compatibility helper also exercised actual archived v5 code at `5119d1a863d89cf1201358d2e4a8addfc6b8e841`: its active timer survives migration, and old received-update, missed-update and cold-load clients cannot overwrite v9. All six compatibility safeguards passed.

## Validation

Environment: macOS 26.6.2 (25G83), desktop Chrome 156.0.8078.80 and Playwright WebKit 26.5 (build 2336). Production bundles used the `/clock/` base. WebKit keyboard checks used Option-Tab, which includes all controls under its default macOS keyboard-navigation preference.

| Check | Result |
| --- | --- |
| `npm run check` | Strict TypeScript; 36 Vitest files, 412 tests passed |
| `BASE_PATH=/clock/ npm run build` | Passed, including service worker generation |
| `SCENE_BROWSER_CHANNEL=chrome npm run test:e2e` | Eight suites, 662 checks passed |
| Chrome suite breakdown | Scenes 115; Focus 101; Records 114; persistence 21; updates 15; panels 180; iOS design 92; navigation 24 |
| WebKit production checks | iOS design 92 and navigation 24 passed |
| Companion animation review | 425 checks; p95 frame sample 16.7 ms, no frames above 50 ms in that sample |
| Actual v5 compatibility helper | Six safeguards passed |
| `python3 scripts/check-prd-docs.py` | 17 PRD documents, 409 local links, 568 anchors and 48 dialogue candidates checked |
| `git diff --check` | Passed |
| Browser page/console errors in design and animation checks | None in final runs |

The upstream refactor retired four obsolete legacy-only unit tests; the final count is 412 (393 upstream plus 19 regression tests added here). Its Records search checks and snapshot module split are preserved.

The design matrix covers 320×568, 375×812, 430×932 and 844×390 at 100%/200% root text. Existing suites add short landscape, both motion preferences, all eleven scenes, keyboard and focus return, panel reflow with a simulated keyboard viewport, normal and failed-save states, persistence races, protected updates and source-aware Records journeys. The two new suites are included in `test:e2e`, so the main deployment workflow runs their Chrome checks.

Machine-readable evidence is in [ios-design-review/](ios-design-review/). It records individual assertions, browser versions and errors. Historical batch reports remain unchanged.

## Pictures and limits

Actual before screenshots were rendered from an isolated archive of `c708f1e`, using installed dependencies without changing the development checkout. After screenshots were rendered from the reviewed production build. The supplied comparison pictures arrange and label those captures; they are not AI mockups. They show 320 px / 200% text and paused dusk at 375 px; additional captures cover tall large-text layout, landscape, Focus, Records and Settings. Generated screenshots stay outside the repository, consistent with the project's existing verification practice.

Desktop WebKit is not a physical iPhone or a shipped Safari version. Physical iPhone Safari/PWA installation, real soft-keyboard behavior, OS Larger Text, VoiceOver and locked-screen behavior remain unverified. Simulated viewport changes and keyboard navigation are reported only as desktop browser evidence. Scrolling is intentional when enlarged text cannot fit at once. Full P0 backup/restore/clear, story acceptance and final branding remain separate work.

## Delivery

The report above records local implementation and validation. The authorized main push triggers the existing GitHub Pages workflow. Workflow success and the live published assets must be checked separately after the release commit; they are not implied by a successful local build. The completion message records those publication results and the release SHA.
