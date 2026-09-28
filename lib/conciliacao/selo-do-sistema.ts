// ⭐⭐⭐ UMA RÉGUA, TODOS OS ANDARES — "o sistema já resolveu esta linha?" (27/09/2026)
//
// **O dono:** *"Concilio pagamento de empréstimo/fatura/aporte pelo gesto próprio (🏦/💳/📈)
// e a transação fica «Sem categoria · Pendente» na tela de Transações — mas o Fluxo de Caixa
// já mostra ela como «Parcela de empréstimo (pelo sistema)» lendo o vínculo. **Dois andares
// lendo réguas diferentes: um sabe, o outro cobra.**"*
//
// **OS CASOS, medidos em prod:** `LIQUIDACAO DE PARCELA-C41033828` (R$ 2.665,44) e
// `AMORTIZACAO CONTRATO-C41033828` (R$ 7.568,91), 25/09, sicredi — as duas vinculadas à
// **parcela #22 do C41033828-8 pela porta N:1**, e as duas `categoryId: null` + `PENDING`.
//
// ⭐⭐ **A RÉGUA JÁ EXISTIA — em `comoFoiResolvida` (a caixa de entrada), com as travas
// certas.** O que faltava era ela ter DONO e os outros andares a consumirem: o Fluxo tinha a
// própria cópia (`rotularLinha`) e a tela de Transações não tinha nenhuma. *Três andares, uma
// pergunta — é a lição do B1 e dos 7 detectores de par, agora em forma de rótulo de tela.*
//
// ⛔⛔ **E A TRAVA QUE NÃO SE AFROUXA: A FLAG DIZ "PARECE", O VÍNCULO DIZ "É".** O selo do
// cartão exige `businessCreditCardId`, nunca o `isCardPayment` sozinho — foi confiar na flag
// que deixou a fatura do Carter **OPEN com o pagamento dela no extrato** (20/09). ⚠️ E a cópia
// do Fluxo tinha a régua VELHA (`if (l.isCardPayment)`): unificar **aperta** aquele andar.
// Medido antes de trocar: **0 linhas** com a flag sem vínculo na Caçula, então nenhum número
// do Fluxo se move hoje — o que muda é que a divergência deixa de ser possível amanhã.

/** as famílias de vínculo que o sistema resolve sozinho — cada gesto tem a sua */
export type FamiliaDoSelo =
  | 'PARCELA_EMPRESTIMO'
  | 'FATURA_CARTAO'
  | 'APORTE_INVESTIMENTO'
  | 'LIBERACAO_EMPRESTIMO'
  | 'TRANSFERENCIA'

/**
 * ⚠️ Os campos são os VÍNCULOS, nunca as flags soltas. Quem monta este objeto a partir do
 * Prisma é o `paraSelo` de cada andar — e é por isso que o `select` de cada um tem que trazer
 * **as duas portas** do empréstimo (1:1 `loanInstallmentPaid` e N:1 `loanInstallmentPayments`):
 * checar uma só foi o bug de 14/08, e na Caçula **47 das 53** parcelas vêm pela N:1.
 */
export interface LinhaComVinculo {
  /** `isCardPayment` — a flag da heurística de descrição do import. Nunca decide sozinha. */
  isCardPayment: boolean
  /** `businessCreditCardId != null` — o vínculo que de fato quita a fatura */
  faturaVinculada: boolean
  /** 1:1 **ou** N:1 — as duas portas */
  temParcelaVinculada: boolean
  /** `InvestmentContribution` existe */
  temAporteVinculado: boolean
  /** `Loan.disbursementTransactionId` aponta pra esta linha */
  ehLiberacaoEmprestimo: boolean
  /** `type === 'TRANSFER'` ou par formado (`transferGroupId`) */
  ehTransferencia: boolean
}

export interface SeloDoSistema {
  familia: FamiliaDoSelo
  /**
   * o rótulo que vai na tela.
   *
   * ⚠️ São **os mesmos textos que o Fluxo de Caixa já imprime** (`CAT_PARCELA`, `CAT_FATURA`,
   * `CAT_LIBERACAO`) — dois nomes pro mesmo fato fariam o dono achar que são coisas
   * diferentes em telas diferentes, que é metade do defeito de hoje.
   */
  rotulo: string
  /** o texto curto do selo da caixa de entrada (*"parcela de empréstimo"*) */
  curto: string
}

/**
 * ⭐ O selo é **"pelo sistema"** e não uma categoria de despesa.
 *
 * **Palavras do dono:** *"não é categoria de despesa que eu escolho, é o vínculo falando"*.
 */
export const SELO_PELO_SISTEMA = 'pelo sistema'

