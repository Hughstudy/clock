import type { ReactNode } from 'react'
import { useDialSketch } from '../hooks/useSketches'
import { SketchSvg } from './SketchSvg'

const SIZE = 280

interface Props {
  progress: number
  children: ReactNode
}

/** Static rough dial with a plain progress arc, so ticks only move a dash offset. */
export function TimerDial({ progress, children }: Props) {
  const dial = useDialSketch(SIZE)
  const r = SIZE * 0.36
  const clamped = Math.min(1, Math.max(0, progress))
  return (
    <div className="dial">
      <svg className="dial-progress" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
        <circle className="dial-track" cx={SIZE / 2} cy={SIZE / 2} r={r} pathLength={100} />
        {/* A zero-length round-capped dash would still draw a dot. */}
        {clamped > 0 && (
          <circle
            className="dial-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            pathLength={100}
            strokeDasharray={`${clamped * 100} 100`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
      </svg>
      <SketchSvg sketch={dial} className="dial-face" />
      <div className="dial-center">{children}</div>
    </div>
  )
}
