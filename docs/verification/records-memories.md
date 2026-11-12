# Focus and rest memories in Records

Verified November 12, 2026 on macOS 26.6.2. The production build used the `/clock/` base. The Records checks used desktop Chrome 157.0.8103.51 and isolated local profiles.

## Reading and navigation

- A first visit showed the room and a readable welcome letter. After saving sessions, the same space featured a picture with its activity, date and mode. Opening a picture from the timeline or postcard displayed the matching original. Back returned focus to the opener.
- Phone layouts at 320, 375 and 430 CSS pixels kept all four modes accessible. The room offered eleven named picture targets and equivalent text controls. The search field and room source links remained usable at 200% text.
- The mixed-history check pictured a 23-second rest above three focus memories. The focus total stayed at 40 seconds. A separate run covered a rest that expired across midnight and retained its original deadline and recorded day after reload.
- A failed write produced no saved rest picture. Retrying created one picture source for that session. Repeated activities led to each separate source, and 1,000- and 10,000-record fixtures exercised month selection, search, paging and return positions.
- The production Records suite completed 131 checks with zero page or console errors. Desktop WebKit 26.5 also passed the navigation suite covering Back, focus restoration, resizing and large text.

## Data and coverage

The production build and all 491 unit tests passed. The archived v5 client correctly rejected v10 data on cold load and before a stale-tab write. The model and storage tests cover manual and deadline endings, zero-length rests, competing tabs, failed saves, retries, dataset changes, and migration from older snapshots. Legacy migration uses at most the last verifiable rest. Older data may lack its civil date, break type, ending reason or scene.

Visual inspection used first-visit, populated timeline, rest detail and eleven-picture room screenshots. Physical iPhone and VoiceOver testing remain open.

## The other three Records views

- In Thoughts, two notes and an empty marker created from Focus survived reload. A search matched the expected note, which could be opened by keyboard and put away. The notebook kept the search and month controls available on an empty history.
- In Scenes, a fixture with eight focus and three rest activities showed eleven picture targets and eleven named list entries. Both routes opened the matching source records. Returning from a record and then from its activity restored focus to the original picture or named entry.
- In Favorites, saving three encouragements from Focus put the newest saved text on the cover. The other sentences could be reread individually. An empty collection offered a welcome letter. Back closed its sheet and restored focus to the envelope.
- Desktop Chrome 157.0.8103.51 exercised the three views at 320, 375 and 430 CSS pixels, including 200% text. The room targets and favorites controls remained at least 44 CSS pixels, and the search field and button fit together without horizontal overflow.
- The updated production Records suite passed 137 checks in Chrome. Desktop WebKit 26.5 passed 39 additional checks across the three tabs, including editing a thought out of its current search and returning to the results. A 100-character unbroken query stayed within the 320-pixel viewport at 200% text. Neither engine reported console or page errors.
