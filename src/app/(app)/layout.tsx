import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'

/**
 * Layout do grupo (app): o AppShell exige a sessão ativa (segunda camada, além
 * do middleware) e monta menu, cabeçalho e área de conteúdo.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
