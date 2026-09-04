// La mano de quien sostiene el cuaderno y la que lo dibuja.
//
// Nada de esto está dibujado a lápiz, y es deliberado: el mundo del juego es un
// dibujo sobre papel, pero la mano no forma parte del dibujo. Por eso va en el
// DOM y no en el canvas, con volumen y sombra propia, sin el temblor del trazo
// y moviéndose a la tasa del navegador mientras el dibujo avanza a saltos.

const SKIN = ['#f7ddc8', '#eec8ac', '#dbab8e', '#bd8e73']

// Un dedo: yema a la izquierda, entra por la derecha. Se reutiliza para el
// pulgar que sujeta el cuaderno y para los dos que sujetan el lápiz.
const FINGER = 'M204 6 L126 11 C99 14 76 24 61 39 C47 53 46 68 60 80 C74 92 99 99 127 101 L204 106 Z'
const NAIL = 'M86 27 C104 25 116 34 119 50 C122 68 112 82 94 85 C79 87 68 78 66 63 C64 45 71 30 86 27 Z'

function SkinGradient({ id }) {
  return (
    <linearGradient id={id} x1="30%" y1="8%" x2="60%" y2="100%">
      {SKIN.map((color, i) => (
        <stop key={color} offset={`${[0, 34, 72, 100][i]}%`} stopColor={color} />
      ))}
    </linearGradient>
  )
}

function NailGradient({ id }) {
  return (
    <linearGradient id={id} x1="18%" y1="6%" x2="72%" y2="96%">
      <stop offset="0%" stopColor="#fdf3ea" />
      <stop offset="45%" stopColor="#f7dfd0" />
      <stop offset="100%" stopColor="#e0b59d" />
    </linearGradient>
  )
}

function Finger({ skin, nail, soft }) {
  return (
    <g>
      <path d={FINGER} fill={`url(#${skin})`} />
      <path d="M204 8 L127 13 C101 16 79 26 65 40" fill="none" stroke="#fdeadb" strokeWidth="2.4" strokeOpacity=".6" filter={`url(#${soft})`} />
      <path d="M64 79 C78 91 102 97 128 99 L204 104" fill="none" stroke="#a97a60" strokeWidth="4.5" strokeOpacity=".36" filter={`url(#${soft})`} />
      <path d={NAIL} fill={`url(#${nail})`} />
      <path d="M74 68 C82 76 96 78 108 73" fill="none" stroke="#fffaf4" strokeWidth="5" strokeOpacity=".45" filter={`url(#${soft})`} />
      <ellipse cx="97" cy="42" rx="13" ry="7" transform="rotate(-24 97 42)" fill="#fffdfa" opacity=".5" filter={`url(#${soft})`} />
    </g>
  )
}

