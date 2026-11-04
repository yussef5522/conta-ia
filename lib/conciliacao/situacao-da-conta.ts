/**
 * ⭐⭐⭐ O QUE UMA CONTA JÁ PAGA E SEM VÍNCULO REALMENTE É (04/11/2026)
 *
 * ⛔⛔ **O CARD MENTIA, E A MENTIRA FOI MEDIDA EM PROD.** A régua velha era uma linha
 * (`fila-de-conciliacao.ts:311`):
 *
 *     situacao: c.lifecycle === 'EFFECTED' ? 'DUPLA_CONTAGEM' : 'EM_ABERTO'
 *
 * Ela afirmava *"o mesmo dinheiro está em duas linhas, e o saldo mente até alguém
 * costurar"* a partir de **um único fato**: a conta está paga. Não olhava se existe
 * segunda linha, nem se poderia existir.
 *
 * **O caso real (caçula mix, medido em 04/11):** a conta de R$ 408,65 da E.M.S. foi paga
 * **em dinheiro**, no `caixa loja/cofre`. Essa conta tem **zero** transação de extrato (495
 * tx, todas `MANUAL`/`IMPORT_EXCEL`/`ESTOQUE_NF`) porque ela é dinheiro físico — o schema
 * diz isso por escrito em `BankAccount.accountType`: *"CASH = Conta Caixa (dinheiro
 * físico/cofre) … sem importação OFX, não aparece em Conciliação"*. **Não existe par, e
 * nunca vai existir.** O dono categorizou a transação e o card continuou gritando, porque a
 * régua também não olhava categoria. *Alarme falso repetido é como um alarme morre.*
 *
 * ⭐⭐ **O DISCRIMINADOR É O CAMPO DECLARADO, NÃO A CONTAGEM** — e isto foi medido, não
 * preferido. Contar "a conta tem transação de extrato?" parece equivalente e **não é**: no
 * banco de prod existem **2 contas `CHECKING` sem nenhuma tx de extrato** (conta cadastrada
 * que ainda não importou). Pela contagem elas virariam "paga por fora", e a dupla contagem
 * real ficaria escondida até o primeiro import — ***ausência não é zero***. `accountType`
 * é declarado pelo dono no cadastro; ele diz o que a conta É, não o que ela ainda não teve.
 *
 * ⚠️ Daí a assimetria de propósito: conta **não-CASH** sem extrato ainda cai em
 * `DUPLA_CONTAGEM`, que é o lado conservador — ali o par é possível e pode chegar amanhã.
 *
 * ⚠️ **NÃO é uma 2ª cópia do `origem-do-extrato.ts`.** Aquele responde *"esta LINHA veio do
 * extrato do banco?"* (`ORIGENS_DO_EXTRATO = ['OFX','PDF']`) — pergunta sobre uma transação.
 * Esta responde *"esta CONTA pode ter extrato algum dia?"* — pergunta sobre o cadastro da
 * conta bancária, e a resposta dela não muda quando um import chega.
 */

/** ⚠️ o valor LIDO do schema (`BankAccount.accountType`), não um sinônimo meu */
export const TIPO_DE_CONTA_DINHEIRO = 'CASH'

export type SituacaoDaConta =
  /** conta a pagar que ainda não foi paga — casar aqui liquida */
  | 'EM_ABERTO'
  /** paga e sem vínculo numa conta que TEM extrato: o par é possível, e o dinheiro pode estar em duas linhas */
  | 'DUPLA_CONTAGEM'
  /** paga em dinheiro (conta CASH) e ainda sem categoria: não há par a costurar, falta classificar */
  | 'PAGA_POR_FORA'
  /** paga em dinheiro e já categorizada: nada pendente — arquivo, com selo */
  | 'PAGA_POR_FORA_RESOLVIDA'

export interface FatosDaSituacao {
  lifecycle: string
  /** `BankAccount.accountType` da conta onde o pagamento saiu — null quando a conta não tem banco */
  accountType: string | null
  categoryId: string | null
}

/**
 * ⭐ A PORTA ÚNICA DA SITUAÇÃO. Pura de propósito: ela recebe os três fatos já lidos, pra
 * que o teste possa exercitar as quatro saídas sem banco — e pra que exista **um** lugar
 * onde essa decisão mora (a régua velha estava cravada no meio de um `.map`, que é
 * exatamente como uma segunda cópia nasce).
 */
export function situacaoDaConta(f: FatosDaSituacao): SituacaoDaConta {
  if (f.lifecycle !== 'EFFECTED') return 'EM_ABERTO'

  // ⛔ o DECLARADO decide. Ver o cabeçalho: a contagem de extrato mentiria nas 2 CHECKING
  // sem import medidas em prod.
  if (f.accountType !== TIPO_DE_CONTA_DINHEIRO) return 'DUPLA_CONTAGEM'

  return f.categoryId != null ? 'PAGA_POR_FORA_RESOLVIDA' : 'PAGA_POR_FORA'
}

/** ⭐ o que ainda pede gesto do dono — o resolvido NÃO pede */
export function pedeGesto(s: SituacaoDaConta): boolean {
  return s === 'DUPLA_CONTAGEM' || s === 'PAGA_POR_FORA'
}
