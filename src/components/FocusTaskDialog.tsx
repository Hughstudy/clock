import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  closeLabel?: string
}

/** Native modal keeps background controls inert and handles Escape/platform close. */
export function FocusTaskDialog({ title, onClose, children, closeLabel = '返回' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const viewport = window.visualViewport
    const fit = () => {
      dialog.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`)
      dialog.style.setProperty('--visible-height', `${viewport?.height ?? window.innerHeight}px`)
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
    <dialog ref={ref} className="focus-task" aria-labelledby="focus-task-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
      }}>
      <header className="focus-task__header">
        <h2 id="focus-task-title">{title}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>{closeLabel}</button>
      </header>
      {children}
    </dialog>
  )
}
