// Sprint Análise de Variação (28/05/2026) — Testes engine pura.

import { describe, it, expect } from 'vitest'
import {
  agregarPorCategoria,
  classificarDriver,
  computeTabelaHeaders,
  decompor,
  buildWaterfallBars,
  analiseVariacao,
  ordenarCronologicamente,
  selecionarDriversVisuais,
  gerarTituloNarrativo,
  gerarInsightsPrincipais,
  type DriverVariacao,
} from '@/lib/relatorios/analise-variacao'
import {
  parseRefMonth,
  type ComparativoInputTx,
} from '@/lib/relatorios/comparativo'

function driver(
  id: string,
  name: string,
  diferenca: number,
  tipo: DriverVariacao['tipo'] = 'aumentou',
): DriverVariacao {
  return {
    categoryId: id,
    categoryName: name,
    dreGroup: null,
    valorNovo: Math.max(0, diferenca),
    valorAntigo: Math.max(0, -diferenca),
    diferenca,
    percentual: null,
    tipo,
  }
}

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
    expect(c.valorAntigo).toBe(0)
    expect(c.diferenca).toBe(200)
    expect(c.percentual).toBeNull() // comparacao = 0
  })

  it('categoria que sumiu', () => {
    const r = decompor(inv, cmp)
    const d = r.find((row) => row.categoryId === 'd')!
    expect(d.tipo).toBe('sumiu')
    expect(d.valorNovo).toBe(0)
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
        valorNovo: 1500,
        valorAntigo: 1000,
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
        valorNovo: 1500,
        valorAntigo: 1000,
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
        valorNovo: 500,
        valorAntigo: 1000,
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
      valorNovo: 1100 + i * 100,
      valorAntigo: 1000,
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
        valorNovo: 1500,
        valorAntigo: 1000,
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
        valorNovo: 1000.001,
        valorAntigo: 1000,
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

describe('selecionarDriversVisuais — Top 6 + threshold 8% + mín 4 (Hotfix SVG)', () => {
  it('Top 6 (default novo) quando todos passam threshold', () => {
    // Hotfix waterfall SVG: defaults agressivos (topN=6, antes 10).
    // 12 drivers × 10k = 12% cada (acima do 8% threshold). Topo 6 visível.
    const drivers: DriverVariacao[] = Array.from({ length: 12 }, (_, i) =>
      driver(`c${i}`, `Cat ${i}`, 10_000),
    )
    const r = selecionarDriversVisuais(drivers, 100_000)
    expect(r.visiveis).toHaveLength(6)
    expect(r.outrosCount).toBe(6)
  })

  it('Drivers abaixo threshold 8% vão pra outros (mín 4)', () => {
    // Threshold 8% de 100k = 8k. A (60k), B (30k), C (10k) passam.
    // minVisible=4 garante 4 visíveis (acrescenta o próximo maior).
    const drivers: DriverVariacao[] = [
      driver('a', 'A', 60_000),
      driver('b', 'B', 30_000),
      driver('c', 'C', 10_000),
      ...Array.from({ length: 8 }, (_, i) => driver(`p${i}`, `Peq ${i}`, 1_000)),
    ]
    drivers.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca))
    const r = selecionarDriversVisuais(drivers, 100_000)
    expect(r.visiveis).toHaveLength(4) // mín 4
    expect(r.visiveis[0].categoryId).toBe('a')
    expect(r.outrosCount).toBe(7)
  })

  it('Garante mínimo 4 visíveis mesmo abaixo do threshold', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'A', 50_000),
      driver('b', 'B', 30_000),
      driver('c', 'C', 10_000),
      driver('d', 'D', 4_000),
      driver('e', 'E', 3_000),
      driver('f', 'F', 2_000),
      driver('g', 'G', 1_000),
    ]
    const r = selecionarDriversVisuais(drivers, 100_000)
    // Threshold 8k filtra A, B, C (acima). minVisible=4 acrescenta D.
    expect(r.visiveis).toHaveLength(4)
    expect(r.visiveis[3].categoryId).toBe('d') // abaixo do threshold mas visível
  })

  it('Aritmética preservada: visiveis + outros = soma total', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'A', 50_000),
      driver('b', 'B', 20_000),
      driver('c', 'C', 10_000),
      driver('d', 'D', 5_000),
      driver('e', 'E', 3_000),
      driver('f', 'F', 2_000),
      driver('g', 'G', -500),
    ]
    const total = drivers.reduce((s, d) => s + d.diferenca, 0)
    const r = selecionarDriversVisuais(drivers, total)
    const somaVisiveis = r.visiveis.reduce((s, d) => s + d.diferenca, 0)
    expect(somaVisiveis + r.outrosDelta).toBeCloseTo(total, 2)
  })

  it('opts customizadas (topN=5, minImpactPct=0.10)', () => {
    const drivers: DriverVariacao[] = Array.from({ length: 8 }, (_, i) =>
      driver(`c${i}`, `Cat ${i}`, 15_000 - i * 500),
    )
    const r = selecionarDriversVisuais(drivers, 100_000, {
      topN: 5,
      minImpactPct: 0.1,
      minVisible: 3,
    })
    expect(r.visiveis).toHaveLength(5)
    expect(r.outrosCount).toBe(3)
  })

  it('drivers com diff zero excluídos', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'A', 100_000),
      driver('b', 'B', 0),
      driver('c', 'C', 0),
    ]
    const r = selecionarDriversVisuais(drivers, 100_000, { minVisible: 1 })
    expect(r.visiveis).toHaveLength(1)
    expect(r.visiveis[0].categoryId).toBe('a')
  })

  it('zero drivers: result vazio', () => {
    const r = selecionarDriversVisuais([], 0)
    expect(r.visiveis).toHaveLength(0)
    expect(r.outrosCount).toBe(0)
  })
})

