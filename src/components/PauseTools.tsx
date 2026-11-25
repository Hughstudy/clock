import { useLayoutEffect, useRef } from 'react'
import { focusCopy as copy } from '../data/focus-copy'
import { uiText } from '../data/ui-copy'
import '../styles/pause-tools.css'

interface Props {
  anchor: HTMLElement | null
  requested: boolean
  canEdit: boolean
  count: number
  onClose: () => void
  onAsk: (button: HTMLButtonElement) => void
  onMark: () => void
  onWrite: (button: HTMLButtonElement) => void
  onRead: (button: HTMLButtonElement) => void
}

const icons = {
  ask: 'M20 11a8 8 0 0 1-8 8c-1.4 0-2.7-.3-3.8-.9L4 20l1.3-4A8 8 0 1 1 20 11Z',
  mark: 'M6 4h12v16l-6-4-6 4zM9 9h6m-3-3v6',
  write: 'm5 15-1 5 5-1L20 8l-4-4zM14 6l4 4',
}

function Icon({ kind }: { kind: keyof typeof icons }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[kind]}/></svg>
}

/** A choice above the paused timer. The rest of Focus remains directly operable. */
export function PauseTools({ anchor, requested, canEdit, count, onClose, onAsk, onMark, onWrite, onRead }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const dismiss = useRef(onClose)
  dismiss.current = onClose
  useLayoutEffect(() => {
    const dialog = surface.current
    const controls = anchor?.closest<HTMLElement>('.fp-controls')
    const room = controls?.closest('.home')
    const scene = room?.querySelector('.fp-scene')
    if (!dialog || !controls || !room || !scene) return
    const viewport = window.visualViewport
    const place = () => {
      const top = (viewport?.offsetTop ?? 0) + 8
      const bottom = top + (viewport?.height ?? innerHeight) - 16
      const left = (viewport?.offsetLeft ?? 0) + 8
      const right = left + (viewport?.width ?? innerWidth) - 16
      const buttons = controls.getBoundingClientRect()
      const width = Math.min(right - left, buttons.width)
      const x = Math.max(left, Math.min(right - width, buttons.left))
      dialog.style.width = width + 'px'
      dialog.style.left = x + 'px'
      // Choose a clear vertical strip near the paused controls. On a phone
      // this is usually the sky above the tuft. The tablet side card can use
      // its own column. Large text scrolls inside the available strip.
      const obstacles = room.querySelectorAll('.fp-top, .fp-clock-phase, .fp-digits, .fp-step, .fp-controls, [data-scene-book-trigger], .fp-art [data-part="tuft"], .fp-art [data-focus-rig="eyes"], .fp-art [data-focus-rig="mouth"], .fp-art [data-scene-part="creature"], .fp-art [data-touch-kind="high-five"]')
      const tabs = room.closest('.app')?.querySelector('.tab-bar')
      const bounds = [...obstacles, ...(tabs ? [tabs] : [])].map(node => node.getBoundingClientRect())
        .filter(rect => rect.width && rect.height && rect.right > x && rect.left < x + width)
        .sort((a, b) => a.top - b.top)
      const spaces: { top: number; bottom: number }[] = []
      let cursor = top
      for (const rect of bounds) {
        if (rect.bottom < top || rect.top > bottom) continue
        if (rect.top - 6 > cursor) spaces.push({ top: cursor, bottom: rect.top - 6 })
        cursor = Math.max(cursor, rect.bottom + 6)
      }
      if (bottom > cursor) spaces.push({ top: cursor, bottom })
      const needed = dialog.scrollHeight + 2
      const height = (space: { top: number; bottom: number }) => space.bottom - space.top
      const distance = (space: { top: number; bottom: number }) =>
        Math.max(0, buttons.top - space.bottom, space.top - buttons.bottom)
      spaces.sort((a, b) => {
        if (height(a) >= needed && height(b) >= needed) return distance(a) - distance(b)
        return Math.min(needed, height(b)) - Math.min(needed, height(a))
      })
      const space = spaces[0] ?? { top, bottom }
      dialog.style.maxHeight = Math.max(44, height(space)) + 'px'
      dialog.style.top = (space.top >= buttons.bottom ? space.top : space.bottom - dialog.offsetHeight) + 'px'
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !dialog.contains(event.target) && !event.target.closest('.fp-tools-opener')) dismiss.current()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); dismiss.current() }
    }
    place()
    dialog.querySelector('button')?.focus({ preventScroll: true })
    const sizes = new ResizeObserver(place)
    sizes.observe(dialog)
    sizes.observe(controls)
    const art = scene.querySelector('.fp-art')
    if (art) sizes.observe(art)
    // The camera and clock settle after the viewport is measured. A transform
    // can move the drawn crown without resizing either the controls or dialog.
    const camera = new MutationObserver(place)
    camera.observe(scene, { attributes: true, attributeFilter: ['style', 'data-fit'] })
    scene.addEventListener('transitionend', place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    viewport?.addEventListener('resize', place)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape)
    return () => {
      sizes.disconnect()
      camera.disconnect()
      scene.removeEventListener('transitionend', place)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      viewport?.removeEventListener('resize', place)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', escape)
    }
  }, [anchor])
  return <div id="focus-pause-tools" ref={surface} className="fp-pause-tools" role="dialog" aria-label="专注工具"
    onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }}>
    <div className="fp-pause-actions">
      <button type="button" aria-pressed={requested} onClick={event => onAsk(event.currentTarget)}><Icon kind="ask"/>{uiText('UI19')}</button>
      <button type="button" disabled={!canEdit} onClick={onMark}>
        <Icon kind="mark"/>{copy.mark}</button>
      <button type="button" disabled={!canEdit} onClick={event => onWrite(event.currentTarget)}><Icon kind="write"/>{copy.write}</button>
    </div>
    <div className="fp-pause-footer">
      {count > 0 && <button type="button" onClick={event => onRead(event.currentTarget)}>{copy.sessionThoughts}（{count}）</button>}
      <button type="button" onClick={onClose}>收起工具</button>
    </div>
  </div>
}
