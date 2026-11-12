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
