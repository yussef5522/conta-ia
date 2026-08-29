// PARSER DETERMINÍSTICO — FATURA MERCADO PAGO (29/08/2026). O 4º da família PJ.
//
// Layout: `pdftotext -layout` limpo, COLUNA ÚNICA — sem o problema de tabelas lado a lado
// que obrigou corte por coluna no Banrisul e no Caixa. Duas seções:
//   "Movimentações na fatura"    → pagamentos da fatura anterior + encargos
//   "Cartão Visa [****2711]"     → os consumos (compras e parcelas)
//
// ⚠️⚠️ AS 3 ARMADILHAS DESTE BANCO, todas medidas contra a fatura real de 20/08:
//
// 1) **DATA DA PARCELA É A DA COMPRA ORIGINAL, e pode estar NO FUTURO.**
//    A coluna "Data" das parcelas traz o dia/mês da compra ORIGINAL, sem ano — e como as
//    compras são de meses (ou anos) diferentes, aparecem datas como `25/10`, `06/10`,
//    `16/09`, `01/09`, `28/08` numa fatura que fecha em **15/08**. Um parser que tome a
//    data ao pé da letra cria transação com data FUTURA e envenena saldo, DRE e o descarte
//    de futuro do import. **A competência é da FATURA**; a data original vira metadado.
//
// 2) **ITENS REPETIDOS SÃO COMPRAS DISTINTAS, não duplicata de exibição.**
//    "MADEIRA · Parcela 3 de 12 · R$ 47,59" aparece DUAS vezes. Parece bug de listagem —
//    e não é: a soma declarada (2.503,08) só fecha com as duas (sem uma, 2.455,49). Quem
//    decide é o total declarado, nunca a aparência. Mesma lição do Sicredi (2 compras
//    "Mercadolivre Tioali" no mesmo minuto).
//
// 3) **ENCARGOS SÃO LINHAS, não soma por fora.** IOF do rotativo, multa por atraso, juros
//    do rotativo e juros de mora entram como transações — igual aos R$ 0,62 da fatura PF.
//    Assim o invariante "total == Σ das linhas" continua valendo e o dono VÊ a cobrança.
//
// ⚠️ E o que este banco NÃO tem, apesar de parecer: **pagamento parcial**. A fatura de
// julho (2.025,73) foi paga INTEGRALMENTE em 3 lançamentos (42,42 + 0,02 + 1.983,29), só
// que EM ATRASO — daí multa e juros. Por isso os pagamentos NÃO entram na conta do total.

import type { InvoiceExtraction, InvoiceLine } from '../types'
import { parseBRL } from './sicredi-fatura-parser' // REGRA 4: uma leitura de valor, não quatro

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface MercadoPagoFaturaParsed extends InvoiceExtraction {
  /** os totais que o PRÓPRIO PDF declara — é contra eles que a validação julga */
  declarados: {
    consumos: number | null
    jurosMesAnterior: number | null
    tarifasEncargos: number | null
    multasAtraso: number | null
    pagamentosCreditos: number | null
    totalFaturaAnterior: number | null
    total: number | null
  }
  /** soma das linhas de consumo lidas (pra bater com `declarados.consumos`) */
  somaConsumos: number
  somaEncargos: number
  somaPagamentos: number
}

const MESES_ATE = (fechamentoMes: number, mes: number) => (mes > fechamentoMes ? -1 : 0)

