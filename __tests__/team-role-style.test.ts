// Mapeamento role.name → estilos visuais — Sprint 1.4.
// PURO: testa cores, gradient, ordenação, fallback default.

import { describe, it, expect } from 'vitest'
import {
  getRoleStyle,
  compareRolesByDisplayOrder,
  initialsFromName,
  KNOWN_ROLE_NAMES,
} from '@/lib/team/role-style'

describe('getRoleStyle — mapeamento role → cor', () => {
  it('OWNER → roxo + displayOrder 1', () => {
    const s = getRoleStyle('OWNER')
    expect(s.badgeClass).toContain('purple')
    expect(s.displayOrder).toBe(1)
  })

  it('ADMIN → azul + displayOrder 2', () => {
    const s = getRoleStyle('ADMIN')
    expect(s.badgeClass).toContain('blue')
    expect(s.accentColor).toBe('#0C447C')
    expect(s.displayOrder).toBe(2)
  })

  it('ACCOUNTANT → verde + displayOrder 3', () => {
    const s = getRoleStyle('ACCOUNTANT')
    expect(s.badgeClass).toContain('emerald')
    expect(s.displayOrder).toBe(3)
  })

  it('FINANCIAL → amarelo + displayOrder 4', () => {
    const s = getRoleStyle('FINANCIAL')
    expect(s.badgeClass).toContain('amber')
    expect(s.displayOrder).toBe(4)
  })

  it('VIEWER → cinza + displayOrder 5', () => {
    const s = getRoleStyle('VIEWER')
    expect(s.badgeClass).toContain('slate')
    expect(s.displayOrder).toBe(5)
  })

  it('Case-insensitive (owner, Owner, OWNER → mesmo style)', () => {
    expect(getRoleStyle('owner').displayOrder).toBe(1)
    expect(getRoleStyle('Owner').displayOrder).toBe(1)
    expect(getRoleStyle('OWNER').displayOrder).toBe(1)
  })

  it('Custom role desconhecida → default cinza (displayOrder 99)', () => {
    const s = getRoleStyle('CONTADOR_AVANCADO')
    expect(s.displayOrder).toBe(99)
    expect(s.badgeClass).toContain('slate')
  })

  it('null/undefined → default', () => {
    expect(getRoleStyle(null).displayOrder).toBe(99)
    expect(getRoleStyle(undefined).displayOrder).toBe(99)
  })

  it('Todos os 5 system defaults têm description não-vazia', () => {
    for (const name of KNOWN_ROLE_NAMES) {
      const s = getRoleStyle(name)
      expect(s.description.length).toBeGreaterThan(10)
    }
  })

  it('avatarGradient é string CSS válida (linear-gradient)', () => {
    for (const name of ['OWNER', 'ADMIN', 'ACCOUNTANT', 'FINANCIAL', 'VIEWER']) {
      const s = getRoleStyle(name)
      expect(s.avatarGradient).toMatch(/^linear-gradient/)
    }
  })
})

describe('compareRolesByDisplayOrder', () => {
  it('ordena OWNER → ADMIN → ACCOUNTANT → FINANCIAL → VIEWER', () => {
    const input = [
      { name: 'VIEWER' },
      { name: 'OWNER' },
      { name: 'FINANCIAL' },
      { name: 'ACCOUNTANT' },
      { name: 'ADMIN' },
    ]
    const sorted = [...input].sort(compareRolesByDisplayOrder)
    expect(sorted.map((r) => r.name)).toEqual([
      'OWNER',
      'ADMIN',
      'ACCOUNTANT',
      'FINANCIAL',
      'VIEWER',
    ])
  })

  it('Custom roles (displayOrder 99) ficam no fim', () => {
    const input = [
      { name: 'CUSTOM_ROLE' },
      { name: 'ADMIN' },
      { name: 'VIEWER' },
    ]
    const sorted = [...input].sort(compareRolesByDisplayOrder)
    expect(sorted[0].name).toBe('ADMIN')
    expect(sorted[2].name).toBe('CUSTOM_ROLE')
  })
})

describe('initialsFromName', () => {
  it('Nome com 2 palavras → primeira + última', () => {
    expect(initialsFromName('Yussef Musa')).toBe('YM')
  })

  it('Nome com 1 palavra → 1 letra', () => {
    expect(initialsFromName('Yussef')).toBe('Y')
  })

  it('Nome com 3+ palavras → primeira + última', () => {
    expect(initialsFromName('Marcyelle da Silva dos Santos')).toBe('MS')
  })

  it('Nome com espaços extras', () => {
    expect(initialsFromName('  Yussef   Musa  ')).toBe('YM')
  })

  it('String vazia → "?"', () => {
    expect(initialsFromName('')).toBe('?')
    expect(initialsFromName('   ')).toBe('?')
  })

  it('Acentos preservados', () => {
    expect(initialsFromName('João Ântonio')).toBe('JÂ')
  })
})
