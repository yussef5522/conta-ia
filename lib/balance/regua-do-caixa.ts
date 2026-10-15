/**
 * ⭐⭐⭐ A RÉGUA DO CAIXA — *"o que conta como dinheiro na conta, e com que sinal"*.
 *
 * ⚠️⚠️ **ESTA PERGUNTA JÁ TEVE QUATRO LEITORES NESTA CASA, e um deles estava errado.** Em
 * 30/09 o `recalcularSaldoConta` foi descoberto como **o único sem o `reconciledWithId: null`**
 * — e o efeito foi R$ 5.234,00 de aluguel contado **duas vezes** no saldo do Banrisul (a
 * ex-payable + a linha do extrato conciliada com ela). O `increment` escondia isso porque
 * nunca somava as duas pontas.
 *
 * ⛔ Então a régua passa a ter **um dono só**, e módulo novo que precise dela **consome** em
 * vez de escrever o `where` de novo. Há guard contando os escritores.
 *
 * ⚠️ **Módulo PURO, zero imports** — de propósito, pela cicatriz de 15/10 (`lei-do-custo-medio`):
 * a decisão compartilhada que importa alguém reabre ciclo por baixo, e o sintoma não é erro de
 * módulo, é `undefined` no meio de uma leitura.
 */

/** ⛔ compromisso não é caixa (PAYABLE/RECEIVABLE), e conciliada não conta 2× */
export const WHERE_CAIXA = { lifecycle: 'EFFECTED', reconciledWithId: null } as const

export interface LinhaDeCaixa {
  type: string
  transferDirection: string | null
}

/**
 * ⭐ O SINAL — `DEBIT` e a perna `OUT` saem; `CREDIT` e `IN` entram.
 *
 * ⚠️ O `amount` da casa é **sempre positivo**: quem carrega o sinal é o `type` (convenção do
 * módulo desde a Fatia 2). Ler o sinal do valor seria a cicatriz do estorno de cartão, que
 * mordeu 3× no mesmo dia (REGRA 6).
 *
 * ⚠️ `TRANSFER` precisa do `transferDirection` — sem ele o saldo cai no fallback por
 * `createdAt` e **assina a perna errada**: foi exatamente assim que o PIX de R$ 7.000 voltou
 * como duplicata em 17/08.
 */
export function sinalDoCaixa(t: LinhaDeCaixa): 1 | -1 {
  if (t.type === 'TRANSFER') return t.transferDirection === 'IN' ? 1 : -1
  return t.type === 'CREDIT' ? 1 : -1
}

/**
 * ⛔⛔ CONTA DE INVESTIMENTO FICA FORA DO "NO CAIXA AGORA".
 *
 * ⚠️ A régua existia **só dentro da página** `/contas` (`c.accountType !== 'INVESTMENT'`) — e
 * a mesa do dono precisa do MESMO número que o card dela mostra. Copiar o filtro faria as duas
 * telas divergirem no dia em que uma conta de aplicação entrar, e o dono veria dois "saldo
 * total" diferentes na mesma sessão.
 */
export const ehContaDeCaixa = (c: { accountType?: string | null }) => c.accountType !== 'INVESTMENT'
