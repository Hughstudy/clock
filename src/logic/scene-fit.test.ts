import { describe, expect, it } from 'vitest'
import { awayGroup, AWAY_SKY_SHARE, ART_CARD, ART_FACE, ART_HEAD, ART_MAX_SCENE_RATIO, BUBBLE_GAP, BUBBLE_RESERVE, fitSceneArt, ROOM_MIN_ZOOM, SHEET_GAP, shownTimeDrop, wideRoomFit, type SceneFitInput } from './scene-fit'

const phone: SceneFitInput = { sceneWidth: 393, sceneHeight: 570, artWidth: 565, topLimit: 50, bubbleHeight: 0, timeHeight: 0, panelTop: null, framed: true }
const headTop = (input: SceneFitInput, fit: ReturnType<typeof fitSceneArt>) =>
  input.sceneHeight + fit.shift - ART_HEAD * input.artWidth * fit.scale

describe('wideRoomFit', () => {
  const roomWidth = (zoom: number, artWidth: number) => 234 * zoom * artWidth / 240

  it.each([[1180, 1050, 840], [1024, 855, 684], [1366, 1282, 1026]])('moves %i wide art clear of the card and still covers both edges', (width, art, cardLeft) => {
    const { zoom, cardPan, roomShift } = wideRoomFit(width, art, cardLeft)
    expect(width / 2 - cardPan + art * 0.32).toBeLessThanOrEqual(cardLeft - 8 + 1e-6)
    const half = roomWidth(zoom, art) / 2
    const shiftPx = roomShift * 0.75 * art / 240
    for (const centre of [width / 2 + shiftPx, width / 2 - cardPan + shiftPx]) {
      expect(centre - half).toBeLessThanOrEqual(0)
      expect(centre + half).toBeGreaterThanOrEqual(width)
    }
  })

  it('does not move the scene when the card is already clear', () => {
    expect(wideRoomFit(1600, 900, 1500).cardPan).toBe(0)
  })

  it('falls back to the base size before the art has been measured', () => {
    expect(wideRoomFit(1180, 0, 840)).toEqual({ zoom: ROOM_MIN_ZOOM, cardPan: 0, roomShift: 0 })
  })
})

describe('fitSceneArt', () => {
  it('leaves the art untouched when nothing competes for the space', () => {
    expect(fitSceneArt(phone)).toEqual({ scale: 1, shift: 0, hidden: false })
    expect(fitSceneArt({ ...phone, bubbleHeight: 33 })).toEqual({ scale: 1, shift: 0, hidden: false })
  })

  it('never grows the art so wide that a side prop leaves a narrow screen', () => {
    const tall = { ...phone, sceneWidth: 375, sceneHeight: 760, artWidth: 640 }
    const fit = fitSceneArt(tall)
    expect(fit.scale * tall.artWidth).toBeCloseTo(375 * ART_MAX_SCENE_RATIO, 5)
    expect(fit.hidden).toBe(false)
  })

  it('shrinks just enough for a tall bubble to sit between the head and the top controls', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 90 }
    const fit = fitSceneArt(input)
    expect(fit.scale).toBeLessThan(1)
    expect(fit.shift).toBe(0)
    expect(headTop(input, fit) - 10 - 90).toBeCloseTo(input.topLimit, 5)
  })

  it('keeps the time readout and the bubble stacked between the head and the top controls', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 60, timeHeight: 52 }
    const fit = fitSceneArt(input)
    expect(fit.scale).toBeLessThan(fitSceneArt({ ...input, timeHeight: 0 }).scale)
    expect(headTop(input, fit) - 10 - 60 - 52).toBeCloseTo(input.topLimit, 5)
  })

  it('keeps a one-line bubble\'s room above the head while the time reads there', () => {
    const input = { ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, bubbleHeight: 0, timeHeight: 52 }
    const fit = fitSceneArt(input)
    expect(headTop(input, fit) - BUBBLE_RESERVE - 52).toBeCloseTo(input.topLimit, 5)
    expect(fitSceneArt({ ...input, bubbleHeight: 30 })).toEqual(fit)
  })

  it('rises at its own size to look over a sheet with its whole face', () => {
    const input = { ...phone, panelTop: 412 }
    const fit = fitSceneArt(input)
    expect(fit).toMatchObject({ scale: 1, hidden: false })
    // The line under the mouth sits a small gap above the sheet's edge.
    const face = input.sceneHeight + fit.shift - ART_FACE * input.artWidth * fit.scale
    expect(face).toBeCloseTo(412 - SHEET_GAP, 5)
    expect(headTop(input, fit)).toBeGreaterThanOrEqual(input.topLimit)
  })

  it('stays where it is when a sheet ends below the face', () => {
    expect(fitSceneArt({ ...phone, panelTop: 520 })).toEqual({ scale: 1, shift: 0, hidden: false })
  })

  it('keeps the whole scenery card clear once its edges would show', () => {
    const input = { ...phone, sceneHeight: 250 }
    const fit = fitSceneArt(input)
    const cardTop = input.sceneHeight + fit.shift - ART_CARD * input.artWidth * fit.scale
    expect(fit.hidden).toBe(false)
    expect(cardTop).toBeGreaterThanOrEqual(input.topLimit - 1e-9)
    // Without scenery there is no card to keep clear, so it may stay larger.
    expect(fitSceneArt({ ...input, framed: false }).scale).toBeGreaterThan(fit.scale)
  })

  it('steps the companion out instead of showing a tiny one or a face cut by a sheet', () => {
    expect(fitSceneArt({ ...phone, sceneHeight: 150 }).hidden).toBe(true)
    expect(fitSceneArt({ ...phone, sceneWidth: 375, sceneHeight: 407, artWidth: 539, panelTop: 150 }).hidden).toBe(true)
    // The time keeps its own space: a face that would rise into it steps out too.
    // So does one that would rise into the time where it is shown now, lower than its resting place.
    expect(fitSceneArt({ ...phone, panelTop: 412 }).hidden).toBe(false)
    expect(fitSceneArt({ ...phone, panelTop: 412, timeFloor: 260 }).hidden).toBe(true)
    const tight = { ...phone, timeHeight: 110, panelTop: 330 }
    expect(headTop(tight, fitSceneArt({ ...tight, timeHeight: 0 }))).toBeLessThan(tight.topLimit + 110)
    expect(fitSceneArt(tight).hidden).toBe(true)
  })

  it('ignores an unmeasured art box', () => {
    expect(fitSceneArt({ ...phone, artWidth: 0 })).toEqual({ scale: 1, shift: 0, hidden: false })
  })
})

