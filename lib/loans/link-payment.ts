// Sprint Casar Pagamento (04/08/2026) — FASE 4/5: split de um GRUPO de lançamentos
// (débito parcial) contra UMA parcela. Identidade validada nos 3 bancos:
//   PAGO = AMORTIZAÇÃO + JUROS + CORREÇÃO + MORA
// AMORTIZAÇÃO vem do cronograma (determinística, fora do DRE). ENCARGOS = pago −
// amortização (o residual: juros+correção+mora), despesa financeira REAL no DRE.
// Puro — sem DB.

import { validateSchedule, type ScheduleRowForValidation } from './validate-schedule'
import { descriptionMatchesContract } from './contract-core'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const TOL = 0.02

// Palavra-chave de empréstimo — lista candidatos ADICIONÁVEIS quando não há número
// na descrição (Caixa/Banrisul). NÃO pré-seleciona (evita misturar contratos da
// mesma conta).
const LOAN_KW = /empr[eé]stimo|emprestimo|amortizac|liquidac|presta|contrato|financ|parcela|pronampe/i

export interface GroupTx { id: string; description: string; amount: number; date: Date }
export interface BuildLinkGroupInput {
  /** pendentes DEBIT da conta na janela. */
  pend: GroupTx[]
  contractNumber: string | null
  /** tx que originou o clique — SEMPRE pré-selecionada (BUG 1). */
  originTxId?: string
  /** seleção explícita do usuário (toggle). Sem isso, usa o grupo auto. */
  transactionIds?: string[]
}
export interface LinkGroup {
  candidates: Array<GroupTx & { selected: boolean }>
  selectedIds: string[]
  paidTotal: number
}

/**
 * Monta o grupo do painel de vínculo. Regra:
 *  - AUTO = lançamentos que batem o contrato (Sicredi) + SEMPRE a tx clicada.
 *  - sem número (Caixa/Banrisul): grupo começa só com a tx clicada — NUNCA
 *    auto-agrupa por palavra-chave (misturaria os 2 contratos da mesma conta).
 *  - candidatos exibidos = grupo + demais lançamentos loan-ish (adicionáveis,
 *    não pré-selecionados).
 * Puro — sem DB.
 */
export function buildLinkGroup(input: BuildLinkGroupInput): LinkGroup {
  const { pend, contractNumber, originTxId, transactionIds } = input
  const contractHits = contractNumber ? pend.filter((t) => descriptionMatchesContract(t.description, contractNumber)) : []
  const autoIds = new Set(contractHits.map((t) => t.id))
  if (originTxId && pend.some((t) => t.id === originTxId)) autoIds.add(originTxId)
  const selectedIds = new Set(transactionIds ?? [...autoIds])
  const universe = pend.filter((t) => autoIds.has(t.id) || selectedIds.has(t.id) || LOAN_KW.test(t.description ?? ''))
  const selected = universe.filter((t) => selectedIds.has(t.id))
  return {
    candidates: universe.map((t) => ({ ...t, selected: selectedIds.has(t.id) })),
    selectedIds: [...selectedIds],
    paidTotal: round2(selected.reduce((s, t) => s + t.amount, 0)),
  }
}

export interface LinkSplitInput {
  installment: { amortization: number; openingBalance: number }
  rateMonthly: number
  /** soma dos lançamentos do grupo. */
  paidTotal: number
}

export interface LinkSplit {
  /** amortização aplicada (do cronograma; = pago se parcial). Fora do DRE. */
  amortization: number
  paidInterest: number
  paidCorrection: number
  paidPenalty: number
  paidTotal: number
  /** juros+correção+mora = despesa financeira no DRE. */
  encargos: number
  closingBalance: number
  /** pago < amortização prevista → parcela PARCIAL, não quita. */
  isPartial: boolean
}

