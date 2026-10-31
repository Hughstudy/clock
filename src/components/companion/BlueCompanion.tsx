import { useId, type CSSProperties } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import type { CompanionScene } from '../../contracts/presentation'
import { useBlueCompanion } from '../../hooks/companion/useBlueCompanion'
import { useBlueCompanionTouch } from '../../hooks/companion/useBlueCompanionTouch'
import { useCompanionScene } from '../../hooks/companion/useCompanionScene'
import { sampleScenePose } from '../../logic/scene-pose'
import type { SceneMotionKind } from '../../logic/scene-motion'
import { CompanionSceneArt } from './CompanionSceneArt'
import { CompanionScenery } from './CompanionScenery'
import { CompanionPaint } from './CompanionPaint'
import '../../styles/blue-companion.css'
import '../../styles/companion-scenes.css'

export interface SceneInspection { actionKind: SceneMotionKind | 'idle'; actionProgress: number }
interface Props { presentation: CompanionPresentation; cueId?: string | undefined; scene?: CompanionScene | null | undefined; inspection?: SceneInspection | undefined; panelOpen?: boolean; sceneryEnabled?: boolean; keyboardPat?: number | undefined }

/** Original, replaceable prototype art. Only semantic presentation cues enter this layer. */
export function BlueCompanion({ presentation, cueId, scene, inspection, panelOpen = false, sceneryEnabled = true, keyboardPat }: Props) {
  // Scene entrances/endings have their own bound identities. Keep greeting and
  // requested encouragement, but don't play two start/end gestures together.
  const legacyPresentation = scene && (presentation.cue === 'begin' || presentation.cue === 'settle')
    ? { ...presentation, cue: null } : presentation
  const { spec, sketch, active, finish } = useBlueCompanion(legacyPresentation, cueId)
  const play = useBlueCompanionTouch(presentation, spec, active?.id, finish, scene?.key, keyboardPat)
  const { touch } = play
  const sceneMotion = useCompanionScene(scene, { staticOnly: presentation.staticOnly || presentation.stance === 'neutral', touching: !!touch || !!active, panelOpen })
  const gradientId = useId().replace(/:/g, '')
  const scenePose = spec.poses[presentation.stance]
  const sceneFrame = scene ? sampleScenePose({
    id: scene.id, status: scene.status, progress: inspection ? scene.completedProgress : sceneMotion.presentedProgress,
    activityProgress: inspection ? scene.completedProgress : sceneMotion.activityProgress,
    actionKind: inspection?.actionKind ?? sceneMotion.sampleKind,
    actionProgress: inspection?.actionProgress ?? sceneMotion.actionProgress,
    endingFromActionProgress: inspection ? 0 : sceneMotion.endingFromActionProgress,
    beatIndex: sceneMotion.beatIndex, staticOnly: presentation.staticOnly,
    touchKind: touch?.kind ?? (active?.cue === 'support' ? 'high-five' : null),
  }) : null
  const pose = touch ? {
    arms: touch.kind === 'pat' ? spec.poses.paused.arms : touch.kind === 'high-five'
      ? (touch.point.x < spec.width / 2 ? ['armLeftHappy', 'armRight'] : spec.poses.support.arms) : spec.poses.settled.arms,
    eyes: ['eyesHappy'],
    mouth: touch.phase === 'press' ? ['mouth'] : ['mouthHappy', 'tongue'],
  } : scenePose
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
    '--blue-touch-duration': `${play.duration}ms`,
    '--blue-gaze-x': `${play.gaze.x}px`, '--blue-gaze-y': `${play.gaze.y}px`,
    '--blue-touch-side': touch && touch.point.x < spec.width / 2 ? -1 : 1,
    '--scene-duration': `${sceneMotion.durationMs}ms`,
  } as CSSProperties
  return (
    <svg ref={play.ref} className="blue-companion" viewBox={`0 0 ${sketch.width} ${sketch.height}`} style={style} {...play.handlers}
      role="img" aria-label={spec.labels[presentation.stance]} focusable="false"
      data-stance={presentation.stance} data-static={presentation.staticOnly} data-cue={touch ? '' : active?.cue ?? ''}
      data-touch={touch?.kind ?? ''} data-touch-phase={touch?.phase ?? ''}
      data-scene={scene?.id ?? ''} data-scene-phase={sceneMotion.phase} data-scene-beat={sceneMotion.beatIndex % 3}
      data-scene-motion={sceneMotion.ambientAllowed} data-scene-status={scene?.status ?? ''} data-scene-tier={scene?.ending?.tier ?? ''}
      data-scene-progress={inspection ? scene?.completedProgress : sceneMotion.presentedProgress}
      data-scene-activity-progress={inspection ? scene?.completedProgress : sceneMotion.activityProgress}
      data-scene-action={inspection?.actionKind ?? sceneMotion.sampleKind} data-scene-action-progress={inspection?.actionProgress ?? sceneMotion.actionProgress}>
      {scene && sceneFrame ? <CompanionSceneArt key={scene.key} scene={scene} frame={sceneFrame} /> : <>
      <CompanionPaint id={gradientId}/>
      {sceneryEnabled ? <g transform="scale(.75)"><CompanionScenery/></g> : <>{part('ground')}{part('groundEdge')}</>}
      <g className="blue-companion__shadow">{part('shadow')}</g>
      <g key={active?.id ?? 'at-rest'} className="blue-companion__gesture" onAnimationEnd={event => { if (event.target === event.currentTarget && active) finish(active.id) }}>
        <g key={touch?.id ?? 'no-touch'} className="blue-companion__touch" onAnimationEnd={event => { if (event.target === event.currentTarget && touch) play.finish(touch.id) }}>
          <g className="blue-companion__stance">
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
        </g>
      </g>
      <g className="blue-companion__sparkles" aria-hidden="true">{part('sparkLeft')}{part('sparkRight')}</g>
      </>}
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
