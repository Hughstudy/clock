import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { BlueCompanion, type SceneInspection } from '../../src/components/companion/BlueCompanion'
import { blueCompanionSpec } from '../../src/data/blue-companion'
import { useMotionPreference } from '../../src/hooks/companion/useMotionPreference'
import { BLUE_STANCES } from '../../src/logic/blue-companion'
import type { CompanionPresentation, CompanionStance } from '../../src/logic/companion'
import type { SceneId } from '../../src/contracts/presentation'
import { sceneMotionSpec } from '../../src/data/scene-motion'
import { sceneMotionDuration } from '../../src/logic/scene-motion'
import { activityFixture, activityPresentation, SCENE_IDS, SCENE_LABELS, type SceneFixtureState, type SceneFixtureTier } from './scene-fixtures'
import '../../src/styles/companion.css'
import './preview.css'

type Cue = NonNullable<CompanionPresentation['cue']>
type Check = { label: string; passed: boolean }
const wait = (ms = 45) => new Promise<void>(resolve => window.setTimeout(resolve, ms))
const points = { pat: { x: 120, y: 55 }, squish: { x: 120, y: 130 }, 'high-five': { x: 184, y: 74 } }

function Preview() {
  const [stance, setStance] = useState<CompanionStance>('ready')
  const [cue, setCue] = useState<CompanionPresentation['cue']>(null)
  const [cueId, setCueId] = useState<string | undefined>()
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [width, setWidth] = useState(375)
  const [largeText, setLargeText] = useState(false)
  const [intentCount, setIntentCount] = useState(0)
  const [repeatCount, setRepeatCount] = useState(0)
  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(false)
  const [frame, setFrame] = useState('Live interaction')
  const [sceneId, setSceneId] = useState<SceneId | ''>('F1')
  const [sceneState, setSceneState] = useState<SceneFixtureState>('loop')
  const [sceneSerial, setSceneSerial] = useState(0)
  const [sceneProgress, setSceneProgress] = useState(0.45)
  const [sceneTier, setSceneTier] = useState<SceneFixtureTier>('snack')
  const [attentionAllowed, setAttentionAllowed] = useState(true)
  const [inspectMotion, setInspectMotion] = useState(false)
  const [inspectKind, setInspectKind] = useState<SceneInspection['actionKind']>('idle')
  const [inspectPosition, setInspectPosition] = useState(0)
  const [playInspection, setPlayInspection] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [sceneChecks, setSceneChecks] = useState<Check[]>([])
  const scene = useRef<HTMLDivElement>(null)
  const serial = useRef(0)
  const intents = useRef(0)
  const { reducedMotion, systemReducedMotion } = useMotionPreference(motionEnabled)
  const presentation: CompanionPresentation = { stance, cue, staticOnly: reducedMotion }
  const activity = sceneId ? activityFixture(sceneId, sceneState, sceneSerial, sceneTier, sceneProgress, attentionAllowed) : null
  const inspectionMs = inspectKind === 'idle' ? 12000 : activity ? sceneMotionDuration(inspectKind, activity, sceneMotionSpec) : sceneMotionSpec.beatMs
  const renderedPresentation: CompanionPresentation = activity ? {
    ...activityPresentation(activity, sceneState, reducedMotion),
    ...(cue === 'support' && sceneState !== 'error' ? { stance: 'support', cue: 'support' } as const : {}),
  } : presentation

  useEffect(() => {
    if (!playInspection || !inspectMotion || reducedMotion) return
    let animation = 0
    let last: number | null = null
    let position = inspectKind === 'idle' ? sceneProgress : inspectPosition
    const step = (now: number) => {
      if (last !== null) position = Math.min(1, position + (now - last) * playbackSpeed / inspectionMs)
      last = now
      if (inspectKind === 'idle') setSceneProgress(position)
      else setInspectPosition(position)
      if (position < 1) animation = requestAnimationFrame(step)
      else setPlayInspection(false)
    }
    animation = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animation)
  }, [playInspection, inspectMotion, inspectKind, playbackSpeed, inspectionMs, reducedMotion])

  function emit(nextCue: Cue = 'support') {
    setStance(nextCue === 'begin' ? 'focused' : nextCue === 'settle' ? 'settled' : nextCue === 'welcome' ? 'ready' : 'support')
    setCue(nextCue)
    setCueId(`fixture-${++serial.current}`)
    setFrame('Live interaction')
  }
  function request() { intents.current += 1; setIntentCount(intents.current); emit('support') }
  function svg() {
    const element = scene.current?.querySelector<SVGSVGElement>('.blue-companion')
    if (!element) throw new Error('Character SVG is unavailable')
    return element
  }
  function pointer(type: string, kind: keyof typeof points = 'squish', options: PointerEventInit = {}) {
    const element = svg()
    const surface = element.querySelector('.blue-companion__touch-surface')
    if (!surface) throw new Error('Fixed touch surface is unavailable')
    const rect = element.getBoundingClientRect()
    const scale = Math.min(rect.width / 240, rect.height / 190)
    const point = points[kind]
    surface.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true,
      button: 0, buttons: type === 'pointerdown' ? 1 : 0,
      clientX: rect.left + (rect.width - 240 * scale) / 2 + point.x * scale,
      clientY: rect.top + (rect.height - 190 * scale) / 2 + point.y * scale,
      ...options,
    }))
  }
  function cancel() { pointer('pointercancel'); setCue(null); setFrame('Settled; no queued gesture') }
  async function inspect(kind: keyof typeof points, release = false) {
    flushSync(() => { setStance('ready'); setCue(null) })
    await wait()
    pointer('pointerdown', kind)
    setFrame(`${kind}: contact held for at most ${blueCompanionSpec.touch.holdMaxMs / 1000} seconds`)
    if (release) {
      await wait(150)
      pointer('pointerup', kind)
      pointer('pointerout', kind, { relatedTarget: null })
      setFrame(`${kind}: finite release and rebound`)
    }
  }

  async function runChecks() {
    if (running) return
    setRunning(true)
    setChecks([])
    setInspectMotion(false); setPlayInspection(false)
    const results: Check[] = []
    const check = (label: string, passed: boolean) => { results.push({ label, passed }); setChecks([...results]) }
    const touch = () => svg().dataset.touch
    const phase = () => svg().dataset.touchPhase
    const initialIntents = intents.current
    try {
      flushSync(() => { setSceneId(''); setStance('ready'); setCue(null); setMotionEnabled(true); setFrame('Running pointer-only checks') })
      pointer('pointercancel')
      await wait(100)
      const nativeButton = scene.current!.querySelector('button')!
      const initialBounds = nativeButton.getBoundingClientRect()
      for (const kind of ['pat', 'squish', 'high-five'] as const) {
        pointer('pointerdown', kind)
        await wait()
        check(`${kind}: contact selects the correct expression`, touch() === kind && phase() === 'press')
        pointer('pointerup', kind)
        await wait()
        pointer('pointerout', kind, { relatedTarget: null })
        await wait()
        check(`${kind}: touch-up then leave preserves release`, touch() === kind && phase() === 'release')
        const bounds = nativeButton.getBoundingClientRect()
        check(`${kind}: native target stays fixed`, (['left', 'top', 'width', 'height'] as const).every(key => Math.abs(bounds[key] - initialBounds[key]) < 0.5))
        pointer('pointercancel')
        await wait()
      }
      pointer('pointerdown', 'pat', { isPrimary: false, pointerId: 2 })
      await wait()
      check('A secondary pointer cannot start a gesture', touch() === '')
      pointer('pointerdown', 'pat')
      await wait()
      pointer('pointerup', 'pat', { isPrimary: false, pointerId: 2 })
      await wait()
      check('A secondary release cannot release the primary press', phase() === 'press')
      pointer('pointercancel', 'pat', { isPrimary: false, pointerId: 2 })
      await wait()
      check('A secondary cancellation preserves the primary press', phase() === 'press')
      pointer('pointerout', 'pat', { isPrimary: false, pointerId: 2, relatedTarget: null })
      await wait()
      check('A secondary leave preserves the primary press', phase() === 'press')
      pointer('pointercancel')
      await wait()
      check('Primary pointer cancellation settles immediately', touch() === '')

      pointer('pointerdown', 'pat')
      await wait()
      pointer('pointerup', 'pat')
      await wait()
      const previousGesture = svg().querySelector('.blue-companion__touch')
      pointer('pointerdown', 'squish')
      await wait()
      check('A repeated tap replaces the previous local gesture', touch() === 'squish' && phase() === 'press' && svg().querySelector('.blue-companion__touch') !== previousGesture)
      flushSync(() => { setStance('focused'); setCue(null) })
      await wait()
      check('A host stance change cancels direct play', touch() === '')
      const ambient = () => svg().getAnimations({ subtree: true }).filter(animation =>
        animation instanceof CSSAnimation && /blue-focus-|blue-blink/.test(animation.animationName))
      if (!systemReducedMotion) {
        const breathing = ambient().find(animation => (animation as CSSAnimation).animationName === 'blue-focus-breathe')
        check('Focused countdown has breathing, two quiet hands and a blink', ambient().length === 4 && !!breathing)
        const previousTime = Number(breathing?.currentTime)
        flushSync(() => setRepeatCount(value => value + 1))
        await wait(100)
        check('Ordinary rerenders retain the running breath cycle', ambient().includes(breathing!) && Number(breathing?.currentTime) > previousTime)
      }
      pointer('pointerdown', 'squish')
      await wait()
      check('Direct touch suspends ambient breathing and blinking', ambient().length === 0)
      window.dispatchEvent(new Event('blur'))
      await wait()
      check('Window blur clears local play', touch() === '')
      check('After direct play, focus returns to its allowed ambient state', ambient().length === (systemReducedMotion ? 0 : 4))
      pointer('pointerdown', 'pat')
      await wait()
      window.dispatchEvent(new Event('resize'))
      await wait()
      check('Layout invalidation clears local play', touch() === '')
      pointer('pointerdown', 'squish')
      await wait()
      flushSync(() => setMotionEnabled(false))
      await wait()
      if (systemReducedMotion) check('OS reduced motion remains static when app motion is disabled', svg().dataset.static === 'true')
      else check('Disabling motion settles an in-flight interaction', touch() === '' && svg().dataset.static === 'true')
      check('Motion-off stops every countdown animation', svg().getAnimations({ subtree: true }).length === 0)
      pointer('pointerdown', 'squish')
      await wait()
      check('Static mode still responds with an expression', touch() === 'squish' && svg().querySelector('[data-part="eyesHappy"]') !== null)
      pointer('pointerup', 'squish')
      await wait()
      check('Static response has no active CSS animations', svg().getAnimations({ subtree: true }).length === 0)
      await wait(blueCompanionSpec.touch.squishMs + 180)
      check('Fallback timeout clears response without animationend', touch() === '')
      flushSync(() => { setMotionEnabled(true); emit('support') })
      await wait()
      const repeatedNode = svg().querySelector('.blue-companion__gesture')
      flushSync(() => setRepeatCount(value => value + 1))
      await wait()
      check('Repeating the same cue identity retains its gesture node', svg().querySelector('.blue-companion__gesture') === repeatedNode)
      await wait(blueCompanionSpec.motion.greetingMs + 150)
      flushSync(() => setRepeatCount(value => value + 1))
      await wait()
      check('A consumed cue does not replay on an ordinary rerender', svg().dataset.cue === '')
      check('Synthetic pointer events never dispatch host intent', intents.current === initialIntents)
      setFrame('Checks complete; results below')
    } catch (error) { check(error instanceof Error ? error.message : String(error), false) }
    finally { setRunning(false) }
  }

  async function runSceneChecks() {
    if (running) return
    setRunning(true)
    setSceneChecks([])
    setInspectMotion(false); setPlayInspection(false)
    const results: Check[] = []
    const check = (label: string, passed: boolean) => { results.push({ label, passed }); setSceneChecks([...results]) }
    const phase = () => svg().dataset.scenePhase
    const initialIntents = intents.current
    const choose = (id: SceneId, state: SceneFixtureState, tier: SceneFixtureTier = 'snack') => {
      flushSync(() => { setSceneId(id); setSceneState(state); setSceneTier(tier); setCue(null); setSceneSerial(value => value + 1) })
    }
    try {
      flushSync(() => { setMotionEnabled(false); setAttentionAllowed(true); setFrame('Checking all scene fixtures') })
      for (const id of SCENE_IDS) {
        for (const state of ['loop', 'paused', 'ending', 'restored'] as const) {
          choose(id, state)
          await wait()
          check(`${id} ${state}: correct scene, finite SVG geometry and static motion`, svg().dataset.scene === id && !/NaN|Infinity/.test(svg().outerHTML) && svg().getAnimations({ subtree: true }).length === 0)
        }
      }
      for (const tier of ['hello', 'snack', 'meal', 'feast'] as const) {
        choose('F1', 'ending', tier)
        await wait()
        check(`Saved ${tier} ending retains its static tableau`, svg().dataset.sceneTier === tier && svg().dataset.sceneStatus === 'ended')
      }

      flushSync(() => { setMotionEnabled(true); setAttentionAllowed(true) })
      window.dispatchEvent(new Event('focus'))
      choose('F1', 'opening')
      await wait()
      if (!systemReducedMotion) {
        check('A permitted fresh start plays its entrance', phase() === 'open')
        flushSync(() => setRepeatCount(value => value + 1))
        await wait()
        check('Countdown rerenders retain the entrance identity', phase() === 'open')
        await wait(sceneMotionSpec.openMs + 120)
        check('Entrance settles using a finite fallback timer', phase() === 'idle')
        flushSync(() => setRepeatCount(value => value + 1))
        await wait()
        check('Consumed entrance does not replay', phase() === 'idle')

        choose('F2', 'opening')
        await wait()
        flushSync(() => setAttentionAllowed(false))
        await wait()
        check('Thought input attention stops every scene animation', phase() === 'idle' && svg().dataset.sceneMotion === 'false' && svg().getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'))
        flushSync(() => setAttentionAllowed(true))
        await wait()
        check('Finishing input never replays the cancelled entrance', phase() === 'idle')

        choose('F3', 'opening')
        await wait()
        pointer('pointerdown', 'squish')
        await wait()
        check('Direct touch takes priority over the entrance', phase() === 'idle' && svg().dataset.touch === 'squish')
        pointer('pointercancel')
        await wait()

        choose('F2', 'loop')
        await wait()
        pointer('pointerdown', 'pat')
        await wait()
        check('A running scene can hold a direct head pat', svg().dataset.touch === 'pat' && svg().dataset.touchPhase === 'press')
        choose('F3', 'loop')
        await wait()
        check('Replacing the session settles touch even when the stance stays focused', svg().dataset.stance === 'focused' && svg().dataset.scene === 'F3' && svg().dataset.touch === '')

        flushSync(() => emit('support'))
        await wait()
        check('An explicit greeting preserves supported scene contact while activity yields', phase() === 'idle' && svg().querySelector('[data-scene-part]') !== null && !/NaN|Infinity/.test(svg().outerHTML))

        choose('F1', 'ending', 'feast')
        await wait()
        check('A saved, matching ending plays once', phase() === 'ending')
        window.dispatchEvent(new Event('pagehide'))
        await wait()
        check('Page hiding cancels an ending', phase() === 'idle')
        window.dispatchEvent(new Event('pageshow'))
        await wait()
        check('Returning does not catch up the cancelled ending', phase() === 'idle')

        choose('R1', 'opening')
        await wait()
        check('Rest uses its permitted rest entrance cue', phase() === 'open')
        choose('R1', 'ending')
        await wait()
        check('Rest ending needs no focus-time tier', phase() === 'ending' && svg().dataset.sceneTier === '')
      } else check('OS reduced motion suppresses scene choreography', phase() === 'idle')

      choose('F2', 'opening')
      await wait()
      flushSync(() => setMotionEnabled(false))
      await wait()
      check('Disabling motion cancels every scene animation', phase() === 'idle' && svg().getAnimations({ subtree: true }).length === 0)
      choose('F3', 'error')
      await wait()
      check('Errors keep the scene neutral and static', svg().dataset.stance === 'neutral' && svg().getAnimations({ subtree: true }).length === 0)
      choose('F3', 'restored')
      flushSync(() => setMotionEnabled(true))
      await wait()
      check('Restored activity appears without replaying a start', phase() === 'idle')
      check('Scene motions never dispatch a host intent', intents.current === initialIntents)
      setFrame('Scene checks complete')
    } catch (error) { check(error instanceof Error ? error.message : String(error), false) }
    finally { setRunning(false) }
  }

  return <main className="preview">
    <header className="preview__header"><span className="preview__eyebrow">Animation workbench · C2-P3 fixtures</span><h1>A little company, in blue.</h1><p>The production character and its everyday activities. Pat its head, squish its belly or touch a hand. These fixtures select read-only views; they never save a session, record time or grant scene access.</p></header>
    <div className="preview__workspace">
      <section className="preview__canvas" aria-label="Character fixture">
        <div ref={scene} className="preview__phone" style={{ width, fontSize: largeText ? '200%' : '100%' }} data-text-scale={largeText ? '200' : '100'}>
          <p className="preview__eyebrow">Fixture · {stance}</p>
          <div className="companion-feedback"><button type="button" className="companion-feedback__greeting" aria-label="Say hello to the blue companion" onClick={request}><span className="companion-feedback__character" aria-hidden="true"><BlueCompanion presentation={renderedPresentation} cueId={cueId} scene={activity} panelOpen={!attentionAllowed} inspection={inspectMotion ? { actionKind: inspectKind, actionProgress: inspectPosition } : undefined} /></span><span className="preview__invite">Say hello <span aria-hidden="true">↗</span></span></button></div>
          <p className="preview__hint">A head pat, a belly squish, a tiny high-five.</p>
          <p className="preview__facts">Explicit host intents: <strong>{intentCount}</strong></p>
          <p className="preview__facts">{reducedMotion ? 'Static expression' : 'Motion enabled'}{systemReducedMotion ? ' · OS reduced motion' : ''}</p>
          <p className="preview__frame">{frame}</p>
        </div>
      </section>
      <aside className="preview__controls" aria-label="Fixture controls">
        <fieldset disabled={running}><legend>Session activity</legend>
          <label>Scene<select aria-label="Scene" value={sceneId} onChange={event => { setSceneId(event.target.value as SceneId | ''); setSceneState('loop') }}><option value="">Plain character / legacy cues</option>{SCENE_IDS.map(id => <option key={id} value={id}>{id} · {SCENE_LABELS[id]}</option>)}</select></label>
          <label>Scene state<select aria-label="Scene state" value={sceneState} onChange={event => { setSceneState(event.target.value as SceneFixtureState); setSceneSerial(value => value + 1) }}>{(['opening', 'loop', 'paused', 'ending', 'restored', 'error'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Saved ending tier<select aria-label="Saved ending tier" value={sceneTier} onChange={event => setSceneTier(event.target.value as SceneFixtureTier)}>{(['hello', 'snack', 'meal', 'feast'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Completed progress: {Math.round(sceneProgress * 100)}%<input type="range" min="0" max="100" step="0.1" value={sceneProgress * 100} onChange={event => setSceneProgress(Number(event.target.value) / 100)} /></label>
          <label className="preview__toggle"><input type="checkbox" checked={!attentionAllowed} onChange={event => setAttentionAllowed(!event.target.checked)} /> Thought editor needs attention</label>
          <div className="preview__buttons"><button type="button" onClick={() => { setSceneState('opening'); setSceneSerial(value => value + 1) }}>New entrance cue</button><button type="button" onClick={() => { setSceneState('ending'); setSceneSerial(value => value + 1) }}>New ending cue</button></div>
          <p className="preview__small">Focus progress is completed proportion; rest has no progress prop. Rest endings have no focus-time tier.</p>
        </fieldset>
        <fieldset disabled={running}><legend>Motion inspection</legend>
          <label className="preview__toggle"><input type="checkbox" checked={inspectMotion} onChange={event => { setInspectMotion(event.target.checked); setPlayInspection(false) }} /> Inspect exact poses</label>
          <label>Sequence<select aria-label="Sequence" value={inspectKind} onChange={event => { setInspectKind(event.target.value as SceneInspection['actionKind']); setPlayInspection(false) }}><option value="idle">Full activity progression</option><option value="open">Entrance</option><option value="beat">Quiet activity beat</option><option value="ending">Closing gesture</option></select></label>
          <label>Action position: {Math.round(inspectPosition * 100)}%<input type="range" min="0" max="1" step="0.001" value={inspectPosition} onChange={event => { setInspectPosition(Number(event.target.value)); setPlayInspection(false) }} /></label>
          <label>Playback speed<select aria-label="Playback speed" value={playbackSpeed} onChange={event => setPlaybackSpeed(Number(event.target.value))}><option value="1">Normal speed</option><option value="0.25">Quarter speed</option></select></label>
          <div className="preview__buttons"><button type="button" onClick={() => { setInspectMotion(true); if (inspectKind === 'idle') setSceneProgress(0); else setInspectPosition(0); setPlayInspection(true) }}>Play sequence</button><button type="button" onClick={() => setPlayInspection(false)}>Hold this pose</button></div>
          <p className="preview__small">The full-activity preview compresses session progress into twelve seconds. The action slider samples exact contact poses; reduced motion keeps the selected pose still.</p>
        </fieldset>
        <fieldset disabled={running}><legend>Presentation</legend>
          <label>Semantic stance<select aria-label="Semantic stance" value={stance} onChange={event => { setStance(event.target.value as CompanionStance); setCue(null) }}>{BLUE_STANCES.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Scene width<select aria-label="Scene width" value={width} onChange={event => setWidth(Number(event.target.value))}>{[320, 375, 430].map(value => <option key={value} value={value}>{value} CSS pixels</option>)}</select></label>
          <label className="preview__toggle"><input type="checkbox" checked={motionEnabled} onChange={event => setMotionEnabled(event.target.checked)} /> Enable motion</label>
          <label className="preview__toggle"><input type="checkbox" checked={largeText} onChange={event => setLargeText(event.target.checked)} /> 200% scene text</label>
          <p className="preview__small">The OS preference takes precedence. Neutral is the quiet error fixture.</p>
        </fieldset>
        <fieldset disabled={running}><legend>Permitted visual cues</legend>
          <div className="preview__buttons">{(['welcome', 'begin', 'settle', 'support'] as const).map(value => <button key={value} type="button" onClick={() => emit(value)}>New {value}</button>)}</div>
          <div className="preview__buttons"><button type="button" onClick={() => setRepeatCount(value => value + 1)}>Repeat same cue</button><button type="button" onClick={cancel}>Cancel</button></div>
          <p className="preview__small">Cue: {cueId ?? 'none'} · repeat renders: {repeatCount}. These are visual fixtures, never saved-result claims.</p>
        </fieldset>
        <fieldset disabled={running}><legend>Contact inspection</legend>
          <div className="preview__buttons"><button type="button" onClick={() => void inspect('pat')}>Hold head pat</button><button type="button" onClick={() => void inspect('squish')}>Hold squish</button><button type="button" onClick={() => void inspect('high-five', true)}>Replay high-five</button><button type="button" onClick={() => { pointer('pointerup'); pointer('pointerout', 'squish', { relatedTarget: null }); setFrame('Release and rebound') }}>Release contact</button><button type="button" onClick={cancel}>Settle</button></div>
          <p className="preview__small">Contact controls dispatch pointer events only. The production timeout remains active during inspection.</p>
        </fieldset>
      </aside>
    </div>
    {sceneId && <section className="preview__poses" aria-label="Selected activity contact sequence">
      <h2>{SCENE_LABELS[sceneId]} · contact sequence</h2>
      <p className="preview__small">Exact sampled poses from the production renderer. Progress landmarks are connected by handling actions; resting scenes show their action cycle.</p>
      <div className="preview__pose-grid preview__contact-grid">{[0, .2, .32, .4, .58, .75, .9, 1].map(position => {
        const example = activityFixture(sceneId, 'loop', 0, 'snack', position, true)
        const rest = sceneId.startsWith('R')
        return <figure key={position} className="preview__pose"><div aria-hidden="true"><BlueCompanion presentation={activityPresentation(example, 'loop', true)} scene={example} inspection={{ actionKind: rest ? 'beat' : 'idle', actionProgress: rest ? position : 0 }} /></div><figcaption>{Math.round(position * 100)}%</figcaption></figure>
      })}</div>
    </section>}
    <section className="preview__poses" aria-label="All static session activities">
      <h2>Eleven activities, same little companion</h2>
      <p className="preview__small">Every shipped scene remains recognizable without motion. Select a scene above to inspect its opening, pause, ending or restored state.</p>
      <div className="preview__pose-grid preview__scene-grid">{SCENE_IDS.map(id => {
        const example = activityFixture(id, 'loop', 0, 'snack', 0.6, true)
        return <figure key={id} className="preview__pose"><div aria-hidden="true"><BlueCompanion presentation={activityPresentation(example, 'loop', true)} scene={example} /></div><figcaption>{id} · {SCENE_LABELS[id]}</figcaption></figure>
      })}</div>
    </section>
    <section className="preview__poses" aria-label="Seven static poses">
      <h2>Seven expressions, with no motion</h2>
      <p className="preview__small">The same production drawing and semantic poses, held still for comparison.</p>
      <div className="preview__pose-grid">{BLUE_STANCES.map(value => <figure key={value} className="preview__pose"><div aria-hidden="true"><BlueCompanion presentation={{ stance: value, cue: null, staticOnly: true }} /></div><figcaption>{value}</figcaption></figure>)}</div>
    </section>
    <section className="preview__checks" aria-label="Browser lifecycle checks">
      <div className="preview__checks-heading"><div><h2>Browser lifecycle checks</h2><p>Real React handlers, fixed SVG contact surface and production styles. Keep this tab visible while checks run.</p></div><button type="button" className="preview__run" disabled={running} onClick={() => void runChecks()}>{running ? 'Checking…' : 'Run interaction checks'}</button></div>
      {checks.length > 0 && <p className="preview__result" data-result={checks.some(check => !check.passed) ? 'fail' : running ? 'running' : 'pass'}>{checks.filter(check => check.passed).length}/{checks.length} checks passed{running ? ' · running' : ''}</p>}
      <ol className="preview__check-list">{checks.map((check, index) => <li key={index} data-passed={check.passed}><span>{check.passed ? 'PASS' : 'FAIL'}</span> {check.label}</li>)}</ol>
      <div className="preview__checks-heading preview__scene-checks-heading"><div><h2>Scene lifecycle checks</h2><p>Checks every scene in static running, paused, ended and restored states, then verifies finite cue cancellation and replay protection.</p></div><button type="button" className="preview__run" disabled={running} onClick={() => void runSceneChecks()}>{running ? 'Checking…' : 'Run scene checks'}</button></div>
      {sceneChecks.length > 0 && <p className="preview__result" data-scene-result={sceneChecks.some(check => !check.passed) ? 'fail' : running ? 'running' : 'pass'}>{sceneChecks.filter(check => check.passed).length}/{sceneChecks.length} scene checks passed{running ? ' · running' : ''}</p>}
      <ol className="preview__check-list">{sceneChecks.map((check, index) => <li key={index} data-passed={check.passed}><span>{check.passed ? 'PASS' : 'FAIL'}</span> {check.label}</li>)}</ol>
      <p className="preview__small">Synthetic checks do not establish physical-device, screen-reader or installed-PWA verification. Actual app accounting, selection and recovery flows are tested separately.</p>
      <p className="preview__small">Browser: {navigator.userAgent}</p>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
