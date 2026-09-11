// ⭐⭐⭐ PARCELA PAGA RELATA; PARCELA FUTURA PREVÊ (10/09/2026).
//
// **O dono, olhando a #3 do C61021346-2 recém-conciliada:** *"a linha do cronograma mostra
// JUROS R$ 0,00 · PARCELA R$ 2.777,80, como se eu tivesse pago sem juro nenhum. (…) É
// pós-fixado: o juros só nasce no vencimento — quando nasce, a linha ADOTA o nascido."*
//
// ⛔⛔ O DADO JÁ ESTAVA TODO GRAVADO — a tela é que lia a coluna errada. Medido em prod:
// a #3 tem `paidTotal 4.337,52 · paidInterest 459,71 · paidCorrection 1.100,01` desde o
// vínculo, enquanto `interest` (a AGENDA) segue 0, que é o valor honesto da PREVISÃO num
// pós-fixado. São dois campos com duas perguntas diferentes, e a tela misturava.
//
// ⭐ É A MESMA REGRA DO RESTO DA CASA: **derivado, não gravado**. O `estaPaga` do cartão
// lê `paidAmount` e nunca o `status`; o saldo do estoque é Σ do ledger; aqui a linha paga
// é derivada do VÍNCULO. Nada aqui escreve no banco.
//
// ⚠️ E A #1 E A #2 SÃO A PROVA DE QUE A RÉGUA É SEGURA: nelas o real BATE com a agenda
// (1.518,43 e 473,23+1.097,68), porque o documento do Sicredi já trazia o efetivo das
// parcelas pagas. A régua nova não as muda — ela só tem efeito onde previsão e fato
// divergem, que é exatamente onde a tela mentia.

export interface ParcelaGravada {
  number: number
  /** a AGENDA: o que se previa */
  interest: number
  correcao?: number | null
  amortization: number
  payment: number
  status: string
  /** o VÍNCULO: o que aconteceu (nulo enquanto ninguém pagou) */
  paidTotal?: number | null
  paidInterest?: number | null
  paidCorrection?: number | null
  paidPenalty?: number | null
  paidDate?: Date | string | null
}

export interface LinhaDoCronograma {
  /** juros + correção + mora — realizado quando há vínculo, previsto quando não há */
  juros: number
  amortizacao: number
  parcela: number
  /** ⭐ a linha está RELATANDO (true) ou PREVENDO (false)? é isto que a tela pinta */
  realizado: boolean
  /** o dia em que o dinheiro saiu — só existe no realizado */
  pagoEm: Date | string | null
  /** a abertura do realizado, quando o vínculo soube separar */
  detalhe: { juros: number; correcao: number; mora: number } | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐⭐ O QUE A LINHA MOSTRA.
 *
 * ⛔ O gatilho é o **VÍNCULO** (`paidTotal`), nunca o `status`. Status é campo gravado, e
 * campo gravado envelhece — foi assim que a `CreditCardInvoice.status` ficou eternamente
 * `OPEN` depois de vencer. Parcela marcada PAID sem vínculo nenhum não tem fato pra
 * relatar, então continua mostrando a previsão (e é honesto: ninguém mediu aquele
 * pagamento).
 */
export function linhaDoCronograma(p: ParcelaGravada): LinhaDoCronograma {
  const pago = p.paidTotal ?? 0
  if (pago <= 0) {
    return {
      juros: round2(p.interest + (p.correcao ?? 0)),
      amortizacao: round2(p.amortization),
      parcela: round2(p.payment),
      realizado: false,
      pagoEm: null,
      detalhe: null,
    }
  }

  const juros = round2(p.paidInterest ?? 0)
  const correcao = round2(p.paidCorrection ?? 0)
  const mora = round2(p.paidPenalty ?? 0)
  const encargos = round2(juros + correcao + mora)
  return {
    juros: encargos,
    // ⚠️ a AMORTIZAÇÃO é a que o vínculo aplicou: `pago − encargos`. Repetir a da agenda
    // faria a linha não fechar (amort + juros ≠ parcela) justo na linha que relata um
    // fato — e linha de dinheiro que não soma é a que destrói a confiança na tela.
    amortizacao: round2(pago - encargos),
    parcela: round2(pago),
    realizado: true,
    pagoEm: p.paidDate ?? null,
    detalhe: { juros, correcao, mora },
  }
}

/**
 * ⭐ O TOTAL DA COLUNA JUROS — *"passa a somar só realizado (passado) + nada inventado
 * (futuro); é o número que conversa com a despesa financeira do DRE"* (o dono).
 *
 * ⛔ Antes era `Σ(installment.interest)` da agenda inteira: no pós-fixado isso soma a
 * previsão das pagas com ZERO das futuras — um número que não é nem o realizado nem a
 * projeção, e que não conversa com lugar nenhum. Medido no C61021346-2: dizia
 * **R$ 3.089,34** enquanto o realizado é **R$ 4.649,06**; a diferença, R$ 1.559,72, é
 * exatamente a parcela que o dono acabou de conciliar.
 */
export function jurosRealizados(parcelas: ParcelaGravada[]): number {
  return round2(parcelas.reduce((s, p) => {
    const l = linhaDoCronograma(p)
    return s + (l.realizado ? l.juros : 0)
  }, 0))
}
