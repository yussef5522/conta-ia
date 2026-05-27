// Sprint 5.0.3.0d (d2) — Tests dos helpers de virtualização.

import { describe, it, expect } from 'vitest'
import {
  shouldVirtualize,
  VIRTUALIZATION_THRESHOLD,
  ROW_HEIGHT_BY_DENSITY,
  overscanForDensity,
} from '@/lib/contas-pagar/virtualization'

describe('VIRTUALIZATION_THRESHOLD', () => {
  it('é 100 (conforme spec)', () => {
    expect(VIRTUALIZATION_THRESHOLD).toBe(100)
  })
})

describe('shouldVirtualize', () => {
  it('≤ 100 linhas: NÃO virtualiza', () => {
    expect(shouldVirtualize(0)).toBe(false)
    expect(shouldVirtualize(50)).toBe(false)
    expect(shouldVirtualize(94)).toBe(false) // Cacula
    expect(shouldVirtualize(100)).toBe(false) // limite
  })

  it('> 100 linhas: virtualiza', () => {
    expect(shouldVirtualize(101)).toBe(true)
    expect(shouldVirtualize(500)).toBe(true)
    expect(shouldVirtualize(10000)).toBe(true)
  })
})

describe('ROW_HEIGHT_BY_DENSITY', () => {
  it('compact 36px, normal 48px, comfortable 60px (bate CSS)', () => {
    expect(ROW_HEIGHT_BY_DENSITY.compact).toBe(36)
    expect(ROW_HEIGHT_BY_DENSITY.normal).toBe(48)
    expect(ROW_HEIGHT_BY_DENSITY.comfortable).toBe(60)
  })

  it('alturas crescentes', () => {
    expect(ROW_HEIGHT_BY_DENSITY.compact).toBeLessThan(
      ROW_HEIGHT_BY_DENSITY.normal,
    )
    expect(ROW_HEIGHT_BY_DENSITY.normal).toBeLessThan(
      ROW_HEIGHT_BY_DENSITY.comfortable,
    )
  })
})

describe('overscanForDensity', () => {
  it('compact tem mais overscan (mais linhas cabem na viewport)', () => {
    expect(overscanForDensity('compact')).toBeGreaterThan(
      overscanForDensity('normal'),
    )
    expect(overscanForDensity('normal')).toBeGreaterThan(
      overscanForDensity('comfortable'),
    )
  })

  it('valores razoáveis (não 0, não absurdo)', () => {
    for (const d of ['compact', 'normal', 'comfortable'] as const) {
      const o = overscanForDensity(d)
      expect(o).toBeGreaterThan(0)
      expect(o).toBeLessThan(50)
    }
  })
})