describe('gerarTituloNarrativo — McKinsey style', () => {
  it('formato base: mês X custou +R$ Y a mais — A e B 80%', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'IRPJ', 60_000, 'novo'),
      driver('b', 'CSLL', 20_000, 'novo'),
      driver('c', 'Outros', 20_000),
    ]
    const t = gerarTituloNarrativo({
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'Fevereiro/2026',
      diferencaTotal: 100_000,
      drivers,
    })
    expect(t).toContain('Janeiro/2026')
    expect(t).toContain('Fevereiro/2026')
    expect(t).toContain('a mais')
    expect(t).toContain('IRPJ e CSLL')
    expect(t).toContain('80%')
  })

  it('quando diferença é negativa: "a menos"', () => {
    const drivers: DriverVariacao[] = [driver('a', 'A', -50_000, 'reduziu')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Fevereiro/2026',
      antigoLabel: 'Janeiro/2026',
      diferencaTotal: -50_000,
      drivers,
    })
    expect(t).toContain('a menos')
    expect(t).toContain('-')
  })

  it('quando estável (~0): mensagem específica', () => {
    const t = gerarTituloNarrativo({
      novoLabel: 'Mar/26',
      antigoLabel: 'Fev/26',
      diferencaTotal: 0,
      drivers: [],
    })
    expect(t).toContain('estável')
  })

  it('um único driver: usa "respondeu" (singular)', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 100_000, 'novo')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Jan/26',
      antigoLabel: 'Fev/26',
      diferencaTotal: 100_000,
      drivers,
    })
    expect(t).toContain('respondeu')
    expect(t).not.toContain('responderam')
    expect(t).toContain('100%')
  })
})

