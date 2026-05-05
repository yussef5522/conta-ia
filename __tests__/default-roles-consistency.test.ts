import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ROLES,
  expandPermissions,
  permissionMatches,
} from '../lib/auth/permissions'

describe('DEFAULT_ROLES consistency', () => {
  it('OWNER: pode tudo', () => {
    const ownerPerms = expandPermissions([...DEFAULT_ROLES.OWNER.permissions])
    expect(permissionMatches(ownerPerms, 'company.delete')).toBe(true)
    expect(permissionMatches(ownerPerms, 'category.create')).toBe(true)
    expect(permissionMatches(ownerPerms, 'audit.view')).toBe(true)
  })

  it('ADMIN: pode quase tudo, mas NÃO company.delete', () => {
    const adminPerms = expandPermissions([...DEFAULT_ROLES.ADMIN.permissions])
    expect(permissionMatches(adminPerms, 'category.create')).toBe(true)
    expect(permissionMatches(adminPerms, 'company.update')).toBe(true)
    expect(permissionMatches(adminPerms, 'company.delete')).toBe(false)
  })

  it('ACCOUNTANT: pode categorias e transações, mas NÃO mexe em users/roles', () => {
    const accPerms = expandPermissions([...DEFAULT_ROLES.ACCOUNTANT.permissions])
    expect(permissionMatches(accPerms, 'category.create')).toBe(true)
    expect(permissionMatches(accPerms, 'transaction.create')).toBe(true)
    expect(permissionMatches(accPerms, 'audit.view')).toBe(true)
    expect(permissionMatches(accPerms, 'user.invite')).toBe(false)
    expect(permissionMatches(accPerms, 'role.create')).toBe(false)
  })

  it('FINANCIAL: foca em transações, não mexe em categorias além de ver', () => {
    const finPerms = expandPermissions([...DEFAULT_ROLES.FINANCIAL.permissions])
    expect(permissionMatches(finPerms, 'transaction.create')).toBe(true)
    expect(permissionMatches(finPerms, 'category.view')).toBe(true)
    expect(permissionMatches(finPerms, 'category.create')).toBe(false)
    expect(permissionMatches(finPerms, 'audit.view')).toBe(false)
  })

  it('VIEWER: SÓ leitura', () => {
    const viewPerms = expandPermissions([...DEFAULT_ROLES.VIEWER.permissions])
    expect(permissionMatches(viewPerms, 'category.view')).toBe(true)
    expect(permissionMatches(viewPerms, 'transaction.view')).toBe(true)
    expect(permissionMatches(viewPerms, 'dre.view')).toBe(true)
    expect(permissionMatches(viewPerms, 'category.create')).toBe(false)
    expect(permissionMatches(viewPerms, 'transaction.delete')).toBe(false)
  })
})
