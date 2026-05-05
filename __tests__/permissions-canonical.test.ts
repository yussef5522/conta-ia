import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  DEFAULT_ROLES,
  expandPermissions,
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
  it('tem 5 roles padrão', () => {
    expect(Object.keys(DEFAULT_ROLES).length).toBe(5)
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
