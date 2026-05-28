// Sprint Análise de Variação (28/05/2026) — Testes engine pura.

import { describe, it, expect } from 'vitest'
import {
  agregarPorCategoria,
  classificarDriver,
  decompor,
  buildWaterfallBars,
  analiseVariacao,
} from '@/lib/relatorios/analise-variacao'
import {
  parseRefMonth,
  type ComparativoInputTx,
} from '@/lib/relatorios/comparativo'

function tx(
  id: string,
  name: string,
  bucketDate: string,
  amount: number,
  type: 'DEBIT' | 'CREDIT' = 'DEBIT',
): ComparativoInputTx {
  return {
    bucketDate: new Date(bucketDate),
    amount,
    type,
    categoryId: id,
    categoryName: name,
    dreGroup: null,
  }
}

describe('agregarPorCategoria', () => {
  it('soma transactions por categoria dentro do bucket', () => {
    const bucket = parseRefMonth('2026-01')
    const txs = [
      tx('1', 'Salários', '2026-01-15T12:00:00.000Z', 10000),
      tx('1', 'Salários', '2026-01-20T12:00:00.000Z', 5000),
      tx('2', 'Aluguel', '2026-01-10T12:00:00.000Z', 8000),
    ]
    const r = agregarPorCategoria(txs, bucket, 'DESPESA')
    expect(r).toHaveLength(2)
    const salarios = r.find((c) => c.categoryId === '1')!
    expect(salarios.totalNoBucket).toBe(15000)
  })

  it('ignora txs fora do bucket', () => {
    const bucket = parseRefMonth('2026-01')
    const txs = [
      tx('1', 'A', '2026-01-15T12:00:00.000Z', 100),
      tx('2', 'B', '2026-02-15T12:00:00.000Z', 200), // fora
    ]
    const r = agregarPorCategoria(txs, bucket, 'DESPESA')
    expect(r).toHaveLength(1)
  })

  it('filtra por tipo DESPESA (só DEBIT)', () => {
    const bucket = parseRefMonth('2026-01')
    const txs = [
      tx('1', 'Despesa', '2026-01-15T12:00:00.000Z', 100, 'DEBIT'),
      tx('2', 'Receita', '2026-01-15T12:00:00.000Z', 500, 'CREDIT'),
    ]
    const r = agregarPorCategoria(txs, bucket, 'DESPESA')
    expect(r).toHaveLength(1)
    expect(r[0].categoryId).toBe('1')
  })

  it('filtra por tipo RECEITA (só CREDIT)', () => {
    const bucket = parseRefMonth('2026-01')
    const txs = [
      tx('1', 'Despesa', '2026-01-15T12:00:00.000Z', 100, 'DEBIT'),
      tx('2', 'Receita', '2026-01-15T12:00:00.000Z', 500, 'CREDIT'),
    ]
    const r = agregarPorCategoria(txs, bucket, 'RECEITA')
    expect(r).toHaveLength(1)
    expect(r[0].categoryId).toBe('2')
  })
})

describe('classificarDriver', () => {
  it('aumentou: valor sobe acima do threshold', () => {
    expect(classificarDriver(1000, 500)).toBe('aumentou')
  })

  it('reduziu: valor desce abaixo do threshold', () => {
    expect(classificarDriver(500, 1000)).toBe('reduziu')
  })

  it('novo: existia=0 e investigado>0', () => {
    expect(classificarDriver(500, 0)).toBe('novo')
  })

  it('sumiu: investigado=0 mas existia antes', () => {
    expect(classificarDriver(0, 500)).toBe('sumiu')
  })

  it('estavel: |diferenca| < threshold R$ 100', () => {
    expect(classificarDriver(1050, 1000)).toBe('estavel')
    expect(classificarDriver(1000, 1050)).toBe('estavel')
  })

  it('estavel ambos zero', () => {
    expect(classificarDriver(0, 0)).toBe('estavel')
  })

  it('threshold customizado', () => {
    expect(classificarDriver(100, 50, 30)).toBe('aumentou')
    expect(classificarDriver(100, 50, 100)).toBe('estavel')
  })
})