describe('awayGroup', () => {
  // 375×812: art 588 wide, drawn at 1.11 while the card is away; the time rests with its bottom at 119.
  const phone = { sceneHeight: 812, timeBottom: 119, bubbleHeight: 81, artWidth: 588, awayScale: 1.11, awayFloor: 132 }

  it('puts the time a bubble above the head and shares the spare height', () => {
    const { timeDrop, artLift } = awayGroup(phone)
    const spare = timeDrop + artLift
    expect(spare).toBeGreaterThan(0)
    expect(timeDrop).toBe(Math.round(spare * AWAY_SKY_SHARE))
    // After both moves the head is exactly a bubble and its gap below the time.
    const crown = 812 - 132 - artLift - ART_HEAD * 588 * 1.11
    expect(Math.abs(crown - (119 + timeDrop) - (81 + BUBBLE_GAP))).toBeLessThanOrEqual(1)
  })

  it('moves nothing when the screen has no height to spare', () => {
    expect(awayGroup({ ...phone, sceneHeight: 568, artWidth: 420 })).toEqual({ timeDrop: 0, artLift: 0 })
  })

  it('moves nothing where the stylesheet names no away scale', () => {
    expect(awayGroup({ ...phone, awayScale: 0 })).toEqual({ timeDrop: 0, artLift: 0 })
    expect(awayGroup({ ...phone, artWidth: 0 })).toEqual({ timeDrop: 0, artLift: 0 })
  })

  it('gives a taller screen more sky and more floor, never less', () => {
    const tall = awayGroup({ ...phone, sceneHeight: 932 })
    const base = awayGroup(phone)
    expect(tall.timeDrop).toBeGreaterThan(base.timeDrop)
    expect(tall.artLift).toBeGreaterThan(base.artLift)
  })
})

describe('shownTimeDrop', () => {
  // 375×812 with the card shown: the art box ends at 610; the art is 588 wide, drawn at .918.
  const shown = { sceneHeight: 610, artWidth: 588, scale: 0.918, bubbleHeight: 81, blockBottom: 157 }

  it('brings the time block down to a bubble above the head', () => {
    const drop = shownTimeDrop(shown)
    const crown = 610 - ART_HEAD * 588 * 0.918
    expect(drop).toBeGreaterThan(0)
    expect(Math.abs(crown - (157 + drop) - (81 + BUBBLE_GAP))).toBeLessThanOrEqual(1)
  })

  it('never lifts the time above its resting place', () => {
    expect(shownTimeDrop({ ...shown, sceneHeight: 300 })).toBe(0)
    expect(shownTimeDrop({ ...shown, artWidth: 0 })).toBe(0)
  })
})
