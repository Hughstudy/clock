import { useRef } from 'react'

interface Props {
  identity: string
  disabled: boolean
  busy?: boolean
  onActivate: () => void
  children: React.ReactNode
  primary?: boolean
  label?: string
  className?: string
}

/** Keep a held press bound to the session, state and command it started on. */
export function TimerActionButton({ identity, disabled, busy = false, onActivate, children, primary, label, className }: Props) {
  const held = useRef<string | null>(null)
  return (
    <button type="button" className={className ?? (primary ? 'btn btn-primary' : 'btn btn-secondary')} disabled={disabled} aria-disabled={busy || undefined} aria-busy={busy || undefined} aria-label={label}
      onPointerDown={() => { held.current = identity }}
      onPointerCancel={() => { held.current = null }}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        if (busy) { event.preventDefault(); return }
        if (event.repeat) event.preventDefault()
        else held.current = identity
      }}
      onClick={event => {
        const original = held.current
        held.current = null
        if (busy || (original !== null && original !== identity) || event.detail > 1) return
        onActivate()
      }}>{children}</button>
  )
}
