import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSheetDrag } from '../hooks/useSheetDrag'

/** How far a plate panel may rise above the card, over the floor band, before going modal. */
const PLATE_GROWTH = 140

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  onBack?: () => void
  timerSummary?: string
  /** Visually hide the heading where the content already names the task. */
  quietTitle?: boolean
  /** A sheet rises from the bottom edge over the page. A plate panel takes the card's own place. */
  placement?: 'sheet' | 'plate'
}

/**
 * One task surface. Input, reading and details open as a bottom sheet: a native modal with a
 * grabber, a dimmed page behind it, a close button and a downward drag that both dismiss it. A
 * stray tap on the dimmed page does nothing, so typing is never interrupted by a missed key. It
 * rests on the soft keyboard and scrolls inside itself, so the caret and the actions stay in view.
 * The duration ruler instead takes the card's place, going modal only when it has no room there.
 */
export function FocusPanel({ title, onClose, onBack = onClose, timerSummary, children, closeLabel = '返回', quietTitle = false, placement = 'sheet' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const drag = useSheetDrag(ref, onClose, placement !== 'plate')
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const viewport = window.visualViewport
    const plate = placement === 'plate'
    const scene = panel.parentElement
    const home = panel.closest<HTMLElement>('.home')
    let modal = false
    let frame = 0
    const revealFocus = () => {
      const focused = document.activeElement
      if (focused instanceof HTMLElement && panel.contains(focused)) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
      if (!plate) return
      const box = scene?.getBoundingClientRect()
      // The large-text console is a scrollport. A plate panel cannot grow
      // above its clipping edge, so use the top layer instead of the old
      // floor-band allowance. Keep this decision independent of panel size.
      const scrollingPlate = home?.dataset.layout === 'readable'
      // On the plate the panel replaces the card and may grow upward over the floor band; the
      // time reads above the companion. The plate's bottom padding is the tab bar's room.
      const padding = scene ? getComputedStyle(scene) : null
      const localTop = Math.max((box?.top ?? 0) - PLATE_GROWTH, top + 8)
      const localBottom = Math.min((box?.bottom ?? 0) - parseFloat(padding?.paddingBottom ?? '0'), top + height - 8)
      panel.style.setProperty('--picker-space', `${Math.max(0, localBottom - localTop)}px`)
      // This budget is independent of the panel's own layout, so switching to
      // the wider viewport cannot trigger an endless local/modal resize loop.
      const font = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const required = Math.max(150, font * 7) + (modal ? 16 : 0)
      const nextModal = scrollingPlate || covered > 80 || localBottom - localTop < required
      panel.dataset.layout = nextModal ? 'viewport' : 'local'
      panel.setAttribute('aria-modal', String(nextModal))
      if (nextModal !== modal) {
        const focused = document.activeElement instanceof HTMLElement && panel.contains(document.activeElement) ? document.activeElement : null
        const input = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused : null
        const selection = input && input.selectionStart !== null ? [input.selectionStart, input.selectionEnd, input.selectionDirection] as const : null
        panel.close()
        if (nextModal) panel.showModal()
        else panel.show()
        modal = nextModal
        focused?.focus({ preventScroll: true })
        if (input && selection) input.setSelectionRange(selection[0], selection[1], selection[2] ?? undefined)
      }
    }
    if (plate) panel.show()
    else {
      panel.dataset.layout = 'sheet'
      panel.setAttribute('aria-modal', 'true')
      panel.showModal()
    }
    fit()
    panel.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
    const observer = new ResizeObserver(fit)
    if (plate && scene) observer.observe(scene)
    const layoutObserver = new MutationObserver(fit)
    if (home) layoutObserver.observe(home, { attributes: true, attributeFilter: ['data-layout'] })
    const header = panel.querySelector<HTMLElement>('.focus-panel__header')
    if (header) observer.observe(header)
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      layoutObserver.disconnect()
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      panel.close()
    }
  }, [placement])

  return (
    <dialog ref={ref} className={placement === 'plate' ? 'focus-panel fp-duration-surface' : 'focus-panel'} aria-modal="false" aria-labelledby="focus-panel-title"
      onCancel={event => { event.preventDefault(); onBack() }}
      onFocus={event => {
        if (event.target instanceof HTMLElement && event.currentTarget.querySelector('.focus-panel__body')?.contains(event.target)) {
          event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); return }
        if (event.key !== 'Tab' || event.currentTarget.dataset.layout === 'local') return
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
