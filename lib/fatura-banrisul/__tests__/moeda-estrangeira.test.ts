// ⭐⭐⭐ A CLASSE INTEIRA DA LINHA EM MOEDA ESTRANGEIRA (16/09/2026)
//
// **A ordem do dono:** *"conserta a leitura NO PARSER DO BANRISUL — a classe inteira de
// linha em moeda estrangeira, não só esta."*
//
// ⛔⛔ **O QUE ESTAVA ERRADO:** a cotação (`JOD 49,95 TX DÓLAR R$ 5,2264`) é um FRAGMENTO
// informativo, e a régua antiga pulava a **LINHA INTEIRA** que a contivesse. Isso só é
// seguro enquanto a cotação estiver sozinha na linha física — e ela deixa de estar assim
// que a calha das duas colunas some (foi o que aconteceu na última página de setembro).
//
// Os três desfechos, medidos antes do conserto:
//   · compra de R$ 617,00 ao lado de uma cotação → lia **R$ 5,22**, a TAXA, em EXTERIOR
//   · IOF de R$ 0,06 ao lado de uma cotação → **sumia**
//   · cotação ao lado de uma compra de R$ 559,42 → **sumia**
//
// ⚠️ O primeiro é o mais traiçoeiro: **não falta linha, falta dinheiro DENTRO de uma linha
// que existe**. A conferência acusa a diferença e o dono vai procurar uma transação inteira
// que está lá, na cara dele.

import { describe, it, expect } from 'vitest'
import { classificarLinhas, removerCotacaoInformativa, fatiarColunasColadas, allBRNumbers } from '../nucleo'

const VENC = { month: 8, year: 2026, dueDate: '2026-08-10' }
const ler = (linha: string) => classificarLinhas([linha], VENC)

describe('⛔⛔ a cotação divide a linha física com conteúdo REAL (calha ausente)', () => {
  /**
   * ⛔ O PIOR DOS TRÊS — o valor não some, ele é TROCADO pela taxa de câmbio.
   * ⚠️ E repare no contrafactual: a taxa tem 4 casas e o leitor de dinheiro casa
   * `[\d.]+,\d{2}` → `5,2264` vira **5,22**. Um número plausível, com cara de valor.
   */
  it('⭐ compra doméstica + cotação ao lado → o valor é o da COMPRA, nunca a taxa', () => {
    const r = ler('  06/07   HOT CAFECA RESTA DE BE HOT RESTA B               617,00            JOD 49,95 TX DÓLAR R$ 5,2264')
    expect(r).toHaveLength(1)
    expect(r[0]!.value, 'leu a TAXA no lugar do valor — o defeito de 16/09').toBe(617)
    expect(r[0]!.bucket, 'a cotação do vizinho não pode mudar o bucket').toBe('BRASIL')
    // o contrafactual que explica o 5,22
    expect(allBRNumbers('TX DÓLAR R$ 5,2264')).toEqual([5.22])
  })

  it('⭐ IOF + cotação ao lado → o IOF continua sendo lido', () => {
    const r = ler('          IOF SOBRE TRANSACAO NO EXTERIOR                    0,06            JOD 3,00 TX DÓLAR R$ 5,2711')
    expect(r, 'o IOF sumiu com a linha inteira').toHaveLength(1)
    expect(r[0]!.bucket).toBe('IOF')
    expect(r[0]!.value).toBe(0.06)
  })

  it('⭐ cotação + transação REAL ao lado → a transação sobrevive', () => {
    const r = ler('          JOD 19,50 TX DÓLAR R$ 5,2621                               19/07   HOT CAFECA MERCADOME H RESTA HOT                     106,13   559,42')
    expect(r, 'a transação sumiu junto com a cotação').toHaveLength(1)
    expect(r[0]!.value).toBe(559.42)
    expect(r[0]!.bucket, 'tem US$ e R$ na linha → internacional').toBe('EXTERIOR')
  })
})

