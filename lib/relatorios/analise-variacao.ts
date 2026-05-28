// Sprint Análise de Variação (28/05/2026) — Decomposição categoria por categoria.
//
// Padrão FP&A "bridge/waterfall": decompõe a diferença entre 2 pontos
// (mês X vs mês Y OU mês X vs média histórica) mostrando exatamente
// quais categorias causaram o gap.
//
// Engine PURA: recebe transactions já filtradas, devolve drivers + bars
// Recharts-ready + validação aritmética.
//
// REUSA helpers de lib/relatorios/comparativo.ts (parseRefMonth,
// MonthRange) mas NÃO depende de computeComparativoMulti diretamente
// porque precisa de buckets ARBITRÁRIOS (mes-vs-mes pode ser não-consecutivo).

import {
  parseRefMonth,
  type MonthRange,
  type ComparativoInputTx,
  type ComparativoTipoFilter,
} from './comparativo'

// ────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────

export type ComparacaoMode = 'mes-vs-mes' | 'mes-vs-media'

export type DriverTipo =
  | 'aumentou' // existia antes, gastou mais agora
  | 'reduziu' // existia antes, gastou menos agora
  | 'novo' // não tinha antes, tem agora
  | 'sumiu' // tinha antes, não tem agora
  | 'estavel' // |diferenca| < threshold

export interface DriverVariacao {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  valorInvestigado: number
  valorComparacao: number
  /** investigado - comparacao (positivo = aumentou). */
  diferenca: number
  /** Variação relativa em frações. null se comparacao = 0. */
  percentual: number | null
  tipo: DriverTipo
}

export type WaterfallBarTipo = 'inicio' | 'aumento' | 'reducao' | 'fim'

export interface WaterfallBar {
  label: string
  /** Y onde a barra começa (base invisível pro stacked Bar) */
  base: number
  /** Magnitude (sempre positivo pro Recharts) */
  value: number
  /** Delta real com sinal — pra tooltip */
  delta: number
  /** Y onde a barra termina (base + value) */
  end: number
  tipo: WaterfallBarTipo
  /** True se é a barra "Outros" agregando drivers pequenos */
  isOutros?: boolean
}

export interface AnaliseVariacaoResult {
  mesInvestigadoLabel: string // "Janeiro/26"
  comparacaoLabel: string // "Fevereiro/26" | "Média dos últimos 6 meses (excl. Jan/26)"
  totalInvestigado: number
  totalComparacao: number
  diferencaTotal: number
  percentualTotal: number | null
  /** Drivers ordenados por |diferenca| DESC */
  drivers: DriverVariacao[]
  /** Bars do waterfall Recharts-ready (top N + Outros + barras totais) */
  waterfallBars: WaterfallBar[]
  /** True se soma(drivers.diferenca) ≈ diferencaTotal (tolerância R$ 0,01) */
  aritmeticaFecha: boolean
  /** |soma - diferencaTotal| em R$. Esperado ~0 */
  aritmeticaResiduo: number
}

export interface AnaliseVariacaoInputComum {
  txs: ComparativoInputTx[]
  mesInvestigado: string // YYYY-MM
  tipo: ComparativoTipoFilter
  /** Top N drivers no waterfall (resto vira "Outros"). Default 10. */
  topNDrivers?: number
  /** Threshold |diferenca| pra classificar como "estavel". Default R$ 100. */
  estavelThreshold?: number
}

export interface AnaliseVariacaoInputMesVsMes extends AnaliseVariacaoInputComum {
  mode: 'mes-vs-mes'
  /** YYYY-MM — pode ser não-consecutivo do mesInvestigado */
  ymComparacao: string
}

export interface AnaliseVariacaoInputMesVsMedia
  extends AnaliseVariacaoInputComum {
  mode: 'mes-vs-media'
  /** Quantos meses de contexto (incluindo o investigado). Default 6. */
  nMesesContexto?: number
}

export type AnaliseVariacaoInput =
  | AnaliseVariacaoInputMesVsMes
  | AnaliseVariacaoInputMesVsMedia

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

const DEFAULT_TOP_N = 10
const DEFAULT_ESTAVEL_THRESHOLD = 100 // R$
const DEFAULT_N_MESES_CONTEXTO = 6
const ARITMETICA_TOLERANCE = 0.01 // R$ 0,01

const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function labelMonth(ym: string): string {
  const r = parseRefMonth(ym)
  return `${MES_FULL[r.start.getUTCMonth()]}/${r.start.getUTCFullYear()}`
}