describe('gerarInsightsPrincipais', () => {
  it('Top 1 driver com tipo "novo": insight "apareceu no mês novo"', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 56_507, 'novo')]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: 56_507,
      visiveis: drivers,
    })
    expect(r[0].tipo).toBe('top-driver')
    expect(r[0].texto).toContain('IRPJ')
    expect(r[0].texto).toContain('apareceu no mês novo')
  })

  it('Top 2 drivers com diferentes tipos', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'IRPJ', 56_000, 'novo'),
      driver('b', 'CSLL', 22_000, 'novo'),
      driver('c', 'Outros', 5_000),
    ]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: 83_000,
      visiveis: drivers,
    })
    expect(r.filter((i) => i.tipo === 'top-driver')).toHaveLength(2)
    expect(r[0].texto).toContain('IRPJ')
    expect(r[1].texto).toContain('CSLL')
  })

  it('Concentração: insight quando top 2 >= 50% do total', () => {
    const drivers: DriverVariacao[] = [
      driver('a', 'A', 50_000),
      driver('b', 'B', 30_000),
      driver('c', 'C', 10_000),
      driver('d', 'D', 5_000),
    ]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: 95_000,
      visiveis: drivers,
    })
    const conc = r.find((i) => i.tipo === 'concentracao')
    expect(conc).toBeDefined()
    expect(conc!.texto).toContain('Top 2')
  })

  it('Hotfix SVG: bullet "X outros drivers" REMOVIDO dos insights', () => {
    // Yussef classificou como ruído. Insights agora só top-driver + concentracao.
    const visiveis = [driver('a', 'A', 50_000), driver('b', 'B', 30_000)]
    const drivers = [
      ...visiveis,
      driver('c', 'C', 10_000),
      driver('d', 'D', 5_000),
      driver('e', 'E', 4_000),
    ]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: 99_000,
      visiveis,
    })
    const outros = r.find((i) => i.tipo === 'outros')
    expect(outros).toBeUndefined() // bullet "X outros drivers" removido
  })

  it('zero drivers: insights vazios', () => {
    const r = gerarInsightsPrincipais({
      drivers: [],
      diferencaTotal: 0,
      visiveis: [],
    })
    expect(r).toHaveLength(0)
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
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
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
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.totalNovo).toBe(56507 + 22737 + 100000 + 20000)
    expect(r.totalAntigo).toBe(95000 + 20000)
  })

  it('mes-vs-mes: IRPJ e CSLL aparecem como "novo" (só no investigado)', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
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
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
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
      mesNovo: '2026-01',
      mesAntigo: '2026-05',
      tipo: 'DESPESA',
    })
    expect(r.totalNovo).toBe(1000)
    expect(r.totalAntigo).toBe(3000)
    expect(r.diferencaTotal).toBe(-2000)
    expect(r.drivers[0].categoryId).toBe('a')
  })

  it('mes-vs-mes: waterfallBars começa com comparacao e termina com investigado', () => {
    const txs = buildScenario()
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.waterfallBars[0].tipo).toBe('inicio')
    expect(r.waterfallBars[0].value).toBe(r.totalAntigo)
    const fim = r.waterfallBars[r.waterfallBars.length - 1]
    expect(fim.tipo).toBe('fim')
    expect(fim.value).toBe(r.totalNovo)
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
      mesNovo: '2026-03',
      nMesesContexto: 6,
      tipo: 'DESPESA',
    })
    const salarios = r.drivers.find((d) => d.categoryId === 'salarios')!
    expect(salarios.valorAntigo).toBe(100) // média dos 2 meses com valor (ignora 3 zeros)
    expect(salarios.diferenca).toBe(100)
  })

  it('mes-vs-media: antigoLabel descreve a média', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'A', '2026-03-15T12:00:00.000Z', 100),
      tx('a', 'A', '2026-02-15T12:00:00.000Z', 50),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-media',
      txs,
      mesNovo: '2026-03',
      nMesesContexto: 6,
      tipo: 'DESPESA',
    })
    expect(r.antigoLabel).toContain('Média')
    expect(r.antigoLabel).toContain('5 meses')
    expect(r.antigoLabel).toContain('Março/2026')
  })

  it('percentualTotal calculado corretamente', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'A', '2026-01-15T12:00:00.000Z', 200),
      tx('a', 'A', '2026-02-15T12:00:00.000Z', 100),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
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
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
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

// ────────────────────────────────────────────────────────────────────
// Hotfix Waterfall SVG (28/05/2026) — Garantias narrativas
//   Confirmar que `novoLabel` SEMPRE é sujeito do título,
//   independente da direção da diferença ou do modo de comparação.
// ────────────────────────────────────────────────────────────────────

