// Sprint 5.0.2.c — Testes search com aliases + filtro ramo + ícones.

import { describe, it, expect } from 'vitest'
import {
  searchCNAEs,
  countCNAEsByRamo,
  RAMO_ICONS,
  ALL_CNAES,
} from '@/lib/tax/expertise'

describe('Aliases — busca por sinônimo coloquial', () => {
  it('"churrascaria" encontra restaurante 5611-2/01', () => {
    const r = searchCNAEs('churrascaria')
    expect(r.some((c) => c.code === '5611-2/01')).toBe(true)
  })

  it('"hamburguer" encontra hamburgueria 1091-1/02', () => {
    const r = searchCNAEs('hamburguer')
    expect(r.some((c) => c.code === '1091-1/02')).toBe(true)
  })

  it('"pizza" encontra pizzaria 5620-1/01', () => {
    const r = searchCNAEs('pizza')
    expect(r.some((c) => c.code === '5620-1/01')).toBe(true)
  })

  it('"smart fit" encontra academia 9313-1/00', () => {
    const r = searchCNAEs('smart fit')
    expect(r.some((c) => c.code === '9313-1/00')).toBe(true)
  })

  it('"crossfit" encontra ensino esportes 8591-1/00', () => {
    const r = searchCNAEs('crossfit')
    expect(r.some((c) => c.code === '8591-1/00')).toBe(true)
  })

  it('"loja roupa" encontra vestuário 4781-4/00', () => {
    const r = searchCNAEs('loja roupa')
    expect(r.some((c) => c.code === '4781-4/00')).toBe(true)
  })

  it('"renner" encontra vestuário (brand alias)', () => {
    const r = searchCNAEs('renner')
    expect(r.some((c) => c.code === '4781-4/00')).toBe(true)
  })

  it('"havaianas" encontra calçados 4782-2/01', () => {
    const r = searchCNAEs('havaianas')
    expect(r.some((c) => c.code === '4782-2/01')).toBe(true)
  })

  it('"musculacao" (sem acento) encontra academia', () => {
    const r = searchCNAEs('musculacao')
    expect(r.some((c) => c.code === '9313-1/00')).toBe(true)
  })

  it('"PIZZA" maiúsculas funciona (case-insensitive)', () => {
    const r = searchCNAEs('PIZZA')
    expect(r.some((c) => c.code === '5620-1/01')).toBe(true)
  })

  it('busca "lanche" pega 5611-2/03 (lanchonete) E 1091-1/02 (fast food)', () => {
    const r = searchCNAEs('lanche')
    expect(r.some((c) => c.code === '5611-2/03')).toBe(true)
    expect(r.some((c) => c.code === '1091-1/02')).toBe(true)
  })
})

describe('Filtro por ramo', () => {
  it('ramo=RESTAURANTE retorna só 8 CNAEs do ramo', () => {
    const r = searchCNAEs('', 50, 'RESTAURANTE')
    expect(r).toHaveLength(8)
    expect(r.every((c) => c.ramo === 'RESTAURANTE')).toBe(true)
  })

  it('ramo=ACADEMIA + query "personal" retorna 9319-1/01', () => {
    const r = searchCNAEs('personal', 20, 'ACADEMIA')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((c) => c.ramo === 'ACADEMIA')).toBe(true)
  })

  it('ramo=COMERCIO_ROUPA + query "esportivo" retorna 4789-0/01', () => {
    const r = searchCNAEs('esportivo', 20, 'COMERCIO_ROUPA')
    expect(r.some((c) => c.code === '4789-0/01')).toBe(true)
  })

  it('query que match cross-ramo é filtrada pelo ramo', () => {
    // "esportivo" aparece em ACADEMIA (gestão) e COMERCIO_ROUPA (artigos)
    const academia = searchCNAEs('esportivo', 50, 'ACADEMIA')
    const comercio = searchCNAEs('esportivo', 50, 'COMERCIO_ROUPA')
    expect(academia.every((c) => c.ramo === 'ACADEMIA')).toBe(true)
    expect(comercio.every((c) => c.ramo === 'COMERCIO_ROUPA')).toBe(true)
  })
})

describe('Ícones e contagens', () => {
  it('Todos os 19 CNAEs têm ícone definido', () => {
    expect(ALL_CNAES.every((c) => typeof c.icon === 'string' && c.icon.length > 0)).toBe(true)
  })

  it('Todos os 19 CNAEs têm pelo menos 1 alias', () => {
    expect(ALL_CNAES.every((c) => (c.aliases?.length ?? 0) > 0)).toBe(true)
  })

  it('countCNAEsByRamo retorna 8/5/6', () => {
    const c = countCNAEsByRamo()
    expect(c.RESTAURANTE).toBe(8)
    expect(c.ACADEMIA).toBe(5)
    expect(c.COMERCIO_ROUPA).toBe(6)
  })

  it('RAMO_ICONS tem entry pra cada ramo', () => {
    expect(RAMO_ICONS.RESTAURANTE).toBeTruthy()
    expect(RAMO_ICONS.ACADEMIA).toBeTruthy()
    expect(RAMO_ICONS.COMERCIO_ROUPA).toBeTruthy()
  })
})

describe('Edge cases', () => {
  it('query vazia + ramo=null retorna todos até o limit', () => {
    const r = searchCNAEs('', 5)
    expect(r).toHaveLength(5)
  })

  it('query inexistente retorna []', () => {
    const r = searchCNAEs('qwertyxyz123')
    expect(r).toHaveLength(0)
  })

  it('busca com espaço extra trim funciona', () => {
    const r = searchCNAEs('  pizza  ')
    expect(r.some((c) => c.code === '5620-1/01')).toBe(true)
  })
})
