import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { PROFILE_HEADER, encodeProfile } from '@/lib/auth/profile-header'

/**
 * Rotas públicas (sem exigir sessão).
 * - /login, /esqueci-senha: acesso anônimo; se já logado, vai para /inicio.
 * - /nova-senha: acessada com a sessão de recuperação — não redireciona o
 *   usuário logado para fora.
 * - /auth: troca de código por sessão (callback de e-mail).
 * - /dev: catálogo de componentes, que só existe fora de produção. O gate real
 *   é o layout do segmento; aqui ele apenas dispensa sessão.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/esqueci-senha',
  '/nova-senha',
  '/auth',
  '/dev',
]
const REDIRECT_IF_AUTHED = ['/login', '/esqueci-senha']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export async function middleware(request: NextRequest) {
  // ------------------------------------------------------------------
  // D-019 / D-029 — saneamento ANTES de qualquer decisão de rota.
  //
  // `x-user-profile` é a ponte middleware → render: o render confia nele sem
  // reconsultar. Se um valor vindo do cliente sobreviver, o header vira caminho
  // de escalonamento de papel.
  //
  // O `delete` vale para TODA requisição, em todos os ramos — não só no de rota
  // protegida. O sistema de origem saneia apenas naquele ramo, e por isso uma
  // requisição a uma rota PÚBLICA que leia perfil (o /dev, cujo layout exige
  // administrador) atravessa o gate com header forjado. Aqui isso não acontece:
  // nenhum caminho abaixo devolve header vindo do cliente.
  //
  // Isto roda antes de o cliente Supabase existir, então não interfere na regra
  // de não haver lógica entre createServerClient e getUser().
  // ------------------------------------------------------------------
  const sanitizedHeaders = new Headers(request.headers)
  sanitizedHeaders.delete(PROFILE_HEADER)

  const { response, user, supabase } = await updateSession(
    request,
    sanitizedHeaders,
  )
  const { pathname } = request.nextUrl

  // Sem sessão: rota pública passa; rota protegida vai para o login com o
  // destino preservado.
  if (!user) {
    if (isPublic(pathname)) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Com sessão numa rota de login/recuperação de senha: manda para o início.
  if (REDIRECT_IF_AUTHED.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/inicio'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // Com sessão numa rota protegida: bloqueia usuário desativado, força a troca
  // de senha obrigatória e passa o perfil já lido para o render. A MESMA leitura
  // de profiles cobre os dois flags E alimenta o render — que não repete getUser
  // nem a consulta a profiles (ver src/lib/auth/profile-header.ts).
  if (!isPublic(pathname)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('reason', 'inactive')
      const redirect = NextResponse.redirect(url)
      // Carrega os cookies limpos pelo signOut para a resposta de redirect.
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie)
      })
      return redirect
    }

    // Troca obrigatória: a única rota alcançável é /trocar-senha, a cada
    // request, independentemente da idade da sessão.
    if (
      profile &&
      profile.must_change_password &&
      pathname !== '/trocar-senha'
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/trocar-senha'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Passa o perfil validado ao render. Os headers já vieram sem o
    // `x-user-profile` do cliente (saneamento no topo), então o `set` abaixo é
    // sempre sobre terreno limpo.
    if (profile) {
      sanitizedHeaders.set(PROFILE_HEADER, encodeProfile(profile))
    }
    const passthrough = NextResponse.next({
      request: { headers: sanitizedHeaders },
    })
    // Preserva os cookies renovados pela updateSession (mesmo padrão do branch
    // de inativação acima).
    response.cookies.getAll().forEach((cookie) => {
      passthrough.cookies.set(cookie)
    })
    return passthrough
  }

  return response
}

export const config = {
  matcher: [
    // Tudo, exceto assets estáticos, imagens e arquivos públicos servidos na
    // raiz (robots.txt, sitemap.xml) — que não podem cair no redirect de login.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
