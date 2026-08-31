import { describe, expect, it } from 'vitest'
import { cadastrarComercioSchema } from './comercios'

const base = {
  razaoSocial: 'Padaria do Bairro Ltda',
  cnpj: '11.222.333/0001-81',
  origemId: '11111111-1111-4111-8111-111111111111',
  empresaDemandanteId: '22222222-2222-4222-8222-222222222222',
}

describe('cadastrarComercioSchema', () => {
  it('normaliza o CNPJ com a mesma função da escrita (D-039)', () => {
    const r = cadastrarComercioSchema.safeParse({
      ...base,
      origemExigeEmpresa: true,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.cnpj).toBe('11222333000181')
  })

  it('recusa CNPJ que não fecha 14 dígitos', () => {
    const r = cadastrarComercioSchema.safeParse({
      ...base,
      cnpj: '11.222.333/0001',
      origemExigeEmpresa: true,
    })
    expect(r.success).toBe(false)
  })

  // As duas direções da bicondicional, medidas separadamente — é a distinção
  // que uma implicação simples apaga (D-042).
  it('origem que exige empresa: recusa sem empresa', () => {
    const r = cadastrarComercioSchema.safeParse({
      ...base,
      empresaDemandanteId: '',
      origemExigeEmpresa: true,
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0]?.message).toContain('exige a empresa cliente')
  })

  it('origem que NÃO exige empresa: recusa COM empresa', () => {
    const r = cadastrarComercioSchema.safeParse({
      ...base,
      origemExigeEmpresa: false,
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0]?.message).toContain('não admite empresa cliente')
  })

  it('origem que NÃO exige empresa: aceita sem empresa', () => {
    const r = cadastrarComercioSchema.safeParse({
      ...base,
      empresaDemandanteId: '',
      origemExigeEmpresa: false,
    })
    expect(r.success).toBe(true)
  })
})
