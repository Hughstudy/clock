import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  /** The control that asked. The confirmation rises from it and returns to it. */
  anchor: HTMLElement | null
  cancelLabel: string
  onCancel: () => void
  /** A short timer line, shown only when the confirmation has to cover the readout. */
  summary?: string
  /** The readout that line stands in for. */
  readout?: Element | null
  children: ReactNode
}

const EDGE = 12
const GAP = 14

/**
 * A short confirmation that rises from the control that asked for it. It is a native modal, so
 * the page behind is inert and Escape or a tap outside cancels. When the control is gone, or
 * there is no room above it (large text, a short landscape), it sits in the middle instead.
 */
export function ConfirmPopover({ title, anchor, cancelLabel, onCancel, summary, readout, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const viewport = window.visualViewport
    const place = () => {
      const top = viewport?.offsetTop ?? 0
      const height = viewport?.height ?? window.innerHeight
      dialog.style.setProperty('--visible-top', `${top}px`)
      dialog.style.setProperty('--visible-height', `${height}px`)
      // A control that left the page (its session ended) keeps the confirmation where it was.
      if (!anchor?.isConnected) { if (!dialog.dataset.placement) dialog.dataset.placement = 'center'; return }
      const source = anchor.getBoundingClientRect()
      dialog.dataset.placement = 'anchor'
      const width = dialog.offsetWidth
      const left = Math.min(window.innerWidth - width - EDGE, Math.max(EDGE, source.right - width))
      const bottom = window.innerHeight - source.top + GAP
      const fits = source.width > 0 && source.top - GAP - dialog.offsetHeight >= top + EDGE
      if (!fits) { dialog.dataset.placement = 'center'; return }
      dialog.style.setProperty('--confirm-left', `${left}px`)
      dialog.style.setProperty('--confirm-bottom', `${bottom}px`)
      dialog.style.setProperty('--confirm-tail', `${Math.min(width - 34, Math.max(34, source.left + source.width / 2 - left))}px`)
      // At large text the card above its button can reach the time; its own line then says it.
      const time = readout?.getBoundingClientRect()
      if (time && source.top - GAP - dialog.offsetHeight < time.bottom) dialog.dataset.covers = 'true'
    }
    dialog.showModal()
    place()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus({ preventScroll: true })
    const sizes = new ResizeObserver(place)
    sizes.observe(dialog)
    viewport?.addEventListener('resize', place)
    window.addEventListener('resize', place)
    return () => {
      sizes.disconnect()
      viewport?.removeEventListener('resize', place)
      window.removeEventListener('resize', place)
      dialog.close()
    }
  }, [anchor, readout])

  return (
    <dialog ref={ref} className="fp-confirm" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onCancel() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onCancel()
      }}>
      <h2 id={titleId}>{title}</h2>
      {summary && <p className="fp-confirm__summary">{summary}</p>}
      {children}
      <button type="button" className="pill fp-confirm__cancel" onClick={onCancel}>{cancelLabel}</button>
    </dialog>
  )
}