export function computeLinkSplit(input: LinkSplitInput): LinkSplit {
  const amortSched = round2(input.installment.amortization)
  const paidTotal = round2(input.paidTotal)
  const opening = round2(input.installment.openingBalance)

  // Parcial: pagou menos que a amortização prevista → tudo vira principal, sem
  // encargos, e a parcela NÃO quita (FASE 4.4).
  if (paidTotal < amortSched - TOL) {
    return {
      amortization: paidTotal, paidInterest: 0, paidCorrection: 0, paidPenalty: 0,
      paidTotal, encargos: 0, closingBalance: round2(opening - paidTotal), isPartial: true,
    }
  }

  const encargos = round2(paidTotal - amortSched)
  // Juros nominais = saldo × taxa; correção+mora = o que sobra dos encargos.
  // Clamp pra ambos >= 0 e soma == encargos (o DRE usa só o total).
  const interest = Math.min(round2(opening * input.rateMonthly), encargos)
  const correcao = round2(encargos - interest)
  return {
    amortization: amortSched, paidInterest: interest, paidCorrection: correcao, paidPenalty: 0,
    paidTotal, encargos, closingBalance: round2(opening - amortSched), isPartial: false,
  }
}

// ── FIX matcher por data (05/08/2026) ──
// Antes o painel casava sempre com a parcela ABERTA mais antiga (openList[0]).
// Em PRICE de parcela fixa o VALOR não distingue nada, então pagamentos
// consecutivos ficavam cada um uma posição atrás. Agora casa pela DATA: a parcela
// cujo dueDate está mais próximo da data do débito.
export interface OpenInstallment { number: number; dueDate: Date; payment: number; status: string }
export interface TargetPick {
  target: OpenInstallment | null
  /** escolheu pela data porque o valor não distinguia (várias parcelas iguais). */
  byDate: boolean
  /** 2+ parcelas abertas com o MESMO valor (o valor não decide). */
  valorAmbiguo: boolean
  /** 2+ parcelas igualmente próximas por data (nem a data decide → perguntar). */
  dateAmbiguo: boolean
  /** parcelas abertas ordenadas por proximidade de data (pro usuário escolher). */
  alternatives: OpenInstallment[]
}

export function pickTargetInstallment(
  openList: OpenInstallment[],
  originDate: Date | null,
  originAmount: number | null,
): TargetPick {
  if (openList.length === 0) return { target: null, byDate: false, valorAmbiguo: false, dateAmbiguo: false, alternatives: [] }
  if (!originDate) return { target: openList[0], byDate: false, valorAmbiguo: false, dateAmbiguo: false, alternatives: openList }

  // Tolerância APERTADA (0,5%): parcela decrescente de SAC com valores distintos
  // é distinguida pelo VALOR; só PRICE fixo (ou SAC muito próximo) fica ambíguo.
  const tol = originAmount ? Math.max(1, originAmount * 0.005) : 1
  const valueMatches = originAmount != null ? openList.filter((i) => Math.abs(i.payment - originAmount) <= tol) : []
  const valorAmbiguo = valueMatches.length > 1
  // Se o valor distingue UMA parcela, usa ela. Senão (ambíguo ou nenhum bate),
  // escolhe a mais próxima por DATA entre as candidatas.
  const candidates = valueMatches.length > 0 ? valueMatches : openList

  const dist = (i: OpenInstallment) => Math.abs(i.dueDate.getTime() - originDate.getTime())
  const sorted = [...candidates].sort((a, b) => dist(a) - dist(b))
  const target = sorted[0]
  const dateAmbiguo = valorAmbiguo && sorted.length > 1 && dist(sorted[0]) === dist(sorted[1])
  return { target, byDate: valorAmbiguo, valorAmbiguo, dateAmbiguo, alternatives: [...openList].sort((a, b) => dist(a) - dist(b)) }
}

/**
 * A agenda ARMAZENADA do empréstimo (faixa rastreada) fecha? Decide se o split
 * flui pro DRE (FASE 5.3): agenda inválida → vincula mas não injeta split.
 */
export function storedScheduleValid(
  trackedInstallments: ScheduleRowForValidation[],
  base: number,
  ratePositive: boolean,
  isPostFixed: boolean,
): boolean {
  if (trackedInstallments.length === 0) return false
  return validateSchedule({ rows: trackedInstallments, base, ratePositive, isPostFixed }).ok
}
