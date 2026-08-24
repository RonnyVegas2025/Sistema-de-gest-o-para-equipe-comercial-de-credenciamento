import { describe, expect, it } from 'vitest'
import {
  GROUP_ORDER,
  NAVIGATION,
  activeItem,
  groupNavigation,
  navigationFor,
} from './navigation'
import { ALL_ROLES } from '@/lib/permissions/roles'
import { canRead } from '@/lib/permissions/can'

describe('menu', () => {
  it('nenhum item morto: todo item aponta para rota existente nesta etapa', () => {
    // A lista cresce junto com as páginas, nunca antes delas. Um href aqui sem
    // rota correspondente é item morto, e item morto ensina a ignorar o menu.
    expect(NAVIGATION.map((i) => i.href)).toEqual(['/inicio', '/usuarios'])
  })

  it('Usuários só aparece para administrador', () => {
    for (const role of ALL_ROLES) {
      const hrefs = navigationFor(role).map((i) => i.href)
      expect(hrefs.includes('/usuarios')).toBe(role === 'administrador')
    }
  })

  it('Usuários vive em Administração', () => {
    const usuarios = NAVIGATION.find((i) => i.href === '/usuarios')
    expect(usuarios?.group).toBe('Administração')
  })

  it('todo grupo declarado está na ordem canônica', () => {
    for (const item of NAVIGATION) {
      expect(GROUP_ORDER).toContain(item.group)
    }
  })

  it('visibilidade acompanha canRead, papel por papel', () => {
    for (const role of ALL_ROLES) {
      for (const item of navigationFor(role)) {
        expect(canRead(role, item.module)).toBe(true)
      }
    }
  })

  it('todos os papéis veem o Início', () => {
    for (const role of ALL_ROLES) {
      expect(navigationFor(role).map((i) => i.href)).toContain('/inicio')
    }
  })

  it('grupo vazio não aparece', () => {
    for (const role of ALL_ROLES) {
      for (const entry of groupNavigation(navigationFor(role))) {
        expect(entry.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('os grupos saem na ordem canônica', () => {
    const grupos = groupNavigation(navigationFor('administrador')).map(
      (e) => e.group,
    )
    expect(grupos).toEqual(GROUP_ORDER.filter((g) => grupos.includes(g)))
  })
})

describe('item ativo', () => {
  it('casa a rota exata e as subrotas', () => {
    expect(activeItem('/inicio')?.href).toBe('/inicio')
    expect(activeItem('/inicio/detalhe')?.href).toBe('/inicio')
  })

  it('não casa prefixo parcial de outro segmento', () => {
    expect(activeItem('/iniciativas')).toBeUndefined()
  })
})