describe('Hotfix SVG: título narrativo — sujeito sempre o investigado', () => {
  it('mes-vs-mes positivo: Jan vs Fev, Jan é sujeito', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 100_000, 'novo')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'Fevereiro/2026',
      diferencaTotal: 100_000,
      drivers,
    })
    // Janeiro DEVE aparecer ANTES de Fevereiro
    expect(t.indexOf('Janeiro/2026')).toBeLessThan(t.indexOf('Fevereiro/2026'))
    expect(t).toMatch(/^Janeiro\/2026/)
  })

  it('mes-vs-mes negativo: Fev vs Jan (investigado caiu), Fev é sujeito', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', -50_000, 'reduziu')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Fevereiro/2026',
      antigoLabel: 'Janeiro/2026',
      diferencaTotal: -50_000,
      drivers,
    })
    expect(t).toMatch(/^Fevereiro\/2026/)
    expect(t).toContain('a menos')
  })

  it('mes-vs-media: investigado é sujeito, "Média dos últimos N" é objeto', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 30_000, 'aumentou')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'Média dos últimos 6',
      diferencaTotal: 30_000,
      drivers,
    })
    expect(t).toMatch(/^Janeiro\/2026/)
    expect(t).toContain('Média dos últimos 6')
  })

  it('estável: investigado ainda é sujeito', () => {
    const t = gerarTituloNarrativo({
      novoLabel: 'Mar/26',
      antigoLabel: 'Fev/26',
      diferencaTotal: 0,
      drivers: [],
    })
    expect(t).toMatch(/^Mar\/26/)
    expect(t).toContain('estável')
  })
})

// ────────────────────────────────────────────────────────────────────
// Hotfix Waterfall SVG (28/05/2026) — Defaults agressivos no e2e
//   Garantir que analiseVariacao() retorna AT MOST 6 visíveis + 2 totais
//   (inicio + fim), com threshold 8% e mínimo 4 aplicados.
// ────────────────────────────────────────────────────────────────────

