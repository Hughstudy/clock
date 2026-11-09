import { useId, useRef, type CSSProperties } from 'react'
import type { CompanionPresentation } from '../../logic/companion'
import type { CompanionScene } from '../../contracts/presentation'
import { useBlueCompanion } from '../../hooks/companion/useBlueCompanion'
import { useBlueCompanionTouch } from '../../hooks/companion/useBlueCompanionTouch'
import { useCompanionScene } from '../../hooks/companion/useCompanionScene'
import { useFocusPresence, type FocusTime } from '../../hooks/companion/useFocusPresence'
import { useLayerCrossfade } from '../../hooks/companion/useLayerCrossfade'
import { useTouchSpring } from '../../hooks/companion/useTouchSpring'
import { focusAttentionTransforms, NO_ATTENTION, PLAIN_FOCUS_ATTENTION, sampleScenePose } from '../../logic/scene-pose'
import type { BlueTouchKind } from '../../logic/blue-touch'
import type { SceneMotionKind } from '../../logic/scene-motion'
import { CompanionSceneArt } from './CompanionSceneArt'
import { CompanionScenery } from './CompanionScenery'
import { CompanionPaint } from './CompanionPaint'
import '../../styles/blue-companion.css'
import '../../styles/companion-scenes.css'

export interface SceneInspection { actionKind: SceneMotionKind | 'idle'; actionProgress: number }
interface Props { presentation: CompanionPresentation; cueId?: string | undefined; scene?: CompanionScene | null | undefined; inspection?: SceneInspection | undefined; panelOpen?: boolean; sceneryEnabled?: boolean; keyboardPat?: number | undefined; focusTime?: FocusTime | undefined; night?: number }

const NO_GAZE = { x: 0, y: 0 }

