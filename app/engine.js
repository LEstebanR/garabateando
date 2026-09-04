// Motor del juego. Sin DOM: solo estado y fisica a paso fijo.
// Regla del proyecto: un tick = un dibujo = una hoja del folioscopio.
// Por eso la simulacion corre a 14 Hz y no a 60: la sensacion de folioscopio
// nace de que la fisica y el dibujo comparten el mismo reloj discreto.

export const FPS = 14
export const TICK_MS = 1000 / FPS

// Todo el mundo se mide en las mismas unidades: "unidades de escena", donde la
// escena mide VIEW_H de alto. El canvas se escala a esas unidades, asi que
// colisionar y dibujar usan exactamente los mismos numeros.
export const VIEW_H = 260
export const GROUND_OFFSET = 40
export const PLAYER_X = 96
export const PLAYER_W = 22
export const PLAYER_H = 52
export const CROUCH_H = 30

export const GRAVITY = 6.2
export const JUMP_V = 34
export const JUMP_TICKS = (2 * JUMP_V) / GRAVITY
export const JUMP_PEAK = (JUMP_V * JUMP_V) / (2 * GRAVITY)

// Un cuaderno se mide en distancia recorrida, no en hojas. Contando hojas
// habia que adivinar donde caeria el cambio para reservarle el hueco, y como
// la velocidad sube por el camino la prediccion se desviaba cientos de
// unidades: el claro quedaba en otro sitio y la hoja tapaba obstaculos reales.
// Un mundo dura un minuto de folioscopio. Se mide en hojas y no en distancia
// recorrida porque la transicion detiene la partida y regenera el terreno: ya
// no hay que adivinar en que punto del mapa caera el cambio.
export const WORLD_SHEETS = FPS * 60

// Cada mundo empieza con su terreno dibujado a mano delante de ti. La partida
// se detiene mientras dura: pasar de un cuaderno al siguiente no es inmediato.
export const FLIP_TICKS = 12
export const DRAW_TICKS = 26

const SPAWN_AHEAD = 900
const BASE_SPEED = 12
const LEVEL_SPEED = 1.2
const MAX_SPEED = 24

// A mayor mundo, mas velocidad. El escalon puede ser brusco porque nunca cae
// en mitad de la carrera: siempre despues de dibujar el cuaderno nuevo.
export const speedFor = (world) => Math.min(MAX_SPEED, BASE_SPEED + (world - 1) * LEVEL_SPEED)

// Cada mundo estrena un elemento y conserva los anteriores. A partir del
// quinto ya estan todos en juego y solo sube la velocidad.
export const WORLD_KINDS = [
  ['block'],
  ['block', 'bar'],
  ['block', 'bar', 'plat'],
  ['block', 'bar', 'plat', 'blot'],
  ['block', 'bar', 'plat', 'blot', 'plane'],
]
export const kindsFor = (world) => WORLD_KINDS[Math.min(world, WORLD_KINDS.length) - 1]
const HIT_MARGIN = 3.5
const BAR_Y = 33
// Muro mas alto que un salto desde el suelo: la unica via es la plataforma.
const WALL_H = 104
const PLAT_Y = 46
const PLANE_RATIO = 0.35

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createGame(seed = (Date.now() & 0x7fffffff), startWorld = 1) {
  const state = {
    rand: mulberry32(seed),
    seed,
    tick: 0,
    sheets: 0,
    world: startWorld,
    worldSheets: 0,
    speed: speedFor(startWorld),
    // 'draw' dibujando el mundo | 'run' jugando | 'flip' pasando la hoja
    stage: 'draw',
    stageTick: DRAW_TICKS,
    x: 0,
    y: 0,
    vy: 0,
    onGround: true,
    crouching: false,
    jumpBuffer: 0,
    coyote: 2,
    jumps: 0,
    obstacles: [],
    nextId: 1,
    nextSpawnX: 560,
    dead: false,
    deadTick: 0,
  }
  // El terreno existe antes de que el lapiz lo dibuje: lo que se ve trazar
  // durante la animacion tiene que ser lo que luego se juega.
  spawn(state)
  return state
}

// Arranca un nivel: sube la velocidad y tira el mundo viejo, porque lo que se
// va a ver dibujar tiene que ser el mundo que de verdad se va a jugar.
function beginWorld(state) {
  state.stage = 'draw'
  state.stageTick = DRAW_TICKS
  state.world++
  state.worldSheets = 0
  state.speed = speedFor(state.world)
  state.obstacles = state.obstacles.filter((o) => o.x + o.w < state.x)
  state.nextSpawnX = state.x + 520
  spawn(state)
}

