/**
 * ⭐⭐⭐ QUEM PODE RECEBER NOME DO PDF — A PERGUNTA COM UM DONO SÓ (30/09/2026).
 *
 * ⛔⛔⛔ **O DEFEITO QUE A CRIOU, medido em prod:** o dono mandou o PDF do Banrisul de
 * 01–30/09 e a lista *"vão receber nome"* trouxe **22 lançamentos — TODOS os 22 já com
 * nome gravado**, inclusive os de 02/09, 08/09 e 16/09 que ele tinha nomeado na rodada
 * anterior. E o pior: **22 de 22 vinham `via FITID`**, porque os dois níveis do casamento
 * tinham réguas DIFERENTES pra *"quem é candidato"*:
 *
 * ```
 * NÍVEL 1 (FITID)       → filtrava SÓ `counterpartySource === 'MANUAL'`
 * NÍVEL 2 (DATE_AMOUNT) → filtrava manual + já-tem-nome + elegibilidade
 * ```
 *
 * O nível **preferencial** era o frouxo. E o contrato da própria interface declarava a
 * regra que ele não cumpria — `counterpartyName?: string | null // se já tem nome, não
 * propõe`. ***Menção, não uso***, agora no comentário de um campo.
 *
 * ⛔⛔ **E O LAÇO FECHAVA MUDO:** as 22 têm contraparte de fonte **`OFX`**, e
 * `canApplyCounterparty('OFX', 'PDF_STATEMENT')` é **FALSE** — o confirm as pulava por
 * precedência e gravava **zero**. Então o ciclo era *oferecer → preservar → oferecer de
 * novo*, pra sempre. A tela do fim era honesta (*"N preservados"*), mas quem mentia era a
 * **LISTA**, e é nela que o dono gasta o olho.
 *
 * ⭐⭐ **A CURA É ESTRUTURAL, E ELA TEM UMA LINHA QUE É O CORAÇÃO:** esta função consulta
 * **`canApplyCounterparty`, A MESMA que o confirm usa**. Com isso a lista deixa de poder
 * oferecer o que a gravação recusa — *não por disciplina, por construção* (REGRA 5).
 * Duas réguas pra mesma pergunta é a doença que esta casa mais paga.
 */
import { canApplyCounterparty } from './precedence'
import { isCounterpartyEligible } from './gap'

/**
 * Por que a transação NÃO entra na lista. Cada motivo tem uma frase própria na tela —
 * ⛔ *"pulada"* sem o porquê manda o dono procurar um erro que não existe.
 */
export type MotivoDaPulada =
  /** já tem contraparte gravada — foi a rodada anterior (ou o próprio OFX) */
  | 'JA_TEM_NOME'
  /** IOF/tarifa/antecipação: cobrança do banco, nunca tem favorecido */
  | 'NAO_ELEGIVEL'
  /** o nome gravado vem de fonte mais forte (MANUAL/OFX) — o PDF não sobrescreve */
  | 'PRECEDENCIA'

export interface VereditoDoCandidato {
  pode: boolean
  motivo: MotivoDaPulada | null
}

const PODE: VereditoDoCandidato = { pode: true, motivo: null }

/** o mínimo que se precisa saber de uma linha pra dizer se ela aceita nome do PDF */
export interface LinhaParaEnriquecer {
  description: string | null | undefined
  /** ⚠️ OPCIONAL de propósito: o `JoinTxInput` o declara assim, e ausência == sem nome */
  counterpartyName?: string | null
  counterpartySource: string | null | undefined
}

/**
 * ⭐ A ORDEM DOS MOTIVOS É DELIBERADA, e ela existe pra a frase da tela ser ÚTIL.
 *
 * **1. PRECEDÊNCIA primeiro** — é o que o servidor VAI fazer. Dizer *"já tem nome"* numa
 * linha que o confirm recusaria por fonte esconderia a razão real, e no dia em que o dono
 * apagasse o nome a linha **continuaria** sendo recusada, sem ele entender por quê.
 *
 * **2. JÁ TEM NOME** — o caso do dono: trabalho feito, não se refaz.
 *
 * **3. NÃO ELEGÍVEL** por último: é a informação menos acionável das três (IOF nunca vai
 * ter favorecido), e deixá-la na frente roubaria o lugar das duas que explicam o retrabalho.
 */
export function podeReceberNomeDoPdf(l: LinhaParaEnriquecer): VereditoDoCandidato {
  // ⭐ A MESMA função do confirm. Se um dia a precedência mudar, as duas mudam juntas.
  if (!canApplyCounterparty(l.counterpartySource, 'PDF_STATEMENT')) {
    return { pode: false, motivo: 'PRECEDENCIA' }
  }
  if (l.counterpartyName && l.counterpartyName.trim()) {
    return { pode: false, motivo: 'JA_TEM_NOME' }
  }
  if (!isCounterpartyEligible(l.description)) {
    return { pode: false, motivo: 'NAO_ELEGIVEL' }
  }
  return PODE
}

/**
 * ⚠️ A FRASE DO SELO — e ela diz o ESTADO, nunca só *"pulada"*.
 *
 * É o mesmo desenho do import de OFX com linha repetida: a linha **aparece contada e
 * explicada**, em vez de sumir. *Arquivo que some é indistinguível de trabalho que não
 * aconteceu* — e foi justamente a dúvida do dono (*"já deviam ter nome da rodada anterior"*).
 */
export function seloDaPulada(motivo: MotivoDaPulada): string {
  switch (motivo) {
    case 'JA_TEM_NOME':
      return 'já tem nome — pulada'
    case 'PRECEDENCIA':
      return 'nome de fonte mais forte (manual/extrato) — preservado'
    case 'NAO_ELEGIVEL':
      return 'cobrança do banco (IOF/tarifa) — nunca tem favorecido'
  }
}
