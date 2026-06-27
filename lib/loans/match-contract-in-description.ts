// Sprint OFX V3 R7 — match de contrato em descrição (função PURA reutilizável).
//
// Extraída de lib/loans/auto-conciliacao.ts pra ser usada TAMBÉM no preview
// V3 (client-side via lib reexportada). Antes, PreviewV3Premium tinha uma
// função local `findLoanInstallmentCandidate` que NÃO olhava contractNumber —
// daí "LIQUIDACAO DE PARCELA-C41022227" (Sicredi do Yussef) ficava "escolha
// você" no preview, mesmo com o contrato impresso na descrição.
//
// Mesma lógica do auto-conciliacao.ts (CONTRACT_NUMBER strong match), só
// que separada e sem dep do Prisma. Sinais:
//   - SINAL FORTE: descrição contém contractNumber normalizado (≥5 chars)
//     → janela de data LARGA (±15d) porque contrato JÁ identifica
//     → tolera divergência de valor (pos-fixado: até 30%)
//   - SINAL MÉDIO: descrição "EMPRESTIMO" genérica + valor próximo + ±3d
//     → janela curta (regra do Yussef: ±3d por feriado/fim-de-semana)
//     → pos-fixado: aceita até 15% diff com selo "confira"

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Normaliza string pra comparação substring de contrato:
 * lowercase + remove tudo que não é alfanumérico.
 * "LIQUIDACAO DE PARCELA-C41022227" → "liquidacaodeparcelac41022227"
 * "C41022227" → "c41022227" → match.
 */
