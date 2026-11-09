# Full-screen companion with called-out controls: verification

Date: 2026-11-09. Scope: the Focus screen on iPhone and iPad. See the [PRD rule](../prd/02-features.md#focus-step-aside) and the [plan note](../../PLAN.md).

## What changed

- **Stepping aside.** During an untouched running countdown, the card, tabs, title and Settings leave after 4 seconds, and after 8 seconds once called back. `logic/focus-chrome.ts` makes the decision and `hooks/useFocusChrome.ts` owns the timers. Values are in `data/app-spec.json`. Nothing here reads or writes timer state.
- **Calling back.** The handle or the empty room brings the same card back in place. A pat on the companion does not. Controls ignore taps for 300 ms after a call-back, so one gesture cannot press them.
- **What holds the card.** A finger on the controls, keyboard focus inside them, an open panel, a short confirmation, a save problem, or a pending timer command. A mark's undo lasts all session, so it does not hold the card. It stays available in the card.
- **Portrait.** The room and companion move closer when the card leaves. Plant, Tea, Bubbles and Boat settle lower without growing, because their hands or items reach toward the edges.
- **Tall landscape (600 CSS pixels or more).** The room runs under the floating card and only the room is enlarged. The scene moves left while the card is out, then returns to the centre. Local panels stay in the space beside the card.
- **Unchanged.** Ready, paused and ended states, shorter landscapes, and the large-text layout. The hint uses the existing session count and adds no saved data.

## Results

| Check | Result |
| --- | --- |
| `tsc -b` | Passed |
| Unit tests | 462 passed |
| `scripts/verify-focus-step-aside.mjs` | 263 checks passed, no browser errors |
| Existing production flows in Chrome: scene, focus interactions, records, persistence, update, panels, iOS design and navigation | All passed |
| `verify-ios-design` and `verify-ios-navigation` in WebKit | Passed |
| `/clock/` production build | Passed |

Browsers: Chrome 156.0.8078.80 and Playwright WebKit 26.5, as desktop emulation. Chrome was used through `SCENE_BROWSER_EXECUTABLE` because this Playwright version's own Chromium was not installed. The deployment workflow runs Chromium only; run the WebKit pass locally with `IOS_BROWSER=webkit`.

The step-aside check covers 320×640, 375×812, 430×932, 744×1133, 820×1180, 1180×820 and 1024×768 in both browsers. The full behaviour flow runs at 375×812 and 1180×820 in both browsers. In Chrome, all 11 scenes run at 6%, 50% and 94% of a session at 1180×820, 1024×768, 820×1180 and 375×812. That walk confirms hands stay clear of the card and on screen, the head stays below the time, and the handle and hint do not cover the companion.

Older control checks now hold the card on screen with `holdFocusCard` in `scripts/lib/browser.mjs`, so they keep testing the controls themselves.

## Measured layout

Across all 11 scenes at the three session points:

- **iPad landscape, card out:** every hand clears the card by at least 86 px at 1024×768, 105 px at 1180×820 and 126 px at 1366×1024. Only Bubbles' drifting bubbles pass under the card, by up to 43 px. Table ends can also sit beneath it.
- **iPad portrait, card away:** hands and held items stay on screen, with at least 5 px to spare.
- **iPhone, card away:** hands stay on screen by at least 7 px. Tea and Bubbles items can extend up to 9 px past the edge at 375 and 430 wide.

## Not verified

- The owner tried the stepping-aside build over Wi-Fi and replied that it feels right, but device models and OS versions were not recorded. The full-screen landscape room was reviewed from real-app screenshots only.
- The no-explanation test with a first-time user ([T-FQ20](../prd/07-acceptance.md#t-fq20)), VoiceOver, installed PWA mode and the soft keyboard on physical devices remain open.
