import { useRef } from 'react'

interface Props {
  identity: string
  disabled: boolean
  onActivate: () => void
  children: React.ReactNode
  primary?: boolean
  label?: string
}

/** Keep a held press bound to the session, state and command it started on. */
export function TimerActionButton({ identity, disabled, onActivate, children, primary, label }: Props) {
  const held = useRef<string | null>(null)
  return (
    <button type="button" className={primary ? 'btn btn-primary' : 'btn btn-secondary'} disabled={disabled} aria-label={label}
      onPointerDown={() => { held.current = identity }}
      onPointerCancel={() => { held.current = null }}
      onKeyDown={event => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        if (event.repeat) event.preventDefault()
        else held.current = identity
      }}
      onClick={event => {
        const original = held.current
        held.current = null
        if ((original !== null && original !== identity) || event.detail > 1) return
        onActivate()
      }}>{children}</button>
  )
}