describe('decompor — ordenação e join de categorias', () => {
  const inv = [
    { categoryId: 'a', categoryName: 'A', dreGroup: null, totalNoBucket: 1000 },
    { categoryId: 'b', categoryName: 'B', dreGroup: null, totalNoBucket: 500 },
    { categoryId: 'c', categoryName: 'C', dreGroup: null, totalNoBucket: 200 },
  ]
  const cmp = [
    { categoryId: 'a', categoryName: 'A', dreGroup: null, totalNoBucket: 800 },
    { categoryId: 'b', categoryName: 'B', dreGroup: null, totalNoBucket: 700 },
    { categoryId: 'd', categoryName: 'D', dreGroup: null, totalNoBucket: 300 },
  ]

  it('drivers ordenados por |diferenca| DESC', () => {
    const r = decompor(inv, cmp)
    // A: 1000-800 = +200
    // B: 500-700 = -200
    // C: 200-0 = +200 (novo)
    // D: 0-300 = -300 (sumiu) → maior em |abs|
    expect(r[0].categoryId).toBe('d') // |−300|
    // empate ABS=200: ordena alfabético A → B → C
    expect(r[1].categoryId).toBe('a')
    expect(r[2].categoryId).toBe('b')
    expect(r[3].categoryId).toBe('c')
  })

  it('categoria nova (não estava na comparação)', () => {
    const r = decompor(inv, cmp)
    const c = r.find((d) => d.categoryId === 'c')!
    expect(c.tipo).toBe('novo')
    expect(c.valorComparacao).toBe(0)
    expect(c.diferenca).toBe(200)
    expect(c.percentual).toBeNull() // comparacao = 0
  })

  it('categoria que sumiu', () => {
    const r = decompor(inv, cmp)
    const d = r.find((row) => row.categoryId === 'd')!
    expect(d.tipo).toBe('sumiu')
    expect(d.valorInvestigado).toBe(0)
    expect(d.diferenca).toBe(-300)
  })

  it('percentual calculado corretamente quando comparacao > 0', () => {
    const r = decompor(inv, cmp)
    const a = r.find((d) => d.categoryId === 'a')!
    expect(a.percentual).toBeCloseTo(0.25, 2) // +25%
  })
})

