// Sonido del cuaderno: una canción de fondo y los roces del papel.
//
// Todo se sintetiza en el navegador. Ni un fichero de audio, ni una descarga,
// ni una licencia que arrastrar, y el juego sigue pesando lo mismo.
//
// La música es generativa sobre una progresión fija. Está en pentatónica
// mayor, donde no hay dos notas que choquen, así que puede variar sola sin
// desafinar nunca; y va a 72 pulsos por minuto, por debajo del pulso en
// reposo, que es lo que hace que se perciba tranquila.

// Dos interruptores independientes: hay quien quiere los roces del papel sin
// música, y quien quiere justo lo contrario.
const SFX_KEY = 'salta-paginas:mute'
const MUSIC_KEY = 'salta-paginas:music'

const BPM = 72
const STEP = 60 / BPM / 2 // corchea
const STEPS = 32 // cuatro compases

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)

// I - vi - IV - V, un compás cada uno.
const CHORDS = [
  { bass: 48, notes: [60, 64, 67] },
  { bass: 45, notes: [57, 60, 64] },
  { bass: 41, notes: [53, 57, 60] },
  { bass: 43, notes: [55, 59, 62] },
]

// Dos frases que se turnan, con mucho silencio entre notas: el aire es lo que
// separa una canción relajante de una cancioncilla machacona.
const PHRASES = [
  [76, null, 79, null, 81, null, null, null,
   79, null, 76, null, 74, null, null, null,
   72, null, 76, null, 79, null, null, null,
   74, null, 71, null, 72, null, null, null],
  [84, null, null, 81, null, 79, null, null,
   76, null, 79, null, null, null, null, null,
   72, null, 74, null, 76, null, null, null,
   79, null, 74, null, null, null, null, null],
]

