import { describe, expect, it } from 'vitest'
import { createChime } from './sound'

/** An audio context whose playback is blocked: resume() rejects and nodes throw. */
class BlockedAudioContext {
  currentTime = 0
  resumeCalls = 0
  resume(): Promise<void> {
    this.resumeCalls += 1
    return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
  }
  createOscillator(): never {
    throw new DOMException('blocked', 'InvalidStateError')
  }
}

describe('createChime', () => {
  it('contains blocked playback without throwing or leaving rejected promises', async () => {
    let instance: BlockedAudioContext | null = null
    const chime = createChime(() =>
      class extends BlockedAudioContext {
        constructor() {
          super()
          instance = this
        }
      } as unknown as new () => AudioContext,
    )
    expect(() => chime.unlock()).not.toThrow()
    expect(() => chime.play()).not.toThrow()
    // Let the rejected resume() promises settle; Vitest fails the run on unhandled rejections.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect((instance as BlockedAudioContext | null)?.resumeCalls).toBe(2)
  })

  it('does nothing when the browser has no Web Audio', () => {
    const chime = createChime(() => undefined)
    expect(() => {
      chime.unlock()
      chime.play()
    }).not.toThrow()
  })

  it('reports blocked and unsupported previews without promising playback', async () => {
    expect(await createChime(() => undefined).preview()).toBe('unavailable')
    expect(await createChime(() => BlockedAudioContext as unknown as new () => AudioContext).preview()).toBe('blocked')
    expect(await createChime(() => class { state = 'suspended'; resume = () => Promise.resolve() } as unknown as new () => AudioContext).preview()).toBe('blocked')
  })

  it('schedules one deliberate preview only after the audio context is running', async () => {
    const starts: number[] = []
    class AvailableAudioContext {
      state = 'suspended'
      currentTime = 10
      destination = {}
      async resume() { this.state = 'running' }
      createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => ({ connect: () => {} }), start: (t: number) => starts.push(t), stop: () => {} } }
      createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } } }
    }
    expect(await createChime(() => AvailableAudioContext as unknown as new () => AudioContext).preview()).toBe('played')
    expect(starts).toHaveLength(3)
    expect(starts[0]).toBeCloseTo(10.05)
  })
})
