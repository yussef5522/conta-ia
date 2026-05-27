// Sprint 5.0.2.1 — isEmpresaZerada (puro).

import { describe, it, expect } from 'vitest'
import { isEmpresaZerada } from '@/lib/contas-pagar/empty-state'

describe('isEmpresaZerada — empresa SEM contas + filtro padrão', () => {
  it('PENDING + sem vencidas + KPIs zerados → mostra empty state de descoberta (CTA Import)', () => {
    expect(
      isEmpresaZerada({
        status: 'PENDING',
        vencidasOnly: false,
        kpis: { countPendente: 0, countVencido: 0 },
      }),
    ).toBe(true)
  })
})

describe('isEmpresaZerada — empresa COM contas mas filtro não bate', () => {
  it('PENDING + sem vencidas + alguma conta pendente (mas filtro listou 0) → empty state verde, NÃO descoberta', () => {
    // Cenário: kpis dizem 5 pendentes, mas filtro adicional zerou os 5.
    // Esse caso na verdade NÃO acontece com nosso modelo (PENDING agrega
    // mesma coisa), mas o helper é defensivo.
    expect(
      isEmpresaZerada({
        status: 'PENDING',
        vencidasOnly: false,
        kpis: { countPendente: 5, countVencido: 0 },
      }),
    ).toBe(false)
  })

  it('Empresa tem só vencidas → KPI vencido >0 → empty state verde', () => {
    expect(
      isEmpresaZerada({
        status: 'PENDING',
        vencidasOnly: false,
        kpis: { countPendente: 0, countVencido: 3 },
      }),
    ).toBe(false)
  })
})

describe('isEmpresaZerada — filtro NÃO-padrão (não dispara descoberta)', () => {
  it('Status RECONCILED + KPIs zerados → empty state verde (não CTA)', () => {
    // Filtro custom — usuário sabe o que está fazendo
    expect(
      isEmpresaZerada({
        status: 'RECONCILED',
        vencidasOnly: false,
        kpis: { countPendente: 0, countVencido: 0 },
      }),
    ).toBe(false)
  })

  it('Status IGNORED + KPIs zerados → empty state verde', () => {
    expect(
      isEmpresaZerada({
        status: 'IGNORED',
        vencidasOnly: false,
        kpis: { countPendente: 0, countVencido: 0 },
      }),
    ).toBe(false)
  })

  it('TODOS + KPIs zerados → empty state verde (não-padrão)', () => {
    expect(
      isEmpresaZerada({
        status: 'TODOS',
        vencidasOnly: false,
        kpis: { countPendente: 0, countVencido: 0 },
      }),
    ).toBe(false)
  })

  it('PENDING + só vencidas + KPIs zerados → empty state verde', () => {
    expect(
      isEmpresaZerada({
        status: 'PENDING',
        vencidasOnly: true,
        kpis: { countPendente: 0, countVencido: 0 },
      }),
    ).toBe(false)
  })
})
