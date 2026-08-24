import { z } from 'zod'

/**
 * Validação das variáveis de ambiente com Zod.
 *
 * Só existe `publicEnv` — o trio `NEXT_PUBLIC_*`, seguro no navegador e no
 * servidor.
 *
 * **Não há `serverEnv()` nem leitura de `SUPABASE_SERVICE_ROLE_KEY` aqui.** No
 * CRM a service role vive num único lugar: os secrets da Edge Function, onde
 * `admin-create-user` a lê. O runtime do Next nunca a recebe, então um schema
 * de servidor que a exigisse seria código morto convidando alguém a definir a
 * variável na Vercel "para o schema parar de reclamar" — e aí a chave estaria
 * num lugar onde o desenho diz que ela não deve estar.
 *
 * O sistema de origem tem esse `serverEnv()`, e nenhum arquivo o chama nos dois
 * repositórios. Não foi replicado.
 *
 * Este módulo é de servidor: a regra `no-restricted-imports` impede que
 * componente client o importe — valores públicos são lidos via `NEXT_PUBLIC_*`
 * direto de `process.env`.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY é obrigatória')
    .startsWith(
      'sb_publishable_',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY deve ser a chave publishable (sb_publishable_…), não o JWT antigo',
    ),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL precisa ser uma URL válida'),
})

function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  source: unknown,
  contexto: string,
): z.infer<S> {
  const result = schema.safeParse(source)
  if (!result.success) {
    const detalhes = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Configuração de ambiente inválida (${contexto}):\n${detalhes}\n` +
        'Confira o .env.local com base no .env.example.',
    )
  }
  return result.data
}

/** Variáveis públicas. Seguras no cliente e no servidor. */
export const publicEnv = parseOrThrow(
  publicSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  'público',
)
