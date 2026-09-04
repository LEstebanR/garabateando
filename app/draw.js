// Render del folioscopio sobre canvas 2D.
//
// Tres cosas hacen que se lea como un cuaderno animado a mano y no como una
// animacion por computadora:
//   1. "boil": cada trazo se redibuja con un temblor distinto en cada hoja,
//      igual que al calcar un dibujo de nuevo en la hoja siguiente.
//   2. registro imperfecto: la escena entera se desplaza una fraccion de
//      unidad por hoja, como cuando el dibujo no queda alineado con el anterior.
//   3. trasluz (onion skin): la hoja previa se ve por debajo, tenue, como el
//      papel delgado del cuaderno.

import {
  VIEW_H, GROUND_OFFSET, PLAYER_X, PLAYER_W, PLAYER_H,
  FLIP_TICKS, DRAW_TICKS, worldProgress,
} from './engine'

const INK = '#232323'
const PAPER = '#fcfbf8'
const RULE = 'rgba(96, 116, 150, .20)'
const MARGIN = 'rgba(178, 96, 88, .32)'

// Intensidad del temblor de linea. A tope el papel vibra a 14 Hz, que es
// justo la frecuencia que mas cansa la vista; por eso se puede bajar.
let BOIL = 1
export const setBoil = (value) => { BOIL = value }

const hash = (a, b) => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x165667b1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const wob = (frame, salt, amount = 1) => (hash(frame, salt) - 0.5) * 2 * amount

function subdivide(pts, maxLen, closed) {
  const src = closed ? [...pts, pts[0]] : pts
  const out = [src[0]]
  for (let i = 1; i < src.length; i++) {
    const [ax, ay] = src[i - 1]
    const [bx, by] = src[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / maxLen))
    for (let s = 1; s <= steps; s++) out.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps])
  }
  return out
}

function trace(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) {
    const [cx, cy] = pts[i]
    ctx.quadraticCurveTo(cx, cy, (cx + pts[i + 1][0]) / 2, (cy + pts[i + 1][1]) / 2)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1])
}

// Un trazo de lapiz: dos pasadas con temblor distinto, como al repasar la linea.
function pencil(ctx, pts, opts = {}) {
  const { frame = 0, salt = 0, width = 2, alpha = 1, jitter = 0.8, closed = false, color = INK, passes = 2 } = opts
  const shake = jitter * BOIL
  const dense = subdivide(pts, 12, closed)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  for (let p = 0; p < passes; p++) {
    const shaken = dense.map(([x, y], i) => [
      x + wob(frame, salt + i * 17 + p * 911, shake),
      y + wob(frame, salt + i * 31 + 7 + p * 911, shake),
    ])
    ctx.globalAlpha = alpha * (p === 0 ? 1 : 0.4)
    ctx.lineWidth = width * (p === 0 ? 1 : 0.6)
    trace(ctx, shaken)
    ctx.stroke()
  }
  ctx.restore()
}

function fillShape(ctx, pts, opts = {}) {
  const { frame = 0, salt = 0, jitter = 0.7, color = PAPER, alpha = 1 } = opts
  const shake = jitter * BOIL
  const dense = subdivide(pts, 12, true).map(([x, y], i) => [
    x + wob(frame, salt + i * 17, shake),
    y + wob(frame, salt + i * 31 + 7, shake),
  ])
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  trace(ctx, dense)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]

// Gota: punta arriba, cuerpo pesado abajo. El exponente es lo que le da el
// perfil de tinta colgando en vez de un ovalo.
function drop(cx, cy, rx, ry, n = 15) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2
    const w = Math.pow((1 - Math.cos(t)) / 2, 0.6)
    pts.push([cx + Math.sin(t) * rx * w, cy - Math.cos(t) * ry])
  }
  return pts
}

function circle(cx, cy, r, n = 11) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

// ---------------------------------------------------------------- esqueleto

const THIGH = 13, SHIN = 13, UPPER = 9, FORE = 9

// Cinematica inversa de dos huesos: dada la cadera y el pie, saca la rodilla.
function joint(ax, ay, bx, by, l1, l2, bend) {
  const dx = bx - ax
  const dy = by - ay
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01))
  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const ux = dx / d, uy = dy / d
  return [ax + ux * a - uy * h * bend, ay + uy * a + ux * h * bend]
}