export function normalizeForContractMatch(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Procura padrões de contrato brasileiro na descrição:
 *   - C\d{8} (ex: C41022227 — Sicredi)
 *   - 002100\d{9}  (ex: 002100057538834 — Banrisul BNDES)
 *   - \d{10,15}    (genérico — alguns bancos imprimem só dígitos)
 * Retorna a primeira match não vazia.
 */
export function extractContractCandidatesFromDescription(desc: string): string[] {
  if (!desc) return []
  const out: string[] = []
  const s = desc.toUpperCase()
  // 1) C + 8 dígitos (Sicredi PRICE/SAC)
  const cMatches = s.match(/C\d{8,}/g)
  if (cMatches) out.push(...cMatches)
  // 2) 002100 + 9+ dígitos (Banrisul BNDES)
  const banrisulMatches = s.match(/002100\d{9,}/g)
  if (banrisulMatches) out.push(...banrisulMatches)
  // 3) Genérico ≥10 dígitos (fallback — depois testa contractKey individual)
  const genericMatches = s.match(/\d{10,}/g)
  if (genericMatches) out.push(...genericMatches)
  return out
}

export interface LoanLite {
  id: string
  lender: string
  contractNumber: string | null
  pendingInstallments: Array<{
    number: number
    dueDate: string  // ISO
    payment: number
    /** quando true, pos-fixado: aceita divergência maior */
    isEstimate?: boolean
  }>
}

export interface CandidateMatch {
  loanId: string
  loanLender: string
  contractNumber: string | null
  installmentNumber: number
  plannedAmount: number
  daysFromDueDate: number
  /** STRONG = contrato bateu na descrição; MEDIUM = só valor+data */
  matchKind: 'CONTRACT_NUMBER' | 'AMOUNT_DATE'
  /** quanto o valor real diverge do planejado (positivo se acima) */
  amountDiff: number
}

interface FindOptions {
  /** Janela ±N dias quando MATCH POR CONTRATO (default 15 — contrato já identifica) */
  contractWindowDays?: number
  /** Janela ±N dias quando MATCH POR VALOR+DATA (default 3 — regra Yussef) */
  amountDateWindowDays?: number
  /** Tolerância absoluta R$ quando match exato (default 0.50) */
  strongAmountTol?: number
  /** Tolerância % do payment quando pos-fixado + contrato bate (default 0.30) */
  contractEstimateTol?: number
  /** Tolerância % do payment quando pos-fixado SEM contrato (default 0.15) */
  generalEstimateTol?: number
}

/**
 * Busca candidato de parcela para uma transação OFX. Função PURA.
 *
 * Ordem de prioridade:
 *   1. CONTRACT_NUMBER match (FORTE):
 *      - contractNumber do loan está na descrição (normalizado)
 *      - janela ±contractWindowDays dias do vencimento (default 15)
 *      - valor: ±strongAmountTol R$ OU ±contractEstimateTol% se pos-fixado
 *      → matchKind=CONTRACT_NUMBER, selo ALTA na UI
 *   2. AMOUNT_DATE match (MÉDIO):
 *      - descrição parece de empréstimo (palavra-chave) OU sem outro sinal
 *      - janela ±amountDateWindowDays dias (default 3)
 *      - valor: ±strongAmountTol R$ OU ±generalEstimateTol% se pos-fixado
 *      → matchKind=AMOUNT_DATE, selo MEDIA na UI (suggestLineKind decide)
 *
 * Retorna null se nenhum loan/parcela bate.
 * Se múltiplos candidatos batem por valor+data sem contrato, retorna null
 * (caller pode marcar como "confira manualmente"). Se múltiplos batem por
 * contrato, retorna o de menor |dias| pra ser determinístico.
 */
export function findLoanInstallmentForTransaction(
  tx: { description: string; amount: number; type: 'CREDIT' | 'DEBIT' | string; date: string | Date },
  loans: LoanLite[],
  opts: FindOptions = {},
): CandidateMatch | null {
  if (tx.type !== 'DEBIT') return null
  const {
    contractWindowDays = 15,
    amountDateWindowDays = 3,
    strongAmountTol = 0.50,
    contractEstimateTol = 0.30,
    generalEstimateTol = 0.15,
  } = opts

  const txDate = new Date(tx.date)
  const txDescNorm = normalizeForContractMatch(tx.description)
  const isLoanWord = /empr[eé]stimo|emprestimo|parcela|financ|liquida[cç][aã]o\s+de\s+parcela/i.test(tx.description)

  // FASE 1 — Contrato forte
  const strongMatches: CandidateMatch[] = []
  for (const loan of loans) {
    if (!loan.contractNumber || loan.contractNumber.length < 5) continue
    const contractKey = normalizeForContractMatch(loan.contractNumber)
    if (!contractKey || !txDescNorm.includes(contractKey)) continue
    // contrato bate — varredura nas pending pelo +próximo do due
    for (const p of loan.pendingInstallments) {
      const due = new Date(p.dueDate)
      const days = Math.abs(Math.round((txDate.getTime() - due.getTime()) / MS_PER_DAY))
      if (days > contractWindowDays) continue
      const diff = Math.abs(tx.amount - p.payment)
      const tol = p.isEstimate
        ? Math.max(p.payment * contractEstimateTol, strongAmountTol)
        : strongAmountTol
      if (diff > tol) continue
      strongMatches.push({
        loanId: loan.id,
        loanLender: loan.lender,
        contractNumber: loan.contractNumber,
        installmentNumber: p.number,
        plannedAmount: p.payment,
        daysFromDueDate: days,
        matchKind: 'CONTRACT_NUMBER',
        amountDiff: tx.amount - p.payment,
      })
    }
  }
  if (strongMatches.length > 0) {
    // Mais próximo do vencimento ganha (determinístico — se empate, menor parcela)
    strongMatches.sort((a, b) => a.daysFromDueDate - b.daysFromDueDate || a.installmentNumber - b.installmentNumber)
    return strongMatches[0]
  }

  // FASE 2 — Valor + Data ±3d (descrição genérica EMPRESTIMO)
  const mediumMatches: CandidateMatch[] = []
  for (const loan of loans) {
    for (const p of loan.pendingInstallments) {
      const due = new Date(p.dueDate)
      const days = Math.abs(Math.round((txDate.getTime() - due.getTime()) / MS_PER_DAY))
      if (days > amountDateWindowDays) continue
      const diff = Math.abs(tx.amount - p.payment)
      const tol = p.isEstimate
        ? Math.max(p.payment * generalEstimateTol, strongAmountTol)
        : strongAmountTol
      if (diff > tol) continue
      // Sem keyword "empréstimo" na descrição → rejeita pra evitar falso positivo
      // (ex: "PAGAMENTO FORNECEDOR R$ 2.516,91" não devia virar parcela)
      if (!isLoanWord) continue
      mediumMatches.push({
        loanId: loan.id,
        loanLender: loan.lender,
        contractNumber: loan.contractNumber,
        installmentNumber: p.number,
        plannedAmount: p.payment,
        daysFromDueDate: days,
        matchKind: 'AMOUNT_DATE',
        amountDiff: tx.amount - p.payment,
      })
    }
  }
  // Múltiplos candidatos sem contrato → ambíguo, devolve null (UI mostra "escolha")
  if (mediumMatches.length === 1) return mediumMatches[0]
  if (mediumMatches.length > 1) return null

  return null
}
