import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { BlueCompanion } from '../../src/components/companion/BlueCompanion'
import { blueCompanionSpec } from '../../src/data/blue-companion'
import { useMotionPreference } from '../../src/hooks/companion/useMotionPreference'
import { BLUE_STANCES } from '../../src/logic/blue-companion'
import type { CompanionPresentation, CompanionStance } from '../../src/logic/companion'
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
  const scene = useRef<HTMLDivElement>(null)
  const serial = useRef(0)
  const intents = useRef(0)
  const { reducedMotion, systemReducedMotion } = useMotionPreference(motionEnabled)
  const presentation: CompanionPresentation = { stance, cue, staticOnly: reducedMotion }

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
    const results: Check[] = []
    const check = (label: string, passed: boolean) => { results.push({ label, passed }); setChecks([...results]) }
    const touch = () => svg().dataset.touch
    const phase = () => svg().dataset.touchPhase
    const initialIntents = intents.current
    try {
      flushSync(() => { setStance('ready'); setCue(null); setMotionEnabled(true); setFrame('Running pointer-only checks') })
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
      pointer('pointerdown', 'squish')
      await wait()
      window.dispatchEvent(new Event('blur'))
      await wait()
      check('Window blur clears local play', touch() === '')
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

  return <main className="preview">
    <header className="preview__header"><span className="preview__eyebrow">Animation workbench · isolated fixtures</span><h1>A little hello, in blue.</h1><p>The production character with a tiny fixture host. Pat its head, squish its belly or touch a hand. No timer, records, rewards or storage are simulated here.</p></header>
    <div className="preview__workspace">
      <section className="preview__canvas" aria-label="Character fixture">
        <div ref={scene} className="preview__phone" style={{ width, fontSize: largeText ? '200%' : '100%' }} data-text-scale={largeText ? '200' : '100'}>
          <p className="preview__eyebrow">Fixture · {stance}</p>
          <div className="companion-feedback"><button type="button" className="companion-feedback__greeting" aria-label="Say hello to the blue companion" onClick={request}><span className="companion-feedback__character" aria-hidden="true"><BlueCompanion presentation={presentation} cueId={cueId} /></span><span className="preview__invite">Say hello <span aria-hidden="true">↗</span></span></button></div>
          <p className="preview__hint">A head pat, a belly squish, a tiny high-five.</p>
          <p className="preview__facts">Explicit host intents: <strong>{intentCount}</strong></p>
          <p className="preview__facts">{reducedMotion ? 'Static expression' : 'Motion enabled'}{systemReducedMotion ? ' · OS reduced motion' : ''}</p>
          <p className="preview__frame">{frame}</p>
        </div>
      </section>
      <aside className="preview__controls" aria-label="Fixture controls">
        <fieldset disabled={running}><legend>Presentation</legend>
          <label>Semantic stance<select value={stance} onChange={event => { setStance(event.target.value as CompanionStance); setCue(null) }}>{BLUE_STANCES.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Scene width<select value={width} onChange={event => setWidth(Number(event.target.value))}>{[320, 375, 430].map(value => <option key={value} value={value}>{value} CSS pixels</option>)}</select></label>
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
    <section className="preview__poses" aria-label="Seven static poses">
      <h2>Seven expressions, with no motion</h2>
      <p className="preview__small">The same production drawing and semantic poses, held still for comparison.</p>
      <div className="preview__pose-grid">{BLUE_STANCES.map(value => <figure key={value} className="preview__pose"><div aria-hidden="true"><BlueCompanion presentation={{ stance: value, cue: null, staticOnly: true }} /></div><figcaption>{value}</figcaption></figure>)}</div>
    </section>
    <section className="preview__checks" aria-label="Browser lifecycle checks">
      <div className="preview__checks-heading"><div><h2>Browser lifecycle checks</h2><p>Real React handlers, fixed SVG contact surface and production styles. Keep this tab visible while checks run.</p></div><button type="button" className="preview__run" disabled={running} onClick={() => void runChecks()}>{running ? 'Checking…' : 'Run interaction checks'}</button></div>
      {checks.length > 0 && <p className="preview__result" data-result={checks.some(check => !check.passed) ? 'fail' : running ? 'running' : 'pass'}>{checks.filter(check => check.passed).length}/{checks.length} checks passed{running ? ' · running' : ''}</p>}
      <ol className="preview__check-list">{checks.map((check, index) => <li key={index} data-passed={check.passed}><span>{check.passed ? 'PASS' : 'FAIL'}</span> {check.label}</li>)}</ol>
      <p className="preview__small">Synthetic checks do not establish physical-device, screen-reader or installed-PWA verification. Main-owned screen contact, thought-save and reward scenes remain future integration work.</p>
      <p className="preview__small">Browser: {navigator.userAgent}</p>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>)
