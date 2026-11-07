import { useLayoutEffect, useState, type RefObject } from 'react'

/** Large text and short landscapes keep the controls in their own scrollable region. */
export function useFocusLayout(scene: RefObject<HTMLElement>): boolean {
  const [readable, setReadable] = useState(false)
  useLayoutEffect(() => {
    const root = scene.current?.closest<HTMLElement>('.home')
    if (!root) return
    const probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;inset:0 auto auto 0;visibility:hidden;pointer-events:none;width:1rem;height:1rem;contain:strict'
    // Shared navigation uses this text size even when the Focus screen is hidden.
    document.body.append(probe)
    const shortLandscape = window.matchMedia('(orientation: landscape) and (max-height: 360px)')
    const measure = () => {
      const useReadingOrder = probe.getBoundingClientRect().height >= 22 || shortLandscape.matches
      root.dataset.layout = useReadingOrder ? 'readable' : 'scene'
      setReadable(useReadingOrder)
    }
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(probe)
    shortLandscape.addEventListener('change', measure)
    measure()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); shortLandscape.removeEventListener('change', measure); probe.remove() }
  }, [scene])
  return readable
}