// Ciclo de carrera de 6 dibujos: apoyo pegado al suelo, luego vuelo en arco.
function footPath(phase) {
  const t = ((phase % 1) + 1) % 1
  if (t < 0.55) return [8 - (19 * t) / 0.55, 0]
  const k = (t - 0.55) / 0.45
  return [-11 + 19 * k, -Math.sin(k * Math.PI) * 12]
}

function runPose(phase) {
  const t = ((phase % 1) + 1) % 1
  const a = t * Math.PI * 2
  const bob = -Math.abs(Math.sin(a)) * 2 + 1
  return {
    hip: [0, -24 + bob],
    sh: [3.5, -40 + bob],
    head: [6, -47 + bob],
    feet: [footPath(t), footPath(t + 0.5)],
    hands: [
      [Math.sin(a) * 10, -27 + bob - Math.cos(a) * 2],
      [Math.sin(a + Math.PI) * 10, -27 + bob - Math.cos(a + Math.PI) * 2],
    ],
  }
}

const POSES = {
  up: {
    hip: [0, -26], sh: [3, -42], head: [6, -49],
    feet: [[-5, -14], [8, -7]], hands: [[-8, -34], [11, -33]],
  },
  down: {
    hip: [0, -25], sh: [2, -41], head: [5, -48],
    feet: [[10, -9], [-7, -12]], hands: [[-10, -47], [9, -45]],
  },
  crouch: {
    hip: [-3, -14], sh: [4, -24], head: [9, -27],
    feet: [[-8, 0], [5, 0]], hands: [[11, -15], [8, -18]],
  },
  idle: {
    hip: [0, -24], sh: [2, -40], head: [5, -47],
    feet: [[-4, 0], [5, 0]], hands: [[-4, -26], [6, -26]],
  },
  hit: {
    hip: [0, -14], sh: [-9, -19], head: [-16, -22],
    feet: [[13, -6], [10, -14]], hands: [[-16, -8], [-11, -26]],
  },
}

function poseFor(state, started) {
  if (state.dead) return POSES.hit
  if (!started || state.stage === 'draw') return POSES.idle
  if (state.crouching) return POSES.crouch
  if (!state.onGround) return state.vy > 0 ? POSES.up : POSES.down
  return runPose(state.tick / 6)
}

function drawRunner(ctx, cx, groundY, state, started, frame) {
  const pose = poseFor(state, started)
  ctx.save()
  ctx.translate(cx, groundY)
  if (state.dead) ctx.rotate(Math.min(0.36, state.deadTick * 0.12))

  const [hx, hy] = pose.hip
  const [sx, sy] = pose.sh
  const opt = (salt, width = 2.3) => ({ frame, salt, width, jitter: 0.75 })

  // Piernas: la de atras primero, mas tenue, para que se lea la profundidad.
  pose.feet.forEach((foot, i) => {
    const knee = joint(hx, hy, foot[0], foot[1], THIGH, SHIN, -1)
    pencil(ctx, [[hx, hy], knee, foot], { ...opt(200 + i * 53, i ? 2 : 2.4), alpha: i ? 0.55 : 1 })
    pencil(ctx, [foot, [foot[0] + 5, foot[1] + 0.5]], { ...opt(260 + i * 53, 2), alpha: i ? 0.55 : 1 })
  })

  // Torso y cabeza.
  pencil(ctx, [[hx, hy], [sx, sy]], opt(300, 2.8))
  fillShape(ctx, circle(pose.head[0], pose.head[1], 5.2), { frame, salt: 340, color: PAPER })
  pencil(ctx, circle(pose.head[0], pose.head[1], 5.2), { ...opt(340, 2.2), closed: true })
  pencil(ctx, [[sx, sy], [pose.head[0] - 1.5, pose.head[1] + 4.5]], opt(360, 2))

  pose.hands.forEach((hand, i) => {
    const elbow = joint(sx, sy, hand[0], hand[1], UPPER, FORE, 1)
    pencil(ctx, [[sx, sy], elbow, hand], { ...opt(400 + i * 47, i ? 1.9 : 2.2), alpha: i ? 0.55 : 1 })
  })

  // Chispas del golpe, trazadas y no escritas: asi no dependen de que la
  // fuente tenga el simbolo, y tiemblan como el resto del dibujo.
  if (state.dead) {
    for (const [ox, oy, r] of [[5, -34, 5], [-21, -30, 3.6]]) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + 0.4
        pencil(ctx, [[ox - Math.cos(a) * r, oy - Math.sin(a) * r], [ox + Math.cos(a) * r, oy + Math.sin(a) * r]],
          { frame, salt: 600 + i, width: 1.8, passes: 1 })
      }
    }
  }
  ctx.restore()
}

