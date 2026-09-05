// ⭐⭐⭐ QUE NÚMERO VAI GRANDE NO CARD DA CONTA (05/09/2026) — decisão do dono.
//
// > *"O número grande do card passa a ser o SALDO DEVEDOR (−8.347,67) — o mesmo que o app
// > do banco mostra. É esse que eu comparo todo dia; sistema mostrando outro número em
// > destaque parece errado mesmo estando certo."*
//
// ⭐ E A REGRA É DA FICHA DO BANCO, NÃO UM `if (Banrisul)`: vale pra qualquer conta cujo
// saldo declarado **embute bloqueio** (`ledgerBalReliable: false`). O dia em que outro
// banco tiver a mesma mania, o card acerta sozinho — e o dia em que o Banrisul parar de
// ter, também.
//
// ⛔⛔ ISTO É **SÓ APRESENTAÇÃO** — a fronteira é dura e está escrita aqui pra não
// escorregar depois:
//   · o LEDGER, a conferência diária, o selo e a âncora seguem **no CONTÁBIL** — é ele que
//     fecha ao centavo (26/26 dias, de 31/07 a 04/09);
//   · o **devedor dança com o bloqueio sem lançamento nenhum**, então ele nunca pode virar
//     régua de conciliação (foi exatamente o fantasma de R$ 1.700 de 01/09);
//   · **Saldo Total e Fluxo de Caixa continuam somando o CONTÁBIL** — senão o total do
//     dono dançaria com o bloqueio de cada banco.
//
// ⚠️ E O DEVEDOR VAI **DATADO**: ele é do último documento importado, não de hoje. Sem a
// data, um número velho passa por atual — e "sem inventar bloqueio de hoje que ninguém
// mediu" foi condição explícita do dono.

export interface DadosDoCard {
  /** `bankAccount.balance` — o saldo do nosso ledger; é ele que a conferência fecha */
  contabil: number
  /** o saldo DECLARADO pelo banco (LEDGERBAL / "SALDO DEVEDOR" do app) */
  declarado: number | null
  /** quando o banco declarou esse número */
  declaradoEm: Date | null
  /** o "(+) BLOQUEADO + 24 HS", quando o documento trouxe */
  bloqueio: number | null
  bloqueioEm: Date | null
  /** a ficha do banco diz que o declarado serve de régua? (`podeConferirPorLedgerbal`) */
  declaradoEhRegua: boolean
  /** o selo por dia, quando existe */
  selo: { fecham: number; conferidos: number } | null
}

export type RotuloDoDestaque = 'DEVEDOR' | 'CONTABIL'

export interface DestaqueDoCard {
  /** o número GRANDE */
  valor: number
  rotulo: RotuloDoDestaque
  /** data do número grande — `null` quando é o contábil (que é sempre "agora") */
  em: Date | null
  /** a linha de apoio: bloqueio explicado · contábil visível · selo junto */
  apoio: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * O destaque do card. PURA — o componente só ecoa (a lição do prefill do cardápio:
 * *regra que mora num `useState` é regra que ninguém prova*).
 */
export function destaqueDoCard(d: DadosDoCard): DestaqueDoCard {
  const partes: string[] = []

  // ⚠️ o bloqueio só aparece se foi MEDIDO, e com a data dele. Nunca se supõe o bloqueio
  // de hoje a partir do de ontem — ele muda todo dia.
  if (d.bloqueio != null && d.bloqueio !== 0) {
    partes.push(`${brl(d.bloqueio)} bloqueado (+24h)${d.bloqueioEm ? ` em ${dia(d.bloqueioEm)}` : ''}`)
  }

  // ⛔ O DESTAQUE SÓ TROCA ONDE O DECLARADO EMBUTE BLOQUEIO — e só se ele existir.
  const mostraDevedor = !d.declaradoEhRegua && d.declarado != null
  if (mostraDevedor) {
    partes.push(`contábil ${brl(d.contabil)}`)
  }

  if (d.selo && d.selo.conferidos > 0) {
    partes.push(d.selo.fecham === d.selo.conferidos
      ? `conferido ${d.selo.fecham}/${d.selo.conferidos} dias`
      : `${d.selo.fecham}/${d.selo.conferidos} dias fecham`)
  }

  return mostraDevedor
    ? { valor: d.declarado!, rotulo: 'DEVEDOR', em: d.declaradoEm, apoio: partes.join(' · ') }
    : { valor: d.contabil, rotulo: 'CONTABIL', em: null, apoio: partes.join(' · ') }
}

/**
 * ⛔⛔ O TOTAL É SEMPRE O CONTÁBIL — em função própria pra ficar difícil de errar.
 *
 * Somar o devedor de cada conta faria o Saldo Total **dançar com o bloqueio de cada banco**,
 * sem lançamento nenhum por trás. O card individual muda o destaque; o total, nunca.
 */
export function totalDasContas(contas: Array<{ contabil: number }>): number {
  return Math.round(contas.reduce((s, c) => s + c.contabil, 0) * 100) / 100
}
