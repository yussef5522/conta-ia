// ⭐⭐ OS ADAPTADORES — cada banco traduzido pra forma única (09/09/2026).
//
// ⛔ **A RÉGUA DE CONFERÊNCIA CONTINUA SENDO DE CADA BANCO.** Ver a nota do
// `fatura-pf-lida.ts`: a composição que fecha o Nubank não é a do Banrisul nem a do Itaú.
// Aqui cada adaptador aplica a régua do SEU documento e devolve o veredito; o import lê
// só o veredito. **Uma régua única reprovaria fatura correta** — foi a lição de 31/08.

import { parseBanrisulFaturaPF } from '@/lib/fatura-banrisul/banrisul-fatura-pf'
import { parseNubankFaturaPF, conferirNubank } from '@/lib/fatura-nubank/parser'
import { parseItauFaturaPF, conferirItau } from '@/lib/fatura-itau/parser'
import { PROXIMAS_VAZIAS, type FaturaPFLida, type LinhaLidaPF } from './fatura-pf-lida'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const TOL = 0.02
const brl = (n: number) => `R$ ${n.toFixed(2)}`

/**
 * ⚠️ ESTE ENCARGO É DO BANRISUL, e só dele — o rótulo "Encargos sobre rotativo" não existe
 * nas outras duas faturas. Ele mora aqui (e não no import) desde que o import passou a
 * falar UMA língua: era código de um banco rodando pra todos.
 */
function encargosDeclaradosBanrisul(texto: string): number {
  let soma = 0
  for (const re of [
    /Encargos sobre rotativo\s+([\d.]+,\d{2})/i,
    /Encargos sobre saque\s+([\d.]+,\d{2})/i,
    /Encargos sobre pagamento de contas\s+([\d.]+,\d{2})/i,
  ]) {
    const m = texto.match(re)
    if (m) soma += Number(m[1].replace(/\./g, '').replace(',', '.'))
  }
  return round2(soma)
}

export function lerBanrisulPF(texto: string): FaturaPFLida {
  const r = parseBanrisulFaturaPF(texto)
  const enc = encargosDeclaradosBanrisul(texto)
  const despesasCalculado = r.computed.sumPositives
  const saldoCalculado = round2(r.computed.sumEstornos + despesasCalculado + enc)
  const despesasOk = r.declared.brasil != null
    && Math.abs(despesasCalculado - r.declared.brasil) <= TOL
  const saldoOk = r.declared.saldoAtual != null
    && Math.abs(saldoCalculado - r.declared.saldoAtual) <= TOL

  const linhas: LinhaLidaPF[] = (r.extraction.lines ?? []).map((l) => ({
    data: l.date,
    descricao: l.description,
    valor: round2(l.amount),
    credito: !!l.note?.includes('estorno'),
    parcelaNumero: l.installmentNumber ?? null,
    parcelaTotal: l.installmentTotal ?? null,
    portador: (l as { cardLastDigits?: string }).cardLastDigits ?? null,
    internacional: !!l.note?.includes('internacional'),
  }))

  return {
    banco: 'Banrisul',
    vencimento: r.extraction.dueDate ?? null,
    linhas,
    conferencia: {
      despesasCalculado,
      despesasDeclarado: r.declared.brasil,
      saldoCalculado,
      saldoDeclarado: r.declared.saldoAtual,
      encargosDeclarados: enc,
      encargosRotulo: 'Encargos sobre rotativo',
      fecha: despesasOk && saldoOk,
      detalhe: r.declared.brasil != null
        ? `   despesas: lido ${brl(despesasCalculado)} · declarado ${brl(r.declared.brasil)}`
        : null,
    },
    portadores: r.extraction.cardLastDigitsFound ?? [],
    proximas: r.proximas,
  }
}

