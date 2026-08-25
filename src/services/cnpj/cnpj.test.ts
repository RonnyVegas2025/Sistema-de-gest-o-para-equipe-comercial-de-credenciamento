import { describe, expect, it } from 'vitest'
import {
  cnpjProvider,
  ehCnpjCanonico,
  formatarCnpj,
  normalizarCnpj,
  providerManual,
  type CnpjDados,
  type CnpjLookupResult,
  type CnpjProvider,
} from './index'

describe('normalização — o par da constraint de D-039', () => {
  it('tira pontuação e devolve os 14 dígitos', () => {
    expect(normalizarCnpj('12.345.678/0001-90')).toBe('12345678000190')
    expect(normalizarCnpj('12345678000190')).toBe('12345678000190')
    expect(normalizarCnpj(' 12 345 678 0001 90 ')).toBe('12345678000190')
  })

  it('recusa o que não fecha 14 dígitos', () => {
    expect(normalizarCnpj('123')).toBeNull()
    expect(normalizarCnpj('123456780001901')).toBeNull()
    expect(normalizarCnpj('')).toBeNull()
    expect(normalizarCnpj('abcdefghijklmn')).toBeNull()
  })

  it('ehCnpjCanonico espelha o CHECK do banco', () => {
    expect(ehCnpjCanonico('12345678000190')).toBe(true)
    expect(ehCnpjCanonico('12.345.678/0001-90')).toBe(false)
  })

  /**
   * D-039: formato canônico é sobre COMPARABILIDADE, não sobre o CNPJ existir.
   * Este teste fixa isso — se alguém acrescentar validação de DV aqui, ele
   * reprova e obriga a revisitar a decisão em vez de mudar o contrato em
   * silêncio.
   */
  it('NÃO valida dígito verificador — 14 dígitos quaisquer passam', () => {
    expect(normalizarCnpj('00000000000000')).toBe('00000000000000')
    expect(normalizarCnpj('11111111111111')).toBe('11111111111111')
  })

  it('formatarCnpj é só apresentação, e devolve a entrada se não for canônica', () => {
    expect(formatarCnpj('12345678000190')).toBe('12.345.678/0001-90')
    expect(formatarCnpj('123')).toBe('123')
  })
})

// ===========================================================================
// Os quatro casos do aceite. "Não encontrado" e "fornecedor fora do ar" não
// podem virar a mesma tela, então cada um tem asserção própria — inclusive a
// de que NÃO é o outro.
// ===========================================================================

const DADOS: CnpjDados = {
  cnpj: '12345678000190',
  legal_name: 'Comércio Exemplo Ltda',
  trade_name: 'Exemplo',
  situacao_cadastral: 'ATIVA',
  cnae_principal: '4711302',
  atividade: 'Comércio varejista',
  cep: '13480000',
  logradouro: 'Rua Um',
  numero: '100',
  complemento: null,
  bairro: 'Centro',
  municipio: 'Americana',
  uf: 'SP',
  telefone: '1933000000',
}

/** Dublê que responde o que o teste mandar — o fornecedor real não existe (A-001). */
function providerFalso(resposta: CnpjLookupResult): CnpjProvider {
  return { nome: 'falso', lookup: async () => resposta }
}

