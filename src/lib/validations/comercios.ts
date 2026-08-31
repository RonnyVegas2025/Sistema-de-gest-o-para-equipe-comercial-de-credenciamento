import { z } from 'zod'
import { normalizarCnpj } from '@/services/cnpj/normalizar'

/**
 * Cadastro de comércio novo com o vínculo de demanda (D-041, D-042).
 *
 * ===========================================================================
 * A BICONDICIONAL VIVE NO BANCO. AQUI ELA É ECO.
 *
 * `enforce_demand_origin_shape()` (0014) recusa nos dois sentidos:
 *
 *   requires_client_company = true   →  empresa demandante obrigatória
 *   requires_client_company = false  →  empresa demandante PROIBIDA
 *
 * Este schema repete a regra para que o erro apareça no campo em vez de voltar
 * como exceção do Postgres. **Não é a barreira** — se as duas divergirem, quem
 * vale é o banco, e o formulário é que está errado.
 *
 * E a flag vem do catálogo, nunca de comparação com literal: `origin.match_key
 * === 'EMPRESA_CLIENTE'` quebraria num rename e não cobriria uma segunda origem
 * com o mesmo comportamento. Mesmo mecanismo de `requires_notes` (D-011, D-042).
 * ===========================================================================
 */
export const cadastrarComercioSchema = z
  .object({
    razaoSocial: z
      .string()
      .trim()
      .min(3, 'Informe a razão social')
      .max(200, 'Razão social muito longa'),
    nomeFantasia: z.string().trim().max(200).optional().or(z.literal('')),
    /**
     * Normalizado ANTES de validar, com a mesma função que a escrita usa. Sem
     * isto, o usuário digitaria com pontuação, o formulário aceitaria e o CHECK
     * do banco recusaria — erro longe da causa (D-039).
     */
    cnpj: z
      .string()
      .trim()
      .transform((v) => normalizarCnpj(v))
      .refine((v): v is string => v !== null, 'CNPJ deve ter 14 dígitos'),
    municipio: z.string().trim().max(120).optional().or(z.literal('')),
    uf: z
      .string()
      .trim()
      .length(2, 'UF tem 2 letras')
      .toUpperCase()
      .optional()
      .or(z.literal('')),
    origemId: z.string().uuid('Selecione a origem da demanda'),
    /** Marcada pelo formulário a partir da flag do catálogo, não de literal. */
    origemExigeEmpresa: z.boolean(),
    empresaDemandanteId: z
      .string()
      .uuid('Selecione a empresa demandante')
      .optional()
      .or(z.literal('')),
    responsavelId: z
      .string()
      .uuid('Selecione o consultor')
      .optional()
      .or(z.literal('')),
    equipeId: z.string().uuid().optional().or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    const temEmpresa = Boolean(v.empresaDemandanteId)
    if (v.origemExigeEmpresa && !temEmpresa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['empresaDemandanteId'],
        message: 'Esta origem exige a empresa cliente demandante.',
      })
    }
    // A segunda direção, que uma implicação simples deixaria passar. Sem ela, a
    // linha entra com todos os campos preenchidos, PARECE mais completa que as
    // corretas, e a contagem por origem fica ambígua.
    if (!v.origemExigeEmpresa && temEmpresa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['empresaDemandanteId'],
        message: 'Esta origem não admite empresa cliente demandante.',
      })
    }
  })

export type CadastrarComercioInput = z.infer<typeof cadastrarComercioSchema>
