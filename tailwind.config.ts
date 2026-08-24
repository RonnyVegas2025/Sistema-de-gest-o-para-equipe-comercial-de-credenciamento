import type { Config } from 'tailwindcss'

/**
 * As cores apontam para as variáveis de tokens.css. Trocar um valor de marca
 * significa editar tokens.css apenas — nada aqui e nada nos componentes.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--vg-brand-50)',
          100: 'var(--vg-brand-100)',
          200: 'var(--vg-brand-200)',
          300: 'var(--vg-brand-300)',
          400: 'var(--vg-brand-400)',
          500: 'var(--vg-brand-500)',
          600: 'var(--vg-brand-600)',
          700: 'var(--vg-brand-700)',
          800: 'var(--vg-brand-800)',
          900: 'var(--vg-brand-900)',
        },
        rose: {
          50: 'var(--vg-rose-50)',
          200: 'var(--vg-rose-200)',
          400: 'var(--vg-rose-400)',
          600: 'var(--vg-rose-600)',
        },
        peach: {
          50: 'var(--vg-peach-50)',
          200: 'var(--vg-peach-200)',
          400: 'var(--vg-peach-400)',
          600: 'var(--vg-peach-600)',
        },
        canvas: 'var(--vg-bg)',
        overlay: 'var(--vg-overlay)',
        surface: {
          DEFAULT: 'var(--vg-surface)',
          muted: 'var(--vg-surface-muted)',
        },
        line: {
          DEFAULT: 'var(--vg-border)',
          strong: 'var(--vg-border-strong)',
          field: 'var(--vg-border-field)',
        },
        // `ink-muted` foi eliminado na replicação (UI Standard §3.1): o nome não
        // dizia se o texto era hierarquia secundária ou apoio. Use `ink-secondary`
        // para texto subordinado e `muted` para metadado e legenda.
        ink: {
          DEFAULT: 'var(--vg-ink)',
          secondary: 'var(--vg-ink-secondary)',
          placeholder: 'var(--vg-placeholder)',
        },
        muted: 'var(--vg-muted)',
        state: {
          'success-bg': 'var(--vg-success-bg)',
          'success-fg': 'var(--vg-success-fg)',
          'warning-bg': 'var(--vg-warning-bg)',
          'warning-fg': 'var(--vg-warning-fg)',
          'danger-bg': 'var(--vg-danger-bg)',
          'danger-fg': 'var(--vg-danger-fg)',
          'info-bg': 'var(--vg-info-bg)',
          'info-fg': 'var(--vg-info-fg)',
          'neutral-bg': 'var(--vg-neutral-bg)',
          'neutral-fg': 'var(--vg-neutral-fg)',
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--vg-radius-sm)',
        DEFAULT: 'var(--vg-radius)',
        lg: 'var(--vg-radius-lg)',
      },
      boxShadow: {
        card: 'var(--vg-shadow-card)',
        raised: 'var(--vg-shadow-raised)',
        overlay: 'var(--vg-shadow-overlay)',
        focus: 'var(--vg-focus-ring)',
      },
      backgroundImage: {
        'brand-ribbon': 'var(--vg-gradient)',
        'brand-ribbon-v': 'var(--vg-gradient-vertical)',
      },
    },
  },
  plugins: [],
}

export default config
