import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  onBack?: () => void
  timerSummary?: string
  /** Visually hide the heading where the content already names the task. */
  quietTitle?: boolean
  placement?: 'scene' | 'plate' | 'viewport'
}

/**
 * One task surface, kept in the same DOM while the viewport changes. It is
 * normally non-modal; insufficient local space uses a native modal viewport
 * layout, preserving the input/caret while making the covered background inert.
 */
export function FocusPanel({ title, onClose, onBack = onClose, timerSummary, children, closeLabel = '返回', quietTitle = false, placement = 'scene' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const viewport = window.visualViewport
    const scene = panel.parentElement
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
      const box = scene?.getBoundingClientRect()
      const plate = placement === 'plate'
      const topControls = scene?.querySelector<HTMLElement>(plate ? '.fp-digits' : '.fp-top')?.getBoundingClientRect()
      const localTop = Math.max((topControls?.bottom ?? (box?.top ?? 0) + 64) + (plate ? 4 : 12), top + 8)
      const localBottom = Math.min((box?.bottom ?? 0) - (plate ? 4 : 18), top + height - 8)
      if (plate) panel.style.setProperty('--dial-space', `${Math.max(0, localBottom - localTop)}px`)
      // This budget is independent of the panel's own layout, so switching to
      // the wider viewport cannot trigger an endless local/modal resize loop.
      const font = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const required = (plate ? Math.max(150, font * 7) : Math.max(260, font * 11)) + (modal ? 16 : 0)
      const nextModal = placement === 'viewport' || covered > 80 || localBottom - localTop < required
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
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(revealFocus)
    }
    panel.show()
    fit()
    panel.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
    const observer = new ResizeObserver(fit)
    if (scene) observer.observe(scene)
    const header = panel.querySelector<HTMLElement>('.focus-panel__header')
    if (header) observer.observe(header)
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
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
        if (event.key !== 'Tab' || event.currentTarget.dataset.layout !== 'viewport') return
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
        const first = items[0], last = items.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
      <header className="focus-panel__header">
        <h2 id="focus-panel-title" className={quietTitle ? 'sr-only' : undefined}>{title}</h2>
        <button type="button" className="pill pill--ghost" onClick={onClose}>{closeLabel}</button>
      </header>
      {timerSummary && <p className="focus-panel__timer">{timerSummary}</p>}
      <div className="focus-panel__body">{children}</div>
    </dialog>
  )
}
