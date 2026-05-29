// Sprint Drill-Down (29/05/2026) — Testes das funções puras do modal.

import { describe, it, expect } from 'vitest'
import {
  formatDataBR,
  buildContasPagarHref,
  filterTransacoes,
  sortTransacoes,
  type DrillDownTransacao,
} from '@/components/relatorios/drill-down/TransacaoDrillDownModal'

function tx(
  overrides: Partial<DrillDownTransacao> = {},
): DrillDownTransacao {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    bucketDate: '2026-01-15T12:00:00.000Z',
    date: '2026-01-15T12:00:00.000Z',
    competenceDate: '2026-01-15T12:00:00.000Z',
    paymentDate: null,
    description: 'Pagamento ACME',
    type: 'DEBIT',
    amount: 1000,
    signedAmount: -1000,
    favorecido: 'ACME Ltda',
    favorecidoTipo: 'supplier',
    lifecycle: 'EFFECTED',
    status: 'RECONCILED',
    ...overrides,
  }
}

describe('Drill-Down helpers — formatDataBR', () => {
  it('converte ISO YYYY-MM-DD → DD/MM/YYYY UTC', () => {
    expect(formatDataBR('2026-01-15T12:00:00.000Z')).toBe('15/01/2026')
  })

  it('respeita UTC (não shift de timezone)', () => {
    // Mesmo no início do dia UTC, retorna dia 1
    expect(formatDataBR('2026-12-01T00:00:00.000Z')).toBe('01/12/2026')
  })

  it('pad zero em dia/mês single-digit', () => {
    expect(formatDataBR('2026-03-05T12:00:00.000Z')).toBe('05/03/2026')
  })
})

describe('Drill-Down helpers — buildContasPagarHref (Yussef Ajuste 2)', () => {
  it('inclui empresaId + search + janela ±1d do bucketDate', () => {
    const t = tx({
      bucketDate: '2026-03-15T12:00:00.000Z',
      favorecido: 'Acme Ltda',
    })
    const href = buildContasPagarHref('emp-1', t)
    const url = new URL(href, 'http://localhost')
    expect(url.pathname).toBe('/contas-a-pagar')
    expect(url.searchParams.get('empresaId')).toBe('emp-1')
    expect(url.searchParams.get('search')).toBe('Acme Ltda')
    expect(url.searchParams.get('dataDe')).toBe('2026-03-14')
    expect(url.searchParams.get('dataAte')).toBe('2026-03-16')
  })

  it('omite search quando favorecido é null', () => {
    const t = tx({ favorecido: null })
    const href = buildContasPagarHref('emp-1', t)
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.has('search')).toBe(false)
    expect(url.searchParams.get('empresaId')).toBe('emp-1')
    expect(url.searchParams.has('dataDe')).toBe(true)
  })

  it('janela ±1d cruza fim de mês corretamente', () => {
    const t = tx({ bucketDate: '2026-01-31T12:00:00.000Z' })
    const href = buildContasPagarHref('emp-1', t)
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('dataDe')).toBe('2026-01-30')
    expect(url.searchParams.get('dataAte')).toBe('2026-02-01')
  })

  it('janela ±1d cruza virada de ano', () => {
    const t = tx({ bucketDate: '2026-12-31T12:00:00.000Z' })
    const href = buildContasPagarHref('emp-1', t)
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('dataDe')).toBe('2026-12-30')
    expect(url.searchParams.get('dataAte')).toBe('2027-01-01')
  })
})

