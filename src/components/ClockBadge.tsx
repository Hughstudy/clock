import { formatClock, formatMinutes, spokenClock } from './format'

interface Props {
  label: string
  status: string
  remainingMs: number
  /** Remaining proportion, 1 at the start. */
  progress: number
  running: boolean
  ended?: boolean
}

const R = 15

/** A small, quiet clock beside the companion: readable at a glance, never the centre of attention. */
export function ClockBadge({ label, status, remainingMs, progress, running, ended = false }: Props) {
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className="clock-badge" data-running={running}>
      <svg className="clock-badge__ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
        <circle className="clock-badge__track" cx="18" cy="18" r={R} pathLength={100} />
        {clamped > 0 && <circle className="clock-badge__arc" cx="18" cy="18" r={R} pathLength={100}
          strokeDasharray={`${clamped * 100} 100`} transform="rotate(-90 18 18)" />}
      </svg>
      <div className="clock-badge__text">
        {ended ? <span className="clock-badge__time">{formatMinutes(remainingMs)}</span>
          : <span className="clock-badge__time" role="timer" aria-label={`${label}还剩${spokenClock(remainingMs)}`}>{formatClock(remainingMs)}</span>}
        <span className="clock-badge__status">{label} · {status}</span>
      </div>
    </div>
  )
}
