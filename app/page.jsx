'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, step, TICK_MS, worldProgress } from './engine'
import { createRenderer, setBoil } from './draw'
import { PencilSvg, ThumbSvg } from './hand'
import { CrashIcon, DuckHint, JumpHint, KeyIcon, RotateIcon, MusicIcon, SheetIcon, SoundIcon, StackIcon, StarIcon } from './icons'
import { createAudio } from './sound'

const BEST_KEY = 'salta-paginas:best'
const UNLOCKED_KEY = 'salta-paginas:unlocked'
const START_KEY = 'salta-paginas:start'

// Temblor del trazo al redibujarse en cada hoja.
//
// Aqui vivia tambien una capa de hojas cayendo sobre el juego. Se ha quitado:
// por suave que fuera, era un parpadeo constante encima de la partida, y el
// folioscopio no depende de el. Lo sostienen las catorce hojas por segundo del
// render, el trazo rehecho a mano en cada una y el trasluz de la anterior.
const BOIL = 0.3

// Hojas que siguen cayendo tras la caida final. Las justas para ver el golpe;
// despues el cuaderno se queda quieto.
const DEATH_TICKS = 6

// Cuaderno en reposo: el corredor trota en el sitio, sin mundo que avance y
// sin la ceremonia de dibujar el nivel, que es cosa de la partida.
function idleGame() {
  const game = createGame(1)
  game.speed = 0
  game.stage = 'run'
  game.nextSpawnX = Infinity
  game.obstacles = []
  return game
}

