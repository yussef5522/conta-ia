// Sprint CSV Import (30/05/2026) — Orquestrador: mapeia row CACULA → StagedPayableRow.
//
// Recebe ParsedCsv (output do parse-csv.ts) já validado pela
// detect-cacula. Produz N CaculaMappedRow prontos pra ir pro
// `StagedPayableRow` no DB.
//
// Cada row passa por:
//  1. Pega valor de TOTAL (não VALOR — convenção CACULA, decisão Yussef)
//  2. Pega 3 datas (competência, vencimento, pagamento)
//  3. Decide lifecycle (CRÍTICO — guard R$ 939k)
//  4. Limpa categoria + detecta multi
//  5. Monta descrição = CREDOR + " — " + DESCRICAO (se DESCRICAO ≠ "-")
//  6. Coleta erros de parse (linha-a-linha, não joga — preview mostra)

import { CACULA_INDICES, isCaculaHeader } from './detect-cacula'
import { parseValorBR } from './parse-valor-br'
import { parseDataBR } from './parse-data-br'
import {
  limparCategoria,
  detectarMultiCategoria,
} from './clean-categoria'
import { decidirLifecycleCacula } from './lifecycle-cacula'
import type { Lifecycle } from '@/lib/lifecycle'
import type { ParsedCsv } from './parse-csv'

export interface CaculaMappedRow {
  /** Linha 0-based no CSV (excluindo header). Pra UI mostrar */
  rowIndex: number

  // ──── Dados brutos (snapshot pra audit) ────
  rawId: string | null
  rawFavorecido: string | null // CREDOR/PAGANTE
  rawDescricao: string | null // CREDOR + " — " + DESCRICAO
  rawCategoria: string | null // CATEGORIA CONTABIL (texto sujo)
  rawCompetencia: string | null // string DD/MM/YYYY
  rawVencimento: string | null
  rawPagamento: string | null
  rawValor: number | null // já parseado (positivo após Math.abs)
  rawStatus: string | null // PAGO / VENCE HOJE / VENCIDO
  rawUnidade: string | null
  rawNota: string | null
  rawFormaPagamento: string | null

  // ──── Normalizados ────
  /** Math.abs do TOTAL — convenção projeto (Yussef confirmou) */
  valor: number
  competencia: Date | null
  vencimento: Date | null
  /** SOBRESCRITO pra null quando lifecycle=PAYABLE (guard R$ 939k) */
  pagamento: Date | null
  lifecycle: Lifecycle

  // ──── Categoria limpa + detecção multi ────
  categoriaLimpa: string
  temMultiplasCategorias: boolean
  contagemCategorias: number
  /** Todas as categorias detectadas (multi-cat) */
  todasCategorias: string[]

  // ──── Flags pra preview ────
  /** True se row precisa revisão manual (preview badge ⚠️) */
  precisaRevisar: boolean
  motivosRevisar: string[]

  // ──── Erros de parse (NÃO joga; preview mostra) ────
  errosParse: string[]
}

export interface MapCaculaResult {
  rows: CaculaMappedRow[]
  /** Headers do CSV (preservados pra UI) */
  headers: string[]
  /** Unidade detectada na 1ª linha (mostra "Arquivo: X" no preview) */
  unidadeArquivo: string | null
  /** Estatísticas pra preview */
  stats: {
    total: number
    effected: number
    payable: number
    receivable: number // sempre 0 nesta sprint
    comErros: number
    comRevisao: number
  }
}

const safe = (s: string | undefined | null): string | null => {
  if (s === null || s === undefined) return null
  const t = String(s).trim()
  if (t === '' || t === '-') return null
  return t
}

function buildDescricao(
  credor: string | null,
  descricao: string | null,
): string | null {
  if (!credor && !descricao) return null
  if (credor && descricao) return `${credor} — ${descricao}`
  return credor ?? descricao
}

/**
 * Mapeia uma row CACULA pra CaculaMappedRow. Não joga em erros de
 * parse — coleta em errosParse. Joga APENAS se lifecycle decision
 * gerar estado inválido (bug do mapper).
 */