describe('Hotfix SVG: defaults agressivos em analiseVariacao', () => {
  function tx(
    catId: string,
    catName: string,
    date: string,
    amount: number,
  ): ComparativoInputTx {
    return {
      type: 'DEBIT',
      amount,
      bucketDate: new Date(date),
      categoryId: catId,
      categoryName: catName,
      dreGroup: null,
    }
  }

  it('com 10 categorias relevantes: waterfall enxuto (Top 6 visíveis)', () => {
    const txs: ComparativoInputTx[] = []
    // 10 categorias com volumes decrescentes claros (10k, 9k, 8k, ..., 1k)
    for (let i = 0; i < 10; i++) {
      txs.push(
        tx(`c${i}`, `Cat${i}`, '2026-01-15T12:00:00.000Z', (10 - i) * 1000),
      )
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-02-15T12:00:00.000Z', 0))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
      tipo: 'DESPESA',
      topNDrivers: 10, // caller pede 10 mas DEFAULT_TOP_N=6 prevalece nos visuais
    })
    // Bars = início + visíveis (≤6) + talvez Outros + fim
    // Limite superior: 1 + 6 + 1 + 1 = 9. Limite inferior: 1 + 4 + 0 + 1 = 6.
    expect(r.waterfallBars.length).toBeGreaterThanOrEqual(6)
    expect(r.waterfallBars.length).toBeLessThanOrEqual(9)
    // Aritmética continua fechando independente do top
    expect(r.aritmeticaFecha).toBe(true)
  })

  it('insights NÃO contém bullet "outros drivers" (removido no hotfix)', () => {
    const txs: ComparativoInputTx[] = []
    for (let i = 0; i < 10; i++) {
      txs.push(
        tx(`c${i}`, `Cat${i}`, '2026-01-15T12:00:00.000Z', (10 - i) * 1000),
      )
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-02-15T12:00:00.000Z', 0))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
      tipo: 'DESPESA',
    })
    const outros = r.insightsPrincipais.find((i) => i.tipo === 'outros')
    expect(outros).toBeUndefined()
  })

  it('insights NÃO contém string "outros drivers somam" em nenhum bullet', () => {
    const txs: ComparativoInputTx[] = []
    for (let i = 0; i < 10; i++) {
      txs.push(
        tx(`c${i}`, `Cat${i}`, '2026-01-15T12:00:00.000Z', (10 - i) * 1000),
      )
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-02-15T12:00:00.000Z', 0))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesNovo: '2026-01',
      mesAntigo: '2026-02',
      tipo: 'DESPESA',
    })
    expect(
      r.insightsPrincipais.every((b) => !b.texto.includes('outros drivers')),
    ).toBe(true)
    expect(
      r.insightsPrincipais.every((b) => !b.texto.includes('drivers somam')),
    ).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────
// Hotfix headers-bullets (28/05/2026) — computeTabelaHeaders
//   Headers da tabela "Onde foi a diferença" dinâmicos: mostram nome
//   do período (mês ou "Média NM") em vez de "Investigado/Comparação".
// ────────────────────────────────────────────────────────────────────

describe('Hotfix headers-bullets: computeTabelaHeaders', () => {
  it('mes-vs-mes: ambos headers mostram nomes dos meses', () => {
    const r = computeTabelaHeaders({
      modo: 'mes-vs-mes',
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'Fevereiro/2026',
    })
    expect(r.labelNovo).toBe('Janeiro/2026')
    expect(r.labelAntigo).toBe('Fevereiro/2026')
  })

  it('mes-vs-mes: nunca usa palavra "Investigado" ou "Comparação"', () => {
    const r = computeTabelaHeaders({
      modo: 'mes-vs-mes',
      novoLabel: 'Mar/26',
      antigoLabel: 'Fev/26',
    })
    expect(r.labelNovo.toLowerCase()).not.toContain('investigado')
    expect(r.labelAntigo.toLowerCase()).not.toContain('comparação')
  })

  it('mes-vs-media: investigado mantém mês, comparação vira "Média NM"', () => {
    const r = computeTabelaHeaders({
      modo: 'mes-vs-media',
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'média 6 meses',
      nMesesContexto: 6,
    })
    expect(r.labelNovo).toBe('Janeiro/2026')
    expect(r.labelAntigo).toBe('Média 6M')
  })

  it('mes-vs-media: respeita N=3 e N=12', () => {
    const r3 = computeTabelaHeaders({
      modo: 'mes-vs-media',
      novoLabel: 'Jan/26',
      antigoLabel: 'média 3 meses',
      nMesesContexto: 3,
    })
    expect(r3.labelAntigo).toBe('Média 3M')

    const r12 = computeTabelaHeaders({
      modo: 'mes-vs-media',
      novoLabel: 'Jan/26',
      antigoLabel: 'média 12 meses',
      nMesesContexto: 12,
    })
    expect(r12.labelAntigo).toBe('Média 12M')
  })

  it('mes-vs-media: fallback nMesesContexto undefined usa 6', () => {
    const r = computeTabelaHeaders({
      modo: 'mes-vs-media',
      novoLabel: 'Jan/26',
      antigoLabel: 'média X meses',
    })
    expect(r.labelAntigo).toBe('Média 6M')
  })

  it('preserva caracteres da label investigado (acentos)', () => {
    const r = computeTabelaHeaders({
      modo: 'mes-vs-mes',
      novoLabel: 'Março/2026',
      antigoLabel: 'Fevereiro/2026',
    })
    expect(r.labelNovo).toBe('Março/2026')
    expect(r.labelAntigo).toBe('Fevereiro/2026')
  })
})

// ════════════════════════════════════════════════════════════════════
// Hotfix cronológica (28/05/2026) — antigo → novo SEMPRE
// ════════════════════════════════════════════════════════════════════

describe('Hotfix cronológica: ordenarCronologicamente', () => {
  it('Jan vs Fev (mesmo ano) → antigo=Jan, novo=Fev', () => {
    const r = ordenarCronologicamente('2026-01', '2026-02')
    expect(r.antigo).toBe('2026-01')
    expect(r.novo).toBe('2026-02')
  })

  it('Fev vs Jan (ordem invertida na UI) → antigo=Jan, novo=Fev', () => {
    const r = ordenarCronologicamente('2026-02', '2026-01')
    expect(r.antigo).toBe('2026-01')
    expect(r.novo).toBe('2026-02')
  })

  it('Abr/26 vs Jan/26 (pula meses) → antigo=Jan, novo=Abr', () => {
    const r = ordenarCronologicamente('2026-04', '2026-01')
    expect(r.antigo).toBe('2026-01')
    expect(r.novo).toBe('2026-04')
  })

  it('Jun/26 vs Dez/25 → antigo=Dez/25, novo=Jun/26 (cruza ano)', () => {
    const r = ordenarCronologicamente('2026-06', '2025-12')
    expect(r.antigo).toBe('2025-12')
    expect(r.novo).toBe('2026-06')
  })

  it('Mesmo mês 2x → antigo=novo=mesmo valor (sem erro)', () => {
    const r = ordenarCronologicamente('2026-03', '2026-03')
    expect(r.antigo).toBe('2026-03')
    expect(r.novo).toBe('2026-03')
  })
})

describe('Hotfix cronológica: analiseVariacao recebe mesAntigo/mesNovo', () => {
  function tx(
    catId: string,
    catName: string,
    bucketDate: string,
    amount: number,
  ): ComparativoInputTx {
    return {
      bucketDate: new Date(bucketDate),
      amount,
      type: 'DEBIT',
      categoryId: catId,
      categoryName: catName,
      dreGroup: null,
    }
  }

  it('IRPJ Jan=56k, Fev=0 com Jan antigo → tipo SUMIU, diferença NEGATIVA', () => {
    const txs: ComparativoInputTx[] = [
      tx('c-irpj', 'IRPJ', '2026-01-15T12:00:00Z', 56_507),
      // sem tx de IRPJ em Fev — ausente
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const irpj = r.drivers.find((d) => d.categoryName === 'IRPJ')
    expect(irpj).toBeDefined()
    expect(irpj!.tipo).toBe('sumiu')
    expect(irpj!.valorAntigo).toBe(56_507)
    expect(irpj!.valorNovo).toBe(0)
    expect(irpj!.diferenca).toBe(-56_507)
  })

  it('Rescisão Jan=0, Fev=5172 → tipo NOVO, diferença POSITIVA', () => {
    const txs: ComparativoInputTx[] = [
      tx('c-resc', 'Rescisão Academia', '2026-02-15T12:00:00Z', 5_172),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const resc = r.drivers.find((d) => d.categoryName === 'Rescisão Academia')
    expect(resc).toBeDefined()
    expect(resc!.tipo).toBe('novo')
    expect(resc!.valorAntigo).toBe(0)
    expect(resc!.valorNovo).toBe(5_172)
    expect(resc!.diferenca).toBe(5_172)
  })

  it('Salários Jan=44k, Fev=38k → tipo REDUZIU, diferença NEGATIVA', () => {
    const txs: ComparativoInputTx[] = [
      tx('c-sal', 'Salários', '2026-01-15T12:00:00Z', 44_032),
      tx('c-sal', 'Salários', '2026-02-15T12:00:00Z', 38_977),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const sal = r.drivers.find((d) => d.categoryName === 'Salários')
    expect(sal).toBeDefined()
    expect(sal!.tipo).toBe('reduziu')
    expect(sal!.diferenca).toBe(-5_055)
  })

  it('Aluguel Jan=8k, Fev=12k → tipo AUMENTOU, diferença POSITIVA', () => {
    const txs: ComparativoInputTx[] = [
      tx('c-alg', 'Aluguel', '2026-01-15T12:00:00Z', 8_000),
      tx('c-alg', 'Aluguel', '2026-02-15T12:00:00Z', 12_000),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const alg = r.drivers.find((d) => d.categoryName === 'Aluguel')
    expect(alg!.tipo).toBe('aumentou')
    expect(alg!.diferenca).toBe(4_000)
  })
})

describe('Hotfix cronológica: título narrativo "da alta/queda"', () => {
  it('Fev<Jan (queda total): título contém "a menos" e "% da queda"', () => {
    const drivers: DriverVariacao[] = [
      driver('irpj', 'IRPJ', -56_000, 'sumiu'),
      driver('csll', 'CSLL', -22_000, 'sumiu'),
      driver('out', 'Outros', -21_000),
    ]
    const t = gerarTituloNarrativo({
      novoLabel: 'Fevereiro/2026',
      antigoLabel: 'Janeiro/2026',
      diferencaTotal: -99_000,
      drivers,
    })
    expect(t).toMatch(/^Fevereiro\/2026/)
    expect(t).toContain('a menos')
    expect(t).toContain('Janeiro/2026')
    expect(t).toContain('IRPJ e CSLL')
    expect(t).toContain('da queda')
  })

  it('Abr>Jan (alta total): título contém "a mais" e "% da alta"', () => {
    const drivers: DriverVariacao[] = [
      driver('sal', 'Salários', 22_000, 'aumentou'),
      driver('alg', 'Aluguel', 13_000, 'aumentou'),
    ]
    const t = gerarTituloNarrativo({
      novoLabel: 'Abril/2026',
      antigoLabel: 'Janeiro/2026',
      diferencaTotal: 35_000,
      drivers,
    })
    expect(t).toMatch(/^Abril\/2026/)
    expect(t).toContain('a mais')
    expect(t).toContain('Salários e Aluguel')
    expect(t).toContain('da alta')
  })

  it('vs Média: sujeito é mês escolhido, complemento é "Média 6 meses"', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 30_000, 'aumentou')]
    const t = gerarTituloNarrativo({
      novoLabel: 'Janeiro/2026',
      antigoLabel: 'Média dos últimos 6 meses (excl. Janeiro/2026)',
      diferencaTotal: 30_000,
      drivers,
    })
    expect(t).toMatch(/^Janeiro\/2026/)
    expect(t).toContain('Média dos últimos 6 meses')
    expect(t).toContain('da alta')
  })

  it('estável (~0): não contém "da alta" nem "da queda"', () => {
    const t = gerarTituloNarrativo({
      novoLabel: 'Fev/26',
      antigoLabel: 'Jan/26',
      diferencaTotal: 0,
      drivers: [],
    })
    expect(t).toContain('estável')
    expect(t).not.toContain('da alta')
    expect(t).not.toContain('da queda')
  })
})

describe('Hotfix cronológica: insights cronológicos', () => {
  it('top1 tipo "novo": insight "apareceu no mês novo"', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', 56_507, 'novo')]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: 56_507,
      visiveis: drivers,
    })
    expect(r[0].texto).toContain('apareceu no mês novo')
  })

  it('top1 tipo "sumiu": insight "sumiu (era pago no mês antigo)"', () => {
    const drivers: DriverVariacao[] = [driver('a', 'IRPJ', -56_507, 'sumiu')]
    const r = gerarInsightsPrincipais({
      drivers,
      diferencaTotal: -56_507,
      visiveis: drivers,
    })
    expect(r[0].texto).toContain('sumiu (era pago no mês antigo)')
  })

  it('top1 tipo "aumentou"→"aumentou vs antigo", "reduziu"→"reduziu vs antigo"', () => {
    const aumentou: DriverVariacao[] = [driver('a', 'X', 5_000, 'aumentou')]
    const ra = gerarInsightsPrincipais({
      drivers: aumentou,
      diferencaTotal: 5_000,
      visiveis: aumentou,
    })
    expect(ra[0].texto).toContain('aumentou vs antigo')

    const reduziu: DriverVariacao[] = [driver('a', 'X', -5_000, 'reduziu')]
    const rr = gerarInsightsPrincipais({
      drivers: reduziu,
      diferencaTotal: -5_000,
      visiveis: reduziu,
    })
    expect(rr[0].texto).toContain('reduziu vs antigo')
  })
})

