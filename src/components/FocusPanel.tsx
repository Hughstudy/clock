import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  /** Visually hide the heading where the content already names the task. */
  quietTitle?: boolean
}

/**
 * One local panel resting on the plate. It is not modal: the timer, pause and
 * navigation below stay readable and usable. With a soft keyboard open it docks
 * above the keyboard so input, save and return stay reachable.
 */
export function FocusPanel({ title, onClose, children, closeLabel = '返回', quietTitle = false }: Props) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    const viewport = window.visualViewport
    const fit = () => {
      const covered = viewport ? Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height) : 0
      panel.style.setProperty('--keyboard', `${covered}px`)
      panel.dataset.keyboard = String(covered > 80)
    }
    fit()
    panel.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    return () => {
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
    }
  }, [])

  return (
    <section ref={ref} className="focus-panel" role="dialog" aria-modal="false" aria-labelledby="focus-panel-title"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
      <header className="focus-panel__header">
        <h2 id="focus-panel-title" className={quietTitle ? 'sr-only' : undefined}>{title}</h2>
        <button type="button" className="pill pill--ghost" onClick={onClose}>{closeLabel}</button>
      </header>
      {children}
    </section>
  )
}