export function lerNubankPF(texto: string): FaturaPFLida {
  const r = parseNubankFaturaPF(texto)
  const c = conferirNubank(r)
  // ⚠️ no Nubank a régua é a COMPOSIÇÃO declarada (compras + IOF + outros), nunca a soma
  // bruta: somar tudo dá NEGATIVO, porque pagamento e saldo em atraso entram no mesmo bloco.
  const linhas: LinhaLidaPF[] = r.linhas
    .filter((l) => !PAGAMENTO.test(l.bloco))
    .map((l) => ({
      data: l.data,
      descricao: l.descricao,
      valor: round2(l.valor),
      credito: l.credito,
      parcelaNumero: l.parcelaNumero,
      parcelaTotal: l.parcelaTotal,
      portador: l.final,
      internacional: false,
    }))
  return {
    banco: 'Nubank',
    vencimento: r.vencimento,
    linhas,
    conferencia: {
      despesasCalculado: r.computed.compras,
      despesasDeclarado: r.declared.compras,
      saldoCalculado: c.composicao,
      saldoDeclarado: c.totalAPagar,
      // ⚠️⚠️ MEDIDO, não suposto (09/09): eu tinha posto 0 aqui achando que os "outros
      // lançamentos" já vinham como linha. **Não vêm** — a Σ das linhas dá 2.726,03 e o
      // declarado é 3.053,32, exatamente os 327,29 deste campo. Sem ele a fatura do
      // Nubank gravaria 327,29 a menos, que é o mesmo bug dos R$ 0,62 do Banrisul.
      encargosDeclarados: r.declared.outrosLancamentos ?? 0,
      encargosRotulo: 'Outros lançamentos',
      fecha: c.fecha,
      detalhe: `   composição: lido ${brl(c.composicao)} · Total a pagar ${brl(c.totalAPagar ?? 0)}`,
    },
    portadores: [...new Set(r.linhas.map((l) => l.final).filter((x): x is string => !!x))],
    proximas: PROXIMAS_VAZIAS,
  }
}

const PAGAMENTO = /pagamento|financiamento/i

export function lerItauPF(texto: string): FaturaPFLida {
  const r = parseItauFaturaPF(texto)
  const c = conferirItau(r)
  return {
    banco: 'Itaú/Luizacred',
    vencimento: r.vencimento,
    linhas: r.linhas.map((l) => ({
      data: l.data,
      descricao: l.descricao,
      valor: round2(l.valor),
      credito: l.credito,
      parcelaNumero: l.parcelaNumero,
      parcelaTotal: l.parcelaTotal,
      portador: l.portador,
      internacional: false,
    })),
    conferencia: {
      // ⭐ "despesas" aqui é o que entrou nesta fatura: os dois cartões + produtos/serviços
      despesasCalculado: c.lancamentos,
      despesasDeclarado: c.declarado,
      // ⭐ e o SALDO é o total do boleto, recomposto pela conta que o próprio resumo escreve
      saldoCalculado: c.totalRecomposto ?? c.lancamentos,
      saldoDeclarado: c.totalDeclarado,
      encargosDeclarados: r.declared.encargos ?? 0,
      encargosRotulo: 'Encargos (financiamento + moratório)',
      // ⛔ as DUAS provas: os lançamentos fecham, cada cartão fecha com o próprio
      // subtotal, e o total do boleto fecha pela composição.
      fecha: c.fecha && c.cartoesFecham && c.totalFecha,
      detalhe: [
        `   lançamentos: lido ${brl(c.lancamentos)} · declarado ${brl(c.declarado ?? 0)}`,
        ...r.cartoes.map((x) => `   cartão ${x.final}: lido ${brl(x.somado)} · declarado ${brl(x.declarado ?? 0)}`),
        c.totalRecomposto != null
          ? `   total da fatura: recomposto ${brl(c.totalRecomposto)} · declarado ${brl(c.totalDeclarado ?? 0)}`
          : null,
      ].filter(Boolean).join('\n'),
    },
    portadores: r.cartoes.map((x) => x.final),
    // ⛔ as parcelas das PRÓXIMAS faturas ficam de fora dos lançamentos, mas o número
    // declarado vai pra tela — é o que deixa o dono conferir o que vem por aí.
    proximas: {
      proxima: r.proximas.proxima,
      seguinte: null,
      demais: r.proximas.demais,
      total: r.proximas.total,
      rotuloProxima: 'próxima fatura',
      rotuloSeguinte: null,
    },
  }
}
