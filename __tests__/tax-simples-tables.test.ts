// Sprint 5.0.1 — valida estrutura das tabelas Simples Nacional 2026.

import { describe, it, expect } from 'vitest'
import {
  SIMPLES_TABLES,
  findFaixa,
  SIMPLES_LIMITE_RBA_2026,
  FATOR_R_THRESHOLD,
} from '@/lib/tax/simples-nacional-tables'

describe('SIMPLES_TABLES — estrutura', () => {
  it('tem os 5 anexos', () => {
    expect(Object.keys(SIMPLES_TABLES).sort()).toEqual([
      'ANEXO_I',
      'ANEXO_II',
      'ANEXO_III',
      'ANEXO_IV',
      'ANEXO_V',
    ])
  })

  it('cada anexo tem exatamente 6 faixas', () => {
    for (const [, faixas] of Object.entries(SIMPLES_TABLES)) {
      expect(faixas).toHaveLength(6)
    }
  })

  it('faixas são contíguas: rbaMax da N == rbaMin da N+1', () => {
    for (const [, faixas] of Object.entries(SIMPLES_TABLES)) {
      for (let i = 0; i < faixas.length - 1; i++) {
        expect(faixas[i].rbaMax).toBe(faixas[i + 1].rbaMin)
      }
    }
  })

  it('faixa 1 começa em 0', () => {
    for (const [, faixas] of Object.entries(SIMPLES_TABLES)) {
      expect(faixas[0].rbaMin).toBe(0)
    }
  })

  it('faixa 6 termina em 4.800.000 (teto Simples 2026)', () => {
    for (const [, faixas] of Object.entries(SIMPLES_TABLES)) {
      expect(faixas[5].rbaMax).toBe(4_800_000)
    }
  })

  it('alíquotas são crescentes por faixa em todos anexos', () => {
    for (const [anexo, faixas] of Object.entries(SIMPLES_TABLES)) {
      for (let i = 0; i < faixas.length - 1; i++) {
        expect(faixas[i].aliquota).toBeLessThanOrEqual(faixas[i + 1].aliquota)
      }
    }
  })
})

describe('Valores específicos LC 123/2006 (sanidade)', () => {
  it('ANEXO_I faixa 1: 4%', () => {
    expect(SIMPLES_TABLES.ANEXO_I[0].aliquota).toBe(4.0)
  })
  it('ANEXO_III faixa 1: 6%', () => {
    expect(SIMPLES_TABLES.ANEXO_III[0].aliquota).toBe(6.0)
  })
  it('ANEXO_III faixa 3 (360k-720k): 13.5% + deduz 17.640', () => {
    const f = SIMPLES_TABLES.ANEXO_III[2]
    expect(f.aliquota).toBe(13.5)
    expect(f.deduzir).toBe(17_640)
  })
  it('ANEXO_V faixa 1: 15.5% (alíquota alta sem Fator R)', () => {
    expect(SIMPLES_TABLES.ANEXO_V[0].aliquota).toBe(15.5)
  })
  it('Teto = R$ 4,8M', () => {
    expect(SIMPLES_LIMITE_RBA_2026).toBe(4_800_000)
  })
  it('Threshold Fator R = 28%', () => {
    expect(FATOR_R_THRESHOLD).toBe(0.28)
  })
})

describe('findFaixa', () => {
  it('RBA 0 → faixa 1', () => {
    expect(findFaixa('ANEXO_III', 0)?.faixa).toBe(1)
  })

  it('RBA 50k → faixa 1 (Anexo III)', () => {
    const f = findFaixa('ANEXO_III', 50_000)
    expect(f?.faixa).toBe(1)
    expect(f?.aliquota).toBe(6.0)
  })

  it('RBA 180.001 → faixa 2', () => {
    expect(findFaixa('ANEXO_III', 180_001)?.faixa).toBe(2)
  })

  it('RBA exatamente em rbaMax cai na faixa que tem esse rbaMax', () => {
    // 180_000 deve cair na faixa 1 (rbaMax=180k, condição rba <= rbaMax)
    expect(findFaixa('ANEXO_III', 180_000)?.faixa).toBe(1)
  })

  it('RBA 600k → faixa 3', () => {
    expect(findFaixa('ANEXO_III', 600_000)?.faixa).toBe(3)
  })

  it('RBA 4.7M → faixa 6', () => {
    expect(findFaixa('ANEXO_III', 4_700_000)?.faixa).toBe(6)
  })

  it('RBA > 4.8M → null (estourou teto)', () => {
    expect(findFaixa('ANEXO_III', 4_800_001)).toBeNull()
  })

  it('RBA negativa → null (defesa)', () => {
    expect(findFaixa('ANEXO_III', -1)).toBeNull()
  })
})
