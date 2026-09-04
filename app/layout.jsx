import { Analytics } from '@vercel/analytics/next'

import './globals.css'

export const metadata = {
  title: 'Salta Páginas',
  description: 'Un folioscopio jugable',
  // Si alguien lo añade a la pantalla de inicio, abre sin barra de navegador.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Salta Páginas' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Sin zoom: en un juego de dos botones, el doble toque solo estorba.
  userScalable: false,
  // El dibujo llega hasta el borde; los márgenes seguros los pone el CSS.
  viewportFit: 'cover',
  themeColor: '#e7e5e1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