describe('Hotfix cronológica: aritmética preservada', () => {
  function tx(
    catId: string,
    catName: string,
    bucketDate: string,
    amount: number,
  ): ComparativoInputTx {
    return {
      bucketDate: new Date(bucketDate),
      amount,
      type: 'DEBIT',
      categoryId: catId,
      categoryName: catName,
      dreGroup: null,
    }
  }

  it('soma(drivers.diferenca) ≈ totalNovo - totalAntigo (tolerância 0.01)', () => {
    const txs: ComparativoInputTx[] = []
    for (let i = 0; i < 8; i++) {
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-01-15T12:00:00Z', 1000 + i * 100))
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-02-15T12:00:00Z', 1500 + i * 50))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const soma = r.drivers.reduce((s, d) => s + d.diferenca, 0)
    expect(Math.abs(soma - (r.totalNovo - r.totalAntigo))).toBeLessThan(0.01)
    expect(r.aritmeticaFecha).toBe(true)
  })

  it('Aritmética fecha mesmo com Outros agregado (10 cats, Top 6)', () => {
    const txs: ComparativoInputTx[] = []
    for (let i = 0; i < 10; i++) {
      // 10 categorias com valores variados pra forçar agrupamento Outros
      txs.push(
        tx(`c${i}`, `Cat${i}`, '2026-01-15T12:00:00Z', 10_000 + i * 1_000),
      )
      txs.push(tx(`c${i}`, `Cat${i}`, '2026-02-15T12:00:00Z', 8_000 + i * 500))
    }
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.aritmeticaFecha).toBe(true)
    const outros = r.waterfallBars.find((b) => b.isOutros)
    expect(outros).toBeDefined()
  })
})