// ------------------------------------------------------------- decorado

function drawObstacle(ctx, o, sx, groundY, frame) {
  const salt = o.id * 97

  if (o.kind === 'block') {
    const top = groundY - o.h
    fillShape(ctx, rect(sx, top, o.w, o.h), { frame, salt, color: '#f1eee6' })
    pencil(ctx, rect(sx, top, o.w, o.h), { frame, salt, width: 2.4, closed: true })
    for (let i = 1; i * 7 < o.h; i++) {
      pencil(ctx, [[sx + 3, top + i * 7], [sx + o.w - 3, top + i * 7 - 1]], { frame, salt: salt + i * 11, width: 1, alpha: 0.28, passes: 1 })
    }
    if (o.h < 60) {
      pencil(ctx, [[sx + o.w / 2 - 5, top - 9], [sx + o.w / 2, top - 15], [sx + o.w / 2 + 5, top - 9]], { frame, salt: salt + 5, width: 1.6, alpha: 0.5, passes: 1 })
    }
    return
  }

  if (o.kind === 'plat') {
    // Tabla flotante: se pisa por arriba y se atraviesa por abajo, asi que se
    // dibuja fina y con la sombra colgando, no apoyada en nada.
    const top = groundY - (o.y + o.h)
    fillShape(ctx, rect(sx, top, o.w, o.h), { frame, salt, color: '#f3f0e8' })
    pencil(ctx, rect(sx, top, o.w, o.h), { frame, salt, width: 2.2, closed: true })
    pencil(ctx, [[sx + 5, top + 3.5], [sx + o.w - 5, top + 3]], { frame, salt: salt + 2, width: 1, alpha: 0.3, passes: 1 })
    for (let i = 0; i < 5; i++) {
      const px = sx + 6 + (i * (o.w - 12)) / 4
      pencil(ctx, [[px, top + o.h + 2], [px - 2, top + o.h + 8]], { frame, salt: salt + 10 + i, width: 1, alpha: 0.22, passes: 1 })
    }
    return
  }

  if (o.kind === 'blot') {
    const cx = sx + o.w / 2
    const cy = groundY - (o.y + o.h / 2)
    const r = o.w / 2

    // El recorrido, marcado en el papel. Sin esta guia hay que adivinar hasta
    // donde sube, y el elemento se juega de memoria en vez de a la vista.
    const railTop = groundY - (o.base + o.amp + o.h)
    const railBottom = groundY - o.base
    ctx.save()
    ctx.setLineDash([2, 5])
    ctx.strokeStyle = 'rgba(120, 114, 104, .32)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx, railTop)
    ctx.lineTo(cx, railBottom)
    ctx.stroke()
    ctx.restore()
    for (const ry of [railTop, railBottom]) {
      pencil(ctx, [[cx - 6, ry], [cx + 6, ry]], { frame, salt: salt + 60, width: 1.2, alpha: 0.32, passes: 1 })
    }

    // Se estira al ir lanzada y se aplasta al frenar en los extremos, que es
    // lo que hace legible hacia donde va sin mirar dos hojas seguidas.
    const v = Math.sin(o.phase)
    const rx = r * (1 - Math.abs(v) * 0.16)
    const ry = r * (1 + Math.abs(v) * 0.3)
    const body = drop(cx, cy, rx, ry)

    fillShape(ctx, body, { frame, salt, color: '#31302e', alpha: 0.92 })
    pencil(ctx, body, { frame, salt: salt + 1, width: 1.5, closed: true, alpha: 0.55 })
    // Reflejo: le da volumen y evita que sea un agujero negro en la hoja.
    fillShape(ctx, circle(cx - rx * 0.34, cy - ry * 0.12, r * 0.2, 9), { frame, salt: salt + 5, color: '#f2efe8', alpha: 0.5 })

    // Salpicaduras, siempre las mismas para cada gota.
    for (let i = 0; i < 3; i++) {
      const a = hash(o.id, 50 + i) * Math.PI * 2
      const d = r * (1.35 + hash(o.id, 60 + i) * 0.5)
      const px = cx + Math.cos(a) * d
      const py = cy + Math.sin(a) * d * 0.8
      const pr = 1 + hash(o.id, 70 + i) * 1.4
      fillShape(ctx, circle(px, py, pr, 7), { frame, salt: salt + 80 + i, color: '#31302e', alpha: 0.5 })
    }
    return
  }

  if (o.kind === 'plane') {
    // Avion de papel, con la punta hacia el corredor.
    const top = groundY - (o.y + o.h)
    const nose = [sx, top + o.h * 0.62]
    const body = [nose, [sx + o.w, top], [sx + o.w * 0.72, top + o.h * 0.55], [sx + o.w, top + o.h]]
    fillShape(ctx, body, { frame, salt, color: '#f6f3ec' })
    pencil(ctx, body, { frame, salt, width: 1.9, closed: true })
    pencil(ctx, [nose, [sx + o.w * 0.72, top + o.h * 0.55]], { frame, salt: salt + 1, width: 1.4, alpha: 0.55 })
    // Estela: lo que indica que viene volando y no esta quieto.
    for (let i = 0; i < 3; i++) {
      const ex = sx + o.w + 6 + i * 9
      pencil(ctx, [[ex, top + o.h * 0.5 - 2 + i], [ex + 7, top + o.h * 0.5 - 2 + i]], { frame, salt: salt + 20 + i, width: 1.1, alpha: 0.3 - i * 0.07, passes: 1 })
    }
    return
  }

  // Barra colgada del techo de la hoja.
  const top = groundY - (o.y + o.h)
  fillShape(ctx, rect(sx, top, o.w, o.h), { frame, salt, color: '#efece3' })
  pencil(ctx, rect(sx, top, o.w, o.h), { frame, salt, width: 2.4, closed: true })
  pencil(ctx, [[sx + 4, top + 6], [sx + o.w - 6, top + 5]], { frame, salt: salt + 3, width: 1, alpha: 0.3, passes: 1 })
  pencil(ctx, [[sx + o.w * 0.25, top], [sx + o.w * 0.25 - 2, 0]], { frame, salt: salt + 7, width: 1.2, alpha: 0.35, passes: 1 })
  pencil(ctx, [[sx + o.w * 0.75, top], [sx + o.w * 0.75 + 2, 0]], { frame, salt: salt + 9, width: 1.2, alpha: 0.35, passes: 1 })
  // Flecha hacia abajo bajo la barra: se pasa agachado. La contraria, hacia
  // arriba, va sobre las cajas. Son las dos unicas instrucciones del juego y
  // ninguna necesita palabras.
  const my = groundY - 14
  pencil(ctx, [[sx + o.w / 2 - 5, my - 6], [sx + o.w / 2, my], [sx + o.w / 2 + 5, my - 6]], { frame, salt: salt + 5, width: 1.6, alpha: 0.5, passes: 1 })
}

