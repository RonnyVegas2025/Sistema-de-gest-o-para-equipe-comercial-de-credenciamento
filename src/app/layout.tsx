import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Layout raiz. Nasce mínimo na etapa 1 e cresce na etapa 2, quando recebe
 * `globals.css` (que importa `tokens.css`) e as fontes Outfit e Inter via
 * `next/font`.
 */
export const metadata: Metadata = {
  title: 'CRM Comercial de Credenciamento Vegas',
  description: 'CRM da operação comercial de credenciamento da Vegas Card.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
