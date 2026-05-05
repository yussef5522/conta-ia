import { describe, it, expect } from 'vitest'
import {
  buildAuthContextForTest,
  AuthenticationError,
  ForbiddenError,
} from '../lib/auth/rbac'

describe('AuthContext.hasPermission', () => {
  it('OWNER (*) tem todas permissions', () => {
    const ctx = buildAuthContextForTest({ permissions: ['*'] })
    expect(ctx.hasPermission('category.create')).toBe(true)
    expect(ctx.hasPermission('company.delete')).toBe(true)
    expect(ctx.hasPermission('audit.view')).toBe(true)
  })

  it('VIEWER (*.view) só tem views', () => {
    const ctx = buildAuthContextForTest({ permissions: ['*.view'] })
    expect(ctx.hasPermission('category.view')).toBe(true)
    expect(ctx.hasPermission('category.create')).toBe(false)
    expect(ctx.hasPermission('transaction.delete')).toBe(false)
  })

  it('Custom (category.*) só tem categorias', () => {
    const ctx = buildAuthContextForTest({ permissions: ['category.*'] })
    expect(ctx.hasPermission('category.create')).toBe(true)
    expect(ctx.hasPermission('category.delete')).toBe(true)
    expect(ctx.hasPermission('transaction.create')).toBe(false)
  })

  it('permissions vazias = nada permitido', () => {
    const ctx = buildAuthContextForTest({ permissions: [] })
    expect(ctx.hasPermission('category.view')).toBe(false)
  })

  it('permission concreta funciona', () => {
    const ctx = buildAuthContextForTest({
      permissions: ['category.view', 'transaction.create'],
    })
    expect(ctx.hasPermission('category.view')).toBe(true)
    expect(ctx.hasPermission('transaction.create')).toBe(true)
    expect(ctx.hasPermission('category.create')).toBe(false)
  })
})

describe('AuthContext.requirePermission', () => {
  it('não throw se tem permission', () => {
    const ctx = buildAuthContextForTest({ permissions: ['*'] })
    expect(() => ctx.requirePermission('category.create')).not.toThrow()
  })

  it('throw ForbiddenError se NÃO tem', () => {
    const ctx = buildAuthContextForTest({ permissions: ['category.view'] })
    expect(() => ctx.requirePermission('category.create')).toThrow(ForbiddenError)
  })

  it('ForbiddenError tem permission armazenada', () => {
    const ctx = buildAuthContextForTest({ permissions: [] })
    try {
      ctx.requirePermission('category.delete')
      expect.fail('Deveria ter throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError)
      expect((e as ForbiddenError).permission).toBe('category.delete')
      expect((e as ForbiddenError).status).toBe(403)
    }
  })

  it('ForbiddenError com message customizada', () => {
    const ctx = buildAuthContextForTest({ permissions: [] })
    try {
      ctx.requirePermission('category.create')
      expect.fail('Deveria ter throw')
    } catch (e) {
      expect((e as ForbiddenError).message).toContain('category.create')
    }
  })
})

describe('AuthenticationError', () => {
  it('tem status 401', () => {
    const err = new AuthenticationError()
    expect(err.status).toBe(401)
    expect(err.name).toBe('AuthenticationError')
  })

  it('aceita message customizada', () => {
    const err = new AuthenticationError('Token expirado')
    expect(err.message).toBe('Token expirado')
  })
})