function drawGround(ctx, camera, viewW, groundY, frame) {
  pencil(ctx, [[-10, groundY], [viewW + 10, groundY + 1]], { frame, salt: 11, width: 2.6, jitter: 0.9 })
  const first = Math.floor(camera / 38) - 1
  for (let i = first; i < first + viewW / 38 + 3; i++) {
    const sx = i * 38 - camera
    const r = hash(i, 5)
    if (r < 0.42) {
      pencil(ctx, [[sx, groundY + 1], [sx + 3, groundY - 5], [sx + 6, groundY + 1]], { frame, salt: 900 + i, width: 1.4, alpha: 0.5, passes: 1 })
    } else if (r < 0.7) {
      pencil(ctx, [[sx, groundY + 5], [sx + 11, groundY + 4]], { frame, salt: 940 + i, width: 1.2, alpha: 0.35, passes: 1 })
    }
  }
}

function drawBackdrop(ctx, camera, viewW, groundY, frame) {
  const far = camera * 0.12
  const first = Math.floor(far / 190) - 1
  for (let i = first; i < first + viewW / 190 + 3; i++) {
    const sx = i * 190 - far
    const w = 120 + hash(i, 3) * 90
    const h = 34 + hash(i, 4) * 30
    pencil(ctx, [[sx, groundY], [sx + w * 0.3, groundY - h], [sx + w * 0.62, groundY - h * 0.72], [sx + w, groundY]], { frame, salt: 700 + i, width: 1.4, alpha: 0.26, passes: 1 })
  }
  const mid = camera * 0.3
  const firstCloud = Math.floor(mid / 240) - 1
  for (let i = firstCloud; i < firstCloud + viewW / 240 + 3; i++) {
    const sx = i * 240 - mid + 40
    const sy = 26 + hash(i, 8) * 34
    pencil(ctx, [[sx, sy], [sx + 9, sy - 6], [sx + 21, sy - 7], [sx + 30, sy], [sx + 18, sy + 3], [sx + 6, sy + 2]], { frame, salt: 800 + i, width: 1.3, alpha: 0.3, closed: true, passes: 1 })
  }
}

