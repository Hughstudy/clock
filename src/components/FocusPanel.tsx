import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSheetDrag } from '../hooks/useSheetDrag'

/** Position a compact top-layer ruler next to the same digits throughout editing. */
function placeByClock(panel: HTMLDialogElement, anchor: HTMLElement) {
  const viewport = window.visualViewport
  const style = getComputedStyle(panel)
  const inset = (edge: string) => parseFloat(style.getPropertyValue('--safe-' + edge)) || 0
  const left = Math.max(viewport?.offsetLeft ?? 0, inset('left')) + 8
  const right = Math.min((viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth), innerWidth - inset('right')) - 8
  const top = Math.max(viewport?.offsetTop ?? 0, inset('top')) + 8
  const bottom = Math.min((viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight), innerHeight - inset('bottom')) - 8
  const source = anchor.getBoundingClientRect()
  panel.style.maxInlineSize = Math.max(0, right - left) + 'px'
  panel.style.maxBlockSize = Math.max(0, bottom - top) + 'px'
  const width = panel.offsetWidth, height = panel.offsetHeight
  const below = source.bottom + 6
  const above = source.top - 6 - height
  // Prefer the space below the digits. In short windows use the other side; when the
  // keyboard leaves neither side free, clamp the same dialog into the visible area.
  const y = below + height <= bottom || above < top ? below : above
  panel.style.left = Math.max(left, Math.min(right - width, source.left + (source.width - width) / 2)) + 'px'
  panel.style.top = Math.max(top, Math.min(bottom - height, y)) + 'px'
}

function revealInPanel(panel: HTMLDialogElement, element: Element | null) {
  const body = panel.querySelector<HTMLElement>('.focus-panel__body')
  if (!(element instanceof HTMLElement) || !body?.contains(element)) return
  const item = element.getBoundingClientRect(), bounds = body.getBoundingClientRect()
  if (item.bottom > bounds.bottom) body.scrollTop += item.bottom - bounds.bottom
  else if (item.top < bounds.top) body.scrollTop += item.top - bounds.top
}

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  onBack?: () => void
  timerSummary?: string
  /** Visually hide the heading where the content already names the task. */
  quietTitle?: boolean
  /** A preparation control can open its task beside itself. Other tasks use a sheet. */
  anchor?: HTMLElement | null
}

/**
 * One task surface. Input, reading and details open as a bottom sheet: a native modal with a
 * grabber, a dimmed page behind it, a close button and a downward drag that both dismiss it. A
 * stray tap on the dimmed page does nothing, so typing is never interrupted by a missed key. It
 * rests on the soft keyboard and scrolls inside itself, so the caret and the actions stay in view.
 * The duration ruler uses the same keyboard and focus handling in a popover anchored to the clock.
 */
export function FocusPanel({ title, onClose, onBack = onClose, timerSummary, children, closeLabel = '返回', quietTitle = false, anchor = null }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const drag = useSheetDrag(ref, onClose, !anchor)
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const viewport = window.visualViewport
    let frame = 0
    const revealFocus = () => {
      revealInPanel(panel, document.activeElement)
    }
    const fit = () => {
      const top = viewport?.offsetTop ?? 0
      const height = viewport?.height ?? window.innerHeight
      const covered = Math.max(0, window.innerHeight - top - height)
      panel.style.setProperty('--keyboard', `${covered}px`)
      panel.dataset.keyboard = String(covered > 80)
      panel.style.setProperty('--visible-top', `${top}px`)
      panel.style.setProperty('--visible-height', `${height}px`)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(revealFocus)
      if (anchor) placeByClock(panel, anchor)
    }
    panel.showModal()
    fit()
    panel.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
    const observer = new ResizeObserver(fit)
    // The scene positions the clock after measuring its artwork. Its position can
    // change after rotation or enlarged text without changing the clock's size.
    const sceneLayout = anchor ? new MutationObserver(fit) : null
    if (anchor) {
      observer.observe(anchor)
      observer.observe(panel)
      const scene = anchor.closest('.fp-scene')
      const home = anchor.closest('.home')
      if (scene) sceneLayout?.observe(scene, { attributes: true, attributeFilter: ['style'] })
      if (home) sceneLayout?.observe(home, { attributes: true, attributeFilter: ['data-layout'] })
      window.addEventListener('scroll', fit)
    }
    const header = panel.querySelector<HTMLElement>('.focus-panel__header')
    if (header) observer.observe(header)
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      sceneLayout?.disconnect()
      window.removeEventListener('scroll', fit)
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      panel.close()
    }
  }, [anchor])

  return (
    <dialog ref={ref} className={anchor ? 'focus-panel fp-duration-surface' : 'focus-panel'} data-layout={anchor ? 'clock' : 'sheet'} aria-modal="true" aria-labelledby="focus-panel-title"
      onCancel={event => { event.preventDefault(); onBack() }}
      onFocus={event => revealInPanel(event.currentTarget, event.target)}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); return }
        if (event.key !== 'Tab') return
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
        const first = items[0], last = items.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      <header className="focus-panel__header" {...drag}>
        <h2 id="focus-panel-title" className={quietTitle ? 'sr-only' : undefined}>{title}</h2>
        <button type="button" className="pill pill--ghost" onClick={onClose}>{closeLabel}</button>
      </header>
      {timerSummary && <p className="focus-panel__timer">{timerSummary}</p>}
      <div className="focus-panel__body">{children}</div>
    </dialog>
  )
}
