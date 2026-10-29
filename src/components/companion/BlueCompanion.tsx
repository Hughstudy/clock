import { useId, type CSSProperties } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import type { CompanionScene } from '../../contracts/presentation'
import { useBlueCompanion } from '../../hooks/companion/useBlueCompanion'
import { useBlueCompanionTouch } from '../../hooks/companion/useBlueCompanionTouch'
import { useCompanionScene } from '../../hooks/companion/useCompanionScene'
import { sceneArtSketch } from '../../data/scene-art'
import { CompanionSceneArt } from './CompanionSceneArt'
import '../../styles/blue-companion.css'
import '../../styles/companion-scenes.css'

interface Props { presentation: CompanionPresentation; cueId?: string | undefined; scene?: CompanionScene | null | undefined }

/** Original, replaceable prototype art. Only semantic presentation cues enter this layer. */
export function BlueCompanion({ presentation, cueId, scene }: Props) {
  // Scene entrances/endings have their own bound identities. Keep greeting and
  // requested encouragement, but don't play two start/end gestures together.
  const legacyPresentation = scene && (presentation.cue === 'begin' || presentation.cue === 'settle')
    ? { ...presentation, cue: null } : presentation
  const { spec, sketch, active, finish } = useBlueCompanion(legacyPresentation, cueId)
  const play = useBlueCompanionTouch(presentation, spec, active?.id, finish, scene?.key)
  const { touch } = play
  const sceneMotion = useCompanionScene(scene, { staticOnly: presentation.staticOnly || presentation.stance === 'neutral', touching: !!touch || !!active })
  const gradientId = useId().replace(/:/g, '')
  let scenePose = spec.poses[presentation.stance]
  if (scene && !active && presentation.stance !== 'neutral') {
    const holding = ['F3', 'F6', 'R3'].includes(scene.id) || (scene.status === 'ended' && ['F1', 'F4'].includes(scene.id))
    scenePose = scene.status === 'paused' ? spec.poses.paused : scene.status === 'ended' ? spec.poses.settled
      : scene.phase === 'break' || scene.id === 'F8' ? spec.poses.resting : spec.poses.focused
    if (holding) scenePose = { ...scenePose, arms: ['armLeftRead', 'armRightRead'] }
    else if (scene.id === 'R1' && scene.status !== 'paused') scenePose = { ...scenePose, arms: spec.poses.settled.arms }
    else if (scene.id === 'F5' && scene.status === 'running') scenePose = { ...scenePose, arms: ['armLeft', 'armRightWave'] }
    else if (['F1', 'F2', 'F4', 'F7'].includes(scene.id) && scene.status === 'running') scenePose = { ...scenePose, arms: ['armLeftScene', 'armRightPaused'] }
  }
  const pose = touch ? {
    arms: touch.kind === 'pat' ? spec.poses.paused.arms : touch.kind === 'high-five'
      ? (touch.point.x < spec.width / 2 ? ['armLeftHappy', 'armRight'] : spec.poses.support.arms) : spec.poses.settled.arms,
    eyes: ['eyesHappy'],
    mouth: touch.phase === 'press' ? ['mouth'] : ['mouthHappy', 'tongue'],
  } : scenePose
  const color = (tone: string) => tone === 'body' ? `url(#${gradientId}-body)` : tone === 'belly' ? `url(#${gradientId}-belly)` : spec.palette[tone]
  const part = (name: string) => (
    <g key={name} data-part={name}>
      {(sketch.parts[name] ?? sceneArtSketch.parts[name])?.paths.map((path, i) => <path key={i} d={path.d}
        fill={path.fill ? color(path.fill) : 'none'} stroke={path.stroke ? color(path.stroke) : undefined}
        strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </g>
  )
  const style = {
    '--blue-greeting': `${spec.motion.greetingMs}ms`, '--blue-begin': `${spec.motion.beginMs}ms`,
    '--blue-settle': `${spec.motion.settleMs}ms`, '--blue-breathing': `${spec.motion.breathingMs}ms`,
    '--blue-blink': `${spec.motion.blinkMs}ms`,
    '--blue-touch-duration': `${play.duration}ms`,
    '--blue-gaze-x': `${play.gaze.x}px`, '--blue-gaze-y': `${play.gaze.y}px`,
    '--blue-touch-side': touch && touch.point.x < spec.width / 2 ? -1 : 1,
    '--scene-duration': `${sceneMotion.durationMs}ms`,
  } as CSSProperties
  const sceneLayer = (layer: 'back' | 'held' | 'front') => scene && <g key={`${scene.key}:${sceneMotion.motionId}:${layer}`}>
    <CompanionSceneArt scene={scene} layer={layer} />
  </g>
  return (
    <svg ref={play.ref} className="blue-companion" viewBox={`0 0 ${sketch.width} ${sketch.height}`} style={style} {...play.handlers}
      role="img" aria-label={spec.labels[presentation.stance]} focusable="false"
      data-stance={presentation.stance} data-static={presentation.staticOnly} data-cue={touch ? '' : active?.cue ?? ''}
      data-touch={touch?.kind ?? ''} data-touch-phase={touch?.phase ?? ''}
      data-scene={scene?.id ?? ''} data-scene-phase={sceneMotion.phase} data-scene-beat={sceneMotion.beatIndex % 3}
      data-scene-motion={sceneMotion.ambientAllowed} data-scene-status={scene?.status ?? ''} data-scene-tier={scene?.ending?.tier ?? ''}>
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
      {sceneLayer('back')}
      <g key={active?.id ?? 'at-rest'} className="blue-companion__gesture" onAnimationEnd={event => { if (event.target === event.currentTarget && active) finish(active.id) }}>
        <g key={touch?.id ?? 'no-touch'} className="blue-companion__touch" onAnimationEnd={event => { if (event.target === event.currentTarget && touch) play.finish(touch.id) }}>
          <g className="blue-companion__stance">
            <g className="blue-companion__body">
              {part('footLeft')}{part('footRight')}
              <g className="blue-companion__tuft">{part('tuft')}</g>
              {part('body')}{part('shine')}{part('belly')}{part('bellyDimple')}
              {sceneLayer('held')}
              <g className="blue-companion__arm blue-companion__arm--left">{pose.arms[0] && part(pose.arms[0])}</g>
              <g className="blue-companion__arm blue-companion__arm--right">{pose.arms[1] && part(pose.arms[1])}</g>
              <g className="blue-companion__face">
                {part('cheekLeft')}{part('cheekRight')}
                <g className="blue-companion__eyes">{pose.eyes.map(part)}</g>
                {pose.mouth.map(part)}
              </g>
            </g>
          </g>
        </g>
      </g>
      {sceneLayer('front')}
      <g className="blue-companion__sparkles" aria-hidden="true">{part('sparkLeft')}{part('sparkRight')}</g>
      {touch && <g key={touch.id} className="blue-companion__contact" transform={`translate(${touch.point.x} ${touch.point.y})`} aria-hidden="true">
        <circle className="blue-companion__contact-ring" r={spec.touch.contactRadius} />
        <g className="blue-companion__affection"><path d="M0 -6 C-9 -16 -17 -2 0 7 C17 -2 9 -16 0 -6Z" fill={spec.palette.blush} stroke={spec.palette.outline} strokeWidth="1" /></g>
      </g>}
      {/* A fixed decorative surface inside the host's native button. It never
          moves with the art, takes focus, captures pointers or dispatches clicks. */}
      <rect className="blue-companion__touch-surface" x="34" y="12" width="172" height="158" rx="64" fill="transparent" aria-hidden="true" />
    </svg>
  )
}