export default function Home() {
  const [phase, setPhase] = useState('idle')
  const [best, setBest] = useState(0)
  const [unlocked, setUnlocked] = useState(1)
  const [deadSheets, setDeadSheets] = useState(0)
  const [upright, setUpright] = useState(false)
  const [sfxOff, setSfxOff] = useState(false)
  const [musicOff, setMusicOff] = useState(false)
  const [startWorld, setStartWorld] = useState(1)
  const startWorldRef = useRef(1)

  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const thumbRef = useRef(null)
  const pencilRef = useRef(null)
  const hudSheets = useRef(null)
  const hudWorld = useRef(null)
  const hudBar = useRef(null)
  const hudBest = useRef(null)

  const gameRef = useRef(null)
  const phaseRef = useRef('idle')
  const inputRef = useRef({ jump: false, crouch: false })
  const unlockedRef = useRef(1)
  const stageRef2 = useRef('draw')
  const boilRef = useRef(BOIL)
  const uprightRef = useRef(false)
  const fullscreenTried = useRef(false)
  const audioRef = useRef(null)
  const beforeRef = useRef({ jumps: 0, onGround: true, dead: false, crouching: false, stage: 'draw' })

  if (!gameRef.current) gameRef.current = idleGame()

  const setPhaseBoth = useCallback((next) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  // La barra del navegador se come una franja que en horizontal es justo la
  // que falta. Solo puede pedirse desde un gesto del usuario, así que va aquí
  // y se intenta una sola vez: si alguien la cierra a propósito, se respeta.
  const goFullscreen = useCallback(() => {
    if (fullscreenTried.current) return
    fullscreenTried.current = true
    if (!window.matchMedia?.('(pointer: coarse)').matches) return
    const root = document.documentElement
    const request = root.requestFullscreen || root.webkitRequestFullscreen
    try {
      if (request && !document.fullscreenElement) {
        const result = request.call(root)
        if (result?.catch) result.catch(() => {})
      }
      // En Android se puede fijar el horizontal; en iOS no existe y no pasa nada.
      const lock = window.screen?.orientation?.lock
      if (lock) {
        const locked = lock.call(window.screen.orientation, 'landscape')
        if (locked?.catch) locked.catch(() => {})
      }
    } catch {}
  }, [])

  const press = useCallback(() => {
    audioRef.current?.unlock()
    goFullscreen()
    if (phaseRef.current === 'playing') {
      inputRef.current.jump = true
      return
    }
    gameRef.current = createGame(undefined, startWorldRef.current)
    inputRef.current = { jump: false, crouch: false }
    setPhaseBoth('playing')
  }, [setPhaseBoth, goFullscreen])

  const chooseWorld = useCallback((world) => {
    startWorldRef.current = world
    setStartWorld(world)
    try {
      window.localStorage.setItem(START_KEY, String(world))
    } catch {}
  }, [])

  useEffect(() => {
    audioRef.current = createAudio()
    setSfxOff(audioRef.current.sfxOff)
    setMusicOff(audioRef.current.musicOff)
    return () => audioRef.current?.dispose()
  }, [])

  const toggleSfx = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.unlock()
    setSfxOff(audio.toggleSfx())
  }, [])

  const toggleMusic = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.unlock()
    setMusicOff(audio.toggleMusic())
  }, [])

  useEffect(() => {
    try {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) boilRef.current = 0
      setBest(Number(window.localStorage.getItem(BEST_KEY)) || 0)
      const open = Math.max(1, Number(window.localStorage.getItem(UNLOCKED_KEY)) || 1)
      const start = Math.min(open, Math.max(1, Number(window.localStorage.getItem(START_KEY)) || 1))
      setUnlocked(open)
      setStartWorld(start)
      startWorldRef.current = start
    } catch {}
  }, [])

  // El pulgar solo se mueve cuando pasa una hoja de verdad: al cambiar de
  // mundo. El resto del tiempo sujeta el cuaderno, quieto.
  const nudgeThumb = useCallback(() => {
    const thumb = thumbRef.current
    if (!thumb?.animate) return
    thumb.getAnimations?.().forEach((a) => a.cancel())
    thumb.animate(
      [
        { transform: 'rotate(-15deg) translate3d(0,0,0)' },
        { transform: 'rotate(-11deg) translate3d(-3px,7px,0)', offset: 0.4 },
        { transform: 'rotate(-15deg) translate3d(0,0,0)' },
      ],
      { duration: 520, easing: 'ease-in-out' },
    )
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    const renderer = createRenderer(canvas)
    const paint = () => {
      const game = gameRef.current
      setBoil(game.dead ? 0 : boilRef.current)
      renderer.render(game, { started: phaseRef.current !== 'idle' })
      // El lapiz se coloca sobre la punta del trazo. La transicion CSS lo hace
      // avanzar con soltura entre hoja y hoja: la mano es real y no va a
      // saltos, aunque el dibujo que deja si.
      const pencil = pencilRef.current
      if (pencil) {
        const nib = renderer.nib
        pencil.style.width = `${nib.size}px`
        pencil.style.height = `${nib.size}px`
        pencil.style.opacity = nib.on ? '1' : '0'
        if (nib.on) pencil.style.transform = `translate3d(${nib.x}px, ${nib.y}px, 0) rotate(205deg)`
      }
    }
    const fit = () => {
      const box = stage.getBoundingClientRect()
      if (box.width && box.height) renderer.resize(box.width, box.height, Math.min(2, window.devicePixelRatio || 1))
      paint()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)

    let raf = 0
    let last = performance.now()
    let acc = 0

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      acc += now - last
      last = now
      // Como maximo dos hojas por cuadro. Si el navegador se atasca (una
      // recompilacion, el recolector de basura, la pestana en segundo plano) el
      // juego se retrasa un instante en vez de saltar medio mundo de golpe.
      acc = Math.min(acc, TICK_MS * 2)

      // Con el teléfono de pie no corre ni una hoja: al girarlo se sigue
      // exactamente donde se estaba, en vez de haber muerto sin verlo.
      if (uprightRef.current) {
        acc = 0
        audioRef.current?.stopLoops()
        return
      }

      let ticked = false
      while (acc >= TICK_MS) {
        // Con el cuaderno cerrado no se pasa ni una hoja mas: se congela la
        // ultima imagen y para todo el movimiento, que es lo que descansa la vista.
        if (gameRef.current.dead && gameRef.current.deadTick >= DEATH_TICKS) {
          acc = 0
          audioRef.current?.stopLoops()
          break
        }
        acc -= TICK_MS
        const game = gameRef.current
        const input = inputRef.current
        step(game, { jump: input.jump, crouch: input.crouch })
        input.jump = false
        ticked = true
        // El cuaderno en reposo no avanza de mundo por dejarlo abierto.
        if (phaseRef.current === 'idle') game.worldSheets = 0
        else if (game.world > unlockedRef.current) {
          // Cada mundo terminado queda abierto para empezar ahi la proxima vez.
          unlockedRef.current = game.world
          setUnlocked(game.world)
          try {
            window.localStorage.setItem(UNLOCKED_KEY, String(game.world))
          } catch {}
        }

        if (game.stage === 'flip' && stageRef2.current !== 'flip') nudgeThumb()
        stageRef2.current = game.stage

        // Suena lo que ha cambiado respecto a la hoja anterior.
        const audio = audioRef.current
        const before = beforeRef.current
        // La canción acompaña la carrera: en los menús, con el teléfono de pie
        // o con el cuaderno cerrado, se retira.
        audio?.setMusic(phaseRef.current === 'playing' && !game.dead && !uprightRef.current)
        if (audio && phaseRef.current === 'playing') {
          if (game.jumps > before.jumps) audio.jump()
          else if (game.onGround && !before.onGround) audio.land()
          if (game.crouching && !before.crouching) audio.crouch()
          if (game.dead && !before.dead) audio.crash()
          audio.setPencil(game.stage === 'draw')
        }
        before.jumps = game.jumps
        before.onGround = game.onGround
        before.dead = game.dead
        before.crouching = game.crouching
        before.stage = game.stage

        if (game.dead && phaseRef.current === 'playing') {
          setPhaseBoth('dead')
          setDeadSheets(game.sheets)
          // La marca solo cuenta desde el principio: empezar en el mundo 4 no
          // compite con haber llegado hasta el mundo 4.
          if (startWorldRef.current === 1) {
            setBest((current) => {
              const next = Math.max(current, game.sheets)
              try {
                window.localStorage.setItem(BEST_KEY, String(next))
              } catch {}
              return next
            })
          }
        }
      }

      // Solo se repinta cuando hay hoja nueva: 14 dibujos por segundo, como un
      // folioscopio de verdad. Nada de interpolar entre hojas.
      if (ticked) {
        const game = gameRef.current
        paint()
        if (hudSheets.current) hudSheets.current.textContent = String(game.sheets).padStart(4, '0')
        if (hudWorld.current) hudWorld.current.textContent = String(game.world).padStart(2, '0')
        if (hudBar.current) hudBar.current.style.width = `${worldProgress(game) * 100}%`
      }
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [nudgeThumb, setPhaseBoth])

  useEffect(() => {
    if (hudBest.current) hudBest.current.textContent = String(best).padStart(4, '0')
  }, [best])

  // En vertical, un teléfono deja ver tan poco mundo por delante que no da
  // tiempo a reaccionar. En vez de encoger el juego, se pide girarlo.
  useEffect(() => {
    const query = window.matchMedia?.('(orientation: portrait) and (pointer: coarse)')
    if (!query) return
    const apply = () => {
      uprightRef.current = query.matches
      setUpright(query.matches)
    }
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    unlockedRef.current = unlocked
  }, [unlocked])

  useEffect(() => {
    const down = (event) => {
      if (event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') {
        event.preventDefault()
        if (!event.repeat || phaseRef.current === 'playing') press()
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault()
        inputRef.current.crouch = true
      }
    }
    const up = (event) => {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') inputRef.current.crouch = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [press])

  // Solo aparece cuando hay algo que elegir: con un mundo abierto no hay
  // decision que tomar y el cartel estorbaria.
  const picker = unlocked > 1 && (
    <div className="world-pick" onPointerDown={(event) => event.stopPropagation()}>
      <div className="world-pick-row">
        <StackIcon size={15} />
        {Array.from({ length: unlocked }, (_, i) => i + 1).map((world) => (
          <button
            key={world}
            type="button"
            className={world === startWorld ? 'on' : ''}
            onClick={() => chooseWorld(world)}
          >
            {String(world).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  )

  const holdCrouch = (value) => (event) => {
    event.preventDefault()
    inputRef.current.crouch = value
  }

  return (
    <main className="desk">
      <div className="paper">
        <header className="hud">
          <button className="mute" type="button" onClick={toggleMusic} aria-pressed={musicOff}>
            <MusicIcon on={!musicOff} />
          </button>
          <button className="mute" type="button" onClick={toggleSfx} aria-pressed={sfxOff}>
            <SoundIcon on={!sfxOff} />
          </button>
          <div className="hud-cell">
            <StackIcon />
            <strong ref={hudWorld}>01</strong>
          </div>
          <div className="progress">
            <span ref={hudBar} />
          </div>
          <div className="hud-cell hud-right hud-dim">
            <StarIcon />
            <strong ref={hudBest}>0000</strong>
          </div>
          <div className="hud-cell hud-right">
            <SheetIcon />
            <strong ref={hudSheets}>0000</strong>
          </div>
        </header>

        <div className="game-stage" ref={stageRef} onPointerDown={press}>
          <canvas ref={canvasRef} className="sheet-canvas" />
          {/* El pulgar no es parte del dibujo: es de quien sostiene el
              cuaderno. Por eso va sobre las hojas, no tiembla con el trazo y
              se mueve con soltura mientras el dibujo avanza a saltos. */}
          <div className="pencil" ref={pencilRef} aria-hidden="true">
            <PencilSvg />
          </div>
          <div className="thumb" ref={thumbRef} aria-hidden="true">
            <ThumbSvg />
          </div>

          {phase === 'idle' && (
            <div className="message start">
              <div className="hint-row">
                <div className="hint">
                  <KeyIcon dir="up" />
                  <JumpHint />
                </div>
                <div className="hint">
                  <KeyIcon dir="down" />
                  <DuckHint />
                </div>
              </div>
              <div className="press">
                <KeyIcon dir="up" size={38} />
              </div>
              {picker}
            </div>
          )}
          {phase === 'dead' && (
            <div className="message result">
              <CrashIcon />
              <div className="tally">
                <span><SheetIcon size={16} />{String(deadSheets).padStart(4, '0')}</span>
                <span className="hud-dim"><StarIcon size={16} />{String(best).padStart(4, '0')}</span>
              </div>
              <div className="press">
                <KeyIcon dir="up" size={38} />
              </div>
              {picker}
            </div>
          )}
        </div>
      </div>

      {upright && (
        <div className="rotate-gate">
          <RotateIcon />
        </div>
      )}

      <div className="touch-pad" aria-hidden="true">
        <button onPointerDown={(e) => { e.preventDefault(); press() }}>
          <KeyIcon dir="up" size={30} />
        </button>
        <button onPointerDown={holdCrouch(true)} onPointerUp={holdCrouch(false)} onPointerLeave={holdCrouch(false)}>
          <KeyIcon dir="down" size={30} />
        </button>
      </div>
    </main>
  )
}
