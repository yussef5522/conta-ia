import { statusDaConta } from '@/lib/contas-pagar/escopo'

// Sprint 5.0.3.0a — Função pura que computa o status visual de uma linha
// a partir de status DB + dueDate + paymentDate. Usada pra cor da tarja
// lateral, badge na coluna Status, classificação nos 4 stats cards.

/**
 * ⭐⭐⭐ OS STATUS DA LISTA — e eles são os MESMOS dos cartões (13/09 · 26/09).
 *
 * ⛔ **`warn` ("Vence em breve") MORREU como status.** *"Vence em 2 dias" é informação da
 * COLUNA de vencimento, nunca um status/filtro/stat próprio* — e como STATUS ele fazia
 * duas coisas erradas: (a) era um SUBCONJUNTO de "a pagar", então a soma dos quatro cards
 * contava a mesma conta 2×; (b) discordava do KPI, que comparava `dueDate < now` por
 * TIMESTAMP enquanto isto aqui comparava por DIA — era essa a briga entre `34 · 48.502,57`
 * e `9 · 20.635,54` no print do dono.
 *
 * ⭐⭐⭐ **26/09 — `today` ENTROU, e o defeito era MEU, de ontem.**
 *
 * **O dono:** *"o cartão de cima separa vence-hoje, mas NA LISTA a conta que vence hoje
 * ainda aparece como «A PAGAR» — os dois andares discordam."* ⛔ E a causa era aqui: esta
 * função já é casca sobre `statusDaConta` (certo), mas o tradutor **colapsava `VENCE_HOJE`
 * em `pending`** — eu acrescentei o estado à régua ontem e esqueci o tradutor.
 *
 * ⚠️ *Não eram duas réguas brigando: era UMA régua com um tradutor cego.* A cura é o
 * tradutor virar **total** (switch exaustivo: estado novo **não compila** sem par), e o
 * guard prova que o status da linha é o cartão onde ela conta.
 *
 * ⛔ `warn` segue MORTO — ele era SUBCONJUNTO de "a pagar"; `today` é **PARTIÇÃO**.
 */
export type PayableVisualStatus = 'paid' | 'pending' | 'today' | 'overdue'


export interface PayableLike {
  status: string // PENDING | RECONCILED | IGNORED
  dueDate: Date | string | null
  paymentDate: Date | string | null
}


/**
 * ⚠️⚠️ **ESTA FUNÇÃO NÃO TEM MAIS RÉGUA PRÓPRIA** — ela é casca sobre `statusDaConta`.
 *
 * Era aqui que morava a SEGUNDA definição de "vencida" (por dia, UTC) contra a do KPI
 * (por timestamp). Duas réguas pra mesma palavra é o que fazia o card dizer 34 e a tabela
 * pintar outra coisa. **Uma decisão, uma função** (o padrão do `contarFilas`).
 */
export function payableVisualStatus(
  row: PayableLike,
  now: Date = new Date(),
): PayableVisualStatus {
  const s = statusDaConta(row, now)
  /**
   * ⭐ o tradutor é TOTAL: cada estado da régua tem o seu, e estado novo que caia no
   * `default` seria a discordância entre os andares nascendo de novo — em silêncio.
   */
  switch (s) {
    case 'PAGA': return 'paid'
    case 'VENCIDA': return 'overdue'
    case 'VENCE_HOJE': return 'today'
    case 'A_PAGAR': return 'pending'
  }
}

/** Label humano em PT-BR pra exibição. */
export function payableStatusLabel(s: PayableVisualStatus): string {
  switch (s) {
    case 'paid': return 'Paga'
    case 'overdue': return 'Vencida'
    // ⭐ o MESMO rótulo do cartão — dois textos pro mesmo estado divergem no 1º ajuste
    case 'today': return 'Vence hoje'
    case 'pending': return 'A pagar'
  }
}

/** Classes Tailwind pro badge + tarja lateral. Mapas explícitos (safelist). */
export const PAYABLE_STATUS_COLOR: Record<
  PayableVisualStatus,
  { stripe: string; badgeBg: string; badgeText: string; amountText: string }
> = {
  paid: {
    stripe: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    // Sprint Cor-Valor-Status (07/06/2026): valor verde quando paga,
    // batendo com a palavra "Paga"
    amountText: 'text-emerald-700 dark:text-emerald-400',
  },
  pending: {
    stripe: 'bg-sky-500',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    // Pendente normal (não vencida, sem urgência) → neutro
    amountText: 'text-foreground',
  },
  /**
   * ⭐⭐ ÂMBAR — entre o azul do "a pagar" e o vermelho do "vencida" (pedido do dono).
   * ⚠️ É o MESMO tom do cartão (`warn` → `amber` no `StatsCard`): a cor é parte do estado,
   * e dois tons pro mesmo fato fariam o andar de cima e o de baixo parecerem coisas
   * diferentes — que é exatamente a queixa que abriu este acerto.
   */
  today: {
    stripe: 'bg-amber-500',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    // ⭐ o valor em âmbar: pede atenção sem dizer que já passou
    amountText: 'text-amber-700 dark:text-amber-400',
  },
  overdue: {
    stripe: 'bg-red-500',
    badgeBg: 'bg-red-100 dark:bg-red-950/40',
    badgeText: 'text-red-700 dark:text-red-300',
    // Vencida → vermelho (comportamento atual)
    amountText: 'text-red-600 dark:text-red-400',
  },
}
