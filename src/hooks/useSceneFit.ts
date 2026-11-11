import { useLayoutEffect, type RefObject } from 'react'
import { awayGroup, fitSceneArt, shownTimeDrop, TIME_GAP, wideRoomFit } from '../logic/scene-fit'

// Matches the stylesheet's tall-landscape rule, where the room fills the screen beneath the card.
const WIDE_ROOM = '(orientation: landscape) and (min-aspect-ratio: 6/5) and (min-height: 600px)'

/** Keeps the Focus scene's art clear of the time, the bubble, the top controls and any local panel.
 * Writes `--fit-scale`/`--fit-shift` and `data-fit` on the scene; CSS does the rest. */
export function useSceneFit(scene: RefObject<HTMLElement>, framed: boolean): void {
  useLayoutEffect(() => {
    const root = scene.current
    if (!root) return
    let frame = 0
    // Where the time block was last placed with the card on screen.
    let timeDrop = 0
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      const art = root.querySelector<SVGSVGElement>('.fp-art .blue-companion')
      // The art box ends above the floor band the card sits on; that edge is the support.
      const artBox = root.querySelector<HTMLElement>('.fp-art')
      const top = root.querySelector<HTMLElement>('.fp-top')
      const time = root.querySelector<HTMLElement>('.fp-digits')
      const panel = root.querySelector<HTMLElement>('.focus-panel')
      // The step slot under the time keeps its height whether or not a step is set.
      const step = root.querySelector<HTMLElement>('.fp-step')
      for (const element of [time, panel]) if (element) resize.observe(element)
      const box = root.getBoundingClientRect()
      const font = parseFloat(getComputedStyle(root).fontSize) || 16
      // Keep room for two lines and their tail even when nobody is speaking.
      // A request may open or close without moving the clock or the artwork.
      const bubbleHeight = Math.ceil(2 * font * 1.45 + 34)
      const phaseHeight = root.querySelector<HTMLElement>('.fp-clock-phase')?.offsetHeight ?? 0
      const artWidth = art ? parseFloat(getComputedStyle(art).width) : 0
      const wideRoom = window.matchMedia(WIDE_ROOM).matches && root.closest<HTMLElement>('.home')?.dataset.layout !== 'readable'
      if (wideRoom) {
        // The plate's visible card starts one inset inside its box.
        const plateLeft = root.closest<HTMLElement>('.home')?.querySelector('.fp-plate')?.getBoundingClientRect().left ?? box.right
        const room = wideRoomFit(box.width, artWidth, plateLeft + 12 - box.left)
        root.style.setProperty('--room-zoom', room.zoom.toFixed(4))
        root.style.setProperty('--card-pan', `${room.cardPan.toFixed(1)}px`)
        root.style.setProperty('--room-shift', `${room.roomShift.toFixed(2)}px`)
      }
      const fit = fitSceneArt({
        sceneWidth: box.width, sceneHeight: artBox?.offsetHeight || box.height,
        artWidth,
        topLimit: top ? top.getBoundingClientRect().bottom - box.top + 6 : 0,
        bubbleHeight,
        timeHeight: time ? time.offsetHeight + phaseHeight + (step?.offsetHeight ?? 0) + TIME_GAP : 0,
        // Where the sheet rests, not where its entry or a drag has it for the moment.
        panelTop: panel ? panel.offsetTop - box.top : null,
        timeFloor: (step ? step.offsetTop + step.offsetHeight : time ? time.offsetTop + time.offsetHeight : 0) + timeDrop + TIME_GAP,
        framed: framed && !wideRoom,
      })
      root.style.setProperty('--fit-scale', String(fit.scale))
      root.style.setProperty('--fit-shift', `${fit.shift}px`)
      root.dataset.fit = fit.hidden ? 'hidden' : fit.scale < 1 || fit.shift < 0 ? 'moved' : 'rest'
      // While the card is away, the time sits just above the companion and the spare height is shared.
      // The stylesheet names the scale and the floor kept for the handle; elsewhere both are absent.
      const awayStyle = artBox ? getComputedStyle(artBox) : null
      const awayScale = parseFloat(awayStyle?.getPropertyValue('--away-scale') ?? '') || 0
      const timeBottom = time ? time.offsetTop + time.offsetHeight : 0
      const away = awayGroup({
        sceneHeight: box.height, artWidth, bubbleHeight, timeBottom, awayScale,
        awayFloor: parseFloat(awayStyle?.getPropertyValue('--away-floor') ?? '') || 0,
      })
      root.style.setProperty('--away-time-drop', `${away.timeDrop}px`)
      root.style.setProperty('--away-art-lift', `${away.artLift}px`)
      // With the card on screen the same grouping holds; only the time moves. It keeps its place
      // while a sheet has lifted the companion or sent it out, so the readout never follows a task.
      if (!panel && !fit.hidden) {
        const drop = awayScale > 0 ? shownTimeDrop({
          sceneHeight: artBox?.offsetHeight || box.height, artWidth, scale: fit.scale, bubbleHeight,
          blockBottom: step ? step.offsetTop + step.offsetHeight : timeBottom,
        }) : 0
        timeDrop = drop
        root.style.setProperty('--time-drop', `${drop}px`)
      }
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    // Scene panels are direct children; they can temporarily change the support edge.
    const children = new MutationObserver(measure)
    measure()
    // The first placement is where things are, not a move to animate.
    let settle = requestAnimationFrame(() => { settle = requestAnimationFrame(() => { root.dataset.motion = 'on' }) })
    resize.observe(root)
    children.observe(root, { childList: true })
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settle)
      resize.disconnect()
      children.disconnect()
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [scene, framed])
}
