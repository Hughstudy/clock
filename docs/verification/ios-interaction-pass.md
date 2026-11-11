# iOS interaction and layout pass — 2026-11-12

On November 11, 2026 the owner asked for the interaction and overall layout to be reviewed: it "didn't look attractive", and should follow standard Apple design and iOS best practice while staying attractive. A review, ideas and a phased plan were presented first, then previews made on the real app with temporary styles. On November 12 the owner approved the two-row card with the end confirmation ("I like this, you could continue to implement"), pointed at the stepped-aside screen ("too much empty space under time"), asked for new research and an improvement, and authorized implementation and publication once everything was confirmed. This report records what changed, why, and what was checked. It builds on [focus-layout-hig.md](focus-layout-hig.md), [focus-step-aside.md](focus-step-aside.md) and [ios-design-review.md](ios-design-review.md).

## Sources

**Apple's Human Interface Guidelines**, read on November 11, 2026 from Apple's own text, including pages revised during 2026: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Modality](https://developer.apple.com/design/human-interface-guidelines/modality), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls), [Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles), [Steppers](https://developer.apple.com/design/human-interface-guidelines/steppers), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Going full screen](https://developer.apple.com/design/human-interface-guidelines/going-full-screen), [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) and [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics). The rules used are named in the table below. Apple gives no phone margin, corner radius or animation duration; those stay project decisions.

**Time and character on one screen**, researched on November 12, 2026:

- iOS closes the gap between the Lock Screen time and the photo's subject: since iOS 26 "the time fluidly adapts to the available space in an image" ([Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/)). Apple does it with taller numerals, which the owner had rejected for this app, so the gap is closed here by moving the time and the companion instead.
- On Apple Watch character faces the time touches or adjoins the character ([Apple Support](https://support.apple.com/guide/watch/faces-and-features-apde9218b440/watchos)).
- Proximity decides what reads as related: "varying amounts of whitespace to either unite or separate elements" ([NN/g](https://www.nngroup.com/articles/gestalt-proximity/)); "Group related items" ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout)). A wide band of sky tells the eye the time and the companion are unrelated.
- In the focus and companion apps whose running screens could be inspected (Focus Friend, Forest, Pokémon Sleep, Tiimo), the readout adjoins the subject or sits with the controls; none leaves a wide empty band between them. These positions were read from published screenshots and are approximate.

**What a web app cannot do on iPhone.** Safari has no vibration API, and the label-click workaround was closed during 2026, so feedback here is motion and optional sound. Live Activities and the Dynamic Island are unavailable to web apps. These were taken from WebKit and web-platform status pages and were not tested on a device in this pass.

## What changed and why

| Finding in the review | Now | Guideline or reason |
| --- | --- | --- |
| Six controls in five styles on the card; 「给我一句鼓励」, the step, the timer buttons and the thought tools each had their own row | Two rows: the timer controls, then one row of three equal tools (encouragement, marker, thought), each an icon over its label. The count of this session's thoughts keeps a fixed fourth place, so a first note never moves a tool | Style, not size, marks the one preferred action; group by space |
| The main button was blue, brown or green by state, and the status was written twice | One blue accent in every state. The label above the time carries the target ("已暂停 · 目标 25 分钟"); the card no longer repeats it, and screen readers still get the full line | Use tint sparingly; do not carry state by colour alone |
| The optional step sat in the card | It sits under the time: a quiet capsule while preparing, a line of text while a session runs. Its slot keeps its height in every state, so the companion never resizes when a step comes or goes. Large text keeps it in the card's reading order | The PRD already places preparation items beside the target time |
| Ending opened a white form above the card and shrank the room to a thumbnail | A confirmation rises from 「结束专注」 and points at it, over a dimmed, inert page; the room keeps its size. Both answers are the same size, neither in an alarm colour. With no room above the button (large text, a short landscape) the same card sits in the middle with a short timer line | A confirmation springs from the control that started it; warn in proportion; a destructive style is not for an expected outcome |
| The time stayed at the top of the screen, about 200 px above the companion while the card was away and up to 270 px above it on a tall phone with the card shown | In portrait the label, the time and the step sit one two-line bubble above the head in every state, so the two read as one group; the title and Settings stay at the top. With the card shown the companion stands on the card and only the time comes down. While the card is away the spare height is shared: about six parts sky above the time, four parts floor under the companion, and the time and the companion arrive together. Screens with nothing to spare do not move. The step is not shown while the card is away. A sheet does not move the time, and a companion rising to look over a sheet steps out rather than reach it | Proximity and grouping; iOS closes this gap on the Lock Screen |
| The handle was a round button floating over the floor | The handle is the lowered card's own top edge with a grabber, so it reads as the card that left | A resizable sheet shows a grabber; hidden controls return with one tap |
| The thought editor, this session's thoughts, the full passing line and save details opened as a second card above the first, both in view | One bottom sheet: a grabber, a dimmed inert page, a close button, and a pull on the header that closes it. It rests on the soft keyboard and scrolls inside itself. A stray tap on the dimmed page closes nothing, so typing is never interrupted. The companion keeps its size and rises to look over the sheet with its whole face, or steps out when there is no room | One sheet at a time; a sheet has a grabber and supports a downward dismiss as well as a button |
| Records' four views were a 2 × 2 grid of bordered buttons; totals and the day list were bordered boxes | One segmented control (two rows of two at large text), a number-first summary, and each day's entries in one rounded group with hairlines. Month, status and thought editing use the same bottom sheet. Paging and all fixed labels are unchanged | Segmented controls switch views; grouped lists |
| Settings replaced the page, in one long card with a paragraph under every control and browser disclosure triangles | Settings is a sheet over Focus that covers the tab bar. Rows are grouped, each group has a quiet note under it, steppers are a value beside one minus/plus capsule, and the three explanations open in place with a chevron | A modal task is a sheet; a tab bar is hidden under a modal; switches belong in list rows |

Not changed, by earlier owner decision: the size of the digits, the reader and the duration ruler staying in the card, paging in Records, and all fixed copy.

## Behaviour that follows from modal sheets

A sheet now covers the card and the tab bar, and the page behind it is inert. Starting a rest, asking for encouragement or switching to Records therefore needs the sheet closed first. Closing keeps a draft exactly as before, and it can be continued from the card's 「继续草稿」 or from Records → 「只看想法」 → 「继续草稿」. The earlier path in which an open editor travelled with a tab switch is no longer reachable by touch; the history handling behind it is unchanged. Timing never pauses for a sheet or a confirmation.

## Geometry

Measured in CSS pixels in desktop Chrome on November 12, 2026, with a first-use profile and a daytime scene. "Gap" is from the bottom of the digits to the tip of the tuft.

| Viewport | Card height | Card band incl. tab bar | Time, card shown | Tuft, card shown | Time, card away | Tuft, card away | Gap while away | Smallest hit area | Smallest text |
| --- | ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: |
| 375 × 812 | 128 | 202 | 129–173 | 314 | 134–178 | 285 | 107 | 44 | 12 |
| 430 × 932 | 128 | 202 | 204–248 | 390 | 173–217 | 326 | 109 | 44 | 12 |
| 360 × 640 | 122 | 196 | 88–132 | 264 | 142–186 | 285 | 99 | 44 | 11 |
| 320 × 568 | 122 | 196 | 88–132 | 262 | 97–141 | 240 | 99 | 44 | 11 |

Before this pass the card was 142 high (band 224), the time read at 75–119 in every state, and the gap under it was about 200 at 375 × 812 with the card away and 271 at 430 × 932 with the card shown. With the card shown the gap is now the step's row plus the room kept for a two-line bubble and its tail; with the card away it is that bubble's room alone, so a passing line always fits between the time and the head. No horizontal overflow at any size. Tool labels are 11 px at widths of 360 px and below so six characters stay on one line.

Which scene a session draws is random, and the five wide-reaching scenes do not grow by 1.11 while the card is away, so the away columns differ by scene: the two short-screen rows above happened to draw different scenes.

## Checks

Environment: macOS 26.6.2 (25G83), desktop Chrome 157.0.8103.39 through Playwright, production bundles on the `/clock/` base. All runs are from November 12, 2026 on the final code.

| Check | Result |
| --- | --- |
| `npm run check` | Strict TypeScript; 40 Vitest files, 477 tests passed |
| `BASE_PATH=/clock/ npm run build` | Passed, including service worker generation |
| `scene-e2e` | 131 app checks, 30/30 and 67/67 scene checks passed |
| `verify-focus-interactions` | 107 passed |
| `verify-records-companion` | 118 passed |
| `verify-v35-persistence` | 21 passed |
| `verify-v35-update` | 15 passed |
| `verify-v35-panels` | 185 passed |
| `verify-ios-design` | 180 passed |
| `verify-ios-navigation` | 40 passed |
| `verify-focus-step-aside` | 139 passed |
| `verify-v5-compatibility` | Passed against archived `5119d1a`; current snapshot version 9 |
| `python3 scripts/check-prd-docs.py` | 17 PRD documents, 421 local links, 570 anchors, 48 dialogue candidates |
| `git diff --check` | Clean |
| Page and console errors in the browser suites | None |

The same suites passed on the unchanged code before this pass (792 passing lines), so the changes below are deliberate, not repairs.

Checks rewritten for the new interaction model:

- Three flows that pressed a control behind an open panel (start a rest with the status panel open, switch to Records with the editor open, ask for encouragement with the editor open) now close the sheet first and continue the same draft or retry.
- The keyboard order through the card is now pause, end, encouragement, marker, thought.
- The Settings close button is found by its name 「回到专注」 without the chevron.
- The landscape check that the old end panel stayed beside the card now checks that the confirmation is whole on screen.

Checks added:

- The end confirmation rises above its own button and stays on screen, or sits in the middle when there is no room.
- In portrait, with the card away, the time is no more than a two-line bubble and its margins above the companion's head, at every tested size.
- A short pull on a sheet's header leaves it open; a long pull closes it and keeps the draft.
- Settings is a sheet over Focus that covers the tab bar and leaves Focus out of reach.
- Unit tests for the grouping of the time with the companion (card shown and card away) and for the companion looking over a sheet or stepping out.

Every Focus state, every Records view, the sheets and Settings were also captured from the running app at 375 × 812, 320 × 568, 844 × 390, 430 × 932 at night and 375 × 812 at 200% text, and inspected by eye. The captures are not kept in the repository.

## Not covered

- A physical iPhone or iPad, an installed Home-Screen app, the real soft keyboard, VoiceOver and Larger Text set in iOS. Sizes, the simulated keyboard and 200% text are desktop-browser evidence only. The header pull was exercised with mouse pointer events, not a finger.
- Safari itself. This pass ran in desktop Chrome; the WebKit runs of the design and navigation suites were not repeated.
- The empty wall above the time while the card is shown, on tall phones. That space belongs to the room artwork, which is the animation workstream's; this pass moved only the time, the companion's position and the floor fill.
- Ideas from the review that were left for an owner decision or a real device: a 专注｜休息 switch beside the time (needs one new label), a keep-screen-on setting (needs a saved preference), a dark appearance for Records and Settings, drawing under the status bar in the installed app, and the View Transitions API (reports of crashes and flashes on iOS).
- The full P0 scope. Story chapters, the persistent cottage and backup/restore/clear are untouched.