/** Original, replaceable prototype art. Only semantic presentation cues enter this layer. */
export function BlueCompanion({ presentation, cueId, scene, inspection, panelOpen = false, sceneryEnabled = true, keyboardPat, focusTime, night = 0 }: Props) {
  // Scene entrances/endings have their own bound identities. Keep greeting and
  // requested encouragement, but don't play two start/end gestures together.
  const legacyPresentation = scene && (presentation.cue === 'begin' || presentation.cue === 'settle')
    ? { ...presentation, cue: null } : presentation
  const { spec, sketch, active, finish } = useBlueCompanion(legacyPresentation, cueId)
  const play = useBlueCompanionTouch(presentation, spec, active?.id, finish, scene?.key, keyboardPat)
  const { touch } = play
  const touchGroup = useRef<SVGGElement>(null)
  useTouchSpring(touchGroup, touch ? { id: touch.id, kind: touch.kind, phase: touch.phase, side: touch.point.x < spec.width / 2 ? -1 : 1 } : null, presentation.staticOnly)
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
  const attention = sceneFrame?.attention ?? (presentation.stance === 'focused' ? PLAIN_FOCUS_ATTENTION : NO_ATTENTION)
  const plainAttention = focusAttentionTransforms(scene ? NO_ATTENTION : attention)
  const focusing = scene ? scene.phase === 'focus' && scene.status === 'running' && scene.completedProgress < 1 : presentation.stance === 'focused'
  useFocusPresence(play.ref, {
    time: focusTime, attention, gaze: sceneFrame?.gaze ?? NO_GAZE, sceneKey: scene?.key ?? null, immediate: presentation.staticOnly,
    enabled: !!focusTime && focusing && !presentation.staticOnly && !touch && !active && !panelOpen && (!scene || sceneMotion.ambientAllowed),
  })
  const pose = touch ? {
    arms: touch.kind === 'pat' ? spec.poses.paused.arms : touch.kind === 'high-five'
      ? (touch.point.x < spec.width / 2 ? ['armLeftHappy', 'armRight'] : spec.poses.support.arms) : spec.poses.settled.arms,
    eyes: ['eyesHappy'],
    mouth: touch.phase === 'press' ? ['mouth'] : ['mouthHappy', 'tongue'],
  } : scenePose
  const color = (tone: string) => tone === 'body' ? `url(#${gradientId}-body)` : tone === 'belly' ? `url(#${gradientId}-belly)` : spec.palette[tone]
  const part = (name: string, touchKind?: BlueTouchKind) => (
    <g key={name} data-part={name} data-touch-kind={touchKind}>
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
  } as CSSProperties
  const layerKey = scene && sceneFrame ? scene.key : 'preparation'
  const layer = scene && sceneFrame ? <CompanionSceneArt key={scene.key} scene={scene} frame={sceneFrame} night={night} /> : <>
      <CompanionPaint id={gradientId}/>
      {sceneryEnabled && <g transform="scale(.75)"><CompanionScenery night={night}/></g>}
      {/* Same rig scale and anchor as every scene, so starting never resizes the creature. */}
      <g transform="scale(.75) translate(42 38)">
      {!sceneryEnabled && <>{part('ground')}{part('groundEdge')}</>}
      <g className="blue-companion__shadow">{part('shadow')}</g>
      <g key={active?.id ?? 'at-rest'} className="blue-companion__gesture" onAnimationEnd={event => { if (event.target === event.currentTarget && active) finish(active.id) }}>
        {/* One stable element: a spring moves it, so a new tap never restarts the body from a pose. */}
        <g ref={touchGroup} className="blue-companion__touch">
          <g className="blue-companion__stance">
            <g className="blue-companion__body" data-touch-kind="pat">
              {part('footLeft', 'squish')}{part('footRight', 'squish')}
              <g className="blue-companion__tuft"><g data-focus-rig="fins">{part('tuft')}</g></g>
              {part('body')}{part('shine')}{part('belly', 'squish')}{part('bellyDimple', 'squish')}
              <g className="blue-companion__arm blue-companion__arm--left" data-touch-kind="high-five">{pose.arms[0] && part(pose.arms[0])}</g>
              <g className="blue-companion__arm blue-companion__arm--right" data-touch-kind="high-five"><g data-focus-arm="168 105 -1">{pose.arms[1] && part(pose.arms[1])}</g></g>
              <g className="blue-companion__face"><g transform={plainAttention.head}><g data-focus-rig="head">
                <g data-focus-rig="cheek-left">{part('cheekLeft')}</g><g data-focus-rig="cheek-right">{part('cheekRight')}</g>
                <g transform={plainAttention.eyes}><g data-focus-rig="eyes"><g className="blue-companion__eyes">{pose.eyes.map(name => part(name))}</g></g></g>
                <g data-focus-rig="mouth">{pose.mouth.map(name => part(name))}</g>
              </g></g></g>
            </g>
          </g>
        </g>
      </g>
      <g className="blue-companion__sparkles" aria-hidden="true">{part('sparkLeft')}{part('sparkRight')}</g>
      </g>
  </>
  // Starting or changing an activity crossfades the drawing instead of cutting to it.
  // Only a fresh start of an activity (a permitted begin or rest cue) fades; returning to
  // preparation, navigation and recovery cut as before. Like every scene motion it yields
  // to attention: no fade while a panel or input needs the screen.
  const starting = !!scene?.cue && scene.cue.sessionId === scene.sessionId && (scene.cue.kind === 'begin' || scene.cue.kind === 'rest')
  const { outgoing, outgoingKey } = useLayerCrossfade(layerKey, layer, 220, presentation.staticOnly || panelOpen || !scene?.allowBeats || !starting)
  return (
    <svg ref={play.ref} className="blue-companion" viewBox={`0 0 ${sketch.width} ${sketch.height}`} style={style} {...play.handlers}
      role="img" aria-label={spec.labels[presentation.stance]} focusable="false"
      data-stance={presentation.stance} data-static={presentation.staticOnly} data-cue={touch ? '' : active?.cue ?? ''}
      data-touch={touch?.kind ?? ''} data-touch-phase={touch?.phase ?? ''}
      data-scene={scene?.id ?? ''} data-scene-phase={sceneMotion.phase}
      data-scene-motion={sceneMotion.ambientAllowed} data-scene-status={scene?.status ?? ''} data-scene-tier={scene?.ending?.tier ?? ''}
      data-scene-progress={inspection ? scene?.completedProgress : sceneMotion.presentedProgress}
      data-scene-activity-progress={inspection ? scene?.completedProgress : sceneMotion.activityProgress}
      data-scene-action={inspection?.actionKind ?? sceneMotion.sampleKind} data-scene-action-progress={inspection?.actionProgress ?? sceneMotion.actionProgress}>
      {/* A stable background receives releases even when a press changes the drawn pose.
          Contact begins only on a painted part of the character above it. */}
      <rect className="blue-companion__touch-surface" width={sketch.width} height={sketch.height} fill="transparent" aria-hidden="true" />
      {layer}
      {outgoing && <g key={`outgoing:${outgoingKey}`} className="blue-companion__outgoing" aria-hidden="true">{outgoing}</g>}
      {touch && <g key={touch.id} className="blue-companion__contact" transform={`translate(${touch.point.x} ${touch.point.y})`} aria-hidden="true">
        <circle className="blue-companion__contact-ring" r={spec.touch.contactRadius} />
        <g className="blue-companion__affection"><path d="M0 -6 C-9 -16 -17 -2 0 7 C17 -2 9 -16 0 -6Z" fill={spec.palette.blush} stroke={spec.palette.outline} strokeWidth="1" /></g>
      </g>}
    </svg>
  )
}
