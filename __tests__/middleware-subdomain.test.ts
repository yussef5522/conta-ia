// Subdomain routing — Sprint 1.3.
// PURO: testa a função resolveSubdomainAction sem instanciar NextRequest.

import { describe, it, expect } from 'vitest'
import {
  isAdminHost,
  resolveSubdomainAction,
} from '@/lib/middleware/subdomain'

describe('isAdminHost', () => {
  it('detecta admin.caixaos.com.br', () => {
    expect(isAdminHost('admin.caixaos.com.br')).toBe(true)
  })

  it('detecta admin.* genérico', () => {
    expect(isAdminHost('admin.qualquercoisa.com')).toBe(true)
    expect(isAdminHost('admin.local.test')).toBe(true)
  })

  it('detecta "admin" puro (dev local)', () => {
    expect(isAdminHost('admin')).toBe(true)
  })

  it('NÃO detecta app.caixaos.com.br', () => {
    expect(isAdminHost('app.caixaos.com.br')).toBe(false)
  })

  it('NÃO detecta caixaos.com.br raiz', () => {
    expect(isAdminHost('caixaos.com.br')).toBe(false)
  })

  it('NÃO detecta hosts contendo "admin" no meio', () => {
    expect(isAdminHost('app-admin.caixaos.com.br')).toBe(false)
    expect(isAdminHost('myadminthing.com')).toBe(false)
  })

  it('null/undefined → false', () => {
    expect(isAdminHost(null)).toBe(false)
    expect(isAdminHost(undefined)).toBe(false)
    expect(isAdminHost('')).toBe(false)
  })
})

describe('resolveSubdomainAction — rewrite admin.* → /admin/*', () => {
  it('admin.caixaos.com.br/ → rewrite /admin', () => {
    const r = resolveSubdomainAction('admin.caixaos.com.br', '/')
    expect(r.kind).toBe('rewrite-to-admin')
    if (r.kind === 'rewrite-to-admin') expect(r.newPathname).toBe('/admin')
  })

  it('admin.caixaos.com.br/dashboard → rewrite /admin/dashboard', () => {
    const r = resolveSubdomainAction(
      'admin.caixaos.com.br',
      '/dashboard',
    )
    expect(r.kind).toBe('rewrite-to-admin')
    if (r.kind === 'rewrite-to-admin')
      expect(r.newPathname).toBe('/admin/dashboard')
  })

  it('admin.caixaos.com.br/login → rewrite /admin/login', () => {
    const r = resolveSubdomainAction('admin.caixaos.com.br', '/login')
    expect(r.kind).toBe('rewrite-to-admin')
    if (r.kind === 'rewrite-to-admin')
      expect(r.newPathname).toBe('/admin/login')
  })

  it('admin.caixaos.com.br + path JÁ /admin/* → allow (já está reescrito)', () => {
    const r = resolveSubdomainAction(
      'admin.caixaos.com.br',
      '/admin/dashboard',
    )
    expect(r.kind).toBe('allow')
  })

  it('admin.* + _next/static → allow (asset interno)', () => {
    const r = resolveSubdomainAction(
      'admin.caixaos.com.br',
      '/_next/static/chunks/main.js',
    )
    expect(r.kind).toBe('allow')
  })

  it('admin.* + /api/* → allow (API tem rota própria)', () => {
    const r = resolveSubdomainAction('admin.caixaos.com.br', '/api/auth/login')
    expect(r.kind).toBe('allow')
  })
})

describe('resolveSubdomainAction — bloqueio /admin via app/raiz', () => {
  it('app.caixaos.com.br/admin → block 404', () => {
    const r = resolveSubdomainAction('app.caixaos.com.br', '/admin')
    expect(r.kind).toBe('block-admin')
    if (r.kind === 'block-admin') expect(r.status).toBe(404)
  })

  it('app.caixaos.com.br/admin/login → block 404 (não revela existência)', () => {
    const r = resolveSubdomainAction('app.caixaos.com.br', '/admin/login')
    expect(r.kind).toBe('block-admin')
  })

  it('caixaos.com.br/admin → block 404', () => {
    const r = resolveSubdomainAction('caixaos.com.br', '/admin')
    expect(r.kind).toBe('block-admin')
  })

  it('IP direto + /admin → block 404', () => {
    const r = resolveSubdomainAction('198.211.103.10:3001', '/admin')
    expect(r.kind).toBe('block-admin')
  })
})

describe('resolveSubdomainAction — fluxos normais do app', () => {
  it('app.caixaos.com.br/login → allow', () => {
    expect(
      resolveSubdomainAction('app.caixaos.com.br', '/login').kind,
    ).toBe('allow')
  })

  it('app.caixaos.com.br/dashboard → allow', () => {
    expect(
      resolveSubdomainAction('app.caixaos.com.br', '/dashboard').kind,
    ).toBe('allow')
  })

  it('caixaos.com.br/login → allow (nginx vai redirecionar antes)', () => {
    // nginx faz return 301 antes do middleware, mas se chegar aqui, allow.
    expect(resolveSubdomainAction('caixaos.com.br', '/login').kind).toBe(
      'allow',
    )
  })

  it('host null → allow (não tem como ser admin)', () => {
    expect(resolveSubdomainAction(null, '/login').kind).toBe('allow')
  })
})
