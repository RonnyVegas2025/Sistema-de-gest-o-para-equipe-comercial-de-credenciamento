import type { ReactNode } from 'react'

/**
 * Layout do grupo (auth): sem shell, sem menu. Apenas o contêiner de tela
 * cheia; cada página define a própria composição (o login usa dois painéis;
 * recuperação e nova senha usam um card centralizado).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-canvas">{children}</main>
}
