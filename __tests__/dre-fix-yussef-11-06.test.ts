// Testes do fix do DRE — Yussef 11/06/2026
//
// Cobertura:
// 1. Regime CAIXA com fallback paymentDate → date (OFX importada sem paymentDate)
// 2. Default regime cash (validation schema)
// 3. Caso TOZZO simulado: Excel + ADJ entram, OFX-pai já filtrada upstream
// 4. Caso N:1 (CIA DA FRUTA): 7 Excel filhas entram, OFX-pai filtrada
// 5. Caso ADJ Juros: entra com categoria DESPESAS_FINANCEIRAS, sem duplicar
// 6. Edge: tx sem date e sem paymentDate é ignorada
// 7. Anti-duplicação simulada: engine não vê OFX-pai porque filtro Prisma a remove

import { describe, it, expect } from 'vitest'
import { calculateDRE } from '../lib/dre/calculator'
import type { CategoryForDRE, TransactionForDRE } from '../lib/dre/types'
import { dreQuerySchema } from '../lib/dre/validation'

const cat = (id: string, dreGroup: string): CategoryForDRE => ({
  id, name: id, code: null, dreGroup, parentId: null, isActive: true, type: 'DEBIT',
})

const PERIODO_JUN = {
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-30'),
  regime: 'cash' as const,
}

