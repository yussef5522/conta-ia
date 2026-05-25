// Sprint 5.0.2.c.2 — Testes do helper deriveActivityFromCNAE.

import { describe, it, expect } from 'vitest'
import { deriveActivityFromCNAE } from '@/lib/tax/derive-activity-from-cnae'

describe('deriveActivityFromCNAE — 19 CNAEs do catálogo expertise', () => {
  describe('Restaurantes (RESTAURANTE)', () => {
    it('5611-2/01 Restaurante → COMERCIO + ICMS', () => {
      const r = deriveActivityFromCNAE('5611-2/01')
      expect(r.presumidoAtividade).toBe('COMERCIO')
      expect(r.hasICMS).toBe(true)
      expect(r.hasISS).toBe(false)
      expect(r.source).toBe('expertise')
    })

    it('1091-1/02 Hamburgueria → COMERCIO + ICMS', () => {
      const r = deriveActivityFromCNAE('1091-1/02')
      expect(r.presumidoAtividade).toBe('COMERCIO')
      expect(r.source).toBe('expertise')
    })

    it('5620-1/01 Pizzaria → COMERCIO + ICMS', () => {
      const r = deriveActivityFromCNAE('5620-1/01')
      expect(r.presumidoAtividade).toBe('COMERCIO')
      expect(r.hasICMS).toBe(true)
    })
  })

  describe('Academias (ACADEMIA)', () => {
    it('9313-1/00 Academia → SERVICOS + ISS', () => {
      const r = deriveActivityFromCNAE('9313-1/00')
      expect(r.presumidoAtividade).toBe('SERVICOS')
      expect(r.hasICMS).toBe(false)
      expect(r.hasISS).toBe(true)
      expect(r.source).toBe('expertise')
    })

    it('8591-1/00 Crossfit → SERVICOS + ISS', () => {
      const r = deriveActivityFromCNAE('8591-1/00')
      expect(r.presumidoAtividade).toBe('SERVICOS')
      expect(r.hasISS).toBe(true)
    })

    it('9319-1/01 Personal → SERVICOS + ISS', () => {
      const r = deriveActivityFromCNAE('9319-1/01')
      expect(r.presumidoAtividade).toBe('SERVICOS')
      expect(r.hasISS).toBe(true)
    })
  })

  describe('Comércio de Roupas (COMERCIO_ROUPA)', () => {
    it('4781-4/00 Vestuário → COMERCIO + ICMS', () => {
      const r = deriveActivityFromCNAE('4781-4/00')
      expect(r.presumidoAtividade).toBe('COMERCIO')
      expect(r.hasICMS).toBe(true)
      expect(r.hasISS).toBe(false)
      expect(r.source).toBe('expertise')
    })

    it('4782-2/01 Calçados → COMERCIO', () => {
      const r = deriveActivityFromCNAE('4782-2/01')
      expect(r.presumidoAtividade).toBe('COMERCIO')
    })
  })
})

describe('deriveActivityFromCNAE — heurística por prefixo (CNAEs livres)', () => {
  it('46 atacado → COMERCIO + ICMS', () => {
    const r = deriveActivityFromCNAE('4612-5/00')
    expect(r.presumidoAtividade).toBe('COMERCIO')
    expect(r.hasICMS).toBe(true)
    expect(r.source).toBe('prefix-heuristic')
  })

  it('10-33 indústria → INDUSTRIA + ICMS', () => {
    const r = deriveActivityFromCNAE('1411-8/01')
    expect(r.presumidoAtividade).toBe('INDUSTRIA')
    expect(r.hasICMS).toBe(true)
    expect(r.source).toBe('prefix-heuristic')
  })

  it('41 construção → CONSTRUCAO_CIVIL + ISS', () => {
    const r = deriveActivityFromCNAE('4120-4/00')
    expect(r.presumidoAtividade).toBe('CONSTRUCAO_CIVIL')
    expect(r.hasISS).toBe(true)
    expect(r.source).toBe('prefix-heuristic')
  })

  it('4912 transporte ferroviário passageiros', () => {
    const r = deriveActivityFromCNAE('4912-4/00')
    expect(r.presumidoAtividade).toBe('TRANSPORTE_PASSAGEIROS')
  })

  it('4923 transporte rodoviário passageiros', () => {
    const r = deriveActivityFromCNAE('4923-0/02')
    expect(r.presumidoAtividade).toBe('TRANSPORTE_PASSAGEIROS')
  })

  it('4930 transporte rodoviário cargas (heurística cargas default)', () => {
    const r = deriveActivityFromCNAE('4930-2/02')
    // 49 mas não 4912/4921-4929 → cai em TRANSPORTE_CARGAS
    expect(r.presumidoAtividade).toBe('TRANSPORTE_CARGAS')
  })

  it('4731 revenda combustíveis', () => {
    const r = deriveActivityFromCNAE('4731-8/00')
    expect(r.presumidoAtividade).toBe('REVENDA_COMBUSTIVEIS')
  })

  it('8610 hospitalar → SERVICOS_HOSPITALARES + ISS', () => {
    const r = deriveActivityFromCNAE('8610-1/01')
    expect(r.presumidoAtividade).toBe('SERVICOS_HOSPITALARES')
    expect(r.hasISS).toBe(true)
  })

  it('7020 consultoria → SERVICOS + ISS (heurística genérica)', () => {
    const r = deriveActivityFromCNAE('7020-4/00')
    expect(r.presumidoAtividade).toBe('SERVICOS')
    expect(r.hasISS).toBe(true)
  })
})

describe('deriveActivityFromCNAE — fallback', () => {
  it('null → SERVICOS fallback', () => {
    const r = deriveActivityFromCNAE(null)
    expect(r.presumidoAtividade).toBe('SERVICOS')
    expect(r.source).toBe('fallback')
  })

  it('undefined → SERVICOS fallback', () => {
    const r = deriveActivityFromCNAE(undefined)
    expect(r.source).toBe('fallback')
  })

  it('string vazia → SERVICOS fallback', () => {
    const r = deriveActivityFromCNAE('')
    expect(r.source).toBe('fallback')
  })

  it('código com 1 dígito → fallback', () => {
    const r = deriveActivityFromCNAE('5')
    expect(r.source).toBe('fallback')
  })

  it('código não numérico puro → tenta heurística com dígitos restantes', () => {
    const r = deriveActivityFromCNAE('5611-X/00')
    // 5611 → não bate catálogo (não é canonical), mas prefixo 56 → SERVICOS heurística
    expect(['SERVICOS', 'COMERCIO']).toContain(r.presumidoAtividade)
  })
})