/** "16/08" + mês de fechamento → ISO. Mês maior que o fechamento ⇒ ano anterior. */
function dataOriginalISO(dia: number, mes: number, anoFechamento: number, mesFechamento: number): string {
  const ano = anoFechamento + MESES_ATE(mesFechamento, mes)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** dd/mm no começo da linha */
const RE_DATA = /^\s*(\d{2})\/(\d{2})\s+/
/** "Parcela 13 de 18" */
const RE_PARCELA = /Parcela\s+(\d+)\s+de\s+(\d+)/i

/** Acha "ROTULO ..... R$ 1.234,56". `janela` = quantos chars podem separar os dois.
 *  ⚠️ o rótulo NÃO pode conter `R\$` — senão o regex passa a exigir DOIS valores e não casa
 *  (mordeu na 1ª rodada: o total vinha 4.966,40, de outra seção, pelo fallback). */
function acharValorDeclarado(txt: string, rotulo: RegExp, janela = 80): number | null {
  // ⚠️ `im` SEMPRE: montar o RegExp só com 'i' PERDIA a flag `m` do rótulo, e aí o `^` de
  // um rótulo ancorado passava a significar "início do texto inteiro" em vez de "início da
  // linha" — o total voltava null. Erro sutil de composição de regex; custou duas rodadas.
  const m = txt.match(new RegExp(rotulo.source + String.raw`[\s\S]{0,${janela}}?R\$\s*([\d.]+),(\d{2})`, 'im'))
  if (!m) return null
  return round2(Number(`${m[1].replace(/\./g, '')}.${m[2]}`))
}

export function parseMercadoPagoFatura(texto: string): MercadoPagoFaturaParsed {
  const linhas = texto.split(/\r?\n/)

  // ── cabeçalho: vencimento, fechamento, limites
  const venc = texto.match(/Vence em[\s\S]{0,60}?(\d{2})\/(\d{2})\/(\d{4})/i)
    ?? texto.match(/Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  const dueDate = venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : null
  const fech = texto.match(/Fechamento da fatura\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  const closingDate = fech ? `${fech[3]}-${fech[2]}-${fech[1]}` : null
  const mesFechamento = fech ? Number(fech[2]) : venc ? Number(venc[2]) : 1
  const anoFechamento = fech ? Number(fech[3]) : venc ? Number(venc[3]) : new Date().getUTCFullYear()

  // ⚠️ "Limite total" e o valor ficam em LINHAS diferentes (layout em 4 colunas no topo):
  //     `Total a pagar   Vence em   Limite total   Saque total`
  //     `                20/08/2026 R$ 7.200,00    R$ 50,00`
  // por isso a janela maior. "Limite disponível" já vem na mesma linha, lá embaixo.
  const creditLimit = acharValorDeclarado(texto, /Limite total/, 220)
  const availableLimit = acharValorDeclarado(texto, /Limite disponível/)
  const finais = [...texto.matchAll(/Cartão\s+Visa\s*\[\**(\d{4})\]/gi)].map((m) => m[1])

  // ── os totais declarados (o juiz)
  const declarados = {
    consumos: acharValorDeclarado(texto, /Consumos de \d{2}\/\d{2} a \d{2}\/\d{2}/),
    jurosMesAnterior: acharValorDeclarado(texto, /Juros do mês anterior/),
    tarifasEncargos: acharValorDeclarado(texto, /Tarifas e encargos/),
    multasAtraso: acharValorDeclarado(texto, /Multas por atraso/),
    pagamentosCreditos: acharValorDeclarado(texto, /Pagamentos e créditos devolvidos/),
    totalFaturaAnterior: acharValorDeclarado(texto, /Total da fatura de \w+/),
    // ⚠️ o "Total" do RESUMO, numa linha só dele. NÃO pode cair no "Total a pagar: até
    // R$ 4.966,40" da seção de parcelamento, que é uma OFERTA, não a fatura (foi o que
    // aconteceu na 1ª rodada). Por isso ancora no começo da linha e exige espaçamento.
    // (janela 60: no layout há ~41 espaços entre "Total" e o valor; o `[ \t]{2,}` é o que
    //  impede casar "Total a pagar", "Total da fatura de…" e "Total:" — todos com 1 espaço)
    total: acharValorDeclarado(texto, /^[ \t]*Total[ \t]{2,}/m, 60),
  }

  // ── varredura das linhas, por SEÇÃO
  type Secao = 'nenhuma' | 'movimentacoes' | 'consumos'
  let secao: Secao = 'nenhuma'
  const consumos: InvoiceLine[] = []
  const encargos: InvoiceLine[] = []
  const pagamentos: InvoiceLine[] = []

  for (const raw of linhas) {
    const l = raw.trim()
    if (/^Movimenta(ç|c)ões na fatura/i.test(l)) { secao = 'movimentacoes'; continue }
    if (/^Cartão\s+Visa/i.test(l)) { secao = 'consumos'; continue }
    // "Total   R$ 2.503,08" fecha a seção de consumos — não é transação
    if (/^Total\s+R\$/i.test(l)) { secao = 'nenhuma'; continue }
    if (secao === 'nenhuma') continue

    const md = l.match(RE_DATA)
    if (!md) continue
    const valor = parseBRL(l)
    if (valor == null) continue

    const dia = Number(md[1])
    const mes = Number(md[2])
    const dataOriginal = dataOriginalISO(dia, mes, anoFechamento, mesFechamento)
    const desc = l.replace(RE_DATA, '').replace(/R\$\s*[\d.]+,\d{2}\s*$/, '').replace(RE_PARCELA, '').trim()
    const parc = l.match(RE_PARCELA)

    // ⚠️ A DATA DA LINHA É A DO FECHAMENTO DA FATURA, não a `dataOriginal`: as parcelas
    // trazem a data da compra original e várias caem NO FUTURO (25/10, 06/10, 16/09…).
    // Usar a original criaria transação com data futura. A original vira metadado.
    const dataCompetencia = closingDate ?? dueDate ?? dataOriginal

    const linha: InvoiceLine = {
      date: dataCompetencia,
      description: desc || l,
      amount: Math.abs(valor),
      // parcela vira COMPRA_PARCELADA (regime caixa: só a parcela do mês entra)
      suggestedKind: parc ? 'COMPRA_PARCELADA' : 'COMPRA_AVISTA',
      ...(parc ? { installmentNumber: Number(parc[1]), installmentTotal: Number(parc[2]) } : {}),
      ...(finais[0] ? { cardLastDigits: finais[0] } : {}),
    }

    if (secao === 'consumos') {
      consumos.push(linha)
      continue
    }
    // seção de movimentações: pagamento da fatura anterior × encargos
    if (/pagar sua fatura|Pagamento da fatura/i.test(l)) {
      // ⚠️ IGNORAR: o pagamento da fatura ANTERIOR não vira transação do cartão — o
      // dinheiro já saiu no extrato bancário do mês passado. Contar aqui duplicaria.
      pagamentos.push({ ...linha, suggestedKind: 'IGNORAR' })
    } else {
      // IOF, multa, juros do rotativo, juros de mora → LINHAS, nunca soma por fora
      encargos.push({ ...linha, suggestedKind: 'ENCARGO_FINANCEIRO' })
    }
  }

  const somaConsumos = round2(consumos.reduce((s, l) => s + l.amount, 0))
  const somaEncargos = round2(encargos.reduce((s, l) => s + l.amount, 0))
  const somaPagamentos = round2(pagamentos.reduce((s, l) => s + l.amount, 0))

  return {
    dueDate,
    closingDate,
    totalDeclared: declarados.total,
    totalToPay: declarados.total,
    creditLimit,
    availableLimit,
    detectedBank: 'Mercado Pago',
    cardLastDigitsFound: finais,
    // ⚠️ o que VAI VIRAR TRANSAÇÃO: consumos + encargos. Os pagamentos da fatura ANTERIOR
    // não entram (são caixa do mês passado, e já saíram no extrato bancário).
    lines: [...consumos, ...encargos],
    declarados,
    somaConsumos,
    somaEncargos,
    somaPagamentos,
  } as MercadoPagoFaturaParsed
}
