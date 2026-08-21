import { brand } from '@/config/brand'
import { BrandLogo } from '@/components/brand'
import { LoginForm } from './login-form'

const REASON_MESSAGES: Record<string, string> = {
  inactive: 'Acesso desativado. Procure um administrador.',
  password_updated: 'Senha atualizada. Entre com a nova senha.',
  auth_error: 'O link expirou ou é inválido. Tente novamente.',
}

/**
 * Login em dois painéis, conforme `VEGAS-PLATFORM-UI-STANDARD.md` §7: faixa
 * institucional em brand-700 à esquerda e o card do formulário à direita.
 * Empilha em telas estreitas, com o painel institucional virando faixa curta no
 * topo. O gradiente aparece só como assinatura de 3 px (§3.2).
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; reason?: string }
}) {
  const notice = searchParams.reason
    ? REASON_MESSAGES[searchParams.reason]
    : undefined

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Painel institucional sem logo: não existe variante do selo para fundo
          escuro, e o colorido perde o contorno sobre brand-700 — limitação de
          ativo raster registrada em docs/IDENTIDADE_VISUAL.md. O selo aparece no
          card do formulário; dois logos seria redundante. */}
      <aside className="relative flex flex-col justify-end overflow-hidden bg-brand-700 px-8 py-8 text-white lg:w-[44%] lg:py-12">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-brand-ribbon" />
        <div className="hidden lg:block">
          <h2 className="max-w-sm font-display text-2xl leading-snug">
            {brand.content.loginTitle}
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/80">
            {brand.content.confidentialityNotice}
          </p>
          <p className="mt-8 text-xs text-white/70">{brand.content.footer}</p>
        </div>
      </aside>

      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <BrandLogo variant="full" size="lg" priority />
          </div>
          <h1 className="text-center font-display text-xl text-ink">
            {brand.app.fullName}
          </h1>
          <p className="mb-6 mt-1 text-center text-sm text-ink-secondary">
            {brand.content.loginSubtitle}
          </p>

          <LoginForm next={searchParams.next ?? '/inicio'} notice={notice} />

          <p className="mt-6 text-center text-xs text-ink-placeholder">
            {brand.content.footer} · v{brand.app.version}
          </p>
        </div>
      </section>
    </div>
  )
}
