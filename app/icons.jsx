// Iconografía del juego. No hay una sola palabra en pantalla: lo que hay que
// saber se enseña con dibujos, que es como se explicaba un folioscopio antes
// de que existiera un manual.

export function KeyIcon({ dir = 'up', size = 30 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="2.5" y="2.5" width="27" height="27" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <g transform={dir === 'down' ? 'rotate(180 16 16)' : undefined}>
        <path d="M16 23 L16 10.5 M10 16.5 L16 9.5 L22 16.5" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

// Una hoja: la unidad de puntuación del juego.
export function SheetIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 2.5 h9 l5 5 v14 h-14 z" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinejoin="round" />
      <path d="M14 2.5 v5 h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// Hojas apiladas: el cuaderno, es decir el mundo.
export function StackIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="2.5" y="6.5" width="14" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 4 h11 a1.5 1.5 0 0 1 1.5 1.5 v13" fill="none" stroke="currentColor" strokeWidth="1.7" opacity=".6" />
      <path d="M9.5 1.5 h11 a1.5 1.5 0 0 1 1.5 1.5 v13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
    </svg>
  )
}

export function StarIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5 L14.9 9 L22 9.8 L16.7 14.5 L18.2 21.5 L12 17.9 L5.8 21.5 L7.3 14.5 L2 9.8 L9.1 9 Z"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// Las dos únicas cosas que hay que saber jugar, dibujadas.
export function JumpHint({ width = 96 }) {
  return (
    <svg viewBox="0 0 80 44" width={width} aria-hidden="true">
      <path d="M2 37 H78" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="45" y="25" width="15" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M14 35 C20 6 44 4 58 22" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeDasharray="4 4" opacity=".55" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <circle cx="32" cy="8" r="4" />
        <path d="M32 12 L32 21 M32 15 L26 12 M32 15 L38 13 M32 21 L27 26 M32 21 L37 26" />
      </g>
    </svg>
  )
}

export function DuckHint({ width = 96 }) {
  return (
    <svg viewBox="0 0 80 44" width={width} aria-hidden="true">
      <path d="M2 37 H78" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="26" y="6" width="32" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M33 15 v4 M51 15 v4" stroke="currentColor" strokeWidth="1.4" opacity=".5" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="47" cy="22" r="4" />
        <path d="M44 24.5 L37 29.5 M42 26 L49 29 M37 29.5 L33 37 M37 29.5 L41.5 37" />
      </g>
    </svg>
  )
}

// El final de la partida: la hoja arrugada.
export function CrashIcon({ size = 54 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M9 20 L18 8 L27 16 L38 9 L41 24 L33 34 L36 42 L20 39 L10 43 L13 31 Z"
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M18 8 L21 23 L9 20 M21 23 L38 9 M21 23 L13 31 M21 23 L33 34 M21 23 L20 39"
            fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".45" />
    </svg>
  )
}

// Gira el teléfono: el juego es una tira horizontal y en vertical no cabe
// mundo por delante suficiente para reaccionar.
export function RotateIcon({ size = 96 }) {
  return (
    <svg viewBox="0 0 120 100" width={size} aria-hidden="true">
      {/* el teléfono, de pie */}
      <g stroke="currentColor" fill="none" strokeWidth="3" strokeLinejoin="round">
        <rect x="42" y="28" width="36" height="60" rx="6" />
        <path d="M54 35 h12" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      {/* hacia dónde girarlo */}
      <g stroke="currentColor" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 46 A 50 50 0 0 1 104 46" />
        <path d="M96 38 L104 46 L112 38" />
      </g>
    </svg>
  )
}

// Altavoz con y sin ondas: el único ajuste del juego.
export function SoundIcon({ on = true, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4 9 h4 l5 -4.5 v15 L8 15 H4 Z" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinejoin="round" />
      {on ? (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M16.5 9.2 C17.8 10.6 17.8 13.4 16.5 14.8" />
          <path d="M19.4 6.6 C21.9 9.2 21.9 14.8 19.4 17.4" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 9.5 L22 14.5 M22 9.5 L17 14.5" />
        </g>
      )}
    </svg>
  )
}

// Nota musical: el interruptor de la canción, aparte del de los roces.
export function MusicIcon({ on = true, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M10 17.5 V5 L20 3 V15.5" />
        <ellipse cx="7.4" cy="17.6" rx="3" ry="2.6" />
        <ellipse cx="17.4" cy="15.6" rx="3" ry="2.6" />
      </g>
      {!on && (
        <path d="M3 21 L21 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  )
}
