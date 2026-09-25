// ⭐⭐⭐ A RÉGUA DA DATA — DISTÂNCIA VIRA PERGUNTA, NUNCA MURO (25/09/2026) — régua do dono.
//
// **O caso:** a LAMANA venceu **15/09** e o dono pagou **21/09** — seis dias de atraso, que
// é rotina de caixa. A conciliação recusou:
//
// > *"Datas distantes — 6 dias entre OFX (2026-09-21) e candidato (2026-09-15). Máximo 5 dias."*
//
// ⛔⛔ **SEM PORTA.** É a conta certa, só foi paga atrasada — e a tela não oferecia jeito
// nenhum de dizer isso. ⭐ Nas palavras dele: ***"a régua de datas existe pra evitar
// casamento ERRADO, não pra proibir atraso VERDADEIRO"***.
//
// ⭐⭐ **É A MESMA FAMÍLIA DA DIFERENÇA DE VALOR (24/09), e por isso a anatomia é idêntica:**
// o sinal que antes recusava passa a **PERGUNTAR**, a resposta viaja **no gesto** (não num
// estado de tela que ninguém envia — o bug de 12/09) e fica **no rastro**. A régua é uma
// função que a TELA e o SERVIDOR chamam: *o servidor aceita exatamente o que a tela oferece
// — nunca menos, nunca mais.*
//
// ⚠️ **E a distância NÃO é só atraso.** Pagamento adiantado existe e é comum (a caixa da
// Caçula tem *"pago 2 dias antes de vencer"* em várias linhas), então a régua mede o
// SENTIDO e a frase diz qual é — perguntar *"foi pago com atraso?"* sobre um adiantamento
// seria o sistema errando o nome do fato na cara de quem sabe a verdade.

/** ⭐ até aqui passa DIRETO, sem pergunta — é o teto que já existia (`MAX_DAYS_APART`) */
export const PASSA_DIRETO_DIAS = 5

/**
 * ⭐⭐ até aqui o dono CONFIRMA e concilia; acima, só pelo caminho manual.
 *
 * ⚠️ **45 e não "sem teto"**: a janela existe pra impedir casamento errado, e uma conta de
 * três meses atrás com o mesmo valor é exatamente o par que ninguém quer casar por engano.
 * ⭐ O que a torna honesta é a saída existir: acima dela o **Find & Match com
 * `windowDays: 'all'`** acha qualquer época — conferido, *lá não há este teto* (a gravação
 * de lá usa `allowMultiReconcile`, que pula esta pré-validação inteira).
 */
export const JANELA_ESTENDIDA_DIAS = 45

export type DegrauDaData =
  /** dentro de 5 dias: concilia sem pergunta nenhuma */
  | 'PASSA'
  /** entre 6 e 45 dias: o DONO confirma, com as duas datas à vista */
  | 'PERGUNTA'
  /** acima de 45: não há atalho — o caminho é o Find & Match, que alcança qualquer época */
  | 'RECUSA'

export type SentidoDaDistancia = 'ATRASO' | 'ADIANTAMENTO' | 'MESMO_DIA'

export interface VeredictoDaData {
  degrau: DegrauDaData
  /** dias de distância, sempre positivo */
  dias: number
  sentido: SentidoDaDistancia
  /** o Conciliar pode acender? (já considerando se o dono confirmou) */
  podeFechar: boolean
  /** a pergunta que a tela faz — e que vira o rastro quando ele confirma */
  frase: string
  /** o rótulo do botão que confirma (a resposta muda com o sentido) */
  rotuloDaConfirmacao: string
}

const diaBr = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().slice(0, 2).join('/')

