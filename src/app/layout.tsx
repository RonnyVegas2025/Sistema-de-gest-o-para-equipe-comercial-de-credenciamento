import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Inter, Outfit } from 'next/font/google'
import { brand } from '@/config/brand'
import './globals.css'

/**
 * Fontes carregadas por next/font/google e expostas como variáveis CSS. O
 * tokens.css já consome --font-outfit (display) e --font-inter (interface).
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: brand.app.fullName,
    template: `%s · ${brand.app.name}`,
  },
  description: brand.app.description,
  icons: {
    icon: brand.logos.favicon,
    apple: brand.logos.appleTouchIcon,
  },
}

export const viewport: Viewport = {
  // Espelho do token de marca em brand.ts — uso fora do CSS é permitido lá, e a
  // sincronia com tokens.css é garantida por brand.test.ts.
  themeColor: brand.colors.primary,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
