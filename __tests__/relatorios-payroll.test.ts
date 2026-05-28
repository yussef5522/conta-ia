// Sprint 5.0.4.0b Fase 5 — Testes Folha (puros).

import { describe, it, expect } from 'vitest'
import { computePayroll } from '@/lib/relatorios/payroll'

describe('computePayroll', () => {
  const employees = [
    { id: 'e1', nome: 'João CLT', tipo: 'CLT', ativo: true },
    { id: 'e2', nome: 'Maria CLT', tipo: 'CLT', ativo: true },
    { id: 'e3', nome: 'Pedro Estágio', tipo: 'ESTAGIO', ativo: true },
    { id: 'e4', nome: 'Ana PJ', tipo: 'PJ', ativo: true },
    { id: 'e5', nome: 'Demitido', tipo: 'CLT', ativo: false },
  ]

  it('ordena rows por amount desc', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e2', amount: 4800, count: 1 },
        { employeeId: 'e1', amount: 5200, count: 1 },
        { employeeId: 'e3', amount: 1250, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.rows.map((x) => x.nome)).toEqual([
      'João CLT',
      'Maria CLT',
      'Pedro Estágio',
    ])
  })

  it('calcula totais corretamente', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e1', amount: 5000, count: 1 },
        { employeeId: 'e2', amount: 4000, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.totals.valorTotal).toBe(9000)
    expect(r.totals.funcionariosPagos).toBe(2)
    expect(r.totals.funcionariosAtivos).toBe(4)
    expect(r.totals.mediaPorFuncionario).toBe(4500)
  })

  it('breakdown por tipo agregado corretamente', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e1', amount: 5000, count: 1 },
        { employeeId: 'e2', amount: 4500, count: 1 },
        { employeeId: 'e3', amount: 1500, count: 1 },
        { employeeId: 'e4', amount: 8000, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    const clt = r.byType.find((t) => t.tipo === 'CLT')!
    const estagio = r.byType.find((t) => t.tipo === 'ESTAGIO')!
    const pj = r.byType.find((t) => t.tipo === 'PJ')!
    expect(clt.count).toBe(2)
    expect(clt.amount).toBe(9500)
    expect(estagio.count).toBe(1)
    expect(estagio.amount).toBe(1500)
    expect(pj.amount).toBe(8000)
  })

  it('byType ordenado por amount desc', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e3', amount: 1500, count: 1 },
        { employeeId: 'e1', amount: 5000, count: 1 },
        { employeeId: 'e4', amount: 8000, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.byType.map((t) => t.tipo)).toEqual(['PJ', 'CLT', 'ESTAGIO'])
  })

  it('percent do tipo soma 100%', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e1', amount: 5000, count: 1 },
        { employeeId: 'e3', amount: 5000, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    const sum = r.byType.reduce((s, t) => s + t.percent, 0)
    expect(sum).toBeCloseTo(100, 1)
  })

  it('funcionário com pagamento mas demitido (inativo) entra com flag', () => {
    const r = computePayroll({
      aggregated: [{ employeeId: 'e5', amount: 2500, count: 1 }],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.rows[0].ativo).toBe(false)
    expect(r.rows[0].nome).toBe('Demitido')
  })

  it('funcionário sem metadata usa fallback', () => {
    const r = computePayroll({
      aggregated: [{ employeeId: 'unknown-id', amount: 1000, count: 1 }],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.rows[0].nome).toBe('Funcionário sem nome')
    expect(r.rows[0].tipo).toBe('OUTRO')
  })

  it('lista vazia mas com ativos cadastrados retorna metadata', () => {
    const r = computePayroll({
      aggregated: [],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.rows).toHaveLength(0)
    expect(r.totals.valorTotal).toBe(0)
    expect(r.totals.funcionariosPagos).toBe(0)
    expect(r.totals.funcionariosAtivos).toBe(4)
    expect(r.totals.mediaPorFuncionario).toBe(0)
  })

  it('percentDoTotal de cada row soma 100%', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e1', amount: 3000, count: 1 },
        { employeeId: 'e2', amount: 3000, count: 1 },
        { employeeId: 'e3', amount: 4000, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    const sum = r.rows.reduce((s, row) => s + row.percentDoTotal, 0)
    expect(sum).toBeCloseTo(100, 1)
  })

  it('count total de transações soma corretamente', () => {
    const r = computePayroll({
      aggregated: [
        { employeeId: 'e1', amount: 5000, count: 1 },
        { employeeId: 'e2', amount: 4500, count: 2 }, // 2 pagamentos
        { employeeId: 'e3', amount: 1500, count: 1 },
      ],
      employees,
      totalFuncionariosAtivos: 4,
    })
    expect(r.totals.transacoesCount).toBe(4)
  })

  it('cenário Yussef: 21 funcionários, R$ 138.496', () => {
    const aggs = Array.from({ length: 21 }, (_, i) => ({
      employeeId: `emp-${i}`,
      amount: 138_496 / 21,
      count: 1,
    }))
    const r = computePayroll({
      aggregated: aggs,
      employees: aggs.map((a, i) => ({
        id: a.employeeId,
        nome: `Func ${i}`,
        tipo: i < 18 ? 'CLT' : i < 20 ? 'PJ' : 'ESTAGIO',
        ativo: true,
      })),
      totalFuncionariosAtivos: 21,
    })
    expect(r.totals.funcionariosPagos).toBe(21)
    expect(r.totals.valorTotal).toBeCloseTo(138_496, 0)
    const clt = r.byType.find((t) => t.tipo === 'CLT')!
    expect(clt.count).toBe(18)
  })
})