export function ThumbSvg() {
  return (
    <svg viewBox="0 0 200 116" width="100%" height="100%" aria-hidden="true">
      <defs>
        <SkinGradient id="th-skin" />
        <NailGradient id="th-nail" />
        <filter id="th-cast" x="-30%" y="-30%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5" /></filter>
        <filter id="th-soft" x="-30%" y="-30%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <path d={FINGER} fill="rgba(64,48,36,.32)" filter="url(#th-cast)" transform="translate(2,8)" />
      <Finger skin="th-skin" nail="th-nail" soft="th-soft" />
      <path d="M150 22 C156 40 156 70 150 92" fill="none" stroke="#b98a6f" strokeWidth="1.5" strokeOpacity=".32" />
      <path d="M162 26 C167 44 167 66 162 88" fill="none" stroke="#b98a6f" strokeWidth="1.2" strokeOpacity=".22" />
    </svg>
  )
}

export function PencilSvg() {
  return (
    <svg viewBox="0 0 240 240" width="100%" height="100%" aria-hidden="true">
      <defs>
        <SkinGradient id="pc-skin" />
        <NailGradient id="pc-nail" />
        <linearGradient id="pc-wood" x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#c99a63" /><stop offset="26%" stopColor="#f0cd9c" />
          <stop offset="58%" stopColor="#dcb27f" /><stop offset="100%" stopColor="#a97c4e" />
        </linearGradient>
        <linearGradient id="pc-barrel" x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#9c6f22" /><stop offset="18%" stopColor="#e8b743" />
          <stop offset="40%" stopColor="#fbdc86" /><stop offset="62%" stopColor="#eebc4b" />
          <stop offset="84%" stopColor="#b98622" /><stop offset="100%" stopColor="#8a6118" />
        </linearGradient>
        <linearGradient id="pc-metal" x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#8d949a" /><stop offset="22%" stopColor="#e6ebee" />
          <stop offset="52%" stopColor="#b9c1c6" /><stop offset="78%" stopColor="#dfe5e9" />
          <stop offset="100%" stopColor="#79817f" />
        </linearGradient>
        <linearGradient id="pc-rubber" x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#c4776f" /><stop offset="35%" stopColor="#f0a79c" />
          <stop offset="100%" stopColor="#b26a62" />
        </linearGradient>
        <linearGradient id="pc-lead" x1="0%" y1="0" x2="100%" y2="0">
          <stop offset="0%" stopColor="#2f3236" /><stop offset="40%" stopColor="#6b7076" />
          <stop offset="100%" stopColor="#23262a" />
        </linearGradient>
        <filter id="pc-cast" x="-40%" y="-30%" width="190%" height="170%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="pc-soft" x="-40%" y="-40%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.8" /></filter>

        {/* Cada dedo se desvanece hacia la muñeca en lugar de cortarse contra
            el borde: el resto de la mano queda fuera del cuaderno. */}
        <mask id="pc-fadeIndex">
          <linearGradient id="pc-fi" x1="40%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" /><stop offset="58%" stopColor="#fff" /><stop offset="100%" stopColor="#000" />
          </linearGradient>
          <rect width="240" height="240" fill="url(#pc-fi)" />
        </mask>
        <mask id="pc-fadeThumb">
          <linearGradient id="pc-ft" x1="72%" y1="34%" x2="6%" y2="98%">
            <stop offset="0%" stopColor="#fff" /><stop offset="46%" stopColor="#fff" /><stop offset="100%" stopColor="#000" />
          </linearGradient>
          <rect width="240" height="240" fill="url(#pc-ft)" />
        </mask>
      </defs>

      <path d="M100 6 L124 6 L124 210 L100 210 Z" fill="rgba(62,48,36,.28)" filter="url(#pc-cast)" transform="translate(9,7)" />

      <path d="M108.5 2 L115.5 2 L121 30 L103 30 Z" fill="url(#pc-lead)" />
      <path d="M103 30 L121 30 L126 50 L98 50 Z" fill="url(#pc-wood)" />
      <path d="M103 30 L110 30 L106 50 L98 50 Z" fill="#fff" opacity=".2" />
      <rect x="98" y="49" width="28" height="126" fill="url(#pc-barrel)" />
      <line x1="107.5" y1="49" x2="107.5" y2="175" stroke="#fff5cf" strokeWidth="1" strokeOpacity=".42" />
      <line x1="118" y1="49" x2="118" y2="175" stroke="#7c5713" strokeWidth="1" strokeOpacity=".45" />
      <rect x="97.4" y="175" width="29.2" height="16" fill="url(#pc-metal)" />
      <line x1="97.4" y1="180" x2="126.6" y2="180" stroke="#6f7679" strokeWidth=".9" strokeOpacity=".5" />
      <line x1="97.4" y1="186" x2="126.6" y2="186" stroke="#6f7679" strokeWidth=".9" strokeOpacity=".5" />
      <path d="M98 191 L126 191 L126 205 C126 211 120 214 112 214 C104 214 98 211 98 205 Z" fill="url(#pc-rubber)" />

      <g mask="url(#pc-fadeThumb)">
        <g transform="translate(133,150) rotate(155) scale(.48)">
          <path d={FINGER} fill="rgba(62,48,36,.3)" filter="url(#pc-cast)" />
          <Finger skin="pc-skin" nail="pc-nail" soft="pc-soft" />
        </g>
      </g>
      <g mask="url(#pc-fadeIndex)">
        <g transform="translate(70,92) scale(.52)">
          <path d={FINGER} fill="rgba(62,48,36,.3)" filter="url(#pc-cast)" />
          <Finger skin="pc-skin" nail="pc-nail" soft="pc-soft" />
        </g>
      </g>
    </svg>
  )
}