const addBlock = (state, x, w, h) => {
  state.obstacles.push({ id: state.nextId++, kind: 'block', x, w, y: 0, h })
  return x + w
}

function spawn(state) {
  while (state.nextSpawnX < state.x + SPAWN_AHEAD) {
    const x = state.nextSpawnX
    const kinds = kindsFor(state.world)
    const kind = kinds[Math.floor(state.rand() * kinds.length)]
    const roll = state.rand()
    let endX

    if (kind === 'plat') {
      // Plataforma flotante y, detras, un muro que no se puede saltar desde el
      // suelo: hay que subirse a la tabla para pasar por encima.
      // La tabla es larga y el muro va pegado a su final: hay margen de sobra
      // para aterrizar, y desde arriba el muro sale con un salto normal. Con la
      // tabla corta y el muro lejos se podia sobrevolar la tabla y quedarse sin
      // salida, que es perder sin haber tenido opcion.
      const platW = 76 + Math.round(state.rand() * 22)
      state.obstacles.push({ id: state.nextId++, kind: 'plat', x, w: platW, y: PLAT_Y, h: 7 })
      endX = addBlock(state, x + platW + 4, 18, WALL_H)
    } else if (kind === 'blot') {
      // Gota de tinta que sube y baja colgando: no se esquiva por posicion
      // sino por tiempo. Arriba deja pasar agachado con holgura de sobra;
      // abajo cierra el paso y hay que saltarla.
      //
      // Antes subia justo hasta rozar la cabeza del corredor agachado: cuatro
      // unidades de margen durante un sexto del ciclo, que en la practica era
      // imposible. Ahora deja 24 unidades libres media vuelta de cada ciclo, y
      // oscila mas despacio para poder leer el movimiento y anticiparlo.
      state.obstacles.push({
        id: state.nextId++, kind: 'blot', x, w: 24, y: 0, h: 24,
        base: 10, amp: 44, phase: state.rand() * Math.PI * 2, rate: 0.18,
      })
      endX = x + 24
    } else if (kind === 'plane') {
      // Viene de frente, asi que se planta antes de lo que parece. Nace mas
      // lejos para que el tiempo de reaccion sea el mismo que con lo estatico.
      const vx = state.speed * PLANE_RATIO
      const lead = (x - state.x) * PLANE_RATIO
      const low = state.rand() < 0.5
      state.obstacles.push({
        id: state.nextId++, kind: 'plane', x: x + lead, w: 24, y: low ? 0 : 34, h: 14, vx,
      })
      endX = x + lead + 24
    } else if (kind === 'bar') {
      // Barra alta: se pasa agachado, o saltando si se va justo.
      const w = 34 + Math.round(state.rand() * 22)
      state.obstacles.push({ id: state.nextId++, kind: 'bar', x, w, y: BAR_Y, h: 30 })
      endX = x + w
    } else if (roll < 0.64) {
      // Caja: se salta, y se puede aterrizar encima.
      endX = addBlock(state, x, 20 + Math.round(state.rand() * 16), 24 + Math.round(state.rand() * 14))
    } else if (roll < 0.88) {
      // Escalon doble: obliga a encadenar el aterrizaje.
      const w = 20 + Math.round(state.rand() * 8)
      endX = addBlock(state, x, w, 24)
      endX = addBlock(state, endX + 2, w, 40)
    } else {
      // Torre estrecha: exige el salto completo.
      endX = addBlock(state, x, 16, 46)
    }

    // El hueco se mide en saltos, no en pixeles fijos, para que siga siendo
    // jugable cuando la velocidad sube de mundo en mundo. Y nunca baja de un
    // salto y medio: con un salto justo se aterrizaba encima del obstaculo
    // siguiente, sin una sola hoja para reaccionar.
    const jumpSpan = state.speed * JUMP_TICKS
    state.nextSpawnX = endX + jumpSpan * (1.35 + state.rand() * 0.9)
  }
}

// Los obstaculos que se mueven avanzan dentro del barrido, en la misma
// fraccion que el corredor: si se movieran de golpe una vez por tick, un avion
// y un corredor yendo de frente podrian cruzarse sin llegar a tocarse.
function advanceObstacles(state, frac) {
  for (const o of state.obstacles) {
    if (o.kind === 'plane') {
      o.x -= o.vx * frac
    } else if (o.kind === 'blot') {
      o.phase += o.rate * frac
      o.y = o.base + o.amp * (0.5 - 0.5 * Math.cos(o.phase))
    }
  }
}

