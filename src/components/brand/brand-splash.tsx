import { BrandLogo } from './brand-logo'

interface BrandSplashProps {
  /** Texto anunciado por leitores de tela. */
  label?: string
  /** Ocupa a tela inteira. Use false para carregar uma área interna. */
  fullscreen?: boolean
  className?: string
}

/**
 * Tela de carregamento da aplicação. A barra usa a fita da marca, que aqui
 * indica progresso — o único uso decorativo permitido do gradiente.
 * A animação respeita prefers-reduced-motion via tokens.css.
 */
export function BrandSplash({
  label = 'Carregando',
  fullscreen = true,
  className,
}: BrandSplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex flex-col items-center justify-center gap-6 bg-canvas',
        fullscreen ? 'min-h-screen' : 'min-h-64 py-16',
        className ?? '',
      ].join(' ')}
    >
      <BrandLogo variant="full" size={fullscreen ? 'lg' : 'md'} priority />
      <div className="vg-progress w-40" aria-hidden>
        <span />
      </div>
      <span className="vg-sr-only">{label}</span>
    </div>
  )
}