describe('Hotfix cronológica: coerência tabela ↔ waterfall ↔ insights', () => {
  function tx(
    catId: string,
    catName: string,
    bucketDate: string,
    amount: number,
  ): ComparativoInputTx {
    return {
      bucketDate: new Date(bucketDate),
      amount,
      type: 'DEBIT',
      categoryId: catId,
      categoryName: catName,
      dreGroup: null,
    }
  }

  it('driver "novo" → bar "aumento" (vermelho) + insight "apareceu"', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'Rescisão', '2026-02-15T12:00:00Z', 50_000),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const d = r.drivers[0]
    expect(d.tipo).toBe('novo')
    const bar = r.waterfallBars.find((b) => b.label === 'Rescisão')
    expect(bar?.tipo).toBe('aumento')
    expect(r.insightsPrincipais[0].texto).toContain('apareceu no mês novo')
  })

  it('driver "sumiu" → bar "reducao" (verde) + insight "sumiu (era pago...)"', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'IRPJ', '2026-01-15T12:00:00Z', 50_000),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    const d = r.drivers[0]
    expect(d.tipo).toBe('sumiu')
    const bar = r.waterfallBars.find((b) => b.label === 'IRPJ')
    expect(bar?.tipo).toBe('reducao')
    expect(r.insightsPrincipais[0].texto).toContain('sumiu (era pago no mês antigo)')
  })

  it('Waterfall bars[0]=antigo, bars[last]=novo (ordem cronológica)', () => {
    const txs: ComparativoInputTx[] = [
      tx('a', 'X', '2026-01-15T12:00:00Z', 1_000),
      tx('a', 'X', '2026-02-15T12:00:00Z', 2_000),
    ]
    const r = analiseVariacao({
      mode: 'mes-vs-mes',
      txs,
      mesAntigo: '2026-01',
      mesNovo: '2026-02',
      tipo: 'DESPESA',
    })
    expect(r.waterfallBars[0].tipo).toBe('inicio')
    expect(r.waterfallBars[0].label).toBe(r.antigoLabel)
    const last = r.waterfallBars[r.waterfallBars.length - 1]
    expect(last.tipo).toBe('fim')
    expect(last.label).toBe(r.novoLabel)
  })
})
