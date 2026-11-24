// ⭐⭐⭐ O VALOR DA PARCELA NUM MÊS — UMA FUNÇÃO SÓ (25/11/2026, R58).
//
// ⛔ R58 — COMPROMISSO FUTURO MÊS A MÊS: "mesma fonte do forecast do app (Mesa, Custos Fixos) —
// um número só no sistema inteiro". Esta lógica morava DENTRO do laço de `lerCompromissos`
// (Custos Fixos / Mesa). A carteira de empréstimos precisa do MESMO número pra cada mês futuro;
// copiar o laço seria a 2ª régua. Ele foi MOVIDO pra cá sem mudar uma linha e os dois consomem.

import { estadoDaParcela, type EstadoDaParcela } from './estado-da-parcela'
import { referenciaFlexivelDoMes, type DevolucaoDoContrato, type ReferenciaFlexivel } from './referencia-flexivel'
import { forecastProxima, type ForecastResult } from './forecast'

export interface ParcelaParaValor {
  number: number
  dueDate: Date
  status: string
  payment: number
  interest: number
  paidTotal: number | null
  reconciledTransactionId: string | null
  reconciledTransaction: { date: Date; amount: number } | null
  payments: { amount: number; transaction: { date: Date } | null }[]
}
export interface ContratoParaValor {
  rateType: string | null
  interestRateMonthly: number
  scheduleSource: string | null
  installments: ParcelaParaValor[]
}

export interface PreparoDoContrato {
  flexible: boolean
  forecast: ForecastResult
  devolucoes: DevolucaoDoContrato[]
}

/** o que é do CONTRATO (calcula uma vez), não da parcela */
export function prepararContrato(l: ContratoParaValor): PreparoDoContrato {
  const flexible = l.scheduleSource === 'FLEXIBLE'
  const paraForecast = l.installments.map((i) => ({
    number: i.number,
    dueDate: i.dueDate,
    status: i.status,
    payment: i.payment,
    paidTotal: i.payments.length ? i.payments.reduce((s, x) => s + x.amount, 0) : i.paidTotal,
    reconciledTransactionId: i.reconciledTransactionId,
    paymentsCount: i.payments.length,
  }))
  const forecast = forecastProxima({ rateType: l.rateType }, paraForecast)
  /**
   * ⭐⭐ TODAS as devoluções do contrato, COM DATA — é o insumo da lei da referência flexível
   * (`referenciaFlexivelDoMes`), que recorta por MÊS em vez de ler o vínculo.
   *
   * ⚠️ Lê as DUAS portas (1:1 e N:1) porque o contrato real usou as duas até o backfill R54 de
   * 25/11 — checar UMA e declarar completo foi literalmente o bug de 14/08. **Não há dupla
   * contagem:** o trigger `loan_installment_no_double_link` torna impossível uma parcela ter as duas.
   */
  const devolucoes: DevolucaoDoContrato[] = flexible
    ? l.installments.flatMap((i) => [
        ...(i.reconciledTransaction
          ? [{ data: i.reconciledTransaction.date, valor: i.reconciledTransaction.amount }]
          : []),
        ...i.payments.flatMap((p) => (p.transaction ? [{ data: p.transaction.date, valor: p.amount }] : [])),
      ])
    : []
  return { flexible, forecast, devolucoes }
}

/**
 * ⭐⭐ O VALOR DA PARCELA DO MÊS — e a honestidade está em qual dos três ele é.
 *
 * ⛔ PAGA → o que REALMENTE saiu (`pago`), nunca o nominal da agenda: no POS o nominal é
 * amortização pura (juros 0, o estado honesto da agenda importada) e a parcela real do
 * C41022227 saiu a 6.903,45 contra 4.385,96 agendados. Mostrar o nominal numa parcela paga
 * seria a tela contradizendo o extrato.
 *
 * ⛔ ABERTA e é a PRÓXIMA → `forecastProxima` (PRE devolve a agenda como FATO; POS devolve a
 * última CASADA como `~previsto`).
 *
 * ⛔ ABERTA e NÃO é a próxima (parcela mais pra frente que caiu no mês olhado) → nominal, e
 * **marcado como previsto quando o juro ainda não nasceu** — o juro do mês do POS só se conhece
 * no vencimento, e dizer "4.385,96" como fato seria prometer um débito 36% menor que o real.
 */
