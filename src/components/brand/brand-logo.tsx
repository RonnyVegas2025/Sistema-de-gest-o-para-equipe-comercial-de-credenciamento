import Image from 'next/image'
import { brand } from '@/config/brand'

export type LogoVariant = 'full' | 'icon'
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface BrandLogoProps {
  /** full = selo completo · icon = só o símbolo */
  variant?: LogoVariant
  size?: LogoSize
  /** Marque como decorativo quando o nome da marca já aparece em texto ao lado. */
  decorative?: boolean
  priority?: boolean
  className?: string
}

/** Altura renderizada em px por variante e tamanho. */
const HEIGHTS: Record<LogoVariant, Record<LogoSize, number>> = {
  full: { xs: 40, sm: 56, md: 72, lg: 96, xl: 128 },
  icon: { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 },
}

/**
 * Dimensões REAIS de cada arquivo (px). Vão nos atributos width/height do
 * <Image> para o aspect ratio ser exato; a exibição é controlada pela altura no
 * style, com width:auto. Se mudar o arquivo, ajuste aqui.
 */
const INTRINSIC: Record<LogoVariant, { width: number; height: number }> = {
  full: { width: 1645, height: 1045 },
  icon: { width: 1024, height: 1024 },
}

// Só o tom colorido: todas as superfícies do sistema são claras. As versões
// -light (fundo escuro) foram removidas por não terem uso — reintroduzir com o
// prop `tone` quando surgir superfície escura/colorida + vetor (DE-016).
const SOURCES: Record<LogoVariant, string> = {
  full: brand.logos.full,
  icon: brand.logos.icon,
}

/**
 * Único caminho pelo qual o logo entra na tela.
 * Nenhuma página deve montar <Image src="/brand/..."> diretamente.
 */
export function BrandLogo({
  variant = 'full',
  size = 'md',
  decorative = false,
  priority = false,
  className,
}: BrandLogoProps) {
  const height = HEIGHTS[variant][size]
  const intrinsic = INTRINSIC[variant]

  return (
    <Image
      src={SOURCES[variant]}
      alt={decorative ? '' : `${brand.company.name} — ${brand.app.name}`}
      aria-hidden={decorative || undefined}
      width={intrinsic.width}
      height={intrinsic.height}
      priority={priority}
      className={className}
      // Altura fixa; largura derivada do aspect ratio real do arquivo.
      // maxWidth:'none' anula o `img { max-width: 100% }` do Preflight do
      // Tailwind — sem isso, um container estreito (menu expandido) cortaria a
      // largura mantendo a altura, comprimindo/distorcendo o logo.
      style={{ height, width: 'auto', maxWidth: 'none' }}
    />
  )
}
