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
/** Space between the time readout and whatever sits below it (the bubble or the head). */
export const TIME_GAP = 8
/** Room kept above the head for a one-line bubble whenever the time reads there, so the
 * time does not move as the companion's passing lines come and go. */
export const BUBBLE_RESERVE = 45
/** Widest art relative to the scene. The farthest any hand or handled prop reaches is 34% of the
 * art's width from its centre (F4's kettle, sampled through every scene's actions), so art wider
 * than about 1.47 × the scene cuts it off at a narrow screen's edge. 1.44 keeps a few pixels' margin. */
export const ART_MAX_SCENE_RATIO = 1.44
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
  /** Height of the time readout stacked above the bubble, its gap included, or 0. */
  timeHeight: number
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

/** The painted room is 312 units wide, drawn at .75 into a viewBox 240 wide. */
const ROOM_VIEW_WIDTH = 234
const ROOM_RIG_SCALE = 0.75
const ART_VIEW_WIDTH = 240
const ROOM_EDGE_MARGIN = 10
export const ROOM_MIN_ZOOM = 1.27
/** How far right of centre a hand or held item reaches, per unit of art width, sampled through every scene. */
const ACTIVITY_REACH = 0.32
const CARD_GAP = 8

export interface WideRoomFit {
  /** How far the room is enlarged, never the creature, so it reaches both screen edges. */
  zoom: number
  /** How far the scene moves left while the card is out, so the card covers no hand or held item. */
  cardPan: number
  /** Room offset to the right, in drawing units, so it covers the screen in both scene positions without growing more. */
  roomShift: number
}

/** Fits a full-screen room beneath a card floating on the right. `cardLeft` is the card's left edge. */
export function wideRoomFit(sceneWidth: number, artWidth: number, cardLeft: number): WideRoomFit {
  if (!(artWidth > 0) || !(sceneWidth > 0)) return { zoom: ROOM_MIN_ZOOM, cardPan: 0, roomShift: 0 }
  const cardPan = Math.max(0, sceneWidth / 2 + artWidth * ACTIVITY_REACH + CARD_GAP - cardLeft)
  const zoom = Math.max(ROOM_MIN_ZOOM, ((sceneWidth + cardPan) / artWidth * ART_VIEW_WIDTH + ROOM_EDGE_MARGIN) / ROOM_VIEW_WIDTH)
  return { zoom, cardPan, roomShift: cardPan / 2 / artWidth * ART_VIEW_WIDTH / ROOM_RIG_SCALE }
}

/** How far the card has grown above the band reserved for it (a note row, a second line).
 * `reserved` is that band's height; zero means the card sits beside the scene instead. */
export function plateRise(plateHeight: number, reserved: number): number {
  return reserved > 0 && plateHeight > reserved ? Math.round(plateHeight - reserved) : 0
}

export function fitSceneArt(input: SceneFitInput): SceneFit {
  const { sceneWidth, sceneHeight, artWidth, topLimit, bubbleHeight, timeHeight, panelTop, framed } = input
  if (!(artWidth > 0) || !(sceneHeight > 0)) return { scale: 1, shift: 0, hidden: false }
  const support = panelTop === null ? sceneHeight : Math.min(sceneHeight, panelTop + PANEL_TUCK)
  const bubble = bubbleHeight > 0 ? bubbleHeight + BUBBLE_GAP : 0
  const above = timeHeight > 0 ? Math.max(bubble, BUBBLE_RESERVE) + timeHeight : bubble
  let scale = Math.min(1, (support - topLimit - above) / (ART_HEAD * artWidth), sceneWidth * ART_MAX_SCENE_RATIO / artWidth)
  // Once the card's own edges would show (its sides, or its rounded top corners when the
  // card's top is inside the scene), keep the whole card clear too.
  const cornersInside = support - (ART_CARD - ART_CARD_CORNER) * artWidth * scale > 0
  const covered = artWidth * scale * (cornersInside ? ART_CARD_SIDES : ART_CARD_WIDTH) >= sceneWidth - EDGE_TOLERANCE
  if (framed && !covered) scale = Math.min(scale, (support - topLimit) / (ART_CARD * artWidth))
  const shift = support - sceneHeight
  if (!(scale >= MIN_ART_SCALE)) return { scale: MIN_ART_SCALE, shift, hidden: true }
  return { scale, shift, hidden: false }
}