// ────────────────────────────────────────────────────────────────────
// Agregação por categoria × bucket
// ────────────────────────────────────────────────────────────────────

interface CategoriaAggregate {
  categoryId: string | null
  categoryName: string
  dreGroup: string | null
  totalNoBucket: number
}

/**
 * Agrega transações por categoria DENTRO de um bucket de mês específico.
 * Filtra por tipo (DESPESA/RECEITA/TODOS).
 */
export function agregarPorCategoria(
  txs: ComparativoInputTx[],
  bucket: MonthRange,
  tipo: ComparativoTipoFilter,
): CategoriaAggregate[] {
  type Bucket = { name: string; dreGroup: string | null; total: number }
  const map = new Map<string, Bucket>()

  for (const tx of txs) {
    if (tipo === 'DESPESA' && tx.type !== 'DEBIT') continue
    if (tipo === 'RECEITA' && tx.type !== 'CREDIT') continue

    const d = tx.bucketDate instanceof Date ? tx.bucketDate : new Date(tx.bucketDate)
    if (Number.isNaN(d.getTime())) continue
    if (d < bucket.start || d > bucket.end) continue

    const key = tx.categoryId ?? '__sem_categoria__'
    let agg = map.get(key)
    if (!agg) {
      agg = {
        name: tx.categoryName ?? 'Sem categoria',
        dreGroup: tx.dreGroup,
        total: 0,
      }
      map.set(key, agg)
    }
    agg.total += Math.abs(tx.amount)
  }

  return Array.from(map.entries()).map(([key, b]) => ({
    categoryId: key === '__sem_categoria__' ? null : key,
    categoryName: b.name,
    dreGroup: b.dreGroup,
    totalNoBucket: b.total,
  }))
}

// ────────────────────────────────────────────────────────────────────
// Classificação de drivers
// ────────────────────────────────────────────────────────────────────

export function classificarDriver(
  valorInvestigado: number,
  valorComparacao: number,
  estavelThreshold = DEFAULT_ESTAVEL_THRESHOLD,
): DriverTipo {
  if (valorInvestigado === 0 && valorComparacao === 0) return 'estavel'
  if (valorComparacao === 0 && valorInvestigado > 0) return 'novo'
  if (valorInvestigado === 0 && valorComparacao > 0) return 'sumiu'
  const diff = valorInvestigado - valorComparacao
  if (Math.abs(diff) < estavelThreshold) return 'estavel'
  return diff > 0 ? 'aumentou' : 'reduziu'
}

// ────────────────────────────────────────────────────────────────────
// Decomposição (drivers)
// ────────────────────────────────────────────────────────────────────

/**
 * Decompõe a diferença entre 2 conjuntos agregados de categorias.
 * Retorna lista de drivers ordenada por |diferenca| DESC.
 */
export function decompor(
  investigado: CategoriaAggregate[],
  comparacao: CategoriaAggregate[],
  estavelThreshold = DEFAULT_ESTAVEL_THRESHOLD,
): DriverVariacao[] {
  // Indexa ambos por categoryId pra fazer join
  const investMap = new Map(
    investigado.map((c) => [c.categoryId ?? '__null__', c]),
  )
  const compMap = new Map(
    comparacao.map((c) => [c.categoryId ?? '__null__', c]),
  )

  const allKeys = new Set([...investMap.keys(), ...compMap.keys()])

  const drivers: DriverVariacao[] = []

  for (const key of allKeys) {
    const inv = investMap.get(key)
    const cmp = compMap.get(key)

    const valorInvestigado = inv?.totalNoBucket ?? 0
    const valorComparacao = cmp?.totalNoBucket ?? 0
    const diferenca = valorInvestigado - valorComparacao
    const percentual =
      valorComparacao === 0
        ? null
        : (valorInvestigado - valorComparacao) / valorComparacao

    drivers.push({
      categoryId: key === '__null__' ? null : key,
      categoryName: inv?.categoryName ?? cmp?.categoryName ?? 'Sem categoria',
      dreGroup: inv?.dreGroup ?? cmp?.dreGroup ?? null,
      valorInvestigado,
      valorComparacao,
      diferenca,
      percentual,
      tipo: classificarDriver(
        valorInvestigado,
        valorComparacao,
        estavelThreshold,
      ),
    })
  }

  // Ordena por |diferenca| DESC (maior impacto primeiro). Ties: categoria A→Z.
  drivers.sort((a, b) => {
    const absDiff = Math.abs(b.diferenca) - Math.abs(a.diferenca)
    if (absDiff !== 0) return absDiff
    return a.categoryName.localeCompare(b.categoryName)
  })

  return drivers
}

