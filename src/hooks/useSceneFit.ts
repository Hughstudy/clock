import { useLayoutEffect, type RefObject } from 'react'
import { BUBBLE_GAP, BUBBLE_RESERVE, fitSceneArt, TIME_GAP } from '../logic/scene-fit'

/** Keeps the Focus scene's art clear of the time, the bubble, the top controls and any local panel.
 * Writes `--fit-scale`/`--fit-shift`/`--bubble-space` and `data-fit` on the scene; CSS does the rest. */
export function useSceneFit(scene: RefObject<HTMLElement>, framed: boolean): void {
  useLayoutEffect(() => {
    const root = scene.current
    if (!root) return
    let frame = 0
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      const art = root.querySelector<SVGSVGElement>('.fp-art .blue-companion')
      // The art box ends above the floor band the card sits on; that edge is the support.
      const artBox = root.querySelector<HTMLElement>('.fp-art')
      const top = root.querySelector<HTMLElement>('.fp-top')
      const bubble = root.querySelector<HTMLElement>('.fp-bubble')
      const time = root.querySelector<HTMLElement>('.fp-digits')
      const panel = root.querySelector<HTMLElement>('.focus-panel')
      for (const element of [bubble, time, panel]) if (element) resize.observe(element)
      const box = root.getBoundingClientRect()
      const bubbleHeight = bubble?.offsetHeight ?? 0
      const artWidth = art ? parseFloat(getComputedStyle(art).width) : 0
      // The overlays above the head read the art's rendered width from here, since the
      // container units sizing the art resolve differently outside the art box.
      root.style.setProperty('--art-px', `${artWidth}px`)
      const fit = fitSceneArt({
        sceneWidth: box.width, sceneHeight: artBox?.offsetHeight || box.height,
        artWidth,
        topLimit: top ? top.getBoundingClientRect().bottom - box.top + 6 : 0,
        bubbleHeight,
        timeHeight: time ? time.offsetHeight + TIME_GAP : 0,
        panelTop: panel ? panel.getBoundingClientRect().top - box.top : null,
        framed,
      })
      root.style.setProperty('--fit-scale', String(fit.scale))
      root.style.setProperty('--fit-shift', `${fit.shift}px`)
      // The time keeps a one-line bubble's room above the head; only a taller bubble lifts it.
      root.style.setProperty('--bubble-space', `${Math.max(bubbleHeight > 0 ? bubbleHeight + BUBBLE_GAP : 0, time ? BUBBLE_RESERVE : 0)}px`)
      root.dataset.fit = fit.hidden ? 'hidden' : fit.scale < 1 || fit.shift < 0 ? 'moved' : 'rest'
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    // The bubble and the panel are direct children of the scene.
    const children = new MutationObserver(measure)
    measure()
    resize.observe(root)
    children.observe(root, { childList: true })
    window.visualViewport?.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      children.disconnect()
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [scene, framed])
}
