import { feedbackCatalog } from '../data/encouragement'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from '../logic/app'
import type { FeedbackEvent, FeedbackResult, Persistence } from '../logic/feedback'
import { createFeedbackHost, feedbackFromTransition, interactWithFeedback, updateFeedbackHost, type FeedbackHostInput, type FeedbackHostState } from '../logic/feedback-host'
import { companionSceneOf, companionViewOf, type CompanionScene, type CompanionView, type PresentationCue } from '../logic/presentation'
import { createSnapshot } from '../logic/snapshot'
import { remainingMs } from '../logic/timer'
import type { AppSnapshot } from '../logic/types'

/**
 * Deterministic outcomes produced by the real main logic, for developing and
 * testing a renderer without a live timer or storage. Regenerated on import, so
 * they always match current behavior.
 */
export interface PresentationFixture {
  name: FixtureName
  view: CompanionView
  feedback: Pick<FeedbackResult, 'frame' | 'announcement'>
  cue: PresentationCue | null
  scene: CompanionScene | null
}

export const FIXTURE_NAMES = [
  'ready', 'focus-started', 'paused', 'resumed', 'ended-elapsed', 'ended-early', 'ended-zero',
  'thought-marker', 'thought-text', 'break-started', 'break-ended', 'requested',
  'save-pending', 'save-retried', 'restored', 'synchronized', 'stale-result', 'hidden-screen', 'motion-disabled',
] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 29, 9, 0, 0)
const dateKeyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

interface StepOptions { at: number; origin?: FeedbackEvent['origin']; saved?: boolean; id?: string; active?: boolean }

/** Drives the real reducer and feedback host the way the app's hooks do. */
function scenario(preferences = { motionEnabled: true, encouragementEnabled: true }) {
  let snapshot: AppSnapshot = { ...createSnapshot(spec), settings: { ...createSnapshot(spec).settings, ...preferences } }
  let persistence: Persistence = 'saved'
  let n = 0
  let now = T0
  let visible = true
  const input = (event: FeedbackHostInput['event'], active = true): FeedbackHostInput =>
    ({ snapshot, persistence, event, active, nodeEncouragement: snapshot.settings.encouragementEnabled })
  let host: FeedbackHostState = createFeedbackHost(input(null), feedbackCatalog)
  host = updateFeedbackHost(host, input(null), feedbackCatalog)

  const fixture = (name: FixtureName): PresentationFixture => ({
    name,
    view: companionViewOf(host.feedback.frame, { motionEnabled: snapshot.settings.motionEnabled, encouragementEnabled: snapshot.settings.encouragementEnabled }),
    feedback: { frame: host.feedback.frame, announcement: host.feedback.announcement },
    cue: host.cue,
    scene: companionSceneOf(snapshot, host.cue, {
      completedProgress: snapshot.timer.session ? 1 - remainingMs(snapshot.timer, snapshot.settings, now) / snapshot.timer.session.durationMs : 0,
      visible, persistence, hasError: host.feedback.frame.status.kind === 'error',
    }),
  })
  const act = (action: AppAction, { at, origin = 'user', saved = true, id = `op-${++n}`, active = true }: StepOptions) => {
    now = at
    visible = active
    const before = snapshot
    const t = applyAction(before, action, { now: at, dateKeyOf }, spec)
    snapshot = t.changed ? { ...t.snapshot, revision: before.revision + 1, writer: 'fixture' } : t.snapshot
    persistence = saved ? 'saved' : 'pending'
    const event = feedbackFromTransition(before, { ...t, snapshot }, action, { id, atMs: at, origin }, saved)
    host = updateFeedbackHost(host, input(event, active), feedbackCatalog)
    return api
  }
  /** Delivers an event whose revision no longer matches the shown snapshot. */
  const stale = (at: number) => {
    const event = { kind: 'focus-started' as const, id: 'stale-op', atMs: at, origin: 'user' as const, generation: snapshot.datasetGeneration, revision: snapshot.revision - 1 }
    host = updateFeedbackHost(host, input(event), feedbackCatalog)
    return api
  }
  const request = (at: number) => {
    host = interactWithFeedback(host, input(null), { kind: 'encouragement-requested', id: `ask-${++n}`, atMs: at, origin: 'user' }, feedbackCatalog)
    return api
  }
  const api = { act, stale, request, fixture }
  return api
}

const start = (id = 'f1'): AppAction => ({ type: 'start', sessionId: id, timeZone: 'UTC' })

export function presentationFixtures(): PresentationFixture[] {
  const deadline = T0 + spec.timer.durationsMinutes.focus.default * MIN
  return [
    scenario().fixture('ready'),
    scenario().act(start(), { at: T0 }).fixture('focus-started'),
    scenario().act(start(), { at: T0 }).act({ type: 'pause' }, { at: T0 + MIN }).fixture('paused'),
    scenario().act(start(), { at: T0 }).act({ type: 'pause' }, { at: T0 + MIN }).act({ type: 'resume' }, { at: T0 + 2 * MIN }).fixture('resumed'),
    scenario().act(start(), { at: T0 }).act({ type: 'reconcile' }, { at: deadline, origin: 'expiry' }).fixture('ended-elapsed'),
    scenario().act(start(), { at: T0 }).act({ type: 'end' }, { at: T0 + 3 * MIN + 20_000 }).fixture('ended-early'),
    scenario().act(start(), { at: T0 }).act({ type: 'end' }, { at: T0 }).fixture('ended-zero'),
    scenario().act(start(), { at: T0 }).act({ type: 'markThought', thoughtId: 'n1', timeZone: 'UTC' }, { at: T0 + MIN }).fixture('thought-marker'),
    scenario().act(start(), { at: T0 }).act({ type: 'saveThoughtText', thoughtId: 'n1', text: 'Pick up the parcel tonight', timeZone: 'UTC' }, { at: T0 + MIN }).fixture('thought-text'),
    scenario().act({ type: 'startBreak', sessionId: 'b1', timeZone: 'UTC' }, { at: T0 }).fixture('break-started'),
    scenario().act({ type: 'startBreak', sessionId: 'b1', timeZone: 'UTC' }, { at: T0 }).act({ type: 'skipBreak' }, { at: T0 + MIN }).fixture('break-ended'),
    scenario().request(T0).fixture('requested'),
    scenario().act(start(), { at: T0, saved: false, id: 'op-x' }).fixture('save-pending'),
    scenario().act(start(), { at: T0, saved: false, id: 'op-x' }).act({ type: 'reconcile' }, { at: T0 + 5000, id: 'op-x' }).fixture('save-retried'),
    scenario().act(start(), { at: T0, origin: 'restore' }).fixture('restored'),
    scenario().act(start(), { at: T0, origin: 'sync' }).fixture('synchronized'),
    scenario().act(start(), { at: T0 }).act({ type: 'pause' }, { at: T0 + MIN }).stale(T0 + 2 * MIN).fixture('stale-result'),
    scenario().act(start(), { at: T0, active: false }).fixture('hidden-screen'),
    scenario({ motionEnabled: false, encouragementEnabled: true }).act(start(), { at: T0 }).fixture('motion-disabled'),
  ]
}
