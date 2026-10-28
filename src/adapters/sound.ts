export interface Chime {
  /** Call from a user gesture so later chimes are allowed to play. */
  unlock(): void
  play(): void
}

type AudioContextConstructor = new () => AudioContext

function browserAudioContext(): AudioContextConstructor | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  )
}

/** Audio is optional: every failure, synchronous or asynchronous, is swallowed. */
function ignore(): void {}

export function createChime(getConstructor: () => AudioContextConstructor | undefined = browserAudioContext): Chime {
  let context: AudioContext | null = null

  const ensure = (): AudioContext | null => {
    if (context) return context
    const Ctor = getConstructor()
    if (!Ctor) return null
    context = new Ctor()
    return context
  }

  // resume() rejects when playback is blocked; a sync try/catch cannot see that.
  const resume = (ctx: AudioContext) => Promise.resolve().then(() => ctx.resume()).catch(ignore)

  return {
    unlock() {
      try {
        const ctx = ensure()
        if (ctx) void resume(ctx)
      } catch {
        ignore()
      }
    },
    play() {
      // Creating audio before any user interaction only produces autoplay warnings.
      if (!context && globalThis.navigator?.userActivation && !navigator.userActivation.hasBeenActive) return
      try {
        const ctx = ensure()
        if (!ctx) return
        void resume(ctx)
        const start = ctx.currentTime + 0.05
        ;[659.25, 783.99, 1046.5].forEach((frequency, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const t = start + i * 0.18
          osc.type = 'sine'
          osc.frequency.value = frequency
          gain.gain.setValueAtTime(0.0001, t)
          gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
          osc.connect(gain).connect(ctx.destination)
          osc.start(t)
          osc.stop(t + 0.65)
        })
      } catch {
        // The completion is already recorded and shown; sound is a bonus.
        ignore()
      }
    },
  }
}
