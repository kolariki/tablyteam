/** Tiny synthesized sound effects (no assets) — handy for videos. */
let ctx: AudioContext | null = null
export let sfxEnabled = false
export const setSfx = (on: boolean) => {
  sfxEnabled = on
  if (on && !ctx) ctx = new AudioContext()
}

function tone(freqs: number[], dur = 0.12, type: OscillatorType = 'sine', gain = 0.06) {
  if (!sfxEnabled || !ctx) return
  const t0 = ctx.currentTime
  freqs.forEach((f, i) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t0 + i * dur * 0.6)
    g.gain.setValueAtTime(0, t0 + i * dur * 0.6)
    g.gain.linearRampToValueAtTime(gain, t0 + i * dur * 0.6 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur * 0.6 + dur)
    o.connect(g).connect(ctx!.destination)
    o.start(t0 + i * dur * 0.6)
    o.stop(t0 + i * dur * 0.6 + dur + 0.02)
  })
}

export const sfx = {
  handoff: () => tone([520, 780], 0.14, 'triangle'),
  turn: () => tone([330], 0.08, 'sine', 0.04),
  vote: () => tone([660], 0.1, 'square', 0.025),
  verdict: () => tone([523, 659, 784, 1046], 0.22, 'triangle', 0.07),
}
