# Reading chapters in the existing Focus room and Records book

The November 26 reading integration starts from `d628de191`. The [reading chapter](../prd/12-stories.md#reading-chapter) uses the normal F3 activity selection and original session duration. The versioned content includes the one-minute bakery illustration, a 25-minute first reading, and an independent reread after the first saved bookmark move.

## What was verified

- Strict TypeScript and 578 unit tests across 43 files passed. New tests cover 0 seconds, reached excerpts, held poses, paused recovery, manual and natural endings, timing edits, concurrent schedules, failed saves and retries, generation changes, and old unbound F3 records.
- Snapshot v12 carries the authored binding and archives the printed words and illustration identity. The archived v5 decoder rejected v12 on cold load, receipt of an update, and a missed update followed by a write. A direct v11 migration test preserves ordinary records and running scenes without adding a chapter.
- The production build passed with the Pages base `/clock/`. Its service worker includes the new book and dog illustrations. Vite reported the existing 500 kB bundle-size advisory.
- Production browser runs in Chrome 158.0.8127.88 and desktop WebKit 26.5 used the public controls and actual activity rotation. At 21:15, pausing and reloading held the spread. Confirming the manual ending displayed the existing elapsed/saved row and short-break selector. The hand journal carried the reached sentence, and its F3 activity tag remained available. The room ticket first appeared after the 25-minute natural ending and linked back to the correct saved record. Reading continued to use the original schedule when an edit shortened a 25-minute session to 18 minutes.
- The one-minute chapter displayed the cap first on the dog's head and later in its mouth. Its naturally elapsed record showed the corresponding illustration and excerpt. The mobile-size checks covered 320, 375 and 430 CSS pixels, 200% text, reduced motion, and a keyboard return to the ticket. No page or console errors were reported in these flows.
- A separate Records review ran on Chrome 158.0.8127.88 and desktop WebKit 26.5 with saved story fixtures. Both engines displayed the two cap poses, the closed book and its source, including the text-only path when artwork was disabled. The existing eleven-activity scene suite passed its 145 app checks and both renderer fixture suites (30 and 67 checks).

Browser coverage used desktop phone emulation. Physical iPhone, Android and screen-reader checks remain open.