// Altura de apoyo bajo el jugador. Solo cuentan las cajas cuyo techo ya estaba
// por debajo de sus pies: asi una caja a la que llega de frente no lo teletransporta encima.
function supportAt(state, x, footY) {
  let support = 0
  for (const o of state.obstacles) {
    if (o.kind !== 'block' && o.kind !== 'plat') continue
    if (x + PLAYER_W <= o.x || x >= o.x + o.w) continue
    const top = o.y + o.h
    if (footY >= top - 2) support = Math.max(support, top)
  }
  return support
}

function hits(state) {
  const h = state.crouching ? CROUCH_H : PLAYER_H
  const left = state.x + HIT_MARGIN
  const right = state.x + PLAYER_W - HIT_MARGIN
  for (const o of state.obstacles) {
    // La plataforma solo sostiene: se puede atravesar por el lado y por abajo.
    if (o.kind === 'plat') continue
    if (right <= o.x || left >= o.x + o.w) continue
    if (state.y < o.y + o.h - 2 && state.y + h > o.y + 2) return o
  }
  return null
}

export function step(state, input = {}) {
  state.tick++

  if (state.dead) {
    state.deadTick++
    return state
  }

  // Cae la hoja, se dibuja el mundo nuevo, y solo entonces se corre. Cada
  // etapa cuenta sus propias hojas: el folioscopio nunca deja de pasar.
  if (state.stage !== 'run') {
    state.sheets++
    state.stageTick--
    if (state.stageTick <= 0) {
      if (state.stage === 'flip') beginWorld(state)
      else state.stage = 'run'
    }
    return state
  }

  state.sheets++
  state.worldSheets++

  if (input.jump) state.jumpBuffer = 2
  const wantCrouch = !!input.crouch

  if (state.jumpBuffer > 0 && (state.onGround || state.coyote > 0)) {
    state.vy = JUMP_V
    state.onGround = false
    state.coyote = 0
    state.jumpBuffer = 0
    state.jumps++
  } else if (state.jumpBuffer > 0) {
    state.jumpBuffer--
  }

  const dx = state.speed
  state.vy -= GRAVITY
  // Agacharse en el aire acelera la caida: da control sobre saltos largos.
  if (wantCrouch && state.vy < 0) state.vy -= GRAVITY * 0.85

  spawn(state)

  // Movimiento por barrido, en subpasos de 4 unidades.
  //
  // A 14 hojas por segundo el desplazamiento de un tick es enorme: hasta 21
  // unidades en x y 34 en y, mas que el ancho de una torre (16). Comprobar
  // solo la posicion final dejaba que el corredor apareciera al otro lado del
  // obstaculo sin haberlo tocado nunca: literalmente lo atravesaba. Recorrer
  // el trayecto a pasos cortos es lo que hace solidas las cajas altas.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(state.vy)) / 4))
  let vyStep = state.vy / steps
  let support = 0
  let grounded = false

  for (let i = 0; i < steps; i++) {
    const prevY = state.y
    advanceObstacles(state, 1 / steps)
    state.x += dx / steps
    let ny = state.y + vyStep
    support = supportAt(state, state.x, prevY)

    if (vyStep <= 0 && prevY >= support - 0.5 && ny <= support) {
      ny = support
      state.vy = 0
      vyStep = 0
    }
    if (ny < 0) {
      ny = 0
      state.vy = 0
      vyStep = 0
    }
    state.y = ny
    grounded = state.vy === 0 && Math.abs(state.y - support) < 0.5
    state.crouching = wantCrouch && grounded

    if (hits(state)) {
      state.dead = true
      state.deadTick = 0
      state.crouching = false
      break
    }
  }

  state.onGround = grounded
  state.coyote = state.onGround ? 2 : Math.max(0, state.coyote - 1)

  // Fin del mundo: se pasa la hoja y arranca el siguiente.
  if (!state.dead && state.worldSheets >= WORLD_SHEETS) {
    state.stage = 'flip'
    state.stageTick = FLIP_TICKS
  }

  // Limpieza de lo que ya quedo atras.
  if (state.obstacles.length > 24) {
    state.obstacles = state.obstacles.filter((o) => o.x + o.w > state.x - 260)
  }

  return state
}

export const worldProgress = (state) => Math.min(1, state.worldSheets / WORLD_SHEETS)
