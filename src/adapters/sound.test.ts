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
})
