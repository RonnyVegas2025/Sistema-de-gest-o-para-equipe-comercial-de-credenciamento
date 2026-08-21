import Link from 'next/link'
import { BrandLogo } from './brand-logo'
import { brand } from '@/config/brand'

interface SidebarBrandProps {
  /** Menu recolhido mostra apenas o símbolo. */
  collapsed?: boolean
  /** Destino do clique. Padrão: página inicial do sistema. */
  href?: string
  className?: string
}

/**
 * Marca do topo do menu lateral. Alterna entre o selo completo (menu expandido)
 * e o símbolo (menu recolhido), sem que a página precise saber qual arquivo usar.
 * O selo a 40px é legível — a composição horizontal reconstruída não convencia
 * em tamanho pequeno; ver IDENTIDADE_VISUAL.md.
 */
export function SidebarBrand({
  collapsed = false,
  href = '/inicio',
  className,
}: SidebarBrandProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={`${brand.company.name} — ir para a página inicial`}
    >
      <BrandLogo
        variant={collapsed ? 'icon' : 'full'}
        size={collapsed ? 'md' : 'xs'}
        decorative
        priority
      />
    </Link>
  )
}
