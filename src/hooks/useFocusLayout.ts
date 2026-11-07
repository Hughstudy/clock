import { useLayoutEffect, useState, type RefObject } from 'react'

/** Large text gets a separate, scrollable controls region instead of covering the clock.
 * This depends on the user's type size, never on a transient message or save receipt. */
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
    const measure = () => {
      const font = probe.getBoundingClientRect().height
      root.dataset.layout = font >= 22 ? 'readable' : 'scene'
      setReadable(font >= 22)
    }
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(probe)
    measure()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); probe.remove() }
  }, [scene])
  return readable
}
