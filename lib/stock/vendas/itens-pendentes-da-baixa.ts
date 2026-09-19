// ⭐⭐⭐ O LOTE NÃO FICA REFÉM DE UM ITEM (19/09/2026).
//
// **O dono, com 58 produtos na baixa e 1 barrado:** *"fico travado sem saber onde agir — e
// os outros 57 reféns do 1."*
//
// ⛔ **E A ATOMICIDADE NÃO AFROUXA.** A baixa continua sendo tudo-ou-nada dentro da
// transação — gravar 57 e "meio" o 58º seria o estado pela metade que o módulo inteiro
// existe pra evitar. O que muda é que a RECUSA passa a carregar **o caminho**: ela nomeia o
// réu e devolve a chamada que baixa o resto, deixando o barrado **pendente com o motivo**.
//
// ⭐ É o mesmo desenho do `confirmouSanidade` (05/09) e do `permitirItemNovoComNomeDeEstoque`:
// *pergunta, nunca recusa cega* — o dono responde e segue, e a decisão dele fica registrada.

export interface ItemBarrado {
  itemId: string
  nome: string
  motivo: string
}

export class BaixaComItemBarradoError extends Error {
  readonly barrados: ItemBarrado[]
  /** ⭐ quantos entrariam se ele mandar seguir sem os barrados */
  readonly quantosSeguem: number
  constructor(barrados: ItemBarrado[], quantosSeguem: number) {
    super(
      barrados.length === 1
        ? `«${barrados[0].nome}» não pode ser baixado: ${barrados[0].motivo} ` +
          `Dá pra baixar os outros ${quantosSeguem} agora e deixar este pendente — ` +
          'a baixa dele fica esperando você resolver o item.'
        : `${barrados.length} itens não podem ser baixados (${barrados.map((b) => `«${b.nome}»`).join(', ')}). ` +
          `Dá pra baixar os outros ${quantosSeguem} agora e deixar estes pendentes.`,
    )
    this.name = 'BaixaComItemBarradoError'
    this.barrados = barrados
    this.quantosSeguem = quantosSeguem
  }
}

/**
 * ⭐ Tira da agregada os itens que o dono mandou deixar pendentes.
 *
 * ⚠️ **As LINHAS do dia continuam gravadas inteiras** — o que fica de fora é só o movimento
 * do ledger. Assim o dia segue reprocessável: resolvido o item, um reprocesso baixa o que
 * faltou, sem o dono ter que reimportar nada.
 */
export function semOsPendentes<T extends { itemId: string }>(
  agregada: readonly T[],
  pendentes: readonly string[],
): T[] {
  if (!pendentes.length) return [...agregada]
  const fora = new Set(pendentes)
  return agregada.filter((a) => !fora.has(a.itemId))
}
