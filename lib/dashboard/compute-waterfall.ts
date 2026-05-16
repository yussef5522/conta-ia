// Cashflow Waterfall — Sprint 2 Dia 1.
// Função PURA: agrupa transações de um período em barras de waterfall
// (saldo inicial → entradas → saídas → saldo final).
//
// REGRAS:
//   - `type` decide o LADO (CREDIT = entrada, DEBIT = saída) — é sobre CAIXA.
//   - `dreGroup` refina o BUCKET dentro do lado.
//   - IGNORA type=TRANSFER (movimentação interna) e dreGroup=AJUSTE_SALDO
//     (correção técnica, não fluxo real de caixa).
//   - Sem dreGroup → agrupa por type em "Outras entradas" / "Outras saídas".
//   - DISTRIBUICAO_LUCROS + INVESTIMENTOS entram em "Outras saídas" (são caixa
//     real saindo, mesmo sendo não-DRE).

export type WaterfallPeriodType = 'semana' | 'mes' | 'trimestre' | 'ano'

export interface WaterfallTransaction {
  id: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  amount: number // sempre positivo
  date: Date
  dreGroup: string | null // da categoria; null se transação sem categoria
}

export type WaterfallBarKind = 'start' | 'income' | 'expense' | 'end'

export interface WaterfallBar {
  id: string
  label: string
  kind: WaterfallBarKind
  // Valor "real" pro tooltip (sempre positivo — o tamanho do fluxo)
  rawValue: number
  // Pro Recharts (técnica de waterfall com 2 séries stacked):
  //   displayBase  = série transparente (offset onde a barra começa)
  //   displayValue = série colorida (altura visível da barra)
  displayBase: number
  displayValue: number
  color: string
}

export interface WaterfallResult {
  companyId: string
  periodType: WaterfallPeriodType
  period: { startDate: Date; endDate: Date }
  bars: WaterfallBar[]
  saldoInicial: number
  saldoFinal: number
  totalEntradas: number
  totalSaidas: number
  // Total movimentado (entradas + saídas absolutos) — pro tooltip "% do total"
  totalMovimentado: number
}

// Paleta DASHBOARD-PLAN B.5
const COLOR_SALDO = '#185FA5' // brand (azul)
const COLOR_ENTRADA = '#1D9E75' // success (verde)
const COLOR_ENTRADA_OUTRAS = '#5DCAA5' // teal claro
const COLOR_SAIDA = '#E24B4A' // danger (vermelho)
const COLOR_SAIDA_OUTRAS = '#F09595' // vermelho claro

// dreGroups que são RECEITA (lado entrada quando type=CREDIT)
const RECEITA_GROUPS = new Set([
  'RECEITA_BRUTA',
  'RECEITAS_FINANCEIRAS',
  'OUTRAS_RECEITAS',
])

// Mapeamento dreGroup → bucket de SAÍDA
const SAIDA_BUCKET: Record<string, string> = {
  DESPESAS_PESSOAL: 'folha',
  CUSTO_PRODUTO_VENDIDO: 'fornecedores',
  DESPESAS_COMERCIAIS: 'fornecedores',
  DESPESAS_ADMINISTRATIVAS: 'operacional',
  DESPESAS_FINANCEIRAS: 'operacional',
  IMPOSTOS_SOBRE_LUCRO: 'impostos',
  DEDUCOES: 'impostos',
  OUTRAS_DESPESAS: 'outras-saidas',
  DISTRIBUICAO_LUCROS: 'outras-saidas',
  INVESTIMENTOS: 'outras-saidas',
}

// Ordem + labels dos buckets de saída
const SAIDA_ORDER: Array<{ bucket: string; label: string; color: string }> = [
  { bucket: 'folha', label: 'Folha', color: COLOR_SAIDA },
  { bucket: 'fornecedores', label: 'Fornecedores', color: COLOR_SAIDA },
  { bucket: 'operacional', label: 'Operacional', color: COLOR_SAIDA },
  { bucket: 'impostos', label: 'Impostos', color: COLOR_SAIDA },
  { bucket: 'outras-saidas', label: 'Outras saídas', color: COLOR_SAIDA_OUTRAS },
]

export interface ComputeWaterfallInput {
  companyId: string
  periodType: WaterfallPeriodType
  periodStart: Date
  periodEnd: Date
  // Saldo no FIM do período (já calculado pelo caller a partir do balance
  // cacheado − net das transações pós-período).
  saldoFinal: number
  // Transações DENTRO do período (caller filtra por data).
  transactions: WaterfallTransaction[]
}