export function createAudio() {
  let ctx = null
  let master = null
  let musicBus = null
  let musicMute = null
  let sfxBus = null
  let noise = null
  let pencil = null
  let timer = 0
  let nextTime = 0
  let step = 0
  let round = 0
  let sfxOff = false
  let musicOff = false
  const last = {}

  try {
    sfxOff = window.localStorage.getItem(SFX_KEY) === '1'
    musicOff = window.localStorage.getItem(MUSIC_KEY) === '1'
  } catch {}

  const save = (key, value) => {
    try {
      window.localStorage.setItem(key, value ? '1' : '0')
    } catch {}
  }

  // Reverberación sintética: ruido que se apaga solo. Es lo que separa unos
  // pitidos secos de algo que suena en una habitación.
  function makeReverb() {
    const len = Math.floor(ctx.sampleRate * 2.2)
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
      }
    }
    const convolver = ctx.createConvolver()
    convolver.buffer = buffer
    return convolver
  }

  function build() {
    if (ctx) return ctx
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()

    master = ctx.createGain()
    master.gain.value = 0.85
    master.connect(ctx.destination)

    const reverb = makeReverb()
    const wet = ctx.createGain()
    wet.gain.value = 0.32
    reverb.connect(wet).connect(master)

    musicMute = ctx.createGain()
    musicMute.gain.value = musicOff ? 0 : 1
    musicMute.connect(master)
    musicMute.connect(reverb)

    // Separado del silencio, para que apartar la música al morir y apagarla
    // del todo no se peleen por el mismo mando.
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.5
    musicBus.connect(musicMute)

    sfxBus = ctx.createGain()
    sfxBus.gain.value = sfxOff ? 0 : 1
    sfxBus.connect(master)
    const sfxSend = ctx.createGain()
    sfxSend.gain.value = 0.25
    sfxBus.connect(sfxSend).connect(reverb)

    const frames = ctx.sampleRate * 2
    noise = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  // Una nota: onda suave, ataque redondo y cola larga. Nada de percusión.
  function tone(midi, at, dur, gain, type = 'triangle', cutoff = 2600) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = hz(midi)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain, at + 0.05)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    osc.connect(filter).connect(env).connect(musicBus)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  function schedule() {
    if (!ctx) return
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8)
      const chord = CHORDS[bar]

      if (step % 8 === 0) {
        tone(chord.bass, nextTime, 2.6, 0.16, 'sine', 900)
        // El acorde entra en tres voces muy suaves, casi un fondo.
        chord.notes.forEach((n, i) => tone(n, nextTime + i * 0.05, 3.1, 0.045, 'triangle', 1500))
      }

      const phrase = PHRASES[round % 4 === 2 ? 1 : 0]
      let note = phrase[step]
      // Una vuelta de cada cuatro sube una octava: cambia sin salirse.
      if (note && round % 4 === 3) note += 12
      if (note) tone(note, nextTime, 1.9, 0.1, 'triangle', 3200)

      nextTime += STEP
      step += 1
      if (step >= STEPS) {
        step = 0
        round += 1
      }
    }
  }

  function startMusic() {
    if (!ctx || timer) return
    nextTime = ctx.currentTime + 0.1
    step = 0
    timer = window.setInterval(schedule, 40)
  }

  // Un golpe de ruido filtrado: la base de todos los sonidos de papel.
  function burst({ from, to = from, q = 1, dur = 0.15, gain = 0.2, type = 'bandpass', key }) {
    if (!ctx || sfxOff) return
    const now = ctx.currentTime
    // Un mismo roce no se repite dos veces seguidas en la misma hoja.
    if (key) {
      if (now - (last[key] || -1) < 0.07) return
      last[key] = now
    }
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.playbackRate.value = 0.85 + Math.random() * 0.3

    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.Q.value = q
    filter.frequency.setValueAtTime(from, now)
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, now + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, now)
    env.gain.exponentialRampToValueAtTime(gain, now + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    src.connect(filter).connect(env).connect(sfxBus)
    src.start(now)
    src.stop(now + dur + 0.02)
  }

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
    lfoGain.gain.value = gain * 0.6
    lfo.connect(lfoGain).connect(level.gain)
    src.connect(filter).connect(level).connect(sfxBus)
    src.start()
    lfo.start()
    return { level, gain }
  }

  function fade(node, to, time = 0.12) {
    if (!node || !ctx) return
    const now = ctx.currentTime
    node.level.gain.cancelScheduledValues(now)
    node.level.gain.setValueAtTime(node.level.gain.value, now)
    node.level.gain.linearRampToValueAtTime(to, now + time)
  }

  return {
    unlock() {
      const c = build()
      if (!c) return
      if (c.state === 'suspended') c.resume()
      if (!musicOff) startMusic()
    },

    get sfxOff() {
      return sfxOff
    },

    get musicOff() {
      return musicOff
    },

    toggleSfx() {
      sfxOff = !sfxOff
      if (ctx && sfxBus) {
        sfxBus.gain.cancelScheduledValues(ctx.currentTime)
        sfxBus.gain.linearRampToValueAtTime(sfxOff ? 0 : 1, ctx.currentTime + 0.12)
      }
      save(SFX_KEY, sfxOff)
      return sfxOff
    },

    toggleMusic() {
      musicOff = !musicOff
      if (ctx && musicMute) {
        musicMute.gain.cancelScheduledValues(ctx.currentTime)
        musicMute.gain.linearRampToValueAtTime(musicOff ? 0 : 1, ctx.currentTime + 0.25)
      }
      // Con la música apagada no se programan notas: no tiene sentido gastar
      // en algo que nadie va a oír.
      if (musicOff) {
        window.clearInterval(timer)
        timer = 0
      } else {
        startMusic()
      }
      save(MUSIC_KEY, musicOff)
      return musicOff
    },

    // Despegue: el roce sube de tono al separarse del papel.
    jump() {
      burst({ from: 700, to: 2400, q: 1.4, dur: 0.16, gain: 0.1, key: 'jump' })
    },

    // Agacharse: el mismo roce, pero cayendo. Al revés que el salto, para que
    // los dos controles suenen como lo que hacen.
    crouch() {
      burst({ from: 2100, to: 620, q: 1.6, dur: 0.15, gain: 0.075, key: 'crouch' })
    },

    land() {
      burst({ from: 560, q: 0.8, dur: 0.09, gain: 0.1, type: 'lowpass', key: 'land' })
      if (!ctx || sfxOff) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.09)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.07, now)
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      osc.connect(env).connect(sfxBus)
      osc.start(now)
      osc.stop(now + 0.12)
    },

    crash() {
      burst({ from: 1400, to: 480, q: 0.6, dur: 0.5, gain: 0.2 })
      for (let i = 0; i < 5; i++) {
        window.setTimeout(
          () => burst({ from: 900 + Math.random() * 2000, q: 3, dur: 0.05, gain: 0.09 }),
          40 + i * 55 + Math.random() * 40,
        )
      }
    },

    setPencil(on) {
      if (!ctx) return
      if (on && !pencil) pencil = loop({ freq: 1900, q: 2.4, gain: 0.05, wobble: 13 })
      if (pencil) fade(pencil, on ? pencil.gain : 0, on ? 0.08 : 0.2)
    },

    // Con el cuaderno cerrado la música se retira a un segundo plano en vez
    // de cortarse en seco.
    duck(on) {
      if (!ctx || !musicBus) return
      const now = ctx.currentTime
      musicBus.gain.cancelScheduledValues(now)
      musicBus.gain.setValueAtTime(musicBus.gain.value, now)
      musicBus.gain.linearRampToValueAtTime(on ? 0.2 : 0.5, now + 0.5)
    },

    stopLoops() {
      fade(pencil, 0, 0.1)
    },

    dispose() {
      window.clearInterval(timer)
      timer = 0
      ctx?.close?.()
    },
  }
}
