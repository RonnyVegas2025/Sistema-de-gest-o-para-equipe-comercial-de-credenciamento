import type { ProfileRow } from '@/types/database'

/**
 * Ponte middleware → render para o perfil do usuário. O middleware já valida a
 * sessão na borda (getUser) e lê `profiles` uma vez; em vez de o render repetir
 * as duas chamadas, o middleware anexa o perfil validado a este header da
 * request e o render o lê. Assim há UM getUser e UMA leitura de profiles por
 * navegação, não dois de cada.
 *
 * Segurança: o middleware SEMPRE sobrescreve (ou remove) este header a partir do
 * perfil validado — um valor forjado pelo cliente nunca sobrevive. A RLS
 * continua sendo a fronteira real de dados; isto é só o gate de sessão/perfil.
 *
 * `encodeURIComponent` deixa o JSON ASCII-safe (válido como valor de header) e
 * roda igual no Edge (middleware) e no Node (render).
 */
export const PROFILE_HEADER = 'x-user-profile'

export function encodeProfile(profile: ProfileRow): string {
  return encodeURIComponent(JSON.stringify(profile))
}

export function decodeProfile(raw: string): ProfileRow | null {
  try {
    return JSON.parse(decodeURIComponent(raw)) as ProfileRow
  } catch {
    return null
  }
}
