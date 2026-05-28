// Sprint Comparativo-A — Testes do refactor multi-período.
//
// Cobre buildPeriodos (mes/tri/ano), calcularMediaHistorica (exclui ref),
// calcularDesvio, classifyCellTone (semântica IBCS + intensidade), e
// computeComparativoMulti (cenário Yussef profit sao borja).

import { describe, it, expect } from 'vitest'
import {
  buildPeriodos,
  calcularMediaHistorica,
  calcularDesvio,
  classifyCellTone,
  computeComparativoMulti,
  filterRowsMulti,
  getTrendVisualSemantic,
  CELL_TONE_CLASSES,
  type ComparativoInputTx,
} from '@/lib/relatorios/comparativo'

const cat = (
  id: string,
  name: string,
  bucketDate: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT' = 'DEBIT',
  dreGroup: string | null = 'DESPESAS_PESSOAL',
): ComparativoInputTx => ({
  bucketDate: new Date(bucketDate),
  amount,
  type,
  categoryId: id,
  categoryName: name,
  dreGroup,
})

describe('buildPeriodos — granularidade mês', () => {
  it('3 meses ref Mar/26 → [Jan, Fev, Mar]', () => {
    const p = buildPeriodos('2026-03', 3, 'mes')
    expect(p.map((x) => x.id)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(p.map((x) => x.label)).toEqual(['Jan/26', 'Fev/26', 'Mar/26'])
  })

  it('6 meses ref Mar/26 → [Out/25 a Mar/26]', () => {
    const p = buildPeriodos('2026-03', 6, 'mes')
    expect(p.map((x) => x.id)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('12 meses ref Mai/26 → [Jun/25 a Mai/26]', () => {
    const p = buildPeriodos('2026-05', 12, 'mes')
    expect(p).toHaveLength(12)
    expect(p[0].id).toBe('2025-06')
    expect(p[11].id).toBe('2026-05')
  })

  it('start/end UTC corretos do primeiro bucket', () => {
    const p = buildPeriodos('2026-03', 1, 'mes')
    expect(p[0].start.getUTCFullYear()).toBe(2026)
    expect(p[0].start.getUTCMonth()).toBe(2) // mar=2
    expect(p[0].start.getUTCDate()).toBe(1)
    expect(p[0].end.getUTCDate()).toBe(31)
    expect(p[0].end.getUTCHours()).toBe(23)
  })

  it('rejeita nPeriodos < 1 ou > 12', () => {
    expect(() => buildPeriodos('2026-03', 0, 'mes')).toThrow()
    expect(() => buildPeriodos('2026-03', 13, 'mes')).toThrow()
  })
})

describe('buildPeriodos — granularidade trimestre', () => {
  it('1 tri ref Mai/26 → Q2/26 (Abr-Jun)', () => {
    const p = buildPeriodos('2026-05', 1, 'trimestre')
    expect(p[0].id).toBe('2026-Q2')
    expect(p[0].label).toBe('Q2/26')
    expect(p[0].start.getUTCMonth()).toBe(3) // Abr
    expect(p[0].end.getUTCMonth()).toBe(5) // Jun
  })

  it('4 tri ref Mar/26 → [Q2/25, Q3/25, Q4/25, Q1/26]', () => {
    const p = buildPeriodos('2026-03', 4, 'trimestre')
    expect(p.map((x) => x.id)).toEqual([
      '2025-Q2',
      '2025-Q3',
      '2025-Q4',
      '2026-Q1',
    ])
  })

  it('Q1 ano novo virada', () => {
    const p = buildPeriodos('2026-02', 2, 'trimestre')
    expect(p[0].id).toBe('2025-Q4')
    expect(p[1].id).toBe('2026-Q1')
  })
})

describe('buildPeriodos — granularidade ano', () => {
  it('3 anos ref Mar/26 → [2024, 2025, 2026]', () => {
    const p = buildPeriodos('2026-03', 3, 'ano')
    expect(p.map((x) => x.id)).toEqual(['2024', '2025', '2026'])
    expect(p.map((x) => x.label)).toEqual(['2024', '2025', '2026'])
  })

  it('1 ano = só ano de ref', () => {
    const p = buildPeriodos('2026-12', 1, 'ano')
    expect(p[0].id).toBe('2026')
    expect(p[0].start.getUTCMonth()).toBe(0)
    expect(p[0].end.getUTCMonth()).toBe(11)
  })
})

describe('calcularMediaHistorica (exclui último/ref)', () => {
  it('6 valores [10,20,30,40,50,99] → média de 5 anteriores = 30', () => {
    expect(calcularMediaHistorica([10, 20, 30, 40, 50, 99])).toBe(30)
  })

  it('2 valores [100, 50] → média = 100 (só o primeiro)', () => {
    expect(calcularMediaHistorica([100, 50])).toBe(100)
  })

  it('1 valor → null (sem anteriores)', () => {
    expect(calcularMediaHistorica([42])).toBeNull()
  })

  it('vazio → null', () => {
    expect(calcularMediaHistorica([])).toBeNull()
  })

  it('média 0 → null (sem base de comparação)', () => {
    expect(calcularMediaHistorica([0, 0, 100])).toBeNull()
  })
})

describe('calcularDesvio', () => {
  it('current 41 sobre média 31.8 → +28.9%', () => {
    const r = calcularDesvio(41, 31.8)
    expect(r).toBeCloseTo(0.289, 2)
  })

  it('current 100, média 80 → +25%', () => {
    expect(calcularDesvio(100, 80)).toBeCloseTo(0.25, 5)
  })

  it('current 60, média 80 → -25%', () => {
    expect(calcularDesvio(60, 80)).toBeCloseTo(-0.25, 5)
  })

  it('média null → null', () => {
    expect(calcularDesvio(100, null)).toBeNull()
  })

  it('média 0 → null', () => {
    expect(calcularDesvio(100, 0)).toBeNull()
  })
})

describe('classifyCellTone — semântica IBCS', () => {
  it('DESPESA acima da média = desfavorável (vermelho)', () => {
    // value 120, média 100 → +20% = unfav-weak
    expect(classifyCellTone(120, 100, 'DESPESA')).toBe('unfav-weak')
  })

  it('DESPESA abaixo da média = favorável (verde)', () => {
    // value 70, média 100 → -30% = fav-weak
    expect(classifyCellTone(70, 100, 'DESPESA')).toBe('fav-weak')
  })

  it('RECEITA acima da média = favorável (verde)', () => {
    expect(classifyCellTone(120, 100, 'RECEITA')).toBe('fav-weak')
  })

  it('RECEITA abaixo da média = desfavorável (vermelho)', () => {
    expect(classifyCellTone(70, 100, 'RECEITA')).toBe('unfav-weak')
  })

  it('intensidade weak (15-40%)', () => {
    expect(classifyCellTone(125, 100, 'DESPESA')).toBe('unfav-weak') // +25%
    expect(classifyCellTone(140, 100, 'DESPESA')).toBe('unfav-medium') // +40% boundary → medium
  })

  it('intensidade medium (40-80%)', () => {
    expect(classifyCellTone(150, 100, 'DESPESA')).toBe('unfav-medium') // +50%
    expect(classifyCellTone(175, 100, 'DESPESA')).toBe('unfav-medium') // +75%
  })

  it('intensidade strong (>80%)', () => {
    expect(classifyCellTone(180, 100, 'DESPESA')).toBe('unfav-strong') // +80% exato
    expect(classifyCellTone(250, 100, 'DESPESA')).toBe('unfav-strong') // +150%
  })

  it('|desvio| < 15% = transparent', () => {
    expect(classifyCellTone(105, 100, 'DESPESA')).toBe('transparent') // +5%
    expect(classifyCellTone(90, 100, 'DESPESA')).toBe('transparent') // -10%
    expect(classifyCellTone(114, 100, 'DESPESA')).toBe('transparent') // +14%
  })

  it('média null = transparent', () => {
    expect(classifyCellTone(100, null, 'DESPESA')).toBe('transparent')
  })

  it('cenário Yussef: Folha 45k vs média 30k = +50% = unfav-medium', () => {
    expect(classifyCellTone(45000, 30000, 'DESPESA')).toBe('unfav-medium')
  })
})

describe('CELL_TONE_CLASSES — Tailwind safelist', () => {
  it('todos os 7 tones têm classe', () => {
    expect(Object.keys(CELL_TONE_CLASSES)).toHaveLength(7)
    expect(CELL_TONE_CLASSES['fav-strong']).toContain('emerald-200')
    expect(CELL_TONE_CLASSES['unfav-strong']).toContain('red-200')
  })

  it('transparent é string vazia', () => {
    expect(CELL_TONE_CLASSES.transparent).toBe('')
  })
})

describe('getTrendVisualSemantic — cor por (indicator × tipo)', () => {
  it('DESPESA UP_STRONG = vermelho', () => {
    const v = getTrendVisualSemantic('UP_STRONG', 'DESPESA')
    expect(v.colorClass).toContain('red')
  })

  it('RECEITA UP_STRONG = verde (favorável)', () => {
    const v = getTrendVisualSemantic('UP_STRONG', 'RECEITA')
    expect(v.colorClass).toContain('emerald')
  })

  it('DESPESA DOWN = verde (favorável)', () => {
    const v = getTrendVisualSemantic('DOWN', 'DESPESA')
    expect(v.colorClass).toContain('emerald')
  })

  it('RECEITA DOWN = vermelho (desfavorável)', () => {
    const v = getTrendVisualSemantic('DOWN', 'RECEITA')
    expect(v.colorClass).toContain('red')
  })

  it('STABLE não muda com tipo (slate em ambos)', () => {
    const dDespesa = getTrendVisualSemantic('STABLE', 'DESPESA')
    const dReceita = getTrendVisualSemantic('STABLE', 'RECEITA')
    expect(dDespesa).toEqual(dReceita)
  })

  it('NEW é purple em ambos os tipos', () => {
    expect(getTrendVisualSemantic('NEW', 'DESPESA').colorClass).toContain('purple')
    expect(getTrendVisualSemantic('NEW', 'RECEITA').colorClass).toContain('purple')
  })
})

describe('computeComparativoMulti — cenário Yussef profit sao borja 6 meses', () => {
  // Folha: 28,29,30,29,31,45 (último mês é +41% da média 29.4)
  const FOLHA_VALUES = [28_000, 29_000, 30_000, 29_000, 31_000, 45_000]
  // Aluguel: 18,18,18,18,18,18 (estável)
  const ALUGUEL_VALUES = [18_000, 18_000, 18_000, 18_000, 18_000, 18_000]
  const meses = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']

  function buildTxs(): ComparativoInputTx[] {
    const txs: ComparativoInputTx[] = []
    FOLHA_VALUES.forEach((amt, i) => {
      txs.push(cat('folha', 'Salários', `${meses[i]}-15T12:00:00.000Z`, amt))
    })
    ALUGUEL_VALUES.forEach((amt, i) => {
      txs.push(
        cat('aluguel', 'Aluguel', `${meses[i]}-15T12:00:00.000Z`, amt, 'DEBIT', 'DESPESAS_ADMINISTRATIVAS'),
      )
    })
    return txs
  }

  it('Folha mês 6 (45k) vira unfav-medium vs média 29.4k (+53%)', () => {
    const r = computeComparativoMulti(buildTxs(), {
      ymRef: '2026-03',
      nPeriodos: 6,
      granularidade: 'mes',
      tipo: 'DESPESA',
    })
    const folha = r.rows.find((x) => x.categoryId === 'folha')!
    expect(folha.values).toEqual(FOLHA_VALUES)
    expect(folha.mediaHistorica).toBeCloseTo(29_400, 0)
    expect(folha.desvioPct).toBeCloseTo(0.53, 1)
    expect(folha.cellTones[5]).toBe('unfav-medium')
  })

  it('Aluguel estável: nenhuma célula colorida', () => {
    const r = computeComparativoMulti(buildTxs(), {
      ymRef: '2026-03',
      nPeriodos: 6,
      granularidade: 'mes',
      tipo: 'DESPESA',
    })
    const aluguel = r.rows.find((x) => x.categoryId === 'aluguel')!
    expect(aluguel.cellTones).toEqual(Array(6).fill('transparent'))
  })

  it('summary.foraDaMedia conta DESPESA com desvio > +15%', () => {
    const r = computeComparativoMulti(buildTxs(), {
      ymRef: '2026-03',
      nPeriodos: 6,
      granularidade: 'mes',
      tipo: 'DESPESA',
    })
    expect(r.summary.foraDaMedia).toBe(1) // só Folha (Aluguel estável)
  })

  it('totals.porPeriodo soma todas categorias por mês', () => {
    const r = computeComparativoMulti(buildTxs(), {
      ymRef: '2026-03',
      nPeriodos: 6,
      granularidade: 'mes',
      tipo: 'DESPESA',
    })
    expect(r.totals.porPeriodo[0]).toBe(28_000 + 18_000) // mês 0
    expect(r.totals.porPeriodo[5]).toBe(45_000 + 18_000) // mês 5
  })

  it('ordenação: maior total primeiro', () => {
    const r = computeComparativoMulti(buildTxs(), {
      ymRef: '2026-03',
      nPeriodos: 6,
      granularidade: 'mes',
      tipo: 'DESPESA',
    })
    expect(r.rows[0].categoryId).toBe('folha') // 192k > 108k
    expect(r.rows[1].categoryId).toBe('aluguel')
  })

  it('granularidade ano agrupa Mar/26 → bucket único 2026', () => {
    const txs = [cat('a', 'A', '2026-03-15T12:00:00.000Z', 1000)]
    const r = computeComparativoMulti(txs, {
      ymRef: '2026-03',
      nPeriodos: 1,
      granularidade: 'ano',
      tipo: 'DESPESA',
    })
    expect(r.periodos).toHaveLength(1)
    expect(r.periodos[0].id).toBe('2026')
    expect(r.rows[0].values[0]).toBe(1000)
  })

  it('regime tipo RECEITA filtra só CREDITs', () => {
    const txs = [
      cat('1', 'Despesa A', '2026-02-15T12:00:00.000Z', 1000, 'DEBIT'),
      cat('2', 'Receita A', '2026-02-15T12:00:00.000Z', 5000, 'CREDIT'),
      cat('1', 'Despesa A', '2026-03-15T12:00:00.000Z', 1500, 'DEBIT'),
      cat('2', 'Receita A', '2026-03-15T12:00:00.000Z', 5000, 'CREDIT'),
    ]
    const r = computeComparativoMulti(txs, {
      ymRef: '2026-03',
      nPeriodos: 2,
      granularidade: 'mes',
      tipo: 'RECEITA',
    })
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].categoryId).toBe('2')
  })
})

describe('filterRowsMulti', () => {
  // Helper: cria row já pronta
  const rowOf = (id: string, indicator: string, values: number[] = [0, 100]) =>
    ({
      categoryId: id,
      categoryName: id,
      dreGroup: null,
      values,
      mediaHistorica: 0,
      desvioPct: null,
      total: values.reduce((a, b) => a + b, 0),
      trend: { indicator, percentVsPrev1: null, percentVsPrev2: null },
      cellTones: values.map(() => 'transparent'),
    }) as never

  it('ALL retorna tudo', () => {
    const rows = [rowOf('a', 'UP'), rowOf('b', 'DOWN'), rowOf('c', 'STABLE')]
    expect(filterRowsMulti(rows, 'ALL')).toHaveLength(3)
  })

  it('UP_ONLY pega UP e UP_STRONG', () => {
    const rows = [
      rowOf('a', 'UP'),
      rowOf('b', 'UP_STRONG'),
      rowOf('c', 'STABLE'),
    ]
    expect(filterRowsMulti(rows, 'UP_ONLY')).toHaveLength(2)
  })

  it('NEW_ONLY pega só NEW', () => {
    const rows = [rowOf('a', 'NEW'), rowOf('b', 'UP'), rowOf('c', 'NEW')]
    expect(filterRowsMulti(rows, 'NEW_ONLY')).toHaveLength(2)
  })
})
