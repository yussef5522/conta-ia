// ⛔⛔⛔ COLUNA DE LANÇAMENTO NÃO SOME EM SILÊNCIO (16/09/2026)
//
// A geometria de duas colunas é a defesa que faz a fatura ser lida certo. Quando ela erra,
// **o erro não aparece como erro** — aparece como uma diferença na conferência, e o dono
// vai caçar uma transação que está lá, impressa, na fatura dele.
//
// Os dois mecanismos abaixo são de DESCARTE: a banda inteira jogada fora, e a apara que
// corta a linha entre a data e o valor. Nenhum dos dois gritava.

import { describe, it, expect } from 'vitest'
import { colunasDaRegiao } from '../colunas'

describe('⛔ a banda com POUCOS lançamentos continua sendo uma coluna', () => {
  /**
   * ⚠️ O CASO REAL: cartão adicional que no mês só teve a anuidade. A coluna dele tem
   * **uma** linha datada — e a régua antiga exigia duas pra "valer a pena ler", então a
   * banda era descartada inteira e o dinheiro sumia.
   *
   * ⭐ O que separa coluna de PAINEL não é a quantidade, é ter lançamento: painel de
   * pontos/limites tem ZERO linha datada.
   */
  it('⭐ coluna com UM lançamento é lida', () => {
    const regiao = [
      '  01/09   LOJA A                       10,00        07/09   ANUIDADE DO ADICIONAL        18,00',
      '  02/09   LOJA B                       20,00',
      '  03/09   LOJA C                       30,00',
    ]
    const bandas = colunasDaRegiao(regiao)
    const tudo = bandas.flatMap((b) => b.linhas).join('\n')
    expect(tudo, 'a coluna do adicional foi descartada por ter um lançamento só').toContain('18,00')
    expect(tudo).toContain('ANUIDADE DO ADICIONAL')
  })

  /** ⛔ e o painel (sem lançamento nenhum) continua fora — senão a anuidade volta virando ruído */
  it('⛔ painel sem data nenhuma não vira coluna de lançamento', () => {
    const regiao = [
      '  01/09   LOJA A                       10,00        Limite total          5.000,00',
      '  02/09   LOJA B                       20,00        Pontos acumulados     1.234,00',
      '  03/09   LOJA C                       30,00',
    ]
    const bandas = colunasDaRegiao(regiao)
    const soma = bandas.flatMap((b) => b.linhas).join('\n')
    expect(soma, 'o painel entrou como se fosse lançamento').not.toContain('5.000,00')
  })
})

describe('⛔⛔ a apara do dinheiro não pode órfãr o valor de um lançamento', () => {
  /**
   * A apara existe pra tirar painel que mora à direita da coluna de valor. ⚠️ Mas quando
   * ela cai **depois da data e antes do valor**, a linha sobra datada e sem dinheiro — e o
   * motor a descarta calado (`nums.length === 0`).
   */
  it('⭐ linha datada não pode ficar sem o valor que ela tinha', () => {
    const regiao = [
      '  01/09   LOJA A                 10,00',
      '  02/09   LOJA B                 20,00',
      '  03/09   LOJA C                                            30,00',
    ]
    const linhas = colunasDaRegiao(regiao).flatMap((b) => b.linhas)
    const terceira = linhas.find((l) => l.includes('LOJA C'))
    expect(terceira, 'a linha do LOJA C sumiu').toBeDefined()
    expect(terceira, 'a apara cortou o valor fora da linha').toContain('30,00')
  })
})