// ────────────────────────────────────────────────────────────────────
// Waterfall bars (Recharts-ready)
// ────────────────────────────────────────────────────────────────────

/**
 * Constrói as barras do waterfall chart. Estrutura:
 *
 *   [0] Início (Comparação)    base=0,                value=totalComparacao
 *   [1..N] Top N drivers       base=cumulativo,       value=|diferenca|
 *   [N+1] Outros (se houver)   base=cumulativo,       value=|sobra|
 *   [N+2] Fim (Investigado)    base=0,                value=totalInvestigado
 *
 * Para cada driver:
 * - delta > 0 (aumento): base = cumulativo, end = base + value
 * - delta < 0 (redução): base = cumulativo - value, end = base
 *   (a barra desce DA base PRA cumulative atual)
 *
 * Aritmética fecha porque o último cumulative = totalInvestigado.
 */
export function buildWaterfallBars(
  drivers: DriverVariacao[],
  totalComparacao: number,
  totalInvestigado: number,
  mesInvestigadoLabel: string,
  comparacaoLabel: string,
  topN = DEFAULT_TOP_N,
): WaterfallBar[] {
  const bars: WaterfallBar[] = []

  // Barra inicial: total da comparação
  bars.push({
    label: comparacaoLabel,
    base: 0,
    value: totalComparacao,
    delta: totalComparacao,
    end: totalComparacao,
    tipo: 'inicio',
  })

  // Filtra drivers com diferenca ≠ 0 (estaveis com diff=0 não entram no chart)
  const driversNonZero = drivers.filter(
    (d) => Math.abs(d.diferenca) >= ARITMETICA_TOLERANCE,
  )
  const topDrivers = driversNonZero.slice(0, topN)
  const resto = driversNonZero.slice(topN)

  let cumulative = totalComparacao

  for (const d of topDrivers) {
    if (d.diferenca > 0) {
      // Aumento: barra sobe DA cumulative atual
      const base = cumulative
      const value = d.diferenca
      const end = base + value
      bars.push({
        label: d.categoryName,
        base,
        value,
        delta: d.diferenca,
        end,
        tipo: 'aumento',
      })
      cumulative = end
    } else {
      // Redução: barra desce DA cumulative atual
      const value = Math.abs(d.diferenca)
      const end = cumulative - value
      bars.push({
        label: d.categoryName,
        base: end,
        value,
        delta: d.diferenca,
        end: cumulative,
        tipo: 'reducao',
      })
      cumulative = end
    }
  }

  // Outros (se houver drivers fora do top N)
  if (resto.length > 0) {
    const restoDelta = resto.reduce((s, d) => s + d.diferenca, 0)
    if (Math.abs(restoDelta) >= ARITMETICA_TOLERANCE) {
      if (restoDelta > 0) {
        const base = cumulative
        const value = restoDelta
        const end = base + value
        bars.push({
          label: `Outros (${resto.length})`,
          base,
          value,
          delta: restoDelta,
          end,
          tipo: 'aumento',
          isOutros: true,
        })
        cumulative = end
      } else {
        const value = Math.abs(restoDelta)
        const end = cumulative - value
        bars.push({
          label: `Outros (${resto.length})`,
          base: end,
          value,
          delta: restoDelta,
          end: cumulative,
          tipo: 'reducao',
          isOutros: true,
        })
        cumulative = end
      }
    }
  }

  // Barra final: total investigado
  bars.push({
    label: mesInvestigadoLabel,
    base: 0,
    value: totalInvestigado,
    delta: totalInvestigado,
    end: totalInvestigado,
    tipo: 'fim',
  })

  return bars
}

// ────────────────────────────────────────────────────────────────────
// Helper: período anterior (mês X-N)
// ────────────────────────────────────────────────────────────────────

function backMonths(ymRef: string, n: number): MonthRange {
  const ref = parseRefMonth(ymRef)
  const targetM = ref.start.getUTCMonth() - n
  const yAdj = ref.start.getUTCFullYear() + Math.floor(targetM / 12)
  const mNorm = ((targetM % 12) + 12) % 12
  const start = new Date(Date.UTC(yAdj, mNorm, 1))
  const end = new Date(Date.UTC(yAdj, mNorm + 1, 0, 23, 59, 59, 999))
  const ym = `${yAdj}-${String(mNorm + 1).padStart(2, '0')}`
  const label = `${MES_FULL[mNorm].slice(0, 3)}/${String(yAdj).slice(-2)}`
  return { ym, start, end, label }
}

