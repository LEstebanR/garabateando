// Sonido del cuaderno.
//
// Todo se sintetiza en el navegador: ni un fichero de audio, ni una descarga,
// ni una licencia que arrastrar. Y encaja con lo que se ve, porque el papel es
// justamente lo que mejor se imita con ruido filtrado: un roce de hoja no es
// mas que ruido blanco pasado por un filtro y cortado en seco.

const MUTE_KEY = 'salta-paginas:mute'

export function createAudio() {
  let ctx = null
  let master = null
  let noise = null
  let paper = null
  let pencil = null
  let muted = false

  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {}

  function build() {
    if (ctx) return ctx
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.85
    master.connect(ctx.destination)

    // Dos segundos de ruido blanco, reutilizados por todo lo demas.
    const frames = ctx.sampleRate * 2
    noise = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  // Un golpe de ruido filtrado: la base de casi todos los sonidos de papel.
  function burst({ from, to = from, q = 1, dur = 0.15, gain = 0.2, type = 'bandpass', attack = 0.004 }) {
    if (!ctx || muted) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.playbackRate.value = 0.8 + Math.random() * 0.4

    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, now)
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, now + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(gain, now + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    src.connect(filter).connect(env).connect(master)
    src.start(now)
    src.stop(now + dur + 0.02)
  }

  // Un bucle con la ganancia temblando: el roce sostenido del papel o el
  // vaiven del lapiz. Sin ese temblor suena a estatica de radio.
  function loop({ freq, q, gain, wobble }) {
    if (!ctx) return null
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = q

    const level = ctx.createGain()
    level.gain.value = 0

    const lfo = ctx.createOscillator()
    lfo.frequency.value = wobble
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = gain * 0.65
    lfo.connect(lfoGain).connect(level.gain)

    src.connect(filter).connect(level).connect(master)
    src.start()
    lfo.start()
    return { level, lfo, src, gain }
  }

  function fade(node, to, time = 0.12) {
    if (!node || !ctx) return
    const now = ctx.currentTime
    node.level.gain.cancelScheduledValues(now)
    node.level.gain.setValueAtTime(node.level.gain.value, now)
    node.level.gain.linearRampToValueAtTime(to, now + time)
  }

  return {
    // Los navegadores no dejan sonar nada hasta que alguien toca algo.
    unlock() {
      const c = build()
      if (c?.state === 'suspended') c.resume()
    },

    get muted() {
      return muted
    },

    toggleMute() {
      muted = !muted
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime)
        master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 0.08)
      }
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
      } catch {}
      return muted
    },

    // Impulso hacia arriba: el roce sube de tono al despegar.
    jump() {
      burst({ from: 850, to: 2600, q: 1.1, dur: 0.17, gain: 0.13 })
    },

    // Caer sobre el papel: el roce se apaga y queda el golpe sordo.
    land() {
      burst({ from: 620, q: 0.8, dur: 0.09, gain: 0.14, type: 'lowpass' })
      if (!ctx || muted) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      osc.frequency.setValueAtTime(150, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.09)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.09, now)
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      osc.connect(env).connect(master)
      osc.start(now)
      osc.stop(now + 0.12)
    },

    // La hoja arrugandose: varios crujidos seguidos, nunca uno limpio.
    crash() {
      burst({ from: 1500, to: 500, q: 0.6, dur: 0.5, gain: 0.26 })
      for (let i = 0; i < 5; i++) {
        window.setTimeout(
          () => burst({ from: 900 + Math.random() * 2200, q: 3, dur: 0.05, gain: 0.12 }),
          40 + i * 55 + Math.random() * 40,
        )
      }
    },

    // Una hoja pasando entera, al cambiar de mundo.
    page() {
      burst({ from: 3200, to: 900, q: 0.8, dur: 0.3, gain: 0.22 })
    },

    // El lapiz rayando mientras dibuja el mundo.
    setPencil(on) {
      if (!ctx) return
      if (on && !pencil) pencil = loop({ freq: 1900, q: 2.4, gain: 0.075, wobble: 13 })
      if (pencil) fade(pencil, on ? pencil.gain : 0, on ? 0.08 : 0.2)
    },

    // El roce de fondo mientras se corre: sube con la velocidad.
    setRunning(on, speed = 12) {
      if (!ctx) return
      if (on && !paper) paper = loop({ freq: 3100, q: 0.9, gain: 0.03, wobble: 7 })
      if (paper) fade(paper, on ? 0.012 + speed * 0.0016 : 0, 0.18)
    },

    stopLoops() {
      fade(pencil, 0, 0.1)
      fade(paper, 0, 0.1)
    },
  }
}