describe('Fix DRE Yussef 11/06 — regime caixa default + anti-duplicação', () => {

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 1 — Default regime CAIXA
  // ──────────────────────────────────────────────────────────

  it('1. Default regime é cash (validation schema)', () => {
    const parsed = dreQuerySchema.parse({
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-30T00:00:00.000Z',
    })
    expect(parsed.regime).toBe('cash')
  })

  it('1b. Pode opt-in pra competence explicitamente', () => {
    const parsed = dreQuerySchema.parse({
      startDate: '2026-06-01T00:00:00.000Z',
      endDate: '2026-06-30T00:00:00.000Z',
      regime: 'competence',
    })
    expect(parsed.regime).toBe('competence')
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 2 — Caso TOZZO simulado pós-filtro
  // (Excel R$ 1.165,50 + ADJ R$ 25,63; OFX-pai R$ 1.191,13 filtrada upstream)
  // ──────────────────────────────────────────────────────────

  it('2. Caso TOZZO: Excel + ADJ entram somando OFX, sem duplicar', () => {
    const cats = [
      cat('cat-materia-prima', 'OUTRAS_DESPESAS'),
      cat('cat-juros', 'DESPESAS_FINANCEIRAS'),
    ]
    // Filtro Prisma já EXCLUI a OFX-pai conciliada (origin=OFX + rec link null +
    // reconciledFrom apontando pra ela). Engine só vê Excel + ADJ.
    const txs: TransactionForDRE[] = [
      {
        id: 'excel-tozzo',
        type: 'DEBIT',
        amount: 1165.50,
        date: new Date('2026-06-11'),
        competenceDate: null,             // intencionalmente null (planilha errada)
        paymentDate: new Date('2026-06-11'),
        categoryId: 'cat-materia-prima',
      },
      {
        id: 'adj-tozzo',
        type: 'DEBIT',
        amount: 25.63,
        date: new Date('2026-06-11'),
        competenceDate: null,
        paymentDate: new Date('2026-06-11'),
        categoryId: 'cat-juros',
      },
    ]
    const result = calculateDRE(txs, cats, { period: PERIODO_JUN })

    // Soma das despesas: Excel R$ 1.165,50 + ADJ R$ 25,63 = R$ 1.191,13
    // (= OFX exato, sem duplicar)
    const totalDespesas = (
      result.totals.totalOutrasDespesas + result.totals.despesasFinanceiras
    )
    expect(totalDespesas).toBeCloseTo(1191.13, 2)
    // Granularidade preservada: Juros separado
    expect(result.totals.despesasFinanceiras).toBeCloseTo(25.63, 2)
    expect(result.totals.totalOutrasDespesas).toBeCloseTo(1165.50, 2)
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 3 — Caso N:1 CIA DA FRUTA simulado
  // ──────────────────────────────────────────────────────────

  it('3. Caso N:1 CIA DA FRUTA: 7 Excel entram, OFX-pai filtrada', () => {
    const cats = [cat('cat-mp', 'OUTRAS_DESPESAS')]
    // 7 Excel filhas pareadas com 1 OFX (cuja soma bate exata).
    // Filtro Prisma já removeu a OFX-pai. Engine só vê as 7 Excel.
    const valoresExcel = [1222.21, 951.15, 924.43, 435.81, 409.00, 350.71, 282.85]
    const txs: TransactionForDRE[] = valoresExcel.map((amt, i) => ({
      id: `excel-${i}`,
      type: 'DEBIT',
      amount: amt,
      date: new Date('2026-06-08'),
      competenceDate: null,
      paymentDate: new Date('2026-06-08'),
      categoryId: 'cat-mp',
    }))
    const result = calculateDRE(txs, cats, { period: PERIODO_JUN })

    // Soma: R$ 4.576,16 (igual ao valor único da OFX-pai original).
    expect(result.totals.totalOutrasDespesas).toBeCloseTo(4576.16, 2)
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 4 — OFX órfã (sem par) com paymentDate null + date jun
  // ──────────────────────────────────────────────────────────

  it('4. OFX órfã sem paymentDate entra via fallback date', () => {
    const cats = [cat('cat-misc', 'OUTRAS_DESPESAS')]
    const txs: TransactionForDRE[] = [
      {
        id: 'ofx-orfa',
        type: 'DEBIT',
        amount: 100,
        date: new Date('2026-06-15'),     // data do extrato bancário
        competenceDate: null,
        paymentDate: null,                  // OFX não preenche
        categoryId: 'cat-misc',
      },
    ]
    const result = calculateDRE(txs, cats, { period: PERIODO_JUN })

    expect(result.totals.totalOutrasDespesas).toBe(100)
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 5 — Edge: tx sem date e sem paymentDate (lixo) → ignorada
  // ──────────────────────────────────────────────────────────

  it('5. Edge: tx sem date e sem paymentDate é ignorada (cash)', () => {
    const cats = [cat('c1', 'OUTRAS_DESPESAS')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1',
        type: 'DEBIT',
        amount: 100,
        // @ts-expect-error simulando tx malformada
        date: null,
        competenceDate: null,
        paymentDate: null,
        categoryId: 'c1',
      },
    ]
    const result = calculateDRE(txs, cats, { period: PERIODO_JUN })
    expect(result.totals.totalOutrasDespesas).toBe(0)
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 6 — Competence inalterado (sem regressão)
  // ──────────────────────────────────────────────────────────

  it('6. Regime competence continua usando competenceDate (sem regressão)', () => {
    const cats = [cat('c1', 'OUTRAS_DESPESAS')]
    const txs: TransactionForDRE[] = [
      {
        id: 't1', type: 'DEBIT', amount: 500,
        date: new Date('2026-06-15'),
        competenceDate: new Date('2026-05-15'),  // MAI
        paymentDate: new Date('2026-06-15'),
        categoryId: 'c1',
      },
    ]
    const periodoMai = {
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      regime: 'competence' as const,
    }
    const result = calculateDRE(txs, cats, { period: periodoMai })
    // Entra MAI pelo competenceDate (regime competence inalterado)
    expect(result.totals.totalOutrasDespesas).toBe(500)
  })

  // ──────────────────────────────────────────────────────────
  // CENÁRIO 7 — Comparação caixa: 11 Excel com competenceDate errado
  // ──────────────────────────────────────────────────────────

  it('7. 11 Excel com competenceDate=mai mas paymentDate=jun entram em JUN (caixa)', () => {
    const cats = [cat('cat-mp', 'OUTRAS_DESPESAS')]
    // Simula as 11 Excel reais com competenceDate errado (planilha) e
    // paymentDate jun (real). Regime caixa = ignora competence errado.
    const txs: TransactionForDRE[] = [
      { id: 'lat1', type: 'DEBIT', amount: 4269.27, date: new Date('2026-06-08'), competenceDate: new Date('2026-04-30'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'tur', type: 'DEBIT', amount: 979.37, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-04'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'casp1', type: 'DEBIT', amount: 1852.09, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-13'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'park1', type: 'DEBIT', amount: 1257.62, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-14'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'lat2', type: 'DEBIT', amount: 5312.80, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-15'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'casp2', type: 'DEBIT', amount: 1934.24, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-20'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'park2', type: 'DEBIT', amount: 667.35, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-21'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'dist', type: 'DEBIT', amount: 1198.40, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-26'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'casp3', type: 'DEBIT', amount: 3393.18, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-27'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'spal', type: 'DEBIT', amount: 3445.95, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-29'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
      { id: 'carl', type: 'DEBIT', amount: 452.56, date: new Date('2026-06-08'), competenceDate: new Date('2026-05-29'), paymentDate: new Date('2026-06-08'), categoryId: 'cat-mp' },
    ]
    const result = calculateDRE(txs, cats, { period: PERIODO_JUN })

    // Total: R$ 24.762,83 (todas em jun via paymentDate, competence errado ignorado)
    expect(result.totals.totalOutrasDespesas).toBeCloseTo(24762.83, 2)
  })
})
