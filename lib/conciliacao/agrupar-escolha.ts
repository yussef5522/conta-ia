// ⭐⭐⭐ UM CARD POR FORNECEDOR, UMA LINHA POR VEZ (10/09/2026) — o mock, agora obedecido.
//
// **O dono, vendo 16 cards abertos:** *"a APRESENTAÇÃO virou parede — Ivan aparece 3×,
// Casper 5×, Box Paper lista 15 parcelas até novembro. O mock era outra coisa: a fila
// mostra cards COLAPSADOS (fornecedor · N linhas · valor total), eu abro UM de cada vez, e
// fornecedor com várias linhas abre UMA LINHA POR VEZ, da mais antiga."*
//
// ⛔⛔ **E O MOTIVO É MAIOR QUE ARRUMAÇÃO: N cards do mesmo fornecedor DISPUTAM AS MESMAS
// NOTAS.** Os 3 cards do Ivan mostravam as MESMAS 4 notas — marcar uma no card A e outra
// no card B é o caminho pra vincular a nota errada, que é exatamente o que aconteceu com
// a NF do Cancian em 08/09. *"O desenho certo é nem criar a disputa visual."* Com uma
// linha aberta por vez, **a disputa deixa de existir por construção** (REGRA 5) — não é
// um aviso que o dono precisa ler, é um estado impossível de alcançar.

import type { CardDeEscolha } from './escolher-na-mao'

export interface GrupoDeEscolha {
  fornecedorId: string
  fornecedorNome: string
  /** ⭐ as linhas do extrato deste fornecedor, **da mais antiga** — a ordem do trabalho */
  linhas: CardDeEscolha[]
  /** a soma das linhas — o que o cabeçalho colapsado mostra */
  total: number
  /** a data da mais antiga: é por ela que os grupos se ordenam */
  maisAntiga: Date
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐ AGRUPA os cards por fornecedor. Puro — a tela só desenha o que sai daqui.
 *
 * ⚠️ Agrupa por **id**, nunca por nome (REGRA 8): esta casa já leu o homônimo
 * *"MAURO IVAN LUNARDI (PAO DE MEL)"* como se fosse o Ivan do caso real.
 */
export function agruparPorFornecedor(cards: CardDeEscolha[]): GrupoDeEscolha[] {
  const porId = new Map<string, CardDeEscolha[]>()
  for (const c of cards) {
    const atual = porId.get(c.fornecedorId)
    if (atual) atual.push(c)
    else porId.set(c.fornecedorId, [c])
  }

  const grupos: GrupoDeEscolha[] = [...porId.entries()].map(([fornecedorId, linhas]) => {
    const ordenadas = [...linhas].sort((a, b) => a.linha.data.getTime() - b.linha.data.getTime())
    return {
      fornecedorId,
      fornecedorNome: ordenadas[0].fornecedorNome,
      linhas: ordenadas,
      total: round2(ordenadas.reduce((s, l) => s + l.linha.valor, 0)),
      maisAntiga: ordenadas[0].linha.data,
    }
  })

  // ⚠️ a fila também é do mais antigo pro mais novo — pagamento parado há mais tempo é o
  // que mais custa em juros e o que o fornecedor cobra primeiro.
  return grupos.sort((a, b) => a.maisAntiga.getTime() - b.maisAntiga.getTime())
}
