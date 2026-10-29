import { useId, type CSSProperties } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import { useBlueCompanion } from '../../hooks/companion/useBlueCompanion'
import '../../styles/blue-companion.css'

interface Props { presentation: CompanionPresentation; cueId?: string | undefined }

/** Original, replaceable prototype art. Only semantic presentation cues enter this layer. */
export function BlueCompanion({ presentation, cueId }: Props) {
  const { spec, sketch, active, finish } = useBlueCompanion(presentation, cueId)
  const gradientId = useId().replace(/:/g, '')
  const pose = spec.poses[presentation.stance]
  const color = (tone: string) => tone === 'body' ? `url(#${gradientId}-body)` : tone === 'belly' ? `url(#${gradientId}-belly)` : spec.palette[tone]
  const part = (name: string) => (
    <g key={name} data-part={name}>
      {sketch.parts[name]?.paths.map((path, i) => <path key={i} d={path.d}
        fill={path.fill ? color(path.fill) : 'none'} stroke={path.stroke ? color(path.stroke) : undefined}
        strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </g>
  )
  const style = {
    '--blue-greeting': `${spec.motion.greetingMs}ms`, '--blue-begin': `${spec.motion.beginMs}ms`,
    '--blue-settle': `${spec.motion.settleMs}ms`, '--blue-breathing': `${spec.motion.breathingMs}ms`,
    '--blue-blink': `${spec.motion.blinkMs}ms`,
  } as CSSProperties
  return (
    <svg className="blue-companion" viewBox={`0 0 ${sketch.width} ${sketch.height}`} style={style}
      role="img" aria-label={spec.labels[presentation.stance]} focusable="false"
      data-stance={presentation.stance} data-static={presentation.staticOnly} data-cue={active?.cue ?? ''}>
      <defs>
        <linearGradient id={`${gradientId}-body`} x1="20%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor={spec.palette.light} /><stop offset="46%" stopColor={spec.palette.body} /><stop offset="100%" stopColor={spec.palette.shade} />
        </linearGradient>
        <linearGradient id={`${gradientId}-belly`} x1="10%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%" stopColor={spec.palette.white} /><stop offset="100%" stopColor={spec.palette.belly} />
        </linearGradient>
      </defs>
      {part('ground')}{part('groundEdge')}
      <g className="blue-companion__shadow">{part('shadow')}</g>
      <g key={active?.id ?? 'at-rest'} className="blue-companion__gesture" onAnimationEnd={event => { if (event.target === event.currentTarget) finish() }}>
        <g className="blue-companion__body">
          {part('footLeft')}{part('footRight')}
          <g className="blue-companion__tuft">{part('tuft')}</g>
          {part('body')}{part('shine')}{part('belly')}{part('bellyDimple')}
          <g className="blue-companion__arm blue-companion__arm--left">{pose.arms[0] && part(pose.arms[0])}</g>
          <g className="blue-companion__arm blue-companion__arm--right">{pose.arms[1] && part(pose.arms[1])}</g>
          <g className="blue-companion__face">
            {part('cheekLeft')}{part('cheekRight')}
            <g className="blue-companion__eyes">{pose.eyes.map(part)}</g>
            {pose.mouth.map(part)}
          </g>
        </g>
      </g>
      <g className="blue-companion__sparkles" aria-hidden="true">{part('sparkLeft')}{part('sparkRight')}</g>
    </svg>
  )
}