describe('Drill-Down helpers — filterTransacoes (Yussef Ajuste 1)', () => {
  const txs = [
    tx({ id: '1', description: 'Aluguel Sala', favorecido: 'Imobiliária X', lifecycle: 'EFFECTED' }),
    tx({ id: '2', description: 'Internet', favorecido: 'Vivo', lifecycle: 'EFFECTED' }),
    tx({ id: '3', description: 'Material limpeza', favorecido: 'ACME', lifecycle: 'PAYABLE' }),
    tx({ id: '4', description: 'Reforma', favorecido: null, lifecycle: 'RECEIVABLE' }),
  ]

  it('estado="todas" + busca vazia retorna tudo', () => {
    const r = filterTransacoes(txs, 'todas', '')
    expect(r).toHaveLength(4)
  })

  it('estado="pagas" filtra só EFFECTED', () => {
    const r = filterTransacoes(txs, 'pagas', '')
    expect(r).toHaveLength(2)
    expect(r.every((t) => t.lifecycle === 'EFFECTED')).toBe(true)
  })

  it('estado="pendentes" filtra PAYABLE + RECEIVABLE', () => {
    const r = filterTransacoes(txs, 'pendentes', '')
    expect(r).toHaveLength(2)
    expect(r.every((t) => t.lifecycle !== 'EFFECTED')).toBe(true)
  })

  it('busca filtra por descrição (case-insensitive)', () => {
    const r = filterTransacoes(txs, 'todas', 'aluguel')
    expect(r).toHaveLength(1)
    expect(r[0].description).toBe('Aluguel Sala')
  })

  it('busca filtra por favorecido (case-insensitive)', () => {
    const r = filterTransacoes(txs, 'todas', 'vivo')
    expect(r).toHaveLength(1)
    expect(r[0].favorecido).toBe('Vivo')
  })

  it('busca com favorecido null não quebra', () => {
    const r = filterTransacoes(txs, 'todas', 'reforma')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('4')
  })

  it('combina estado + busca', () => {
    const r = filterTransacoes(txs, 'pendentes', 'acme')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('3')
  })

  it('busca trimada (espaços extras não atrapalham)', () => {
    const r = filterTransacoes(txs, 'todas', '   ALUGUEL  ')
    expect(r).toHaveLength(1)
  })
})

describe('Drill-Down helpers — sortTransacoes', () => {
  const txs = [
    tx({ id: 'A', bucketDate: '2026-01-10T12:00:00Z', amount: 500 }),
    tx({ id: 'B', bucketDate: '2026-01-20T12:00:00Z', amount: 2000 }),
    tx({ id: 'C', bucketDate: '2026-01-15T12:00:00Z', amount: 1000 }),
  ]

  it('data-desc: mais recente primeiro', () => {
    const r = sortTransacoes(txs, 'data-desc')
    expect(r.map((t) => t.id)).toEqual(['B', 'C', 'A'])
  })

  it('valor-desc: maior valor primeiro', () => {
    const r = sortTransacoes(txs, 'valor-desc')
    expect(r.map((t) => t.id)).toEqual(['B', 'C', 'A'])
  })

  it('não muta o array original', () => {
    const original = [...txs]
    sortTransacoes(txs, 'valor-desc')
    expect(txs).toEqual(original)
  })
})

describe('Drill-Down helpers — combinação filtro + sort (pipeline real)', () => {
  const txs = [
    tx({ id: 'A', amount: 500, bucketDate: '2026-01-10T12:00:00Z', lifecycle: 'EFFECTED', description: 'Aluguel' }),
    tx({ id: 'B', amount: 2000, bucketDate: '2026-01-20T12:00:00Z', lifecycle: 'PAYABLE', description: 'Aluguel' }),
    tx({ id: 'C', amount: 1000, bucketDate: '2026-01-15T12:00:00Z', lifecycle: 'EFFECTED', description: 'Internet' }),
    tx({ id: 'D', amount: 800, bucketDate: '2026-01-25T12:00:00Z', lifecycle: 'EFFECTED', description: 'Aluguel' }),
  ]

  it('pagas + busca "aluguel" + valor-desc → [A:500] (B é PAYABLE, fora)', () => {
    const filtered = filterTransacoes(txs, 'pagas', 'aluguel')
    const sorted = sortTransacoes(filtered, 'valor-desc')
    expect(sorted.map((t) => t.id)).toEqual(['D', 'A']) // D=800, A=500
  })

  it('pendentes + sem busca + data-desc → só B', () => {
    const filtered = filterTransacoes(txs, 'pendentes', '')
    const sorted = sortTransacoes(filtered, 'data-desc')
    expect(sorted.map((t) => t.id)).toEqual(['B'])
  })

  it('todas + busca vazia + data-desc → ordem cronológica reversa completa', () => {
    const filtered = filterTransacoes(txs, 'todas', '')
    const sorted = sortTransacoes(filtered, 'data-desc')
    expect(sorted.map((t) => t.id)).toEqual(['D', 'B', 'C', 'A'])
  })
})
