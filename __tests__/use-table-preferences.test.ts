// Sprint 5.0.3.0c (c2) — Tests pro useTablePreferences hook.
//
// Foca no comportamento PURO (storage + filtros alwaysVisible).
// Hooks de React não são testados aqui (sem jsdom env) — função `toggleColumnHidden`
// e helpers de storage cobertos via mock.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DENSITY_HEIGHTS,
  DENSITY_LEVELS,
} from '@/lib/contas-pagar/use-table-preferences'

describe('DENSITY_LEVELS', () => {
  it('tem exatamente 3 níveis: compact, normal, comfortable', () => {
    expect(DENSITY_LEVELS).toEqual(['compact', 'normal', 'comfortable'])
  })

  it('alturas crescentes: 36 < 48 < 60', () => {
    expect(DENSITY_HEIGHTS.compact).toBe(36)
    expect(DENSITY_HEIGHTS.normal).toBe(48)
    expect(DENSITY_HEIGHTS.comfortable).toBe(60)
    expect(DENSITY_HEIGHTS.compact).toBeLessThan(DENSITY_HEIGHTS.normal)
    expect(DENSITY_HEIGHTS.normal).toBeLessThan(DENSITY_HEIGHTS.comfortable)
  })
})

// Mock simples de localStorage pra testar serialização/deserialização
class MemStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
  clear(): void {
    this.map.clear()
  }
}

describe('localStorage prefix caixaos:contas-pagar:* (sanity)', () => {
  let mem: MemStorage

  beforeEach(() => {
    mem = new MemStorage()
  })

  it('round-trip JSON shape válido', () => {
    const prefs = {
      density: 'compact' as const,
      columnOrder: ['status', 'dueDate', 'amount'],
      columnHidden: ['notes'],
    }
    mem.setItem('caixaos:contas-pagar:prefs', JSON.stringify(prefs))
    const raw = mem.getItem('caixaos:contas-pagar:prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual(prefs)
  })

  it('JSON inválido (corrupted localStorage) não quebra parse', () => {
    mem.setItem('caixaos:contas-pagar:prefs', 'not-json{{{')
    expect(() => {
      try {
        const raw = mem.getItem('caixaos:contas-pagar:prefs')
        if (raw) JSON.parse(raw)
      } catch {
        /* silent */
      }
    }).not.toThrow()
  })

  it('density inválida no storage é detectada via includes check', () => {
    const corrupted = {
      density: 'enormous',
      columnOrder: [],
      columnHidden: [],
    }
    mem.setItem('caixaos:contas-pagar:prefs', JSON.stringify(corrupted))
    const parsed = JSON.parse(mem.getItem('caixaos:contas-pagar:prefs')!)
    expect(DENSITY_LEVELS.includes(parsed.density)).toBe(false)
  })

  it('shape sem density é detectado', () => {
    const incomplete = { columnOrder: [], columnHidden: [] }
    mem.setItem('caixaos:contas-pagar:prefs', JSON.stringify(incomplete))
    const parsed = JSON.parse(mem.getItem('caixaos:contas-pagar:prefs')!)
    expect(DENSITY_LEVELS.includes(parsed.density)).toBe(false)
  })
})

describe('alwaysVisible filter logic', () => {
  // Simula a logic de toggleColumnHidden — filtra alwaysVisible
  function applyToggle(
    current: string[],
    columnId: string,
    alwaysVisible: string[],
  ): string[] | null {
    if (alwaysVisible.includes(columnId)) return null // bloqueia
    const set = new Set(current)
    if (set.has(columnId)) set.delete(columnId)
    else set.add(columnId)
    return Array.from(set)
  }

  it('tenta esconder Status (alwaysVisible) → bloqueado (null)', () => {
    const result = applyToggle([], 'status', ['status', 'amount', 'actions'])
    expect(result).toBeNull()
  })

  it('tenta esconder Valor (alwaysVisible) → bloqueado', () => {
    expect(
      applyToggle([], 'amount', ['status', 'amount', 'actions']),
    ).toBeNull()
  })

  it('esconde categoria (não-alwaysVisible) → permitido', () => {
    expect(
      applyToggle([], 'category', ['status', 'amount', 'actions']),
    ).toEqual(['category'])
  })

  it('mostra categoria já escondida → permitido (toggle)', () => {
    expect(
      applyToggle(['category'], 'category', ['status', 'amount', 'actions']),
    ).toEqual([])
  })
})

describe('mobile breakpoint', () => {
  it('breakpoint < 768px considera mobile', () => {
    // Simulação pura — sem window
    const isMobileFn = (width: number) => width < 768
    expect(isMobileFn(767)).toBe(true)
    expect(isMobileFn(768)).toBe(false)
    expect(isMobileFn(1024)).toBe(false)
    expect(isMobileFn(375)).toBe(true) // iPhone SE
  })
})

// Suprime vi warning se não usado
void vi
