/**
 * Sound effects, synthesised rather than loaded.
 *
 * No audio files: nothing extra for the Worker to serve, nothing to fail on a
 * flaky connection mid-game, and the whole set is a couple of kilobytes of code.
 * Everything here is short, soft-attacked and quiet by design — this plays over a
 * video call, where a harsh transient is unpleasant for everyone.
 */
export type Cue =
  | 'select'     // a tile opens
  | 'buzzOpen'   // buzzers go live
  | 'buzz'       // someone buzzes in
  | 'tick'       // legacy single tick
  | 'timeUp'     // the clock runs out
  | 'correct'    // right answer
  | 'wrong'      // wrong answer
  | 'shuffle'    // teams being drawn
  | 'start'      // game begins

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.3
    master.connect(ctx.destination)
  }
  return ctx
}

/** Browsers suspend audio until a gesture, so this is called from a click. */
export function unlockAudio(): boolean {
  const c = audio()
  if (!c) return false
  if (c.state === 'suspended') void c.resume()
  return c.state !== 'suspended'
}

export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running'
}

type ToneOpts = {
  freq: number
  dur: number
  type?: OscillatorType
  gain?: number
  /** Seconds from now. */
  at?: number
  /** Glide to this frequency across the note. */
  to?: number
}

function tone({ freq, dur, type = 'sine', gain = 0.5, at = 0, to }: ToneOpts) {
  const c = audio()
  if (!c || !master) return
  const t = c.currentTime + at

  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)

  // Soft attack and a real decay: a raw gate click is the harshest thing a synth
  // can do, and this is going out over a call.
  const env = c.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3))
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)

  osc.connect(env).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/**
 * The tick-tock bed that runs while the buzzers are open.
 *
 * Deliberately generic — a two-note clock alternation that accelerates as the
 * window closes — rather than the Jeopardy think-music, which is a copyrighted
 * melody. The tension comes from the tempo, not from a tune.
 *
 * `progress` is 0 at the start of the window and 1 at the end.
 */
export function playTock(beat: number, progress: number) {
  const urgent = progress > 0.8
  // Alternating pitch is what reads as a clock rather than a metronome.
  const base = beat % 2 === 0 ? 320 : 244
  const lift = 1 + progress * 0.35
  tone({
    freq: base * lift,
    dur: urgent ? 0.075 : 0.055,
    type: 'square',
    gain: (urgent ? 0.2 : 0.11) + progress * 0.08,
  })
  // A woodblock-ish knock under it, so the bed has some body on a laptop speaker.
  tone({ freq: base * 0.5 * lift, dur: 0.09, type: 'triangle', gain: 0.07 + progress * 0.05 })
}

/**
 * Gap to the next tock, in ms. Starts loose and closes right up, which is what
 * makes a countdown feel like it is getting away from you.
 */
export function tockGap(progress: number): number {
  return 720 - progress * 520
}

/** Position in the buzz queue, so first place is unmistakably brighter. */
export function playBuzz(position: number) {
  const step = Math.min(position, 5)
  tone({ freq: 880 - step * 90, dur: 0.16, type: 'triangle', gain: 0.5 })
  if (position === 0) tone({ freq: 1320, dur: 0.12, type: 'sine', gain: 0.3, at: 0.05 })
}

export function play(cue: Cue) {
  switch (cue) {
    case 'select':
      tone({ freq: 420, dur: 0.1, type: 'sine', gain: 0.4, to: 700 })
      break

    case 'buzzOpen':
      // Two notes up: unambiguously "go".
      tone({ freq: 523, dur: 0.13, type: 'triangle', gain: 0.5 })
      tone({ freq: 784, dur: 0.22, type: 'triangle', gain: 0.5, at: 0.11 })
      break

    case 'tick':
      tone({ freq: 1100, dur: 0.035, type: 'square', gain: 0.16 })
      break

    case 'timeUp':
      tone({ freq: 220, dur: 0.45, type: 'sawtooth', gain: 0.32, to: 110 })
      break

    case 'correct':
      // Rising major arpeggio; the last note rings longest.
      ;[523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, dur: i === 3 ? 0.5 : 0.13, type: 'triangle', gain: 0.45, at: i * 0.085 }),
      )
      break

    case 'wrong':
      // Two notes down, detuned a little. Deflating rather than punishing.
      tone({ freq: 233, dur: 0.18, type: 'square', gain: 0.24 })
      tone({ freq: 175, dur: 0.32, type: 'square', gain: 0.24, at: 0.14 })
      break

    case 'shuffle':
      for (let i = 0; i < 5; i++) {
        tone({ freq: 900 + i * 120, dur: 0.05, type: 'square', gain: 0.13, at: i * 0.055 })
      }
      break

    case 'start':
      ;[392, 523, 659, 784].forEach((f, i) =>
        tone({ freq: f, dur: i === 3 ? 0.6 : 0.15, type: 'triangle', gain: 0.42, at: i * 0.1 }),
      )
      break
  }
}
