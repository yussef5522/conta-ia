// ESTOQUE FASE 1 item 3 — STATUS do item vs min/max (fonte ÚNICA, REGRA 4/5).
// Verde dentro · vermelho abaixo do mín · azul acima do máx · cinza sem mín definido.
// A barra: escala 0..fim (fim = máx, ou mín*2 quando não há máx → o mín fica no meio).
// Função pura — a tela E o CSV E o juiz leem daqui (nunca recalcular status noutro lugar).

export type StatusEstoque = 'ABAIXO' | 'DENTRO' | 'ACIMA' | 'SEM_MIN'
export type CorStatus = 'verde' | 'vermelho' | 'azul' | 'cinza'

export interface StatusEstoqueResult {
  status: StatusEstoque
  cor: CorStatus
  label: string
  // posições na barra (0-100); null quando não se aplica. barra=null quando não há mínimo.
  barra: { saldoPct: number; minPct: number; maxPct: number | null } | null
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function statusEstoque(saldo: number, min: number | null | undefined, max: number | null | undefined): StatusEstoqueResult {
  if (min == null) return { status: 'SEM_MIN', cor: 'cinza', label: 'sem mínimo definido', barra: null }

  let status: StatusEstoque
  let cor: CorStatus
  let label: string
  if (saldo < min) { status = 'ABAIXO'; cor = 'vermelho'; label = 'abaixo do mínimo' }
  else if (max != null && saldo > max) { status = 'ACIMA'; cor = 'azul'; label = 'acima do máximo' }
  else { status = 'DENTRO'; cor = 'verde'; label = 'dentro da faixa' }

  const fim = max != null && max > 0 ? max : min * 2 || 1
  const pct = (v: number) => clamp((v / fim) * 100)
  return { status, cor, label, barra: { saldoPct: pct(saldo), minPct: pct(min), maxPct: max != null ? pct(max) : null } }
}