// Cantos de papel: arriba las hojas que faltan del cuaderno, abajo las que ya
// cayeron. La pila de arriba adelgaza mientras la de abajo engorda.
function drawSheetEdges(ctx, viewW, sheetH, remaining) {
  ctx.save()
  ctx.strokeStyle = 'rgba(120, 114, 104, .30)'
  ctx.lineWidth = 1
  const pending = Math.max(2, Math.round(remaining * 11))
  for (let i = 0; i < pending; i++) {
    const y = 1 + i * 1.9
    ctx.beginPath()
    ctx.moveTo(5 + i * 0.9, y)
    ctx.lineTo(viewW - 5 - i * 0.9, y)
    ctx.stroke()
  }
  const done = Math.max(1, Math.round((1 - remaining) * 8))
  for (let i = 0; i < done; i++) {
    const y = sheetH - 1 - i * 1.7
    ctx.beginPath()
    ctx.moveTo(4 + i * 1.1, y)
    ctx.lineTo(viewW - 4 - i * 1.1, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawRules(ctx, viewW, sheetH, frame) {
  ctx.save()
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  // El rayado se corre un pelo por hoja: cada hoja es una hoja distinta.
  const off = wob(frame, 3, 1.1 * BOIL)
  for (let y = 26; y < sheetH; y += 26) {
    ctx.beginPath()
    ctx.moveTo(0, y + off)
    ctx.lineTo(viewW, y + off + wob(frame, y, 0.6 * BOIL))
    ctx.stroke()
  }
  ctx.strokeStyle = MARGIN
  ctx.beginPath()
  ctx.moveTo(34 + off, 0)
  ctx.lineTo(34 + off * 1.4, sheetH)
  ctx.stroke()
  ctx.restore()
}

// -------------------------------------------------------------- renderer

// Ancho minimo de mundo visible, en unidades. Por debajo de esto no da tiempo
// a reaccionar a lo que aparece por la derecha.
const MIN_VIEW_W = 560
const NARROW_VIEW_W = 430
// El dibujo ocupa una franja de la hoja: en una pantalla muy alta el resto es
// papel en blanco, como en un cuaderno de verdad, en vez de cielo infinito.
const MAX_VIEW_H = 330

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  const make = () => (typeof document === 'undefined' ? null : document.createElement('canvas'))
  let ink = make()
  let ghost = make()
  let size = null
  let hasGhost = false
  let nibAt = { x: 0, y: 0, size: 0, on: false }

  function resize(cssW, cssH, dpr) {
    // La escala sale de la altura, pero nunca tanto como para dejar de ver
    // mundo por delante: en pantalla completa eso quitaria tiempo de reaccion.
    const minW = cssW < 620 ? NARROW_VIEW_W : MIN_VIEW_W
    const scale = Math.min(cssH / VIEW_H, cssW / minW)
    const fullH = cssH / scale
    const viewH = Math.min(fullH, MAX_VIEW_H)
    const viewW = cssW / scale
    size = {
      w: cssW, h: cssH, dpr, scale, viewW, viewH, fullH,
      padY: (fullH - viewH) / 2,
      // En pantallas estrechas el corredor va mas a la izquierda para ganar
      // campo de vision por delante.
      playerX: Math.min(PLAYER_X, viewW * 0.17),
    }
    for (const c of [canvas, ink, ghost]) {
      c.width = Math.round(cssW * dpr)
      c.height = Math.round(cssH * dpr)
    }
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    hasGhost = false
  }

  function render(state, ui = {}) {
    if (!size) return
    const { dpr, scale, viewW, viewH, fullH, padY, playerX } = size
    const frame = state.tick
    const groundY = viewH - GROUND_OFFSET
    const camera = state.x - playerX
    const drawing = state.stage === 'draw'

    // 1. La escena de esta hoja, en su propia capa transparente.
    const ictx = ink.getContext('2d')
    ictx.setTransform(1, 0, 0, 1, 0, 0)
    ictx.clearRect(0, 0, ink.width, ink.height)
    ictx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    // Registro imperfecto entre hojas. Mientras se dibuja no hay salto: es
    // siempre la misma hoja, quieta, con el lapiz avanzando por encima.
    const reg = drawing ? 0 : BOIL
    ictx.translate(wob(frame, 1, 0.9 * reg), padY + wob(frame, 2, 0.9 * reg))

    // Mientras se dibuja el nivel, la escena se revela de izquierda a derecha:
    // solo existe lo que el lapiz ya ha trazado.
    const reveal = drawing ? 1 - (state.stageTick - 1) / DRAW_TICKS : 1
    const nib = reveal * (viewW + 60) - 30
    if (drawing) {
      ictx.save()
      ictx.beginPath()
      ictx.rect(0, 0, Math.max(0, nib), viewH)
      ictx.clip()
    }

    drawBackdrop(ictx, camera, viewW, groundY, frame)
    drawGround(ictx, camera, viewW, groundY, frame)
    for (const o of state.obstacles) {
      const sx = o.x - camera
      if (sx > viewW + 40 || sx + o.w < -40) continue
      drawObstacle(ictx, o, sx, groundY, frame)
    }
    // El corredor se dibuja entero o no se dibuja: medio muneco recortado no
    // se lee como un dibujo a medias, se lee como un fallo.
    if (!drawing || nib > playerX + PLAYER_W + 6) {
      drawRunner(ictx, playerX + PLAYER_W / 2, groundY - state.y, state, ui.started, frame)
    }
    if (drawing) ictx.restore()

    // Donde esta la punta del lapiz, en pixeles del canvas, para que el lapiz
    // de verdad (que vive en el DOM) se coloque encima del trazo.
    nibAt = drawing
      ? { x: nib * scale, y: (padY + groundY + 2) * scale, size: 150 * scale, on: true }
      : { x: 0, y: 0, size: 150 * scale, on: false }

    // 2. Componer: papel, trasluz de la hoja anterior, hoja actual.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    drawRules(ctx, viewW, fullH, frame)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (hasGhost) {
      ctx.globalAlpha = 0.09 + 0.05 * BOIL
      ctx.drawImage(ghost, wob(frame, 4, BOIL) * dpr, wob(frame, 5, BOIL) * dpr)
      ctx.globalAlpha = 1
    }
    ctx.drawImage(ink, 0, 0)

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    drawSheetEdges(ctx, viewW, fullH, 1 - worldProgress(state))

    // Mientras se dibuja el mundo, su numero. Una cifra y nada mas: el lapiz
    // en marcha ya cuenta lo que esta pasando.
    if (drawing) {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.fillStyle = INK
      ctx.globalAlpha = 0.62
      ctx.font = '700 34px Kalam, cursive'
      ctx.fillText(String(state.world).padStart(2, '0'), viewW / 2, padY + 48)
      // Subrayado a mano, como el numero de pagina de un cuaderno.
      pencil(ctx, [[viewW / 2 - 20, padY + 56], [viewW / 2 + 20, padY + 55]], { frame, salt: 512, width: 1.6, alpha: 0.35, passes: 1 })
      ctx.restore()
    }

    // 3. Fin del cuaderno: cae la hoja que da paso al nivel siguiente.
    //
    // Sigue siendo papel a trasluz y no una cortina opaca, pero ahora su papel
    // es tapar el mundo viejo el tiempo justo para que detras aparezca la hoja
    // en blanco que el lapiz empezara a dibujar.
    if (state.stage === 'flip') {
      const k = Math.pow(1 - (state.stageTick - 1) / FLIP_TICKS, 1.45)
      ctx.save()
      ctx.translate(0, -fullH + fullH * 2 * k)
      ctx.globalAlpha = 0.72
      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, viewW, fullH)
      ctx.globalAlpha = 0.85
      drawRules(ctx, viewW, fullH, frame + 9)
      ctx.globalAlpha = 1

      const cast = ctx.createLinearGradient(0, fullH, 0, fullH + 26)
      cast.addColorStop(0, 'rgba(42, 38, 31, .30)')
      cast.addColorStop(1, 'rgba(42, 38, 31, 0)')
      ctx.fillStyle = cast
      ctx.fillRect(0, fullH, viewW, 26)
      pencil(ctx, [[0, fullH], [viewW, fullH]], { frame, salt: 88, width: 2, alpha: 0.65, passes: 1 })
      ctx.restore()
    }

    // 4. Esta hoja pasa a ser el trasluz de la siguiente.
    const gctx = ghost.getContext('2d')
    gctx.setTransform(1, 0, 0, 1, 0, 0)
    gctx.clearRect(0, 0, ghost.width, ghost.height)
    gctx.drawImage(ink, 0, 0)
    hasGhost = true
  }

  return {
    resize,
    render,
    get viewW() { return size?.viewW ?? 0 },
    get nib() { return nibAt },
  }
}
