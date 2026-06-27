// Sprint OFX V3 Premium — IA sugere kind + explica o porquê (função PURA).
//
// Recebe sinais já calculados pelo preview existente:
//   - predict da regra (predictCategory)
//   - detecção de transferência (lib/ofx/detect-transfer.ts)
//   - detecção de pagamento de cartão (lib/credit-card-pj/payment-detector)
//   - candidato a parcela de empréstimo (autoConciliarParcelas equiv)
//
// Devolve {kind, confidence, reason} pra UI exibir o selo + frase explicativa.

import type { AiSuggestion, OfxLineKind, AiSuggestionConfidence } from './types'

export interface SuggestLineKindInput {
  description: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  /** Sugestão de categoria via predictCategory (já computada no preview) */
  predictedCategoryId?: string | null
  predictedCategoryName?: string | null
  predictedConfidence?: number
  predictedRulePattern?: string | null
  /** Detector de pagamento de cartão (lib/credit-card-pj/payment-detector) */
  cardPaymentLikely?: boolean
  /** Candidato a parcela de empréstimo: parcela com vencimento perto + valor próximo */
  loanInstallmentCandidate?: {
    loanLender: string
    contractNumber: string | null
    installmentNumber: number
    plannedAmount: number
    daysFromDueDate: number
  } | null
  /** Cartão sugerido (quando cardPaymentLikely + match único): {id, name} */
  cardCandidate?: { id: string; name: string } | null
  /** Detecção de transferência (lib/ofx/detect-transfer) — quando rolou no preview */
  transferDetected?: {
    confidence: number
    hasPair: boolean
    keyword: string | null
  } | null
}

export function suggestLineKind(input: SuggestLineKindInput): AiSuggestion {
  const desc = (input.description || '').trim()

  // 1) Pagamento de cartão (alta prioridade quando descrição bate)
  if (input.type === 'DEBIT' && input.cardPaymentLikely) {
    return {
      suggestedKind: 'PAGAMENTO_CARTAO',
      confidence: input.cardCandidate ? 'ALTA' : 'MEDIA',
      reason: input.cardCandidate
        ? `Parece pagamento do cartão ${input.cardCandidate.name}`
        : 'Parece pagamento de cartão — confirme qual',
      suggestedCardId: input.cardCandidate?.id ?? null,
    }
  }

  // 2) Pagamento de empréstimo (parcela com vencimento batendo)
  if (input.type === 'DEBIT' && input.loanInstallmentCandidate) {
    const c = input.loanInstallmentCandidate
    const diff = Math.abs(input.amount - c.plannedAmount)
    const dateOk = c.daysFromDueDate <= 3
    if (diff < 0.50 && dateOk) {
      return {
        suggestedKind: 'PAGAMENTO_EMPRESTIMO',
        confidence: 'ALTA',
        reason: `Parcela ${c.installmentNumber} do ${c.loanLender}${c.contractNumber ? ' ' + c.contractNumber : ''} (vence hoje)`,
        suggestedLoanId: null, // (loanId não veio pra função pura — UI resolve)
        suggestedInstallmentNumber: c.installmentNumber,
      }
    }
    if (dateOk && diff <= input.amount * 0.10) {
      // Caso BNDES R$ 2.516,91 vs estimado R$ 2.365,59 (diff 6% — correção pós-fixada)
      return {
        suggestedKind: 'PAGAMENTO_EMPRESTIMO',
        confidence: 'MEDIA',
        reason: `Parcela ${c.installmentNumber} ${c.loanLender}${c.contractNumber ? ' ' + c.contractNumber : ''}: vence hoje, valor R$ ${diff.toFixed(2)} acima — provável correção pós-fixada`,
        suggestedInstallmentNumber: c.installmentNumber,
      }
    }
  }

  // 3) Transferência (com par ou aguardando)
  if (input.transferDetected) {
    const t = input.transferDetected
    if (t.hasPair && t.confidence >= 0.85) {
      return {
        suggestedKind: 'TRANSFER',
        confidence: 'ALTA',
        reason: t.keyword
          ? `Transferência entre suas contas (${t.keyword})`
          : 'Transferência entre suas contas',
      }
    }
    if (!t.hasPair && (t.keyword === 'PIX' || t.keyword === 'TED' || t.keyword === 'TRANSFER')) {
      return {
        suggestedKind: 'TRANSFER',
        confidence: 'AGUARDA_PAR',
        reason: 'Pode ser transferência entre suas contas — aguarda o par do outro banco',
      }
    }
    if (t.confidence >= 0.70) {
      return {
        suggestedKind: 'TRANSFER',
        confidence: 'MEDIA',
        reason: 'Possível transferência — confira',
      }
    }
  }

  // 4) Receita (CREDIT) com categoria predita
  if (input.type === 'CREDIT' && input.predictedCategoryId) {
    const conf: AiSuggestionConfidence =
      (input.predictedConfidence ?? 0) >= 0.95 ? 'ALTA' : 'MEDIA'
    return {
      suggestedKind: 'RECEITA',
      confidence: conf,
      reason: input.predictedRulePattern
        ? `${conf === 'ALTA' ? 'Regra aprendida' : 'Provável'}: ${input.predictedCategoryName ?? 'receita categorizada'}`
        : `${input.predictedCategoryName ?? 'Receita'}`,
      suggestedCategoryId: input.predictedCategoryId,
    }
  }

  // 5) CREDIT sem regra clara: deixa pro user decidir
  if (input.type === 'CREDIT') {
    return {
      suggestedKind: 'RECEITA',
      confidence: 'BAIXA',
      reason: 'Entrada — escolha a categoria',
    }
  }

  // 6) Despesa com categoria predita
  if (input.type === 'DEBIT' && input.predictedCategoryId) {
    const conf: AiSuggestionConfidence =
      (input.predictedConfidence ?? 0) >= 0.95 ? 'ALTA' : 'MEDIA'
    return {
      suggestedKind: 'DESPESA',
      confidence: conf,
      reason: input.predictedRulePattern
        ? `${conf === 'ALTA' ? 'Regra aprendida' : 'Provável'}: ${input.predictedCategoryName ?? 'despesa categorizada'}`
        : `${input.predictedCategoryName ?? 'Despesa'}`,
      suggestedCategoryId: input.predictedCategoryId,
    }
  }

  // 7) Despesa sem palpite — confianca baixa
  return {
    suggestedKind: 'DESPESA',
    confidence: 'BAIXA',
    reason: 'Escolha o tipo e categoria',
  }
}

// Helper visual: cor/label do selo de confiança pra UI.
export function confidencePillVisual(c: AiSuggestionConfidence): {
  label: string
  tone: 'emerald' | 'amber' | 'slate' | 'blue'
} {
  switch (c) {
    case 'ALTA':       return { label: 'tenho certeza', tone: 'emerald' }
    case 'MEDIA':      return { label: 'confira', tone: 'amber' }
    case 'AGUARDA_PAR':return { label: 'aguarda par', tone: 'blue' }
    case 'BAIXA':      return { label: 'escolha você', tone: 'slate' }
  }
}
