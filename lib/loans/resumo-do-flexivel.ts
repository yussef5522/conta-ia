/**
 * ⭐⭐⭐ O RESUMO DO MÚTUO SE DERIVA DO HISTÓRICO — nunca se escreve à mão (09/10/2026).
 *
 * ⛔⛔ **O DEFEITO, nas palavras do dono:** *"o TEXTO-RESUMO da página está VELHO e desdiz os
 * cartões — «Devolvidos 40.000 e 50.000. Saldo 290.000» × cartão R$ 240.000."*
 *
 * **Medido em prod:** o `notes` do contrato diz *"Devolvidos 40.000 (06/07) e 50.000 (04/08).
 * Saldo 290.000"* — era **verdade em 05/08** e envelheceu no dia em que a terceira devolução
 * entrou. A nota não mentiu: ela **congelou**.
 *
 * ⭐ **A régua que fica é a mesma do resto da casa:** *decisão se grava, FATO se deriva.* O que
 * é fato — quantas devoluções, quanto saiu, qual o saldo, quando foi a última — sai dos
 * VÍNCULOS a cada leitura e **não tem como descolar**. O que é decisão — a origem do mútuo, a
 * escolha de não registrar a entrada — continua no `notes`, porque isso nenhuma soma deriva.
 *
 * ⚠️ É a lição do `CreditCardInvoice.status` (eternamente OPEN depois de vencer) e do `balance`
 * que driftou R$ 2.112,00: **número gravado envelhece; soma de linhas, não.**
 */
import { arredondar2 } from './estado-da-parcela'

export interface DevolucaoDoResumo {
  data: Date
  valor: number
}

export interface ResumoDoFlexivel {
  /** quantas devoluções já aconteceram (as duas portas de vínculo) */
  devolucoes: number
  totalDevolvido: number
  /** ⚠️ vem do `saldoDevedorAtual` (a régua da casa), nunca de uma subtração local */
  saldo: number
  principal: number
  ultima: Date | null
  /** ⭐ a frase que a tela imprime no lugar do texto velho */
  frase: string
  /**
   * ⛔⛔ O GUARD DO DONO, calculado aqui pra a tela poder GRITAR em vez de mostrar dois números
   * que não fecham: `Σ(histórico) == principal − saldo`. Falso = alguma das duas pontas está
   * lendo outra coisa.
   */
  fecha: boolean
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ddmmaa = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`

/**
 * ⭐ O resumo, de uma função só.
 *
 * @param principal o valor original do mútuo
 * @param saldo o saldo devedor pela régua da casa (`saldoDevedorAtual`) — **não** recalculado aqui
 * @param devolucoes todas as devoluções com data e valor (as duas portas)
 */
export function resumoDoFlexivel(
  principal: number,
  saldo: number,
  devolucoes: readonly DevolucaoDoResumo[],
): ResumoDoFlexivel {
  const ordenadas = [...devolucoes].sort((a, b) => a.data.getTime() - b.data.getTime())
  const total = arredondar2(ordenadas.reduce((s, d) => s + d.valor, 0))
  const ultima = ordenadas.length ? ordenadas[ordenadas.length - 1].data : null
  const p = arredondar2(principal)
  const s = arredondar2(saldo)

  /** ⚠️ 2 centavos: o mesmo degrau `FECHA` da casa — ruído de arredondamento não é divergência */
  const fecha = Math.abs(total - arredondar2(p - s)) <= 0.02

  const pedacos: string[] = [`Mútuo de ${brl(p)}, sem juros`]
  if (ordenadas.length === 0) {
    pedacos.push('nenhuma devolução registrada ainda')
  } else {
    pedacos.push(
      `${ordenadas.length} ${ordenadas.length === 1 ? 'devolução' : 'devoluções'} somando ${brl(total)}` +
        (ultima ? ` (a última em ${ddmmaa(ultima)})` : ''),
    )
  }
  pedacos.push(`saldo ${brl(s)}`)

  return {
    devolucoes: ordenadas.length,
    totalDevolvido: total,
    saldo: s,
    principal: p,
    ultima,
    frase: pedacos.join(' · '),
    fecha,
  }
}