export function valorDaParcela(
  veredito: { estado: EstadoDaParcela; pago: number },
  nominal: { payment: number; interest: number; dueDate: Date },
  loan: { rateType: string | null },
  forecast: { valor: number | null; isForecast: boolean; dueDate: Date | null; baseNumber: number | null },
): { valor: number | null; valorEhPrevisto: boolean; valorPorque: string | null } {
  if (veredito.estado === 'PAGA' || veredito.estado === 'PARCIAL') {
    return { valor: veredito.pago, valorEhPrevisto: false, valorPorque: null }
  }
  const ehAProxima =
    forecast.dueDate != null && forecast.dueDate.getTime() === nominal.dueDate.getTime()
  if (ehAProxima) {
    if (forecast.valor == null) {
      return {
        valor: null,
        valorEhPrevisto: false,
        valorPorque:
          'contrato pós-fixado sem parcela casada que sirva de base — o valor desta parcela só se conhece no vencimento',
      }
    }
    return {
      valor: forecast.valor,
      valorEhPrevisto: forecast.isForecast,
      valorPorque: forecast.isForecast
        ? `~previsto com base na parcela ${forecast.baseNumber} já paga`
        : null,
    }
  }
  const posSemJuro = (loan.rateType ?? 'PRE') === 'POS' && nominal.interest <= 0
  return {
    valor: nominal.payment,
    valorEhPrevisto: posSemJuro,
    valorPorque: posSemJuro
      ? 'só a amortização da agenda — o juro deste mês nasce no vencimento'
      : null,
  }
}


export interface AvaliacaoDaParcela {
  veredito: { estado: EstadoDaParcela; pago: number; falta: number; mordidas: number; selo: string } | ReturnType<typeof estadoDaParcela>
  v: { valor: number | null; valorEhPrevisto: boolean; valorPorque: string | null }
  ref: ReferenciaFlexivel | null
}

/**
 * ⛔⛔ AQUI A LEI SE BIFURCA, e o escopo é o que a mantém honesta: FLEXIBLE pergunta *"o caixa
 * deste mês cobriu a referência?"*; bancário segue no `estadoDaParcela`, onde *"PAID gravado é
 * DECISÃO"*. Uma lei só mentiria num dos dois.
 */
export function avaliarParcela(
  l: ContratoParaValor,
  prep: PreparoDoContrato,
  i: ParcelaParaValor,
  janela: { mes: string; de: Date; ate: Date },
  agora: Date,
): AvaliacaoDaParcela {
  const ref = prep.flexible
    ? referenciaFlexivelDoMes(i.payment, prep.devolucoes, janela, agora)
    : null
  const veredito = ref
    ? {
        estado: ref.estado as EstadoDaParcela,
        pago: ref.saiuNoMes,
        falta: 0,
        mordidas: ref.mordidas,
        selo: ref.selo,
      }
    : estadoDaParcela(
        {
          dueDate: i.dueDate,
          payment: i.payment,
          interest: i.interest,
          status: i.status,
          paidTotal: i.paidTotal,
          pagamentos: i.payments,
          valorDoVinculo11: null,
        },
        { flexible: prep.flexible, hoje: agora, rateMonthly: l.interestRateMonthly },
      )
  const v = ref
    ? {
        valor: ref.valor,
        // ⭐ a referência nominal é PREVISÃO: a tela marca `~`, nunca como fato
        valorEhPrevisto: ref.ehReferencia,
        valorPorque: ref.ehReferencia
          ? 'referência nominal da agenda flexível — a devolução é conforme o caixa'
          : null,
      }
    : valorDaParcela(veredito, i, { rateType: l.rateType }, prep.forecast)
  return { veredito, v, ref }
}