describe('⛔⛔ e a calha falhando cola DUAS COLUNAS na mesma linha — as linhas REAIS', () => {
  /**
   * ⚠️ Linha 261 da fatura de agosto. Antes do conserto o motor lia **IOF 18,00** — o valor
   * do VIZINHO — e a compra de R$ 18,00 desaparecia. Dois erros de uma vez, os dois calados.
   */
  it('⭐ IOF de uma coluna + transação datada da outra → as DUAS são lidas', () => {
    const r = ler('          IOF SOBRE TRANSACAO NO EXTERIOR                    9,62    22/07   CAFECA CAFECA RESTA HOT                                3,44    18,00')
    expect(r).toHaveLength(2)
    const iof = r.find((b) => b.bucket === 'IOF')
    expect(iof?.value, 'o IOF pegou o valor do vizinho').toBe(9.62)
    expect(r.find((b) => b.bucket === 'EXTERIOR')?.value, 'a compra sumiu').toBe(18)
  })

  /** ⚠️ Linha 167 real: duas compras coladas. O motor lia UMA (45,49) e perdia 347,50. */
  it('⭐ duas transações datadas na mesma linha → as duas são lidas', () => {
    const r = ler('  06/07   PADARIA RESTA 01/04 HOT RESTA BR                 347,50    15/07   MERCADOME RESTA HOT                                    8,70    45,49')
    expect(r).toHaveLength(2)
    expect(r[0]!.value).toBe(347.5)
    expect(r[0]!.bucket).toBe('BRASIL')
    expect(r[0]!.parcela, 'a parcela da descrição sobreviveu ao fatiamento').toEqual({ number: 1, total: 4 })
    expect(r[1]!.value).toBe(45.49)
    expect(r[1]!.bucket).toBe('EXTERIOR')
  })

  /**
   * ⛔⛔ A TRAVA QUE IMPEDE O FATIADOR DE INVENTAR TRANSAÇÃO: a parcela `01/04` vem colada
   * na descrição com UM espaço. Partir ali criaria um lançamento que não existe — e
   * inventar é pior do que perder, porque ninguém desconfia de um número a mais.
   */
  it('⛔ parcela na descrição NÃO parte a linha', () => {
    expect(fatiarColunasColadas('  06/07   PADARIA RESTA 01/04 HOT RESTA BR    347,50')).toHaveLength(1)
  })

  it('⭐ linha de uma coluna só continua inteira', () => {
    const l = '  07/07   HOT RESTA PADARIA HOT MERCADOME BR               387,64'
    expect(fatiarColunasColadas(l)).toEqual([l])
  })
})

describe('⭐ e a cotação SOZINHA continua não sendo transação', () => {
  it('⭐ linha só de cotação não vira lançamento', () => {
    expect(ler('          JOD 49,95 TX DÓLAR R$ 5,2264')).toEqual([])
    expect(ler('                                    HOT 89,00 TX DÓLAR R$ 5,3002')).toEqual([])
  })

  /** ⚠️ Taxa ZERO existe na fatura real (`HOT 645,07 TX DÓLAR R$ 0,0000`) e é cotação igual. */
  it('⭐ cotação com taxa 0,0000 também é informativa', () => {
    expect(ler('          HOT 645,07 TX DÓLAR R$ 0,0000')).toEqual([])
  })
})

describe('⛔ a régua tira o FRAGMENTO, e só ele', () => {
  /**
   * ⛔⛔ A TRAVA QUE IMPEDE O CONSERTO DE VIRAR UM BURACO NOVO: o token da moeda só é
   * comido quando é ALFABÉTICO. Uma régua que engolisse `\S+` antes do valor comeria o
   * **valor da compra** que vem logo antes quando a fatura não imprime o token.
   */
  it('⭐ sem token de moeda, o valor anterior NÃO é comido', () => {
    const limpa = removerCotacaoInformativa('  06/07   COMPRA X   617,00   49,95 TX DÓLAR R$ 5,2264')
    expect(limpa, 'a régua comeu o valor da compra').toContain('617,00')
    expect(limpa).not.toContain('TX DÓLAR')
  })

  it('⭐ linha sem cotação nenhuma passa intacta', () => {
    const l = '  06/07   PADARIA RESTA 01/04 HOT RESTA BR                 347,50'
    expect(removerCotacaoInformativa(l)).toBe(l)
  })

  it('⭐ duas cotações na mesma linha saem as duas', () => {
    const limpa = removerCotacaoInformativa('JOD 1,00 TX DÓLAR R$ 5,2711   USD 2,00 TX DOLAR R$ 5,30')
    expect(limpa.trim()).toBe('')
  })
})
