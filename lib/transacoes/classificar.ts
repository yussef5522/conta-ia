// Helper de classificação de transações.
// Centraliza a montagem dos campos de metadado pra que os endpoints de
// atualização (PUT individual e PATCH lote) sempre sigam o mesmo contrato.
//
// Em 4.5: classificação é sempre manual.
// Em 4.6 (futuro loop de aprendizado): essa função vai ganhar uma variante
// que também cria/atualiza uma AiLearningRule a partir da confirmação.

import { statusFromCategoryId } from './needs-review'

export type ClassificationSource = 'MANUAL' | 'RULE' | 'BRASILAPI' | 'AI'

export interface UpdateClassificacao {
  categoryId: string | null
  classificationSource: ClassificationSource
  aiConfidence: number | null
  classifiedByRuleId: string | null
  status: 'PENDING' | 'RECONCILED'
}

// Monta o objeto de update pra uma classificação MANUAL.
// Sempre limpa os campos de IA (aiConfidence, classifiedByRuleId) — uma
// classificação manual não vem de regra nem tem confiança de IA.
//
// Sprint Escada-Status (28/06/2026): também aplica a invariante da escada
// completa via statusFromCategoryId. Tem categoria ⇒ RECONCILED.
// Tira categoria (null) ⇒ PENDING. Sem isso, PATCH /api/transacoes/[id]
// e /api/transacoes/lote deixavam a tx em estado invertido (categoryId
// preenchido mas status=PENDING) — bug ativo descoberto na 5ª sessão.
export function montarUpdateClassificacaoManual(
  categoryId: string | null,
): UpdateClassificacao {
  return {
    categoryId,
    classificationSource: 'MANUAL',
    aiConfidence: null,
    classifiedByRuleId: null,
    status: statusFromCategoryId(categoryId),
  }
}
