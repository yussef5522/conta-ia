import { describe, it, expect } from 'vitest'
import { buildBreadcrumb } from '../lib/sidebar/breadcrumb-helper'

describe('buildBreadcrumb', () => {
  it('Dashboard', () => {
    const r = buildBreadcrumb({ pathname: '/dashboard' })
    expect(r).toEqual([{ label: 'Dashboard' }])
  })

  it('Lista de empresas', () => {
    const r = buildBreadcrumb({ pathname: '/empresas' })
    expect(r).toEqual([{ label: 'Empresas' }])
  })

  it('Empresa específica (apenas nome)', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123',
      empresaId: 'abc123',
      empresaName: 'cacula mix',
    })
    expect(r).toEqual([
      { label: 'Empresas', href: '/empresas' },
      { label: 'cacula mix' },
    ])
  })

  it('Seção dentro de empresa: DRE', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123/dre',
      empresaId: 'abc123',
      empresaName: 'cacula mix',
    })
    expect(r).toEqual([
      { label: 'Empresas', href: '/empresas' },
      { label: 'cacula mix', href: '/empresas/abc123' },
      { label: 'DRE Gerencial' },
    ])
  })

  it('Seção: Permissões', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123/permissoes',
      empresaId: 'abc123',
      empresaName: 'cacula mix',
    })
    expect(r[2].label).toBe('Permissões')
  })

  it('Seção: Auditoria', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123/auditoria',
      empresaId: 'abc123',
      empresaName: 'cacula mix',
    })
    expect(r[2].label).toBe('Auditoria')
  })

  it('Sem empresaName: usa fallback', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123/dre',
      empresaId: 'abc123',
    })
    expect(r[1].label).toBe('Empresa')
  })

  it('Slug desconhecido: usa o próprio slug', () => {
    const r = buildBreadcrumb({
      pathname: '/empresas/abc123/algo-novo',
      empresaId: 'abc123',
      empresaName: 'X',
    })
    expect(r[2].label).toBe('algo-novo')
  })
})
