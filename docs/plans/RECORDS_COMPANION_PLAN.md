# Records companion and storybook entries

Review draft, 2026-10-31. The user chose a short scene when opening Records and a story on each saved focus entry. The scenes, hours, copy and implementation below are proposals for that experience.

## A visit to Records

At 9:15 pm you tap **记录**. Beside the heading, the blue companion draws a book into the pool of light under its lamp. Its hands settle on the cover. The totals and history are readable from the first frame.

You open a 20-second entry from yesterday. The first line reads **已保存 · 20 秒**. Your own step and thoughts are identifiable as yours. A small illustration underneath shows the companion holding something up to the light. Its caption reads **伙伴的小故事 · 它从书页里接住了一片叶子。叶脉像一棵更小的树。** Tomorrow morning the room will look different. This entry will still have its leaf.

### What changes with the clock

Use the current device-local hour when the user enters Records. Give the existing orchard workroom four variations. These are illustrative clock bands, independent of geographic sunrise or bedtime.

| Local time | One gesture on entry | Settled picture |
| --- | --- | --- |
| 06:00–11:59 | The companion lifts the edge of the curtain to peek out. | Soft morning light and one paw on the sill. |
| 12:00–16:59 | It follows a butterfly outside the window with its eyes. | A bright window and a curious, tilted head. |
| 17:00–20:59 | It tilts a leaf until the low light shines through it. | Copper light on its palm and the veins of the leaf. |
| 21:00–05:59 | It pulls a book under the reading lamp. | A warm circle of light and two paws on the cover. |

Give each gesture about 1–2 seconds in a reserved space beside the page heading. Play at most once per deliberate entry. Crossing a time boundary or returning from the background updates the settled picture quietly. Tapping the already-selected tab, scrolling, expanding rows, receiving another tab's write or refreshing the countdown cannot trigger an entrance. Cancel a gesture when the page is hidden or the user starts interacting. An empty history gets the same welcome and its usual factual empty state.

### What belongs to an entry

The RPG element is a miniature encounter with a payoff the user can see. Prototype three illustrated endings for the companion’s reading adventure. One finds the pressed leaf and peers through it. Another unfolds a tiny map, traces its dotted trail and grins when it ends at a drawing of its own chair. In the third, a star-shaped scrap sticks to its nose. It goes cross-eyed for a moment, then tucks the star back between the pages. Pair each expression with its own authored caption so the joke also works in text. All three are available at any hour.

A collapsed entry shows its actual time or the existing zero-second wording, with a small still of its find. Opening the row shows the caption and larger still beside the existing details. Keep one row expanded, keep the touched row in view and preserve its focus when new data arrives. Each saved focus entry, including an early or zero-second end, gets one story. The draw uses neither elapsed time nor end reason. Repeats across entries are fine. The sketch belongs to the fictional companion, so a book can appear even when the user’s own task was something else.

## Research behind the design

- Studio rabbiko lets *Usagi Shima* sync its island’s day/night cycle with real time and describes play as untimed. Here, a similarly familiar place can acknowledge the hour while a night-shift visitor has access to all the same stories. [Developer press kit](https://usagishima.net/presskit/)
- In *Spirit City: Lofi Sessions*, combinations of activities and surroundings reveal hidden spirits. Adapt the connection between action and discovery at a smaller scale. Turning a page gives the companion something specific to notice, hold and react to. [Publisher press kit](https://gaming.lofigirl.com/spirit-city-lofi-sessions/press-kit)
- W3C describes how to disable nonessential motion triggered by an interaction and how to communicate a save result without moving focus. Use a settled illustration plus ordinary caption text for reduced motion. Route any fresh save announcement through the existing main-owned policy. [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Implementation sequence after review

1. **Review the first frames and endings.** Mock up the four header poses and three expanded entries at phone size. Check that the actual duration is easier to find than the story, that the object fits the rounded hands and that the find and expression still read in a single frame. Reuse the original book, orchard scenery and the production page-turn geometry. [Scenery and motion](COMPANION_SCENERY_AND_MOTION.md) · [Scene artwork](../../src/data/scene-art.ts)
2. **Establish which records are saved.** Today the list reads the working snapshot, which can contain a row after a write fails. Have the store/hook supply the identities of records confirmed by a successful read or write for the current dataset generation. Show a pending or memory-only row with its actual duration and appropriate status. Offer the existing retry when applicable. Once the row is durable, show its saved label and story. A retry, reload or cross-tab read must resolve to the same entry. Keep previous durable entries readable during an unrelated write failure. Unreadable/newer history gets its technical status. [Storage](../../src/adapters/storage.ts) · [Commit handling](../../src/hooks/useClockApp.ts) · [Records screen](../../src/screens/StatsScreen.tsx)
3. **Choose the story deterministically.** Start with a frozen v1 mapping from the saved session ID to the three stable story IDs. Use the same mapping for existing and new entries, including migrated entries. Test known IDs against expected stories and keep that mapping across releases. This makes the choice feel random on a new row and familiar on a revisit, with no extra save or snapshot migration. The story illustrates the entry and conveys no ownership or inventory. Historical dates continue to use the saved date key. Older ended records lack a captured time zone and the story needs no historical hour. [Record model](../../src/logic/types.ts) · [Existing seeded selection](../../src/logic/scenes.ts)
4. **Integrate a read-only Records view.** The calendar adapter supplies local hour from the existing clock. Main maps it to a band and supplies the renderer with the band, a one-shot visit identity, motion settings and the selected story ID. A band change alone updates only the still. Keep the view separate from the session-bound Focus scene contract. Respect the existing motion and scene-art choices. With motion reduced, show the final pose immediately. With scene art hidden, retain the facts and readable story in the expanded entry. History and controls work with the renderer absent. [App composition](../../src/App.tsx) · [Records view](../../src/hooks/useViews.ts) · [Presentation contract](../../src/contracts/presentation.ts)

## Acceptance before shipping

- Open Records at each boundary, including 05:59 → 06:00 and 20:59 → 21:00. Change device zone, cross midnight and return from a hidden tab. Only the current setting changes. A saved date and its entry story stay fixed.
- A saved zero-second entry carries the existing participation wording. Two 20-second records display a total of 40 seconds. Both have a story. Rest and an active timer do not create focus history.
- Force a failed write, retry, reload, open in a second tab and load an older snapshot. Check the durable marker against storage, preserve any pending result honestly and see the same story in both tabs. Reading history creates no writes, extra credit or success announcements.
- Inspect 320, 375 and 430 CSS-pixel widths, 200% text, keyboard and screen-reader reading order, OS/app reduced motion and scene art disabled. Verify the first row and controls stay usable throughout the entrance. Run the relevant tests, production build and browser flows. Record physical-device checks separately.

This review covers the Records entrance and per-entry stories. The wider L3 reward, collection and history proposals retain their separate review status. The product reference was the supplied PRD v3 revision 7 and register revision 9. The linked private library copies could not be checked for a later revision. [Handoff snapshot](../handoff-20261029/README.md) · [Main Logic Plan](MAIN_LOGIC_PLAN.md)