// ────────────────────────────────────────────────────────────────────
// Engine principal
// ────────────────────────────────────────────────────────────────────

export function analiseVariacao(
  input: AnaliseVariacaoInput,
): AnaliseVariacaoResult {
  const topN = input.topNDrivers ?? DEFAULT_TOP_N
  const estavelThreshold = input.estavelThreshold ?? DEFAULT_ESTAVEL_THRESHOLD

  const investBucket = parseRefMonth(input.mesInvestigado)
  const mesInvestigadoLabel = labelMonth(input.mesInvestigado)

  const investigado = agregarPorCategoria(input.txs, investBucket, input.tipo)
  const totalInvestigado = investigado.reduce(
    (s, c) => s + c.totalNoBucket,
    0,
  )

  let comparacao: CategoriaAggregate[]
  let totalComparacao: number
  let comparacaoLabel: string

  if (input.mode === 'mes-vs-mes') {
    const compBucket = parseRefMonth(input.ymComparacao)
    comparacao = agregarPorCategoria(input.txs, compBucket, input.tipo)
    totalComparacao = comparacao.reduce((s, c) => s + c.totalNoBucket, 0)
    comparacaoLabel = labelMonth(input.ymComparacao)
  } else {
    // mes-vs-media: agrega cada um dos N-1 meses ANTERIORES (exclui o investigado)
    const N = input.nMesesContexto ?? DEFAULT_N_MESES_CONTEXTO
    const mesesAnteriores: MonthRange[] = []
    for (let i = 1; i <= N - 1; i++) {
      mesesAnteriores.push(backMonths(input.mesInvestigado, i))
    }

    // Para cada categoria, calcula média dos meses anteriores (ignora zeros)
    type MediaMap = Map<
      string,
      { name: string; dreGroup: string | null; soma: number; count: number }
    >
    const mediaPorCat: MediaMap = new Map()
    for (const bucket of mesesAnteriores) {
      const agg = agregarPorCategoria(input.txs, bucket, input.tipo)
      for (const c of agg) {
        const key = c.categoryId ?? '__null__'
        const ex = mediaPorCat.get(key)
        if (!ex) {
          mediaPorCat.set(key, {
            name: c.categoryName,
            dreGroup: c.dreGroup,
            soma: c.totalNoBucket > 0 ? c.totalNoBucket : 0,
            count: c.totalNoBucket > 0 ? 1 : 0,
          })
        } else {
          if (c.totalNoBucket > 0) {
            ex.soma += c.totalNoBucket
            ex.count++
          }
        }
      }
    }

    comparacao = Array.from(mediaPorCat.entries()).map(([key, v]) => ({
      categoryId: key === '__null__' ? null : key,
      categoryName: v.name,
      dreGroup: v.dreGroup,
      totalNoBucket: v.count > 0 ? v.soma / v.count : 0,
    }))
    totalComparacao = comparacao.reduce((s, c) => s + c.totalNoBucket, 0)
    comparacaoLabel = `Média dos últimos ${N - 1} meses (excl. ${mesInvestigadoLabel})`
  }

  const drivers = decompor(investigado, comparacao, estavelThreshold)
  const diferencaTotal = totalInvestigado - totalComparacao
  const percentualTotal =
    totalComparacao === 0
      ? null
      : (totalInvestigado - totalComparacao) / totalComparacao

  const waterfallBars = buildWaterfallBars(
    drivers,
    totalComparacao,
    totalInvestigado,
    mesInvestigadoLabel,
    comparacaoLabel,
    topN,
  )

  // Aritmética: soma de TODOS os drivers (não só top N) deve bater
  const somaDrivers = drivers.reduce((s, d) => s + d.diferenca, 0)
  const aritmeticaResiduo = Math.abs(somaDrivers - diferencaTotal)
  const aritmeticaFecha = aritmeticaResiduo < ARITMETICA_TOLERANCE

  return {
    mesInvestigadoLabel,
    comparacaoLabel,
    totalInvestigado,
    totalComparacao,
    diferencaTotal,
    percentualTotal,
    drivers,
    waterfallBars,
    aritmeticaFecha,
    aritmeticaResiduo,
  }
}
