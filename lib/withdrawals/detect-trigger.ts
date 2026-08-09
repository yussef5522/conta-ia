// Sprint Ponte-na-hora (08/08/2026). Decide, ao escolher uma categoria no
// dropdown (Pendentes/etc), se deve ABRIR o painel de retirada PJ→PF na hora — e
// qual tipo pré-selecionar.
//
// Decisão do Yussef (08/08):
//   - "Distribuição de Lucros" (DISTRIBUICAO_LUCROS, não pró-labore) → tipo DISTRIBUICAO
//   - "Pró-labore" (DESPESAS_PESSOAL) → tipo PRO_LABORE
//   - INSS sobre pró-labore → NÃO dispara (é imposto ao governo, não dinheiro pro sócio)
//   - Mistas (Pró-labore Sócios / Pró-labore e Distribuição / Retirada de Lucros /
//     Pró-labore, todas DISTRIBUICAO_LUCROS) → DISPARA, mas tipo VAZIO: o nome é
//     ambíguo, qualquer default seria chute, e o tipo muda o tratamento no DRE.
//
// ⚠️ Isto decide só a UI (abrir o painel + sugerir tipo). A CONTABILIDADE
// ("já distribuído") usa bridge.kind (dado gravado), NÃO nome de categoria —
// ver lucro-disponivel. Aqui nome é aceitável (é conveniência; se errar, o
// usuário fecha o painel ou escolhe o tipo). Função PURA.

import type { WithdrawalKind } from './suggest-from-description'

export interface WithdrawalTrigger {
  /** true = abrir o painel de retirada ao escolher esta categoria. */
  triggers: boolean
  /** tipo pré-selecionado; null = deixar o usuário escolher (mistas). */
  suggestedKind: WithdrawalKind | null
}

const RE_PROLABORE = /pr[oó]\s*-?\s*labore/i
const RE_INSS = /inss/i
const RE_DISTRIBUI = /distribui/i

export function detectWithdrawalTrigger(cat: {
  name: string
  dreGroup: string | null | undefined
}): WithdrawalTrigger {
  const name = cat.name ?? ''
  // INSS/imposto: nunca dispara (não é retirada pro sócio).
  if (RE_INSS.test(name)) return { triggers: false, suggestedKind: null }

  if (cat.dreGroup === 'DISTRIBUICAO_LUCROS') {
    // "Distribuição de Lucros" puro → tipo claro.
    if (RE_DISTRIBUI.test(name) && !RE_PROLABORE.test(name)) {
      return { triggers: true, suggestedKind: 'DISTRIBUICAO' }
    }
    // Mistas → dispara, mas usuário escolhe o tipo.
    return { triggers: true, suggestedKind: null }
  }

  // Pró-labore de sócio (folha CLT fica de fora — só a categoria pró-labore).
  if (cat.dreGroup === 'DESPESAS_PESSOAL' && RE_PROLABORE.test(name)) {
    return { triggers: true, suggestedKind: 'PRO_LABORE' }
  }

  return { triggers: false, suggestedKind: null }
}
