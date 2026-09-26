// ⛔⛔⛔ A FLAG DIZ "PARECE"; O VÍNCULO DIZ "É" (20/09/2026)
//
// **O dono:** *"o mapa dizia «pagamento órfão 8.626,98 (17/09) bate a fatura OPEN do Carter,
// palpite aceso na caixa», mas a caixa hoje tem só 4 linhas e ela NÃO está."*
//
// **MEDIDO POR ID (`cmu7qr6ow000o7tu9960fi9wg`) — e a hipótese dele caiu:** a linha **não
// foi categorizada**, não foi ignorada, não tem vínculo e **não tem auditoria nenhuma**.
// Ninguém mexeu nela. O que ela tinha era `isCardPayment: true` (marcado pelo passo 8.5 do
// import, por **heurística de DESCRIÇÃO**) com `businessCreditCardId: null`.
//
// ⛔ E a lei da estação declarava isso **resolvido**: `if (l.isCardPayment) return
// 'pagamento de fatura de cartão'`. A linha ia pro ARQUIVO com um selo que afirma uma
// quitação que **nunca aconteceu** — a fatura do Carter ficou OPEN com o pagamento dela no
// extrato, o **K3 gritando todo dia**, e ***nenhuma tela onde resolver***. O palpite nunca
// pôde ser oferecido porque a linha nunca chegou na caixa.
//
// ⚠️⚠️ **ESTA LIÇÃO JÁ ESTAVA ESCRITA NO CLAUDE.md, em 29/08, nestas palavras:** *"a flag
// diz «parece», o vínculo diz «é» (…) sem `businessCreditCardId` a fatura fica aberta pra
// sempre: **a flag não quita nada, só tira da fila**"*. Ela virou comentário de teste e
// **não virou régua** — e o defeito nasceu depois, na lei das estações. É o que este guard
// existe pra impedir: a lição que não vira executável volta.

import { describe, it, expect } from 'vitest'
import { comoFoiResolvida, estacaoDaLinha, type LinhaParaEstacao } from '@/lib/conciliacao/caixa-de-entrada'

/** a linha do caso real, no formato que a lei lê */
const CARTER: LinhaParaEstacao = {
  categoryId: null,
  reconciledWithId: null,
  temReconciledFrom: false,
  isCardPayment: true,        // ⚠️ marcada por heurística de descrição no import
  faturaVinculada: false,     // ⛔ e sem vínculo: não quita fatura nenhuma
  temParcelaVinculada: false,
  transferGroupId: null,
  isInternalTransfer: false,
  pendingTransfer: false,
  ignoredAt: null,
  tipo: 'DEBIT',
  // ⭐ 25/09 — os dois campos novos da lei; aqui não mudam nada (a linha não tem categoria)
  dreGroupDaCategoria: null,
  avulsaConfirmada: false, temAporteVinculado: false,
}

describe('⛔⛔⛔ pagamento de cartão SEM vínculo não sai da caixa', () => {
  it('⭐ o caso do Carter: flag true + vínculo nenhum = CAIXA, não arquivo', () => {
    expect(comoFoiResolvida(CARTER), 'a flag voltou a valer como quitação — a órfã some de novo')
      .toBeNull()
    expect(estacaoDaLinha(CARTER)).toBe('CAIXA')
  })

  it('⭐ com o VÍNCULO ela é resolvida de verdade, e o selo diz o quê', () => {
    const casada = { ...CARTER, faturaVinculada: true }
    expect(comoFoiResolvida(casada)).toBe('pagamento de fatura de cartão')
    expect(estacaoDaLinha(casada)).toBe('ARQUIVO')
  })

  /**
   * ⛔ A PARCELA DE EMPRÉSTIMO SEMPRE OLHOU O VÍNCULO — e é por isso que ela nunca teve
   * este defeito. O contraste está aqui pra a régua do cartão não voltar a ser a exceção.
   */
  it('⭐ o empréstimo já era pelo vínculo — o cartão era a exceção', () => {
    expect(comoFoiResolvida({ ...CARTER, isCardPayment: false, temParcelaVinculada: true }))
      .toBe('parcela de empréstimo')
  })

  it('⛔ e nenhum outro campo "resolve" a órfã por tabela', () => {
    // ⚠️ o que resolve tem que ser um FATO gravado, não uma impressão do import
    /**
     * ⚠️ AJUSTADO EM 25/09 — a lei mudou, e o teste acompanhou com o motivo escrito.
     *
     * `categoryId` sozinho **não resolve mais**: quem decide é o **grupo do DRE** dela
     * (`categoriaResolveSozinha`). Salário e retirada de sócio encerram a linha; fornecedor
     * que emite nota **não** — ali ela ainda pede o vínculo. O que este teste continua
     * provando é o que ele nasceu pra provar: *só FATO gravado resolve*.
     */
    expect(comoFoiResolvida({ ...CARTER, categoryId: 'cat1', dreGroupDaCategoria: 'DESPESAS_PESSOAL' })).toBe('categorizada')
    expect(
      comoFoiResolvida({ ...CARTER, categoryId: 'cat1', dreGroupDaCategoria: 'CUSTO_PRODUTO_VENDIDO' }),
      'fornecedor com nota voltou a arquivar só com categoria',
    ).toBeNull()
    expect(comoFoiResolvida({ ...CARTER, ignoredAt: new Date() })).toBe('ignorada por você')
  })
})

describe('⭐ a leitura da caixa CARREGA o vínculo — senão a lei decide no escuro', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')

  it('⛔ o SELECT da caixa traz businessCreditCardId', () => {
    const src = fonte('lib/conciliacao/leitura-da-caixa.ts')
    expect(src, 'sem o campo no select, `faturaVinculada` seria sempre false e TODA linha de cartão voltaria pra caixa')
      .toMatch(/SELECT_DA_CAIXA[\s\S]{0,400}businessCreditCardId: true/)
    expect(src).toMatch(/faturaVinculada: !!r\.businessCreditCardId/)
  })

  it('⭐⭐ e o delta do DRE não afirma o que não houve', () => {
    expect(fonte('lib/credit-card-pj/casar-pagamento.ts'),
      'voltou a dizer "R$ X removidos do DRE" numa linha que nunca teve categoria')
      .toMatch(/deltaDespesaRemovidoDoDRE: tx\.categoryId \? tx\.amount : 0/)
  })
})