export function mapearLinhaCacula(
  row: readonly string[],
  rowIndex: number,
): CaculaMappedRow {
  const errosParse: string[] = []
  const motivosRevisar: string[] = []

  const rawId = safe(row[CACULA_INDICES.ID])
  const rawFavorecido = safe(row[CACULA_INDICES.CREDOR_PAGANTE])
  const rawDescricaoCol = safe(row[CACULA_INDICES.DESCRICAO])
  const rawCategoriaCol = safe(row[CACULA_INDICES.CATEGORIA_CONTABIL])
  const rawCompetencia = safe(row[CACULA_INDICES.DATA_COMPETENCIA])
  const rawVencimento = safe(row[CACULA_INDICES.DATA_DE_VENCIMENTO])
  const rawPagamento = safe(row[CACULA_INDICES.DATA_DO_PAGAMENTO])
  const rawStatus = safe(row[CACULA_INDICES.STATUS])
  const rawUnidade = safe(row[CACULA_INDICES.UNIDADE])
  const rawNota = safe(row[CACULA_INDICES.NUMERO_NOTA])
  const rawFormaPagamento = safe(row[CACULA_INDICES.FORMA_DE_PAGAMENTO])
  const rawTotal = row[CACULA_INDICES.TOTAL] ?? null
  const rawValorParseado = parseValorBR(rawTotal)
  const valor = rawValorParseado === null ? 0 : Math.abs(rawValorParseado)

  if (rawValorParseado === null) {
    errosParse.push(`TOTAL inválido: "${rawTotal}"`)
  }

  const competencia = parseDataBR(rawCompetencia)
  const vencimento = parseDataBR(rawVencimento)
  const pagamento = parseDataBR(rawPagamento)

  if (rawCompetencia && competencia === null) {
    errosParse.push(`DATA COMPETENCIA inválida: "${rawCompetencia}"`)
  }
  if (rawVencimento && vencimento === null) {
    errosParse.push(`DATA DE VENCIMENTO inválida: "${rawVencimento}"`)
  }
  if (rawPagamento && pagamento === null) {
    errosParse.push(`DATA DO PAGAMENTO inválida: "${rawPagamento}"`)
  }

  // Categoria
  const multi = detectarMultiCategoria(rawCategoriaCol)
  const categoriaLimpa = multi.primeira

  if (multi.temMultiplas) {
    motivosRevisar.push(
      `Múltiplas categorias (${multi.contagem}) — revisar`,
    )
  }

  // Lifecycle (CRÍTICO — guard R$ 939k)
  // ⚠ Lifecycle exige dueDate em PAYABLE. Se vencimento=null, usar
  //   competencia como fallback; se também null, joga erro de parse
  //   (não decide lifecycle).
  const dueDateParaLifecycle = vencimento ?? competencia
  let lifecycle: Lifecycle = 'PAYABLE'
  let pagamentoFinal: Date | null = pagamento

  if (dueDateParaLifecycle === null) {
    errosParse.push(
      'Sem DATA DE VENCIMENTO nem DATA COMPETENCIA — não dá pra decidir lifecycle',
    )
    // Default safe: PAYABLE com dueDate=null nem é gravável.
    // Marca pra revisão e segue.
    motivosRevisar.push('Datas ausentes — revisar')
  } else {
    const decisao = decidirLifecycleCacula({
      status: rawStatus,
      paymentDate: pagamento,
      dueDate: dueDateParaLifecycle,
    })
    lifecycle = decisao.lifecycle
    pagamentoFinal = decisao.paymentDateFinal
    if (decisao.precisaRevisar && decisao.motivoRevisar) {
      motivosRevisar.push(decisao.motivoRevisar)
    }
  }

  return {
    rowIndex,
    rawId,
    rawFavorecido,
    rawDescricao: buildDescricao(rawFavorecido, rawDescricaoCol),
    rawCategoria: rawCategoriaCol,
    rawCompetencia,
    rawVencimento,
    rawPagamento,
    rawValor: rawValorParseado,
    rawStatus,
    rawUnidade,
    rawNota,
    rawFormaPagamento,
    valor,
    competencia,
    vencimento,
    pagamento: pagamentoFinal,
    lifecycle,
    categoriaLimpa,
    temMultiplasCategorias: multi.temMultiplas,
    contagemCategorias: multi.contagem,
    todasCategorias: multi.todas,
    precisaRevisar: motivosRevisar.length > 0,
    motivosRevisar,
    errosParse,
  }
}

/**
 * Mapeia ParsedCsv inteiro pro shape CaculaMappedRow[].
 * Exige que ParsedCsv tenha sido validado por isCaculaHeader antes.
 */
export function mapearCacula(parsed: ParsedCsv): MapCaculaResult {
  if (!isCaculaHeader(parsed.headers)) {
    throw new Error(
      'mapearCacula chamado com header não-CACULA. Use o fluxo IA genérico.',
    )
  }

  const mapped: CaculaMappedRow[] = parsed.rows.map((row, i) =>
    mapearLinhaCacula(row, i),
  )

  // Unidade da 1ª linha (todas devem ser iguais; mostramos a 1ª)
  const unidadeArquivo = mapped[0]?.rawUnidade ?? null

  const stats = {
    total: mapped.length,
    effected: mapped.filter((r) => r.lifecycle === 'EFFECTED').length,
    payable: mapped.filter((r) => r.lifecycle === 'PAYABLE').length,
    receivable: mapped.filter((r) => r.lifecycle === 'RECEIVABLE').length,
    comErros: mapped.filter((r) => r.errosParse.length > 0).length,
    comRevisao: mapped.filter((r) => r.precisaRevisar).length,
  }

  return {
    rows: mapped,
    headers: parsed.headers,
    unidadeArquivo,
    stats,
  }
}
