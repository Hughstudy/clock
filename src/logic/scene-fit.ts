/** How the Focus page's companion art makes room for the local layers above it
 * (the top controls, a speech bubble and a local panel), so none of them covers it.
 *
 * Every length is in CSS pixels from the top of the scene box. The art is anchored
 * at its support edge (viewBox y 171 of 190) and scales about that edge. The
 * constants are heights above the support edge, per unit of rendered art width. */

/** Top of the creature (tuft, a raised hand) at viewBox y 34. */
export const ART_HEAD = 137 / 240
/** Top of the painted scenery card at viewBox y 6. */
export const ART_CARD = 167 / 240
/** Width of the painted scenery card (viewBox x 3–237). */
export const ART_CARD_WIDTH = 234 / 240
/** Its straight sides, between the rounded top corners (viewBox x 24–216). */
export const ART_CARD_SIDES = 192 / 240
/** Height of those rounded corners. */
export const ART_CARD_CORNER = 21 / 240
/** The support edge tucks this far behind a panel's top, so the floor meets it. */
export const PANEL_TUCK = 12
/** Space between the speech bubble and the creature's head. */
export const BUBBLE_GAP = 10
/** Below this, a shrunken companion would read as a glitch; it steps out instead. */
export const MIN_ART_SCALE = 0.4
/** Card edges this close to the scene's sides are not noticeable. */
const EDGE_TOLERANCE = 8

export interface SceneFitInput {
  sceneWidth: number
  sceneHeight: number
  /** Rendered width of the art at scale 1. */
  artWidth: number
  /** Lowest edge of the controls along the top of the scene, plus a margin. */
  topLimit: number
  /** Height of the bubble anchored above the head, or 0 when none is shown. */
  bubbleHeight: number
  /** Top of an open local panel, or null. */
  panelTop: number | null
  /** Whether the art paints a scenery card whose edges must not show. */
  framed: boolean
}

export interface SceneFit {
  scale: number
  /** Vertical move of the support edge (zero or negative). */
  shift: number
  hidden: boolean
}

export function fitSceneArt(input: SceneFitInput): SceneFit {
  const { sceneWidth, sceneHeight, artWidth, topLimit, bubbleHeight, panelTop, framed } = input
  if (!(artWidth > 0) || !(sceneHeight > 0)) return { scale: 1, shift: 0, hidden: false }
  const support = panelTop === null ? sceneHeight : Math.min(sceneHeight, panelTop + PANEL_TUCK)
  const bubble = bubbleHeight > 0 ? bubbleHeight + BUBBLE_GAP : 0
  let scale = Math.min(1, (support - topLimit - bubble) / (ART_HEAD * artWidth))
  // Once the card's own edges would show (its sides, or its rounded top corners when the
  // card's top is inside the scene), keep the whole card clear too.
  const cornersInside = support - (ART_CARD - ART_CARD_CORNER) * artWidth * scale > 0
  const covered = artWidth * scale * (cornersInside ? ART_CARD_SIDES : ART_CARD_WIDTH) >= sceneWidth - EDGE_TOLERANCE
  if (framed && !covered) scale = Math.min(scale, (support - topLimit) / (ART_CARD * artWidth))
  const shift = support - sceneHeight
  if (!(scale >= MIN_ART_SCALE)) return { scale: MIN_ART_SCALE, shift, hidden: true }
  return { scale, shift, hidden: false }
}
