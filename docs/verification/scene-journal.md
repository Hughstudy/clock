# Scene journal verification

Verified on 2026-11-25 with the production build served at `/clock/`. Chrome 158.0.8127.88 and Playwright WebKit 26.5 ran on macOS. Phone and tablet dimensions were emulated.

| Check | Observed result |
| --- | --- |
| Eight focus and three rest activities | Each activity exposed a reachable closed journal on its own table, floor or mat. Both the prop and the Records tab opened the current reading visit. Returning placed the cover at the original coordinates. |
| First opening and cover movement | The physical prop matched the first moving frame. Samples from the tea table, paper boat and cloud cushion reached the foreground as a closed book, turned around the left spine, then matched the actual Records paper. With a cold cache and 300 ms image delays, the empty and populated first pages displayed their artwork before the cover opened. |
| Timing and navigation | Paused sessions retained their identity and remaining duration. Running sessions retained their deadline and activity. Browser Back and Forward worked during a turn. Starting a timer on return worked immediately. A deadline during opening produced one persisted record. |
| Keyboard, touch and reduced motion | A second activation settled the turn. The arriving page accepted bookmark input and owned keyboard focus. Reduced motion switched directly. Holding the prop for 5.2 seconds with the card visible or tucked kept the target in place until release. |
| Screen fit | All eleven placements were checked at 320×568, 375×760, 430×932, 740×390, 1024×768 and 1440×900 CSS pixels, plus 320×568 with 200% text. The timer controls and navigation left a usable 44 px book target. |

The [journal regression](../../scripts/verify-scene-journal.mjs) runs in `npm run test:e2e`. Run `IOS_BROWSER=webkit node scripts/verify-scene-journal.mjs` for the WebKit variant. The [Records regression](../../scripts/verify-records-pages.mjs) also checks opening the cover on a direct Records reload.