describe('os quatro casos do contrato', () => {
  it('1. encontrado — devolve dados, fonte e quando foi consultado', async () => {
    const provider = providerFalso({
      situacao: 'encontrado',
      dados: DADOS,
      fonte: 'fornecedor-x',
      consultadoEm: '2026-08-25T12:00:00.000Z',
    })

    const r = await provider.lookup('12.345.678/0001-90')

    expect(r.situacao).toBe('encontrado')
    if (r.situacao === 'encontrado') {
      expect(r.dados.legal_name).toBe('Comércio Exemplo Ltda')
      // As duas colunas de rastreabilidade de D-008 só existem neste ramo.
      expect(r.fonte).toBe('fornecedor-x')
      expect(r.consultadoEm).toBeTruthy()
    }
  })

  it('2. formato inválido — não chega a consultar o fornecedor', async () => {
    let chamou = false
    const provider: CnpjProvider = {
      nome: 'espiao',
      lookup: async (cnpj) => {
        const canonico = normalizarCnpj(cnpj)
        if (!canonico) {
          return { situacao: 'formato_invalido', motivo: '14 dígitos' }
        }
        chamou = true
        return { situacao: 'nao_encontrado', cnpj: canonico }
      },
    }

    const r = await provider.lookup('123')

    expect(r.situacao).toBe('formato_invalido')
    expect(chamou).toBe(false)
  })

  it('3. não encontrado — e NÃO é indisponível', async () => {
    const r = await providerFalso({
      situacao: 'nao_encontrado',
      cnpj: '12345678000190',
    }).lookup('12345678000190')

    expect(r.situacao).toBe('nao_encontrado')
    expect(r.situacao).not.toBe('indisponivel')
  })

  it('4. fornecedor fora do ar — e NÃO vira não encontrado', async () => {
    const r = await providerFalso({
      situacao: 'indisponivel',
      fornecedor: 'fornecedor-x',
      detalhe: 'timeout',
    }).lookup('12345678000190')

    expect(r.situacao).toBe('indisponivel')
    expect(r.situacao).not.toBe('nao_encontrado')
  })

  it('lookup não lança, nem com entrada absurda', async () => {
    await expect(providerManual.lookup('')).resolves.toBeDefined()
    await expect(providerManual.lookup('!@#$%')).resolves.toBeDefined()
  })
})

// ===========================================================================
// O provider manual e a honestidade de cnpj_lookup_source.
// ===========================================================================

describe('provider manual — o fallback de D-008', () => {
  it('devolve nao_encontrado, NUNCA dados vazios', async () => {
    const r = await providerManual.lookup('12.345.678/0001-90')

    expect(r.situacao).toBe('nao_encontrado')
  })

  /**
   * A asserção que protege a coluna: se o manual devolvesse `encontrado`,
   * `cnpj_lookup_source` gravaria 'manual' e `cnpj_lookup_at` gravaria agora —
   * registrando uma consulta que nunca aconteceu. Um registro que parece
   * legítimo é o pior tipo de dado errado.
   */
  it('nunca produz fonte nem data de consulta', async () => {
    const r = await providerManual.lookup('12345678000190')

    expect('fonte' in r).toBe(false)
    expect('consultadoEm' in r).toBe(false)
  })

  it('formato inválido vem antes de não encontrado', async () => {
    const r = await providerManual.lookup('123')

    // Sem isto, um CNPJ digitado errado voltaria como "não encontrado" e o
    // usuário procuraria o estabelecimento em vez de conferir o que digitou.
    expect(r.situacao).toBe('formato_invalido')
  })
})

// ===========================================================================
// O aceite estrutural de D-008: trocar de implementação não toca em chamador.
// ===========================================================================

describe('desacoplamento do fornecedor (D-008)', () => {
  /** Um chamador qualquer, escrito só contra o contrato. */
  async function telaDeCadastro(provider: CnpjProvider): Promise<string> {
    const r = await provider.lookup('12.345.678/0001-90')
    switch (r.situacao) {
      case 'encontrado':
        return `preenche: ${r.dados.legal_name} (via ${r.fonte})`
      case 'nao_encontrado':
        return 'abre em branco para digitar'
      case 'formato_invalido':
        return `erro no campo: ${r.motivo}`
      case 'indisponivel':
        return 'avisa e deixa tentar de novo'
    }
  }

  it('o mesmo chamador serve os quatro resultados, sem mudar', async () => {
    expect(await telaDeCadastro(providerManual)).toBe(
      'abre em branco para digitar',
    )
    expect(
      await telaDeCadastro(
        providerFalso({
          situacao: 'encontrado',
          dados: DADOS,
          fonte: 'fornecedor-x',
          consultadoEm: '2026-08-25T12:00:00.000Z',
        }),
      ),
    ).toBe('preenche: Comércio Exemplo Ltda (via fornecedor-x)')
    expect(
      await telaDeCadastro(
        providerFalso({ situacao: 'indisponivel', fornecedor: 'x' }),
      ),
    ).toBe('avisa e deixa tentar de novo')
  })

  it('cnpjProvider() é o único ponto que sabe qual fornecedor existe', () => {
    expect(cnpjProvider().nome).toBe('manual')
  })
})