export function computeWaterfall(input: ComputeWaterfallInput): WaterfallResult {
  if (!input.companyId) {
    throw new Error('companyId é obrigatório (isolamento multi-tenant)')
  }

  // 1. Filtra TRANSFER + AJUSTE_SALDO e acumula por bucket
  let receitas = 0
  let outrasEntradas = 0
  const saidaPorBucket = new Map<string, number>()

  for (const tx of input.transactions) {
    if (tx.type === 'TRANSFER') continue
    if (tx.dreGroup === 'AJUSTE_SALDO') continue
    // Categoria "Transferências" (dreGroup=TRANSFERENCIA): movimentação
    // interna manual — não é fluxo real de caixa do negócio.
    if (tx.dreGroup === 'TRANSFERENCIA') continue

    if (tx.type === 'CREDIT') {
      // Lado ENTRADA — dreGroup refina o bucket
      if (tx.dreGroup && RECEITA_GROUPS.has(tx.dreGroup)) {
        receitas += tx.amount
      } else {
        outrasEntradas += tx.amount
      }
    } else if (tx.type === 'DEBIT') {
      // Lado SAÍDA — dreGroup mapeia o bucket; sem mapa → "outras-saidas"
      const bucket =
        (tx.dreGroup && SAIDA_BUCKET[tx.dreGroup]) || 'outras-saidas'
      saidaPorBucket.set(bucket, (saidaPorBucket.get(bucket) ?? 0) + tx.amount)
    }
    // Tipos desconhecidos ignorados (defensivo)
  }

  const totalEntradas = receitas + outrasEntradas
  const totalSaidas = Array.from(saidaPorBucket.values()).reduce(
    (s, v) => s + v,
    0,
  )

  // 2. Saldo inicial = saldo final − fluxo líquido do período
  const saldoInicial = round2(input.saldoFinal - (totalEntradas - totalSaidas))

  // 3. Monta as barras com running total (técnica waterfall)
  const bars: WaterfallBar[] = []
  let running = saldoInicial

  // Barra: Saldo Inicial
  bars.push(makeAnchorBar('saldo-inicial', 'Saldo Inicial', 'start', saldoInicial))

  // Barras de ENTRADA (verde)
  if (receitas > 0) {
    bars.push(makeFlowBar('receitas', 'Receitas', 'income', receitas, running, COLOR_ENTRADA))
    running = round2(running + receitas)
  }
  if (outrasEntradas > 0) {
    bars.push(
      makeFlowBar('outras-entradas', 'Outras entradas', 'income', outrasEntradas, running, COLOR_ENTRADA_OUTRAS),
    )
    running = round2(running + outrasEntradas)
  }

  // Barras de SAÍDA (vermelho) na ordem fixa
  for (const { bucket, label, color } of SAIDA_ORDER) {
    const valor = saidaPorBucket.get(bucket) ?? 0
    if (valor <= 0) continue
    bars.push(makeFlowBar(bucket, label, 'expense', valor, running, color, true))
    running = round2(running - valor)
  }

  // Barra: Saldo Final
  bars.push(makeAnchorBar('saldo-final', 'Saldo Final', 'end', round2(running)))

  return {
    companyId: input.companyId,
    periodType: input.periodType,
    period: { startDate: input.periodStart, endDate: input.periodEnd },
    bars,
    saldoInicial,
    saldoFinal: round2(input.saldoFinal),
    totalEntradas: round2(totalEntradas),
    totalSaidas: round2(totalSaidas),
    totalMovimentado: round2(totalEntradas + totalSaidas),
  }
}

// Barra-âncora (saldo inicial/final): vai de 0 até o saldo (ou do saldo até 0
// se negativo). É o "chão" do waterfall.
function makeAnchorBar(
  id: string,
  label: string,
  kind: WaterfallBarKind,
  saldo: number,
): WaterfallBar {
  return {
    id,
    label,
    kind,
    rawValue: saldo,
    displayBase: saldo >= 0 ? 0 : saldo,
    displayValue: Math.abs(saldo),
    color: COLOR_SALDO,
  }
}

// Barra de fluxo (entrada/saída): flutua a partir do running total.
function makeFlowBar(
  id: string,
  label: string,
  kind: WaterfallBarKind,
  valor: number,
  running: number,
  color: string,
  isExpense = false,
): WaterfallBar {
  // Entrada: sobe de `running` até `running + valor`.
  // Saída: desce de `running` até `running − valor`.
  const displayBase = isExpense ? round2(running - valor) : running
  return {
    id,
    label,
    kind,
    rawValue: valor,
    displayBase,
    displayValue: valor,
    color,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