describe('buildWaterfallBars — estrutura Recharts-ready', () => {
  it('primeira e última barras são totais (tipo inicio/fim)', () => {
    const drivers = [
      {
        categoryId: 'a',
        categoryName: 'A',
        dreGroup: null,
        valorInvestigado: 1500,
        valorComparacao: 1000,
        diferenca: 500,
        percentual: 0.5,
        tipo: 'aumentou' as const,
      },
    ]
    const bars = buildWaterfallBars(drivers, 1000, 1500, 'Mar/26', 'Fev/26')
    expect(bars[0].tipo).toBe('inicio')
    expect(bars[0].value).toBe(1000)
    expect(bars[bars.length - 1].tipo).toBe('fim')
    expect(bars[bars.length - 1].value).toBe(1500)
  })

  it('driver positivo: barra de aumento sobe da cumulative', () => {
    const drivers = [
      {
        categoryId: 'a',
        categoryName: 'A',
        dreGroup: null,
        valorInvestigado: 1500,
        valorComparacao: 1000,
        diferenca: 500,
        percentual: 0.5,
        tipo: 'aumentou' as const,
      },
    ]
    const bars = buildWaterfallBars(drivers, 1000, 1500, 'Mar/26', 'Fev/26')
    const aumento = bars.find((b) => b.tipo === 'aumento')!
    expect(aumento.base).toBe(1000)
    expect(aumento.value).toBe(500)
    expect(aumento.end).toBe(1500)
    expect(aumento.delta).toBe(500)
  })

  it('driver negativo: barra de redução desce', () => {
    const drivers = [
      {
        categoryId: 'a',
        categoryName: 'A',
        dreGroup: null,
        valorInvestigado: 500,
        valorComparacao: 1000,
        diferenca: -500,
        percentual: -0.5,
        tipo: 'reduziu' as const,
      },
    ]
    const bars = buildWaterfallBars(drivers, 1000, 500, 'Mar/26', 'Fev/26')
    const reducao = bars.find((b) => b.tipo === 'reducao')!
    expect(reducao.base).toBe(500) // 1000 - 500
    expect(reducao.value).toBe(500) // magnitude positiva
    expect(reducao.end).toBe(1000) // termina onde estava
    expect(reducao.delta).toBe(-500) // delta negativo preservado
  })

  it('top N + Outros agrupa drivers além do limite', () => {
    // 14 drivers com diff 100, 200, ..., 1400 (ignora drivers c/ diff=0)
    const drivers = Array.from({ length: 14 }, (_, i) => ({
      categoryId: `c${i}`,
      categoryName: `Cat ${i}`,
      dreGroup: null,
      valorInvestigado: 1100 + i * 100,
      valorComparacao: 1000,
      diferenca: (i + 1) * 100, // 100, 200, ..., 1400
      percentual: 0.1 * (i + 1),
      tipo: 'aumentou' as const,
    }))
    const totalDiff = drivers.reduce((s, d) => s + d.diferenca, 0)
    const bars = buildWaterfallBars(drivers, 1000, 1000 + totalDiff, 'Mar', 'Fev', 10)
    const outros = bars.find((b) => b.isOutros)
    expect(outros).toBeDefined()
    expect(outros!.tipo).toBe('aumento')
    // Outros agrega drivers do top 10 em diante: drivers[10..13] = 1100+1200+1300+1400 = 5000
    const restoDelta = drivers.slice(10).reduce((s, d) => s + d.diferenca, 0)
    expect(outros!.delta).toBe(restoDelta)
  })

  it('sem Outros quando drivers <= topN', () => {
    const drivers = [
      {
        categoryId: 'a',
        categoryName: 'A',
        dreGroup: null,
        valorInvestigado: 1500,
        valorComparacao: 1000,
        diferenca: 500,
        percentual: 0.5,
        tipo: 'aumentou' as const,
      },
    ]
    const bars = buildWaterfallBars(drivers, 1000, 1500, 'Mar', 'Fev', 10)
    expect(bars.find((b) => b.isOutros)).toBeUndefined()
  })

  it('drivers com |diferenca| < 0.01 são excluídos do waterfall', () => {
    const drivers = [
      {
        categoryId: 'a',
        categoryName: 'A',
        dreGroup: null,
        valorInvestigado: 1000.001,
        valorComparacao: 1000,
        diferenca: 0.001, // < tolerância
        percentual: null,
        tipo: 'estavel' as const,
      },
    ]
    const bars = buildWaterfallBars(drivers, 1000, 1000.001, 'Mar', 'Fev')
    // Só barras inicio + fim (driver com diff 0.001 excluído)
    expect(bars).toHaveLength(2)
    expect(bars[0].tipo).toBe('inicio')
    expect(bars[1].tipo).toBe('fim')
  })
})

