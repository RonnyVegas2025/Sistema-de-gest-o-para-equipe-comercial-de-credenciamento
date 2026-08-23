// supabase/functions/admin-create-user/index.ts — Sprint 1 §3.2
//
// Edge Function que cria usuários e regera senha temporária. É o ÚNICO lugar
// (fora scripts) que segura a service role — nunca no bundle nem no runtime do
// Next (ARQUITETURA §3/§4). Arquivo único, para colar direto no editor de
// Edge Functions do Dashboard (o dono do projeto não usa CLI).
//
// Três camadas de barreira (a terceira é esta função, a única que não dá para
// contornar chamando a API direto):
//   1. tela (Next) exige administrador;
//   2. Server Action revalida admin e invoca esta função com o JWT do chamador;
//   3. esta função NÃO confia no gate do Next: revalida a sessão e o papel
//      administrador por conta própria antes de tocar na service role.
//
// Ações:
//   { action: 'create',     full_name, email, role }  -> cria usuário
//   { action: 'regenerate', userId }                  -> nova senha temporária
//
// Senha: padrão é senha temporária gerada aqui (DE-017). O usuário nasce/segue
// com must_change_password = true (marcado como ÚLTIMA operação, para vencer
// qualquer limpeza automática do flag). A senha é devolvida uma vez à Server
// Action, que a mostra na tela. Sessões ativas não são revogáveis por id de
// forma confiável no GoTrue (access token é JWT stateless); a troca é forçada
// pelo flag must_change_password, lido no middleware a cada request (DE-019).
//
// USER_INVITE_EMAIL_ENABLED (secret, sentido invertido): ausente/'false' ->
// senha temporária; 'true' -> convite por e-mail (evolução futura, exige SMTP);
// falha de convite retorna 502, nunca cai para senha temporária em silêncio.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const APP_ROLES = [
  'administrador',
  'gestor_adm',
  'analista_adm',
  'comercial',
  'financeiro',
  'auditoria',
] as const
type AppRole = (typeof APP_ROLES)[number]

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Senha temporária forte: 20 chars, 4 classes, aleatória via crypto. */
function generatePassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const symbols = '!@#$%&*?-_'
  const all = lower + upper + digits + symbols
  const bytes = new Uint32Array(20)
  crypto.getRandomValues(bytes)
  const pick = (set: string, n: number) => set[n % set.length]
  const chars = [
    pick(lower, bytes[0]),
    pick(upper, bytes[1]),
    pick(digits, bytes[2]),
    pick(symbols, bytes[3]),
  ]
  for (let i = 4; i < bytes.length; i++) chars.push(pick(all, bytes[i]))
  // Embaralha (Fisher-Yates) com nova entropia, para não fixar as classes no início.
  const shuffle = new Uint32Array(chars.length)
  crypto.getRandomValues(shuffle)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // O Supabase injeta SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
  // automaticamente em toda Edge Function, e o prefixo SUPABASE_ é RESERVADO —
  // não dá para criar um secret com esses nomes. Se os valores injetados não
  // servirem (projeto com as chaves legadas desabilitadas, por exemplo), defina
  // os secrets alternativos abaixo, que têm precedência.
  const supabaseUrl =
    Deno.env.get('PROJECT_URL') ?? Deno.env.get('SUPABASE_URL')
  const anonKey =
    Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey =
    Deno.env.get('SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  // Diz QUAL falta. Um 'missing_env' genérico é beco sem saída para quem depura
  // pelo painel, sem CLI e sem logs locais. O valor nunca é ecoado — só o nome.
  const faltando = [
    !supabaseUrl && 'PROJECT_URL/SUPABASE_URL',
    !anonKey && 'PUBLISHABLE_KEY/SUPABASE_ANON_KEY',
    !serviceKey && 'SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (faltando.length > 0) {
    return json(500, { error: 'missing_env', missing: faltando })
  }

  // Camada 3a: sessão. Cliente anon com o JWT do chamador; getUser() valida.
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer '))
    return json(401, { error: 'no_session' })

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user: caller },
  } = await authClient.auth.getUser()
  if (!caller) return json(401, { error: 'no_session' })

  // Camada 3b: papel. O chamador lê o próprio profile (RLS permite); precisa ser
  // administrador — mesmo que alguém invoque a função direto com token de outro
  // perfil.
  const { data: callerProfile } = await authClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (!callerProfile || callerProfile.role !== 'administrador') {
    return json(403, { error: 'forbidden' })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(422, { error: 'invalid_json' })
  }

  // A service role só é instanciada depois de a função validar sessão e papel.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const inviteEnabled = Deno.env.get('USER_INVITE_EMAIL_ENABLED') === 'true'
  const action = body.action

  if (action === 'create') {
    const fullName =
      typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const role = body.role as AppRole
    if (!fullName || !isEmail(email) || !APP_ROLES.includes(role)) {
      return json(422, { error: 'invalid_payload' })
    }

    // Evolução futura: convite por e-mail (exige SMTP). Falha -> 502, sem cair
    // para senha temporária em silêncio.
    if (inviteEnabled) {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/auth/callback?next=/nova-senha`,
      })
      if (error || !data?.user) return json(502, { error: 'invite_failed' })
      const upd = await admin
        .from('profiles')
        .update({ role })
        .eq('id', data.user.id)
      if (upd.error) return json(500, { error: 'profile_update_failed' })
      return json(200, { id: data.user.id, invited: true })
    }

    // Padrão: senha temporária.
    const password = generatePassword()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    })
    if (error || !data?.user) {
      const msg = (error?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered')) {
        return json(409, { error: 'email_exists' })
      }
      return json(500, { error: 'create_failed' })
    }

    // handle_new_user já inseriu o profile como 'auditoria'. Define o papel e
    // marca a troca obrigatória (must_change_password por último).
    const upd = await admin
      .from('profiles')
      .update({ role, must_change_password: true })
      .eq('id', data.user.id)
    if (upd.error) return json(500, { error: 'profile_update_failed' })

    return json(200, { id: data.user.id, password })
  }

  if (action === 'regenerate') {
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!UUID_RE.test(userId)) return json(422, { error: 'invalid_payload' })

    const password = generatePassword()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
    })
    if (error) {
      const msg = (error.message ?? '').toLowerCase()
      if (msg.includes('not found')) return json(404, { error: 'not_found' })
      return json(500, { error: 'update_failed' })
    }

    // Remarca a troca obrigatória como ÚLTIMA operação.
    const upd = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)
    if (upd.error) return json(500, { error: 'profile_update_failed' })

    return json(200, { id: userId, password })
  }

  return json(422, { error: 'unknown_action' })
})
