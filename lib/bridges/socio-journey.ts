// Sprint Jornada-do-Dinheiro (12/08) — agregações puras da tela de detalhe do
// sócio. Ficam FORA do componente pra poderem ser executadas em teste com dado
// real (REGRA 3 — o teste roda o comportamento, não faz grep de string).
//
// A "jornada do dinheiro" é a vantagem estrutural do Conta IA: Xero/QuickBooks
// tratam retirada como conta de patrimônio e param aí; a gente sabe pra ONDE o
// dinheiro foi (a despesa PF do fluxo A/B) e o que sobrou parado no PF.

import type { BridgeListItem } from './types'

export interface DestinoRow {
  label: string
  color: string | null
  amount: number
  count: number
  /** true = retirada sem fluxo A/B, ficou parada no PF do sócio. */
  ficou: boolean
}

/**
 * Ponto 2 — soma o valor TIRADO (amount) por categoria de destino da despesa PF
 * (fluxo A/B). Retirada sem A/B cai em "Ficou com você (no PF)".
 *
 * Usa `amount` (o valor da retirada), NÃO `spendAmount`, de propósito: a soma
 * das linhas tem que bater com o total do Resumo e com a lista detalhada — cada
 * real que saiu da empresa aparece em exatamente um destino. Ordena por valor
 * desc (maior primeiro).
 */
export function aggregateDestinoPorCategoria(bridges: BridgeListItem[]): DestinoRow[] {
  const map = new Map<string, DestinoRow>()
  for (const b of bridges) {
    const ficou = !b.spendTransactionId
    const key = ficou ? '__ficou__' : b.spendCategoryName ?? '__sem_cat__'
    const label = ficou
      ? 'Ficou com você (no PF)'
      : b.spendCategoryName ?? 'Sem categoria PF'
    const cur =
      map.get(key) ?? {
        label,
        color: b.spendCategoryColor ?? null,
        amount: 0,
        count: 0,
        ficou,
      }
    cur.amount += b.amount
    cur.count++
    if (!cur.color && b.spendCategoryColor) cur.color = b.spendCategoryColor
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, z) => z.amount - a.amount)
}

export interface JornadaSplit {
  gastouCount: number
  gastouAmount: number
  ficouCount: number
  ficouAmount: number
}

/**
 * Ponto 4 — de tudo que o sócio tirou, quanto virou gasto (fluxo A/B) vs quanto
 * ficou parado no PF. Responde "quanto do que tirei eu realmente gastei".
 */
export function computeJornadaSplit(bridges: BridgeListItem[]): JornadaSplit {
  return bridges.reduce<JornadaSplit>(
    (acc, b) => {
      if (b.spendTransactionId) {
        acc.gastouCount++
        acc.gastouAmount += b.amount
      } else {
        acc.ficouCount++
        acc.ficouAmount += b.amount
      }
      return acc
    },
    { gastouCount: 0, gastouAmount: 0, ficouCount: 0, ficouAmount: 0 },
  )
}
