// V6 — A PONTE ENTRE AS DUAS TELAS (26/08).
//
// ⚠️ POR QUE ISTO EXISTE: em 26/08 a tela de Vendas dizia ~595 mil e o Fluxo de Caixa
// dizia ~425 mil pro MESMO agosto, e ninguém avisou. Duas telas contando histórias
// diferentes em silêncio é a falha mais grave que um sistema financeiro pode ter — pior
// que estar errado, porque o dono não tem como saber em qual acreditar.
//
// Vendas mede COMPETÊNCIA (quando a venda aconteceu) e Fluxo mede CAIXA (quando o
// dinheiro entrou). Elas DEVEM divergir — mas a diferença tem que ser EXPLICÁVEL, e a
// explicação é sempre a mesma: as BORDAS do D+N.
//
//   Vendas(agosto)  = dinheiro que entrou em agosto por venda de agosto
//                   + venda de agosto cujo dinheiro ainda vai cair em setembro
//   Caixa(agosto)   = dinheiro que entrou em agosto por venda de agosto
//                   + dinheiro que entrou em agosto por venda de JULHO
//
//   → Caixa − Vendas = (venda de julho recebida em agosto) − (venda de agosto a receber)
//
// As duas bordas são CALCULÁVEIS a partir da MESMA `VendaDiaria` (que já guarda a
// competência) e das transações de origem (que guardam a data de entrada). Se a conta
// não fechar dentro da tolerância, é porque uma das telas tem dado que a outra não vê —
// duplicata, linha órfã, recompute pela metade — e o juiz fica VERMELHO.

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** ±1 real: arredondamento de rateio, nunca dado faltando. */
export const TOLERANCIA = 1

export interface LinhaVendaComOrigem {
  dataCompetencia: Date
  dataCompetenciaFim: Date
  valorLiquido: number
  /** datas em que o dinheiro de fato entrou (das transações de origem) */
  entradas: { data: Date; valor: number }[]
}

export interface ConsistenciaResultado {
  /** total da tela de Vendas no mês (competência PURA do mês) */
  vendasDoMes: number
  /** total que o Fluxo conta como entrada de venda no mês (caixa) */
  caixaDoMes: number
  /** venda de mês ANTERIOR cujo dinheiro entrou neste mês */
  bordaRecebidaDeAntes: number
  /** venda DESTE mês cujo dinheiro ainda não entrou (cai depois) */
  bordaAReceber: number
  /** o que sobra depois de descontar as bordas — tem que ser ~0 */
  inexplicado: number
  fecha: boolean
}

/**
 * Confere a ponte. PURA — recebe as linhas já lidas do banco.
 *
 * `mesInicio`/`mesFim` delimitam o mês analisado (UTC, fim exclusivo).
 * Só entram linhas cuja competência está DENTRO do mês (agosto puro) — o bloco que
 * atravessa a virada é tratado como borda, exatamente como a tela faz.
 */
export function conferirConsistencia(
  linhas: LinhaVendaComOrigem[],
  mesInicio: Date,
  mesFim: Date,
): ConsistenciaResultado {
  const dentro = (d: Date) => d.getTime() >= mesInicio.getTime() && d.getTime() < mesFim.getTime()

  let vendasDoMes = 0
  let caixaDoMes = 0
  let bordaRecebidaDeAntes = 0
  let bordaAReceber = 0

  for (const l of linhas) {
    // competência do mês = a linha COMEÇA dentro do mês (o bloco de borda começa antes)
    const competenciaNoMes = dentro(l.dataCompetencia)
    if (competenciaNoMes) vendasDoMes = round2(vendasDoMes + l.valorLiquido)

    for (const e of l.entradas) {
      const dinheiroNoMes = dentro(e.data)
      if (dinheiroNoMes) caixaDoMes = round2(caixaDoMes + e.valor)
      if (dinheiroNoMes && !competenciaNoMes) {
        // dinheiro entrou este mês, venda é de antes → borda de entrada
        bordaRecebidaDeAntes = round2(bordaRecebidaDeAntes + e.valor)
      }
      if (!dinheiroNoMes && competenciaNoMes) {
        // venda é deste mês, dinheiro caiu fora → borda de saída
        bordaAReceber = round2(bordaAReceber + e.valor)
      }
    }
  }

  // Caixa − Vendas deve ser exatamente (recebido de antes) − (a receber).
  const diferenca = round2(caixaDoMes - vendasDoMes)
  const explicado = round2(bordaRecebidaDeAntes - bordaAReceber)
  const inexplicado = round2(diferenca - explicado)

  return {
    vendasDoMes,
    caixaDoMes,
    bordaRecebidaDeAntes,
    bordaAReceber,
    inexplicado,
    fecha: Math.abs(inexplicado) <= TOLERANCIA,
  }
}

/** Frase para o relatório do juiz e o e-mail — diz o número E a explicação. */
export function explicarConsistencia(r: ConsistenciaResultado, mes: string): string {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (r.fecha) {
    return `${mes}: Vendas ${brl(r.vendasDoMes)} × Caixa ${brl(r.caixaDoMes)} — diferença explicada pelas bordas (recebido de antes ${brl(r.bordaRecebidaDeAntes)}, a receber ${brl(r.bordaAReceber)}).`
  }
  return `${mes}: a tela de Vendas diz ${brl(r.vendasDoMes)} e o Fluxo de Caixa diz ${brl(r.caixaDoMes)}, e ${brl(Math.abs(r.inexplicado))} dessa diferença NÃO é borda de D+N (recebido de antes ${brl(r.bordaRecebidaDeAntes)}, a receber ${brl(r.bordaAReceber)}). Duas telas contando histórias diferentes — suspeitar de VendaDiaria duplicada, órfã ou recompute pela metade.`
}

export { iso }
