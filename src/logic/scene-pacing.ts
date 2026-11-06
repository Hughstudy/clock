import { sampleScenePose } from './scene-pose'
import type { SceneId } from './types'

/**
 * Handling moves an activity between two progress landmarks in a few seconds.
 * Some activities concentrate the hands' travel in a small part of that span (a
 * cover passing the spine, a block lifted off the stack), so an evenly eased
 * cursor would whip them. Pacing re-times the cursor by the hands' own path:
 * equal time for equal travel, plus a baseline so props that move while the
 * hands rest still take visible time. Poses and contacts are unchanged; only
 * when each pose is shown changes. Pure and deterministic; tables are cached.
 */
export type ScenePace = (from: number, to: number, eased: number) => number

const SAMPLES = 160
/** Share of the mean hand speed always granted, so hand-still stretches are not skipped. */
const BASELINE = 0.25
const cache = new Map<string, Float64Array | null>()

function table(id: SceneId, from: number, to: number): Float64Array | null {
  const key = `${id}:${from}:${to}`
  if (cache.has(key)) return cache.get(key)!
  // Interrupted handling can start between landmarks; keep the table set small.
  if (cache.size > 64) cache.clear()
  const travel: number[] = []
  let previous: number[] | null = null
  for (let i = 0; i <= SAMPLES; i++) {
    const frame = sampleScenePose({ id, status: 'running', progress: to, activityProgress: from + (to - from) * i / SAMPLES, actionKind: 'idle', actionProgress: 1 })
    const palms = [frame.left.palm.x, frame.left.palm.y, frame.right.palm.x, frame.right.palm.y]
    if (previous) travel.push(Math.max(Math.hypot(palms[0]! - previous[0]!, palms[1]! - previous[1]!), Math.hypot(palms[2]! - previous[2]!, palms[3]! - previous[3]!)))
    previous = palms
  }
  const total = travel.reduce((sum, step) => sum + step, 0)
  let result: Float64Array | null = null
  if (total > 1e-6) {
    const floor = BASELINE * total / travel.length
    // Cumulative weighted travel at each sample, normalised to [0, 1].
    result = new Float64Array(SAMPLES + 1)
    for (let i = 0; i < travel.length; i++) result[i + 1] = result[i]! + travel[i]! + floor
    const end = result[SAMPLES]!
    for (let i = 0; i <= SAMPLES; i++) result[i] = result[i]! / end
  }
  cache.set(key, result)
  return result
}

/** A pacing function for one scene. Without hand travel in a span it keeps the plain cursor. */
export function scenePace(id: SceneId | undefined): ScenePace {
  return (from, to, eased) => {
    const share = Number.isFinite(eased) ? Math.min(1, Math.max(0, eased)) : 0
    const cumulative = id && to > from ? table(id, from, to) : null
    if (!cumulative) return from + (to - from) * share
    // Invert the cumulative travel: find where `share` of the weighted path is reached.
    let low = 0, high = SAMPLES
    while (high - low > 1) { const mid = (low + high) >> 1; if (cumulative[mid]! < share) low = mid; else high = mid }
    const span = cumulative[high]! - cumulative[low]!
    const within = span > 0 ? (share - cumulative[low]!) / span : 0
    return from + (to - from) * (low + within) / SAMPLES
  }
}