describe('analiseVariacao — engine completa', () => {
  // Cenário Yussef: Jan/26 vs Fev/26 profit
  // Jan/26: IRPJ 56k + CSLL 22k + Salários comuns 100k = 178k (extras)
  // Fev/26: só Salários 100k
  function buildScenario(): ComparativoInputTx[] {
    return [
      // Janeiro
      tx('irpj', 'IRPJ', '2026-01-15T12:00:00.000Z', 56507),
      tx('csll', 'CSLL', '2026-01-15T12:00:00.000Z', 22737),
      tx('salarios', 'Salários', '2026-01-15T12:00:00.000Z', 100000),
      tx('aluguel', 'Aluguel', '2026-01-15T12:00:00.000Z', 20000),
      // Fevereiro
      tx('salarios', 'Salários', '2026-02-15T12:00:00.000Z', 95000),
      tx('aluguel', 'Aluguel', '2026-02-15T12:00:00.000Z', 20000),
    ]
  }

  it('mes-vs-mes: aritmética fecha (soma drivers = diferenca total)', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.aritmeticaFecha).toBe(true)
    expect(r.aritmeticaResiduo).toBeLessThan(0.01)
  })

  it('mes-vs-mes: total investigado = soma das categorias', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.totalInvestigado).toBe(56507 + 22737 + 100000 + 20000)
    expect(r.totalComparacao).toBe(95000 + 20000)
  })

  it('mes-vs-mes: IRPJ e CSLL aparecem como "novo" (só no investigado)', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    const irpj = r.drivers.find((d) => d.categoryId === 'irpj')!
    expect(irpj.tipo).toBe('novo')
    expect(irpj.diferenca).toBe(56507)
  })

  it('mes-vs-mes: drivers ordenados — Salários, IRPJ, CSLL (por |impacto|)', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    // Salários: 100k-95k = +5k
    // IRPJ: 56507 (novo)
    // CSLL: 22737 (novo)
    // Aluguel: 20k-20k = 0 → estavel, não aparece no top
    expect(r.drivers[0].categoryId).toBe('irpj') // 56507
    expect(r.drivers[1].categoryId).toBe('csll') // 22737
    expect(r.drivers[2].categoryId).toBe('salarios') // 5000
  })

  it('mes-vs-mes: meses NÃO consecutivos funcionam (Jan vs Mai)', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'Cat A', '2026-01-15T12:00:00.000Z', 1000),
      tx('a', 'Cat A', '2026-05-15T12:00:00.000Z', 3000),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-05',
      tipo: 'DESPESA',
    })
    expect(r.totalInvestigado).toBe(1000)
    expect(r.totalComparacao).toBe(3000)
    expect(r.diferencaTotal).toBe(-2000)
    expect(r.drivers[0].categoryId).toBe('a')
  })

  it('mes-vs-mes: waterfallBars começa com comparacao e termina com investigado', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.waterfallBars[0].tipo).toBe('inicio')
    expect(r.waterfallBars[0].value).toBe(r.totalComparacao)
    const fim = r.waterfallBars[r.waterfallBars.length - 1]
    expect(fim.tipo).toBe('fim')
    expect(fim.value).toBe(r.totalInvestigado)
  })

  it('mes-vs-media: usa média dos N-1 meses anteriores ignorando zeros', () => {
    // Investigado: Mar/26 com salários=200, IRPJ=100
    // Anteriores (Fev/Jan/Dez/Nov/Out — N=6 → 5 anteriores):
    //   Fev: salarios=100
    //   Jan: salarios=100
    //   Dez: salarios=0 (zerado — ignora)
    //   Nov: 0
    //   Out: 0
    // Média Salários = (100+100)/2 = 100 (ignora 3 zeros)
    // Diferenca Salários = 200-100 = +100
    const txs: ComparativoInputTx[] = [
      tx('salarios', 'Salários', '2026-03-15T12:00:00.000Z', 200),
      tx('irpj', 'IRPJ', '2026-03-15T12:00:00.000Z', 100),
      tx('salarios', 'Salários', '2026-02-15T12:00:00.000Z', 100),
      tx('salarios', 'Salários', '2026-01-15T12:00:00.000Z', 100),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-media',
      txs,
      mesInvestigado: '2026-03',
      nMesesContexto: 6,
      tipo: 'DESPESA',
    })
    const salarios = r.drivers.find((d) => d.categoryId === 'salarios')!
    expect(salarios.valorComparacao).toBe(100) // média dos 2 meses com valor (ignora 3 zeros)
    expect(salarios.diferenca).toBe(100)
  })

  it('mes-vs-media: comparacaoLabel descreve a média', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'A', '2026-03-15T12:00:00.000Z', 100),
      tx('a', 'A', '2026-02-15T12:00:00.000Z', 50),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-media',
      txs,
      mesInvestigado: '2026-03',
      nMesesContexto: 6,
      tipo: 'DESPESA',
    })
    expect(r.comparacaoLabel).toContain('Média')
    expect(r.comparacaoLabel).toContain('5 meses')
    expect(r.comparacaoLabel).toContain('Março/2026')
  })

  it('percentualTotal calculado corretamente', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'A', '2026-01-15T12:00:00.000Z', 200),
      tx('a', 'A', '2026-02-15T12:00:00.000Z', 100),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.percentualTotal).toBeCloseTo(1.0, 2) // +100%
  })

  it('aritmética fecha mesmo com Outros (top N + resto agrupado)', () => {
    // 15 categorias com pequena diferença
    const txs: ComparativoInputTx[] = []
    for (let i = 0; i < 15; i++) {
      txs.push(tx(`c${i}`, `Cat ${i}`, '2026-01-15T12:00:00.000Z', 1000 + i * 100))
      txs.push(tx(`c${i}`, `Cat ${i}`, '2026-02-15T12:00:00.000Z', 1000))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesInvestigado: '2026-01',
      ymComparacao: '2026-02',
      tipo: 'DESPESA',
      topNDrivers: 10,
    })
    // Total aritmético deve fechar mesmo com Outros agrupando 5 categorias
    expect(r.aritmeticaFecha).toBe(true)
    // Tem barra Outros
    const outros = r.waterfallBars.find((b) => b.isOutros)
    expect(outros).toBeDefined()
  })
})
