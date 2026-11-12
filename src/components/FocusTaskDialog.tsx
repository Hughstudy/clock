import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSheetDrag } from '../hooks/useSheetDrag'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
  onBack?: () => void
}

/** A bottom sheet for one task. The native modal keeps background controls inert and handles Escape/platform close. */
export function FocusTaskDialog({ title, onClose, onBack = onClose, children, closeLabel = '返回' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const drag = useSheetDrag(ref, onClose)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const viewport = window.visualViewport
    const fit = () => {
      const top = viewport?.offsetTop ?? 0, height = viewport?.height ?? window.innerHeight
      const covered = Math.max(0, window.innerHeight - top - height)
      dialog.style.setProperty('--visible-top', `${top}px`)
      dialog.style.setProperty('--visible-height', `${height}px`)
      dialog.style.setProperty('--keyboard', `${covered}px`)
      dialog.dataset.keyboard = String(covered > 80)
    }
    fit()
    dialog.showModal()
    const target = dialog.querySelector<HTMLElement>('[data-initial-focus]')
    target?.focus({ preventScroll: true })
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    return () => {
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      dialog.close()
    }
  }, [])

  return (
    <dialog ref={ref} className="focus-task" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onBack() }}>
      <header className="focus-task__header" {...drag}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{closeLabel}</button>
      </header>
      <div className="focus-task__content">{children}</div>
    </dialog>
  )
}