const SELOS: Record<FamiliaDoSelo, { rotulo: string; curto: string }> = {
  // ⚠️ estes dois textos são os que o `lib/fluxo-caixa/motor.ts` exporta como CAT_*
  PARCELA_EMPRESTIMO: { rotulo: 'Parcela de empréstimo', curto: 'parcela de empréstimo' },
  FATURA_CARTAO: { rotulo: 'Fatura de cartão (paga)', curto: 'pagamento de fatura de cartão' },
  APORTE_INVESTIMENTO: { rotulo: 'Aporte em investimento', curto: 'aporte em investimento' },
  LIBERACAO_EMPRESTIMO: { rotulo: 'Liberação de empréstimo', curto: 'liberação de empréstimo' },
  TRANSFERENCIA: { rotulo: 'Transferência entre contas', curto: 'transferência entre contas' },
}

/**
 * ⭐⭐ **A pergunta única: o sistema já sabe o que esta linha é?**
 *
 * `null` = ela espera a palavra do dono de verdade — e é só isso que pode contar no
 * **A CLASSIFICAR** (item 3 do pedido).
 *
 * ⚠️ **A ORDEM é a de `comoFoiResolvida`, e ela importa:** o vínculo ESTRUTURAL vem antes de
 * qualquer flag. A liberação do C61021346 estava categorizada como *"Aporte de Capital"* — se
 * a categoria mandasse, a tela chamaria uma **DÍVIDA** de aporte de sócio (26/08).
 */
export function seloDoSistema(l: LinhaComVinculo): SeloDoSistema | null {
  // ⛔ transferência primeiro: ela não é entrada nem saída, e o resto não se aplica
  if (l.ehTransferencia) return { familia: 'TRANSFERENCIA', ...SELOS.TRANSFERENCIA }
  if (l.isCardPayment && l.faturaVinculada) return { familia: 'FATURA_CARTAO', ...SELOS.FATURA_CARTAO }
  if (l.temParcelaVinculada) return { familia: 'PARCELA_EMPRESTIMO', ...SELOS.PARCELA_EMPRESTIMO }
  if (l.temAporteVinculado) return { familia: 'APORTE_INVESTIMENTO', ...SELOS.APORTE_INVESTIMENTO }
  if (l.ehLiberacaoEmprestimo) return { familia: 'LIBERACAO_EMPRESTIMO', ...SELOS.LIBERACAO_EMPRESTIMO }
  return null
}

/**
 * ⭐⭐⭐ **POR QUE O CARIMBO É O *STATUS* E O RÓTULO É *DERIVADO* — e não uma categoria gravada.**
 *
 * O dono pediu *"classificação DO SISTEMA + status resolvido"*, e a segunda metade da frase
 * dele é o que decide a forma: *"**não é categoria de despesa que eu escolho**, é o vínculo
 * falando"*. Três razões medidas:
 *
 * 1. ⛔ **Categoria gravada entraria em relatório por categoria como escolha do dono.** É
 *    exatamente por isso que o `applyTransferCandidate` **ZERA** o `categoryId` ao formar o par
 *    desde 06/08 (*"evita tag fantasma em relatórios por categoria"*) — gravar aqui desfaria
 *    aquela decisão sem ninguém pedir. Medido: **256 transferências** nesse estado, de propósito.
 * 2. ⛔ **Campo gravado envelhece.** Se o vínculo for desfeito (o desfazer existe nos três
 *    gestos), a categoria ficaria afirmando um pagamento que não existe mais — a doença da
 *    `CreditCardInvoice.status` que ficou eternamente `OPEN` depois de vencer.
 * 3. ⭐ **O DRE já trata os três SEM categoria**, e por fontes que não mentem: o juros do
 *    empréstimo entra por `paidInterest` (a ponte N:1, 14/08), a compra do cartão entra por
 *    competência, e o aporte é `nonDreGroups` (o contrafactual de 25/09: DRE de setembro
 *    **idêntico ao centavo** com e sem os R$ 2.214,23). Inventar categoria aqui arriscaria
 *    contar a mesma despesa **duas vezes**.
 *
 * ⭐ **O `status`, ao contrário, é estado de FILA** — *"esta linha ainda espera alguém?"* — e
 * a resposta com vínculo é **não**. Esse é o campo que o gesto tem que carimbar, e é o que
 * fazia a tela de Transações cobrar uma decisão que já havia sido tomada.
 *
 * ⚠️ **Só o juros/tarifa embutido vai pra despesa, quando NOMEADO** — a régua D18 da Conta
 * Única, que continua valendo: quem escreve isso é o split do vínculo (`paidInterest` /
 * `rastroDaDiferenca`), nunca este carimbo.
 */
export const STATUS_DE_QUEM_TEM_VINCULO = 'RECONCILED' as const

/** ⭐ o rótulo completo, com o selo — *"Parcela de empréstimo (pelo sistema)"* */
export function rotuloComSelo(s: SeloDoSistema): string {
  return `${s.rotulo} (${SELO_PELO_SISTEMA})`
}
