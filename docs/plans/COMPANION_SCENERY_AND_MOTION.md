# Companion scenery and motion

## Review baseline

Reviewed local main at `cdd6be3` on 2026-10-31. The soft blue silhouette, small smile and blush read clearly at rest. The ground shadow gives each activity a surface, but little indicates where the character is spending time. The scenery currently changes mainly through activity props.

| Observed behavior | Planned correction |
| --- | --- |
| A bubble appears at 25% of session time while the wand stays in the jar until 40%. The ring swings through the opaque jar. | Sequence withdrawal, turn, blow and bubble release against the actual hand movement. |
| The flag reach changes shoulder-to-palm distance from 77 to 16 drawing units. The boat transfer has a similar collapse. | Bring work into reach and articulate the arms while preserving the hand silhouette. |
| Block faces show the character through their sides. Stacking uses the projected bounding box instead of the solid height. | Draw solid faces and use a common support height for the tower and flag. |
| Both hands withdraw as the book cover closes. | Guide the moving edge onto the table before releasing. |
| Focus updates every 250 ms reset the animation frame timestamp. | Keep a continuous presentation clock during an active gesture. |
| The stretch reverses a 220-degree sweep in 320 ms without a hold. | Give the stretch a comfortable range, a hold and an unhurried return. |

## Implementation and review sequence

1. Study published small character environments, illustration composition and accessible motion. Record sources, the design choices they inform and which aspects suit this timer.
2. Develop original, quiet scenery with foreground, middle distance and background. Compose around the existing timer, face, hands and work surface. Give focus, sky and rest activities appropriate settings and include the ready state.
3. Correct the contact and pacing issues above. Keep support surfaces stable and preserve static and interrupted states.
4. Exercise the production geometry and the changing host clock. Inspect actual phone-width renderings, contrast, reduced motion, normal-speed transitions and the production app before publication.

## Background research and art direction

| Reference | What informed this prototype |
| --- | --- |
| Hank Green and Honey B Games' Focus Friend | In the mobile room image, a wall corner, furnishings and a rug establish a place around a small character. Keep the low floor clear around the current activity. [Official gallery](https://www.yourfocusfriend.com/) |
| Hyper Games' Snufkin | Trees and hedges frame open paths and lawns in the gallery. Cluster orchard foliage at the outside edges and leave open sky around the face. [Official gallery](https://new.snufkin.game/) |
| Mooncube Games' Spirit City | The developer connects focus activities with a particular place and atmosphere. Use a domestic workroom for book and tea scenes and an outdoor terrace for activities in the open air. [Developer's product page](https://store.steampowered.com/app/2113850/) |
| HyperBeard's Tsuki's Odyssey | A character doing everyday things makes the village feel inhabited. Use small traces of use in the room, such as a shelf of books and a curtain pulled to one side. [Publisher's gallery](https://hyperbeard.com/game/tsukisodyssey/) |
| Team Alto and Land & Sea | The developers describe distinct outdoor environments arising from broad landscape forms. Use overlapping distant hills and a near garden bank to separate depth at a small scale. [Developer's art and press kit](https://altosodyssey.com/press/) |
| Lumi Interactive's Kinder World | A pale wall and a single shelf keep the expressive potted plant easy to see on the watering screen. Place the small books and stoneware bottle away from the hands and tools. [Official mobile screens](https://www.playkinderworld.com/game) |
| ustwo's Monument Valley | A broad field of color and a few soft cloud shapes isolate the architectural silhouette in the iPad image. Use the same restraint for the dusk sky, leaving space around each new star. [Developer's launch artwork](https://ustwo.com/blog/monument-valley-out-now/) |
| Google Material and W3C WAI | Value contrast can direct attention. Give the creature, active prop and timer the clearest edges. Keep the scenery stationary even when animation is enabled, and review the static poses separately. [Color hierarchy](https://m2.material.io/design/color/color-usage.html) · [Interaction motion](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) |

**Selected prototype.** A workroom overlooking an orchard connects the views. The ready character and indoor activities share a curved window, a warm floor and familiar belongings. Outside, a garden terrace repeats the orchard silhouettes. Stargazing gets its own dusk palette and an open sky for the existing constellation. The renderer draws original vector scenery in the character's coordinates. The same floor supports the tools throughout each session, and the foreground stays clear for the timer, hands, book and cup.

## Implemented changes

- Ready, food, book, tea, blocks and the warm drink share the workroom. Planting, bubbles, folding the boat, stretching and cloud watching take place on the garden terrace. Stargazing uses the terrace at dusk. Switching off companion scenes restores the plain character. Reduced motion keeps the scenery and the static activity.
- The window light, coat shading and eye highlights carry through from ready into the activities. A small shadow grounds the waiting character. During the warm drink, steam curls away from its eyes.
- The wand travels vertically through the jar mouth before turning. The jar front hides the submerged ring. The handling sequence brings the ring near the mouth and emits each bubble from it. The two hands pass the book cover between them and guide it to the page stack. The boat and block carries bend at the elbow and keep a rounded palm. Each block has three solid faces and rests at the support height used to draw it.
- The presentation clock retains its frame timestamp across countdown updates. Opening a visible panel holds the pose, including a partially lifted prop. The stretch lasts 3.2 seconds with a pause near the top. Hiding the page, errors and reduced motion continue to resolve to static geometry.
- The [catalogue](assets/scene-storyboards.json) contains 44 landmarks and the [contact drawings](assets/scene-contact-storyboards.json) contain 47 intermediate poses. Both are exported from the production renderer. [Browser verification and examples](../verification/companion-scenery.md)
