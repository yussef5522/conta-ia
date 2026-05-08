import { describe, it, expect } from 'vitest'
import { permissionMatches } from '../lib/auth/permissions'

// Simula filtragem do menu da contextual sidebar
function filterMenuByPermissions(
  menuItems: Array<{ permission: string | null; isComingSoon?: boolean }>,
  userPermissions: string[],
) {
  return menuItems.filter((item) => {
    if (item.isComingSoon) return true
    if (item.permission === null) return true
    return permissionMatches(userPermissions, item.permission)
  })
}

describe('Sidebar contextual — permission filtering', () => {
  it('OWNER vê tudo (com wildcard)', () => {
    const items = [
      { permission: 'dre.view' },
      { permission: 'role.view' },
      { permission: 'user.invite' },
      { permission: 'audit.view' },
    ]
    const result = filterMenuByPermissions(items, ['*'])
    expect(result.length).toBe(4)
  })

  it('VIEWER vê apenas items de visualização', () => {
    const items = [
      { permission: 'dre.view' },
      { permission: 'role.view' },
      { permission: 'user.invite' },
      { permission: 'audit.view' },
    ]
    // VIEWER tem permissions concretas só de view (sem role.view, sem user.invite, sem audit.view)
    const viewerPerms = [
      'transaction.view',
      'category.view',
      'bank_account.view',
      'company.view',
      'dre.view',
    ]
    const result = filterMenuByPermissions(items, viewerPerms)
    expect(result.length).toBe(1)
    expect(result[0].permission).toBe('dre.view')
  })

  it('Items "breve" sempre aparecem', () => {
    const items = [
      { permission: 'dre.view', isComingSoon: true },
      { permission: 'role.view' },
    ]
    const result = filterMenuByPermissions(items, [])
    expect(result.length).toBe(1)
    expect(result[0].isComingSoon).toBe(true)
  })

  it('Permission null (sem gate) sempre aparece', () => {
    const items = [
      { permission: null },
      { permission: 'role.view' },
    ]
    const result = filterMenuByPermissions(items, [])
    expect(result.length).toBe(1)
    expect(result[0].permission).toBe(null)
  })
})
