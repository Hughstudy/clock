import type { CSSProperties } from 'react'
import { usePalette } from '../hooks/useSketches'
import type { Sketch } from '../logic/sketch'

interface Props {
  sketch: Sketch
  className?: string
  style?: CSSProperties
  /** Accessible name; omit for decoration. */
  title?: string
}

/** Renders serializable rough.js output, mapping named tones to the palette. */
export function SketchSvg({ sketch, className, style, title }: Props) {
  const palette = usePalette()
  return (
    <svg
      className={['sketch', className].filter(Boolean).join(' ')}
      style={style}
      viewBox={`${sketch.x} ${sketch.y} ${sketch.width} ${sketch.height}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {sketch.paths.map((p, i) =>
        p.kind === 'fill' ? (
          <path key={i} d={p.d} fill={palette[p.tone]} />
        ) : (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={palette[p.tone]}
            strokeWidth={p.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  )
}
