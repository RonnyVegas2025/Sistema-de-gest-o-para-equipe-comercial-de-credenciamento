import { describe, expect, it } from 'vitest'
import {
  ALL_MODULES,
  canInactivate,
  canRead,
  canWrite,
  type ModuleKey,
} from './can'
import { ALL_ROLES, ROLES } from './roles'
import type { AppRole } from '@/types/database'

/**
 * Casos NEGATIVOS da matriz de `RLS_PERMISSOES.md` §3. Testar só o caminho
 * feliz deixaria passar exatamente o erro que importa: conceder a mais.
 *
 * Isto **não** é a fronteira de segurança — é o espelho de aplicação. A RLS é
 * quem barra de verdade, e os testes de §6.1/§6.2 na etapa 9 são o mecanismo de
 * detecção quando os dois lados divergirem.
 */

describe('completude da matriz', () => {
  it('todo papel tem rótulo e descrição', () => {
    for (const role of ALL_ROLES) {
      expect(ROLES[role].label).toBeTruthy()
      expect(ROLES[role].description).toBeTruthy()
    }
  })

  it('toda combinação módulo × papel responde as três capacidades', () => {
    for (const modulo of ALL_MODULES) {
      for (const role of ALL_ROLES) {
        expect(typeof canRead(role, modulo)).toBe('boolean')
        expect(typeof canWrite(role, modulo)).toBe('boolean')
        expect(typeof canInactivate(role, modulo)).toBe('boolean')
      }
    }
  })
})

describe('negações que a §3 exige', () => {
  const negaLeitura: Array<[AppRole, ModuleKey]> = [
    ['comercial', 'usuarios'],
    ['analista_adm', 'usuarios'],
    ['gestor_adm', 'usuarios'],
    ['auditoria', 'usuarios'],
    ['financeiro', 'usuarios'],
    ['comercial', 'carteiras'],
    ['financeiro', 'carteiras'],
    ['comercial', 'importacoes'],
    ['analista_adm', 'importacoes'],
    ['auditoria', 'importacoes'],
    ['financeiro', 'minha_carteira'],
    ['auditoria', 'minha_carteira'],
    ['financeiro', 'mapa'],
    ['comercial', 'auditoria'],
    ['comercial', 'configuracoes'],
  ]

  it.each(negaLeitura)('%s NÃO lê %s', (role, modulo) => {
    expect(canRead(role, modulo)).toBe(false)
  })

  const negaEscrita: Array<[AppRole, ModuleKey]> = [
    ['auditoria', 'estabelecimentos'],
    ['financeiro', 'estabelecimentos'],
    ['comercial', 'produtos'],
    ['analista_adm', 'produtos'],
    ['comercial', 'estrutura_comercial'],
    ['analista_adm', 'estrutura_comercial'],
    ['comercial', 'carteiras'],
    ['analista_adm', 'minha_carteira'],
    ['analista_adm', 'visitas'],
    ['auditoria', 'oportunidades'],
    ['gestor_adm', 'configuracoes'],
  ]

  it.each(negaEscrita)('%s NÃO escreve em %s', (role, modulo) => {
    expect(canWrite(role, modulo)).toBe(false)
  })
})

describe('módulos sem escrita para ninguém', () => {
  it.each(['inicio', 'mapa', 'auditoria'] as ModuleKey[])(
    '%s é somente leitura para todos os papéis',
    (modulo) => {
      for (const role of ALL_ROLES) {
        expect(canWrite(role, modulo)).toBe(false)
      }
    },
  )
})

describe('coluna inactivate × matriz de encerramento (§5.7)', () => {
  it('visita não tem inativação para papel nenhum — atividade é histórico (D-022)', () => {
    for (const role of ALL_ROLES) {
      expect(canInactivate(role, 'visitas')).toBe(false)
    }
  })

  it('consultor inativa contato no escopo — saída da empresa não é erro de cadastro', () => {
    expect(canInactivate('comercial', 'contatos')).toBe(true)
  })

  it('gestor inativa carteira e produto, sem depender de administrador', () => {
    expect(canInactivate('gestor_adm', 'carteiras')).toBe(true)
    expect(canInactivate('gestor_adm', 'produtos')).toBe(true)
  })

  it('gestor NÃO inativa estabelecimento — cadastro mestre é do administrador', () => {
    expect(canInactivate('gestor_adm', 'estabelecimentos')).toBe(false)
    expect(canInactivate('administrador', 'estabelecimentos')).toBe(true)
  })

  it('agenda, minha_carteira, base_vegas e atividades não têm inativação', () => {
    const semInativacao: ModuleKey[] = [
      'agenda',
      'minha_carteira',
      'base_vegas',
      'atividades',
    ]
    for (const modulo of semInativacao) {
      for (const role of ALL_ROLES) {
        expect(canInactivate(role, modulo)).toBe(false)
      }
    }
  })
})

describe('financeiro está praticamente fora do CRM na V1 (§2)', () => {
  it('não escreve em nenhum módulo', () => {
    for (const modulo of ALL_MODULES) {
      expect(canWrite('financeiro', modulo)).toBe(false)
    }
  })

  it('não inativa nada', () => {
    for (const modulo of ALL_MODULES) {
      expect(canInactivate('financeiro', modulo)).toBe(false)
    }
  })
})

describe('administrador', () => {
  it('lê todos os módulos', () => {
    for (const modulo of ALL_MODULES) {
      expect(canRead('administrador', modulo)).toBe(true)
    }
  })
})
