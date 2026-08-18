// VENDAS FASE 1 (17/08/2026) — resolução da REGRA de recebimento vigente. Puro.
// A regra diz, pra (conta, meio, data), quantos dias úteis o dinheiro atrasa e se
// recebe fim de semana. COM VIGÊNCIA: a Cacula migrou o PIX pra Tuna em 12/08 →
// antes/depois têm regras diferentes; a data da linha decide qual vale.
//
// Sem regra vigente pra (conta, meio, data) → DEFAULT (D+1 sem fim de semana) +
// flag `confirmado:false` → a TELA avisa "perfil não confirmado" (nunca assume em
// silêncio). Mesma disciplina dos empréstimos: o que é inferido é marcado, não
// tem cara de fato.

export type Meio = 'PIX' | 'CARTAO' | 'DINHEIRO' | 'OUTRO'

export interface RegraRecebimento {
  bankAccountId: string
  meio: Meio
  diasUteisAtraso: number
  recebeSabDom: boolean
  vigenteDe: Date
  vigenteAte: Date | null // null = aberto
  origemHint?: string | null
  confirmadoPeloDono?: boolean
}

// ⚠️ INTERPRETAÇÃO do atraso (usada por computeCompetencia, item 2):
//   recebeSabDom=false → o atraso conta em dias ÚTEIS (pula fim de semana/feriado);
//     o dinheiro do fim de semana chega junto no 1º dia útil → BLOCO (seg = {sex..dom}).
//   recebeSabDom=true  → o atraso conta em dias CORRIDOS (o meio opera todo dia);
//     cada dia mapeia pra exatamente 1 dia anterior, SEM bloco (cofre: sáb=sex, dom=sáb).
export interface RegraResolvida {
  diasUteisAtraso: number
  recebeSabDom: boolean
  confirmado: boolean // false = default assumido (a tela avisa)
  origemHint?: string | null
}

// Default quando não há regra vigente: D+1 útil, não recebe fim de semana, NÃO
// confirmado (perfil da Cacula é o mais comum; a tela mostra a flag pra o dono
// confirmar). Nunca assumir D+0 em silêncio.
export const DEFAULT_REGRA: RegraResolvida = {
  diasUteisAtraso: 1,
  recebeSabDom: false,
  confirmado: false,
  origemHint: null,
}

/** Regra vigente em `data` para (conta, meio): vigenteDe <= data < (vigenteAte ?? ∞). */
export function resolveRegraRecebimento(
  regras: ReadonlyArray<RegraRecebimento>,
  bankAccountId: string,
  meio: Meio,
  data: Date,
): RegraResolvida {
  const t = data.getTime()
  const candidatas = regras.filter(
    (r) =>
      r.bankAccountId === bankAccountId &&
      r.meio === meio &&
      r.vigenteDe.getTime() <= t &&
      (r.vigenteAte === null || t < r.vigenteAte.getTime()),
  )
  if (candidatas.length === 0) return DEFAULT_REGRA
  // Se houver mais de uma (não deveria), a de vigenteDe mais RECENTE ganha.
  const vig = candidatas.reduce((a, b) => (b.vigenteDe.getTime() > a.vigenteDe.getTime() ? b : a))
  return {
    diasUteisAtraso: vig.diasUteisAtraso,
    recebeSabDom: vig.recebeSabDom,
    confirmado: vig.confirmadoPeloDono ?? false,
    origemHint: vig.origemHint ?? null,
  }
}