/** o DIA de calendário em UTC, sem a hora */
const diaUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/**
 * ⭐⭐ DIAS DE CALENDÁRIO — **nunca a diferença crua em horas.**
 *
 * ⚠️⚠️ **MEDIDO EM PROD NA PRÓPRIA LAMANA, e a 1ª versão errava por UM DIA.** Eu tinha
 * escrito `Math.round` sobre a diferença em ms, no pressuposto de que *"as datas do módulo
 * são carimbadas ao MEIO-DIA UTC"*. **Isso vale pras TRANSAÇÕES, não pro `dueDate`:**
 * ```
 * linha do extrato : 2026-09-21T12:00:00Z   (meio-dia, convenção das tx)
 * dueDate da conta : 2026-09-15T00:00:00Z   (data de calendário pura)
 * diferença crua   : 6,5 dias  →  Math.round = 7   ⛔ e o dono conta 6
 * ```
 * ⛔ *Número que o dono SABE que está errado destrói a confiança na tela inteira* — ele
 * abriria a pergunta *"foi pago com 7 dias de atraso?"* sobre um atraso de 6, e o rastro
 * mentiria pro contador.
 *
 * ⚠️ E o erro não era só de texto: **a régua VELHA (`days > 5`) sofria do mesmo problema**,
 * então um pagamento de 5 dias de calendário com meia diferença de horas era arredondado
 * pra 6 e **recusado sem porta**. Parte da queixa do dono nascia daqui.
 *
 * ⭐ "Dias de atraso" é contagem de CALENDÁRIO — a mesma que a pessoa faz no dedo.
 */
export function diasEntre(a: Date, b: Date): number {
  return Math.abs(Math.round((diaUTC(a) - diaUTC(b)) / 86_400_000))
}

/**
 * ⭐⭐ A RÉGUA. `dataDoPagamento` é a linha do extrato; `dataDoCandidato` é o vencimento da
 * conta (ou a data dela, quando não há vencimento).
 *
 * @param confirmada os dias que o DONO confirmou — tem que BATER com os dias reais.
 *   ⛔ **Não é um `force`:** mandar um número qualquer não abre a porta. É a mesma régua do
 *   `diferencaAceita` (07/09), e pelo mesmo motivo: *bater exato é o que separa "vi os 6
 *   dias e aceito" de "ignora a trava".*
 */
export function avaliarDistanciaDeDatas(
  dataDoPagamento: Date,
  dataDoCandidato: Date,
  confirmada?: number | null,
): VeredictoDaData {
  const dias = diasEntre(dataDoPagamento, dataDoCandidato)
  const sentido: SentidoDaDistancia =
    dias === 0 ? 'MESMO_DIA'
      : dataDoPagamento.getTime() > dataDoCandidato.getTime() ? 'ATRASO' : 'ADIANTAMENTO'

  const degrau: DegrauDaData =
    dias <= PASSA_DIRETO_DIAS ? 'PASSA'
      : dias <= JANELA_ESTENDIDA_DIAS ? 'PERGUNTA' : 'RECUSA'

  const confirmou = confirmada != null && confirmada === dias

  const quando = `esta conta ${sentido === 'ADIANTAMENTO' ? 'vence' : 'venceu'} ${diaBr(dataDoCandidato)}`
    + ` e o pagamento é de ${diaBr(dataDoPagamento)}`

  const frase =
    degrau === 'PASSA' ? ''
      : degrau === 'RECUSA'
        ? `${quando} — ${dias} dias de distância, acima dos ${JANELA_ESTENDIDA_DIAS} que o atalho alcança.`
          + ` Se é esta conta mesmo, use o "procurar outra" e busque sem janela de data.`
        : sentido === 'ATRASO'
          ? `${quando} — ${dias} dias depois. Foi pago com atraso?`
          : `${quando} — ${dias} dias antes. Foi pago adiantado?`

  return {
    degrau,
    dias,
    sentido,
    podeFechar: degrau === 'PASSA' || (degrau === 'PERGUNTA' && confirmou),
    frase,
    rotuloDaConfirmacao: sentido === 'ADIANTAMENTO' ? 'sim, pago adiantado' : 'sim, pago atrasado',
  }
}

/**
 * ⭐ O RASTRO — o que fica escrito na conta depois de conciliar.
 *
 * ⚠️ **Ele NOMEIA o sentido.** *"conciliada com 6 dias de distância"* faria o contador de
 * daqui a três meses perguntar "distância pra que lado?" — e é justamente ele quem lê isso.
 */
export function rastroDaDistancia(dias: number, sentido: SentidoDaDistancia): string | null {
  if (dias <= PASSA_DIRETO_DIAS) return null
  const como = sentido === 'ADIANTAMENTO' ? 'adiantamento' : 'atraso'
  return `${dias} dias de ${como}, confirmado por quem conciliou`
}
