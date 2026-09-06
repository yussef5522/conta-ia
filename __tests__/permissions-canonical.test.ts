import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  DEFAULT_ROLES,
  expandPermissions,
  permissionMatches,
} from '../lib/auth/permissions'

describe('PERMISSIONS canonical list', () => {
  it('todas keys são únicas', () => {
    const keys = PERMISSIONS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('todas keys seguem padrão "resource.action"', () => {
    for (const p of PERMISSIONS) {
      expect(p.key).toMatch(/^[a-z_]+\.[a-z_]+$/)
    }
  })

  it('todas têm group definido', () => {
    for (const p of PERMISSIONS) {
      expect(p.group).toBeTruthy()
      expect(p.group.length).toBeGreaterThan(0)
    }
  })

  it('lista tem pelo menos 25 permissions', () => {
    expect(PERMISSIONS.length).toBeGreaterThanOrEqual(25)
  })
})

describe('DEFAULT_ROLES', () => {
  // Fase 3 Parte 1 (22/08/2026): +OPERADOR_ESTOQUE e +LEITURA_ESTOQUE.
  // Assere os SLUGS, não só a contagem — role nova entra de propósito
  // (o teste trinca e alguém decide), role sumida não passa despercebida.
  it('tem os 8 roles padrão (5 financeiro + 3 estoque)', () => {
    // ⭐ EXECUTOR_PRODUCAO entrou em 06/09: a cozinha no tablet compartilhado, com a chave
    // mais fraca do sistema (`stock.executar` e MAIS NADA — nem `stock.view`).
    expect(Object.keys(DEFAULT_ROLES).sort()).toEqual([
      'ACCOUNTANT', 'ADMIN', 'EXECUTOR_PRODUCAO', 'FINANCIAL', 'LEITURA_ESTOQUE', 'OPERADOR_ESTOQUE', 'OWNER', 'VIEWER',
    ])
  })

  it('⛔⛔ o EXECUTOR_PRODUCAO não enxerga o resto do estoque nem o financeiro', () => {
    // ⚠️ a lista é EXATA de propósito: `stock.view` aqui abriria posição, custo e mapa de
    // vendas pra quem só precisa apertar iniciar/finalizar num tablet da cozinha.
    expect(DEFAULT_ROLES.EXECUTOR_PRODUCAO.permissions).toEqual(['stock.executar'])
    const expandido = expandPermissions([...DEFAULT_ROLES.EXECUTOR_PRODUCAO.permissions])
    expect(expandido).toEqual(['stock.executar'])
    for (const proibida of ['transaction.view', 'dre.view', 'report.view', 'stock.view', 'stock.manage']) {
      expect(permissionMatches(expandido, proibida), `vazou ${proibida}`).toBe(false)
    }
  })

  it('⭐ e o ADMIN herda a chave nova de graça (por isso ela mora em `stock.`)', () => {
    // ⛔ se a chave fosse `producao.executar`, seria preciso LEMBRAR de mexer em dois papéis
    expect(permissionMatches(expandPermissions([...DEFAULT_ROLES.ADMIN.permissions]), 'stock.executar')).toBe(true)
    // ⚠️ e o VIEWER (`*.view`) continua de fora — executar não é ver
    expect(permissionMatches(expandPermissions([...DEFAULT_ROLES.VIEWER.permissions]), 'stock.executar')).toBe(false)
  })

  it('OWNER tem permission "*"', () => {
    expect(DEFAULT_ROLES.OWNER.permissions).toContain('*')
  })

  it('VIEWER tem apenas "*.view"', () => {
    expect(DEFAULT_ROLES.VIEWER.permissions).toEqual(['*.view'])
  })

  it('ADMIN não tem company.delete (só OWNER)', () => {
    const expanded = expandPermissions([...DEFAULT_ROLES.ADMIN.permissions])
    expect(expanded).not.toContain('company.delete')
  })
})
