# Focus speech and Records detail checks

Verified on 2026-11-12 using Chrome 157.0.8103.51 and Playwright WebKit 26.5 on macOS. Phone and iPad viewports, enlarged text and touch input were emulated. Physical-device and VoiceOver testing remain open.

## Focus

- At 375 × 667 and an 18px root font, the complete ASKB11 phrase from the approved design appeared above the companion. Its tail pointed to the character and the next-phrase, favorite and category controls were directly reachable. Opening and closing the bubble kept the timer, primary controls, tools and tabs at the same coordinates.
- At 320, 375 and 430 CSS pixels, a marker followed by a successful favorite left all three bubble actions tappable. A simulated full store kept the failure and retry visible. At the shortest size this used the compact reader. Retrying successfully restored the confirmed favorite state.
- At 200% text the reader and its actions were accessible in the scrolling control card. Switching categories, cancelling the native selector, opening the thought editor and cancelling end confirmation preserved the expected phrase and keyboard focus.
- The optional intention has a visible label during editing. The duration, intention and Done controls each have a 44px target. The step-aside checks exercised an uninterrupted countdown, recall, pause and end.

## Records

- The album cover, an activity picture, its text index, a saved quote and the welcome letter each opened one reading sheet. In mobile WebKit the background scroll offset stayed fixed, including when the index was scrolled all the way to its last item. Closing restored focus to the opener.
- In a 375 × 667 WebKit viewport, tapping and closing a thought in All Records held the background at 402px scroll. The equivalent notebook marker stayed at 308px. Editing returned to the same reader, including when the updated text fell outside the active search.
- Opening a room picture, reading one original focus or rest session and going back preserved the source list's own scroll position. A second tab inserting a source or moving a favorite across a pagination boundary kept the open item bound to its original identity.
- The browser checks covered 200% text, keyboard dismissal, touch, scroll gestures over the backdrop, failed favorite removal and retry. The same two navigation tabs stayed in place when the Records page acquired a desktop scrollbar.

TypeScript, 491 unit tests and the production build passed. The production Records suite passed 154 checks, the Focus panel suite passed 254, and the WebKit step-aside suite passed 137.
