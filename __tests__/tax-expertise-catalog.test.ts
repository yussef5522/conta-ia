// Sprint 5.0.2.b — Validação do catálogo de expertise (3 ramos).

import { describe, it, expect } from 'vitest'
import {
  ALL_CNAES,
  ALL_EXPERTISE,
  CNAES_RESTAURANTES,
  CNAES_ACADEMIAS,
  CNAES_COMERCIO_ROUPA,
  EXPERTISE_RESTAURANTES,
  EXPERTISE_ACADEMIAS,
  EXPERTISE_COMERCIO_ROUPA,
  findCNAE,
  expertiseForCNAE,
  searchCNAEs,
  RAMO_LABELS,
} from '@/lib/tax/expertise'

describe('Catálogo CNAEs (volumes)', () => {
  it('Restaurantes tem 8 CNAEs', () => {
    expect(CNAES_RESTAURANTES).toHaveLength(8)
  })
  it('Academias tem 5 CNAEs', () => {
    expect(CNAES_ACADEMIAS).toHaveLength(5)
  })
  it('Comércio Roupa tem 6 CNAEs', () => {
    expect(CNAES_COMERCIO_ROUPA).toHaveLength(6)
  })
  it('Total 19 CNAEs', () => {
    expect(ALL_CNAES).toHaveLength(19)
  })
  it('Todos os CNAEs únicos (sem dup)', () => {
    const codes = ALL_CNAES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('Expertise por ramo (sanidade)', () => {
  it('Restaurantes tem Anexo I + benefício PERSE + ICMS-ST', () => {
    expect(EXPERTISE_RESTAURANTES.anexoPreferido).toBe('ANEXO_I')
    const tipos = EXPERTISE_RESTAURANTES.beneficios.map((b) => b.tipo)
    expect(tipos).toContain('PROGRAMA_PERSE')
    expect(tipos).toContain('ICMS_ST')
    expect(tipos).toContain('PIS_COFINS_MONOFASICO')
  })

  it('Academias tem Anexo III preferido + Fator R EXTREMA', () => {
    expect(EXPERTISE_ACADEMIAS.anexoPreferido).toBe('ANEXO_III')
    expect(EXPERTISE_ACADEMIAS.fatorRAnalysis?.importancia).toContain('EXTREMA')
    expect(EXPERTISE_ACADEMIAS.aliquotaSeFatorR_OK).toBe(6.0)
    expect(EXPERTISE_ACADEMIAS.aliquotaSeFatorR_NAO).toBe(15.5)
  })

  it('Comércio Roupa tem Anexo I + benefícios ICMS-ST + DIFAL', () => {
    expect(EXPERTISE_COMERCIO_ROUPA.anexoPreferido).toBe('ANEXO_I')
    const tipos = EXPERTISE_COMERCIO_ROUPA.beneficios.map((b) => b.tipo)
    expect(tipos).toContain('ICMS_ST_VESTUARIO')
    expect(tipos).toContain('DIFAL_OTIMIZACAO')
    expect(tipos).toContain('NCM_CORRETO')
  })

  it('Todos os 3 ramos têm errosComuns >= 4', () => {
    expect(EXPERTISE_RESTAURANTES.errosComuns.length).toBeGreaterThanOrEqual(4)
    expect(EXPERTISE_ACADEMIAS.errosComuns.length).toBeGreaterThanOrEqual(4)
    expect(EXPERTISE_COMERCIO_ROUPA.errosComuns.length).toBeGreaterThanOrEqual(4)
  })

  it('Todos os 3 ramos têm particularidades >= 4', () => {
    expect(EXPERTISE_RESTAURANTES.particularidades.length).toBeGreaterThanOrEqual(4)
    expect(EXPERTISE_ACADEMIAS.particularidades.length).toBeGreaterThanOrEqual(4)
    expect(EXPERTISE_COMERCIO_ROUPA.particularidades.length).toBeGreaterThanOrEqual(4)
  })

  it('ALL_EXPERTISE tem exatamente 3 entries', () => {
    expect(Object.keys(ALL_EXPERTISE).sort()).toEqual([
      'ACADEMIA',
      'COMERCIO_ROUPA',
      'RESTAURANTE',
    ])
  })

  it('RAMO_LABELS cobre todos os 3 ramos', () => {
    expect(RAMO_LABELS.RESTAURANTE).toBeTruthy()
    expect(RAMO_LABELS.ACADEMIA).toBeTruthy()
    expect(RAMO_LABELS.COMERCIO_ROUPA).toBeTruthy()
  })
})

describe('findCNAE', () => {
  it('encontra Restaurante 5611-2/01', () => {
    const c = findCNAE('5611-2/01')
    expect(c).not.toBeNull()
    expect(c?.ramo).toBe('RESTAURANTE')
    expect(c?.name).toContain('Restaurantes')
  })

  it('encontra Academia 9313-1/00', () => {
    expect(findCNAE('9313-1/00')?.ramo).toBe('ACADEMIA')
  })

  it('encontra Comércio 4781-4/00', () => {
    expect(findCNAE('4781-4/00')?.ramo).toBe('COMERCIO_ROUPA')
  })

  it('retorna null pra CNAE inexistente', () => {
    expect(findCNAE('9999-9/99')).toBeNull()
  })
})

describe('expertiseForCNAE', () => {
  it('Restaurante 5620-1/01 (pizzaria) → expertise RESTAURANTE', () => {
    const e = expertiseForCNAE('5620-1/01')
    expect(e?.ramo).toBe('RESTAURANTE')
    expect(e?.anexoPreferido).toBe('ANEXO_I')
  })

  it('Academia 8591-1/00 (crossfit) → expertise ACADEMIA', () => {
    const e = expertiseForCNAE('8591-1/00')
    expect(e?.ramo).toBe('ACADEMIA')
  })

  it('null para CNAE não cadastrado', () => {
    expect(expertiseForCNAE('0000-0/00')).toBeNull()
  })
})

describe('searchCNAEs', () => {
  it('busca por código parcial "5611" retorna 5 lanchonetes/restaurantes', () => {
    const r = searchCNAEs('5611')
    expect(r.length).toBe(5)
    expect(r.every((c) => c.ramo === 'RESTAURANTE')).toBe(true)
  })

  it('busca por nome "restaurante" retorna restaurantes', () => {
    const r = searchCNAEs('restaurante')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((c) => c.name.toLowerCase().includes('restaurante'))).toBe(true)
  })

  it('busca por "academia" retorna academias', () => {
    const r = searchCNAEs('academia')
    expect(r.some((c) => c.ramo === 'ACADEMIA')).toBe(true)
  })

  it('busca vazia retorna todos até o limit', () => {
    const r = searchCNAEs('', 5)
    expect(r).toHaveLength(5)
  })

  it('busca case-insensitive ("VESTUARIO" = "vestuario")', () => {
    const upper = searchCNAEs('VESTUARIO')
    const lower = searchCNAEs('vestuario')
    expect(upper.length).toBe(lower.length)
  })

  it('busca normalizada (acentuada × sem acento)', () => {
    const semAcento = searchCNAEs('balé')
    const semAcento2 = searchCNAEs('bale')
    expect(semAcento.length).toBeGreaterThan(0)
    expect(semAcento2.length).toBeGreaterThan(0)
  })

  it('limit funciona', () => {
    expect(searchCNAEs('', 3)).toHaveLength(3)
  })

  it('query inexistente retorna array vazio', () => {
    expect(searchCNAEs('xyzwq')).toHaveLength(0)
  })
})
