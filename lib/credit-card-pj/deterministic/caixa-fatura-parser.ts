// Sprint Cartão FASE 4 (18/08/2026) — parser DETERMINÍSTICO da fatura Caixa por
// texto (pdftotext -layout). Custo zero, sem Vision, sem timeout/truncamento.
//
// A fatura Caixa inverte o Banrisul: as transações estão na COLUNA DIREITA (~col 99);
// a esquerda tem Limites/Guia de Consumo/Programa de Pontos/Encargos. Corta a
// esquerda e parseia só a direita.
//
// ARMADILHAS (todas do dado real, viram teste — REGRA 3):
//  1) SINAL POR SUFIXO, não por "-": cada valor termina em D (débito) ou C (crédito):
//     "570,08D", "12,50C". C = crédito (cashback/ajuste/pagamento), D = débito.
//     É ISSO que o Vision perdeu (3 créditos de 12,58) — o invariante K4/REGRA 6.
//  2) LINHAS QUEBRADAS no -layout: no Demonstrativo o banco separou data, descrição
//     e valor em linhas físicas distintas (28/07 / 29/06 / CASHBACK / AJUSTE / 12,50C
//     / 0,04C). Recupera por FILA: dates e descs pendentes casam com os valores nus
//     na ordem. A Σ dos créditos (12,58) independe do pareamento → a validação fecha.
//  3) MÚLTIPLOS CARTÕES na mesma fatura (2937, 3883): cada linha pertence ao bloco do
//     "(Cartão XXXX)" corrente. Guarda o final por linha (V1/V2 são por cartão).
//  4) 6 linhas "Total" (Total, Total OUTROS, Total final×2, Total COMPRAS, Total
//     COMPRAS PARCELADAS) — NÃO são transação; são os totais declarados (validação).
//  5) ⭐⭐ O PAR QUE SE ANULA — TOTAL DA FATURA ANTERIOR (D) × OBRIGADO PELO PAGAMENTO
//     (C), no MESMO bloco Demonstrativo. **Isto é PAREAMENTO, nunca "pular por nome".**
//     Σ == 0 (quitação total, o caso comum) → os dois ficam FORA e nada muda.
//     Σ != 0 (PAGAMENTO PARCIAL, ou nenhum) → o resíduo é **dívida carregada** que o
//     banco cobra NESTA fatura, e entra como LINHA (sem portador).
//     ⛔ Pular por NOME fazia o resíduo EVAPORAR: na fatura de outubro/2026 do dono
//     (anterior 5.106,99 NÃO paga — daí juros de atraso, multa e mora no mesmo bloco)
//     a leitura dava 3.716,72 contra 8.823,71 declarados, e a conferência RECUSAVA a
//     fatura **pelos 5.106,99 exatos**. 5 tentativas do dono, 5 recusas.
//  6) parcela "08 DE 10" (não "08/10"); a DATA (10/12) é da compra original (ano-1).
//  7) "7.280,39" aparece 8× no PDF — ancora em "Valor total desta fatura".
//
// A VALIDAÇÃO É JUIZ (impossibilidade): Σ por cartão/seção TEM que fechar com os
// totais declarados. Não fecha → import FALHA (validate-caixa-fatura).

import type { InvoiceExtraction, InvoiceLine, InvoiceLineKind } from '../types'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⛔ NÃO É FOLGA, É RUÍDO DE ARREDONDAMENTO (o mesmo degrau `FECHA` de 24/09 e a
 * tolerância do validador). Um par que difere de dois centavos é quitação total com
 * arredondamento do banco; acima disso é **pagamento parcial**, e aí o resíduo é uma
 * dívida de verdade que tem que aparecer.
 */
const CENTAVO = 0.02

const fmt = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

export function parseBRNumber(raw: string): number | null {
  const m = raw.match(/(-?)\s*([\d.]+),(\d{2})/)
  if (!m) return null
  const v = Number(`${m[2].replace(/\./g, '')}.${m[3]}`)
  return isNaN(v) ? null : round2((m[1] === '-' ? -1 : 1) * v)
}

/** valor + sufixo D/C — pega o ÚLTIMO da linha (a direita alinha à direita). */
function lastValueSuffix(s: string): { value: number; suffix: 'D' | 'C' } | null {
  const all = [...s.matchAll(/([\d.]+,\d{2})\s*([DC])\b/g)]
  if (all.length === 0) return null
  const m = all[all.length - 1]
  const v = parseBRNumber(m[1])
  if (v == null) return null
  return { value: v, suffix: m[2] as 'D' | 'C' }
}

/** parcela "08 DE 10" (Caixa) → {8,10}. */
function extractParcelaCaixa(desc: string): { number: number; total: number } | null {
  const m = desc.match(/\b(\d{2})\s+DE\s+(\d{2})\b/i)
  if (!m) return null
  const n = Number(m[1]), t = Number(m[2])
  if (n > 0 && t > 0 && n <= t) return { number: n, total: t }
  return null
}

type Section = 'DEMONSTRATIVO' | 'OUTROS' | 'ANUIDADE' | 'COMPRAS' | 'PARCELADAS' | 'NONE'

export interface CaixaFaturaParsed {
  extraction: InvoiceExtraction
  declared: {
    valorTotalFatura: number | null // "Valor total desta fatura R$ X D"
    totalFinalByCard: Record<string, number> // "Total final (cartão XXXX) X D"
    totalCompras: number | null // "Total COMPRAS"
    totalParceladas: number | null // "Total COMPRAS PARCELADAS"
    /**
     * O "Total" do bloco Demonstrativo — e ele é o **NET do bloco**, ASSINADO pelo
     * sufixo (D positivo, C negativo), não "a soma dos créditos".
     *
     * ⚠️⚠️ ERA `/Total\s+(num)\s*C/` — e isso estava **certo por ACIDENTE** na fixture
     * de agosto: lá o par anterior×pagamento se anula e o bloco só tem crédito, então
     * o net É `−|créditos|`. Na fatura RICA o Total é `465,29 D` e o regex (que exige
     * C) devolvia **null** — a checagem simplesmente não rodava. Lido como net, ele
     * morde nos dois.
     *
     * ⛔ E é lido **ANCORADO NA SEÇÃO**, nunca por regex solto: "Total" é o rótulo mais
     * genérico que existe num PDF de banco (a lição de 31/08).
     */
    totalDemonstrativo: number | null
  }
  computed: {
    debitsByCard: Record<string, number>
    sumDebits: number
    sumCredits: number // negativo
    comprasSum: number
    parceladasSum: number
    net: number // sumDebits + sumCredits = Valor total desta fatura
    count: number
    /** net do bloco Demonstrativo (inclui o resíduo do par) — bate `totalDemonstrativo` */
    demonstrativoNet: number
    /** Σ dos "TOTAL DA FATURA ANTERIOR" (D ⇒ positivo) */
    faturaAnterior: number
    /** Σ dos "OBRIGADO PELO PAGAMENTO" (C ⇒ negativo) */
    pagamentoAnterior: number
    /** o que SOBRA do par: > 0 dívida carregada · < 0 crédito · ~0 quitação total */
    residuoAnterior: number
  }
}

function resolveCutCol(lines: string[]): number {
  for (const l of lines) {
    const c = l.indexOf('Demonstrativo')
    if (c > 40) return c - 3
  }
  // fallback: coluna do cabeçalho "Crédito/Débito"
  for (const l of lines) {
    const c = l.indexOf('Crédito/Débito')
    if (c > 40) {
      const d = l.indexOf('Data')
      if (d > 40) return d - 3
    }
  }
  return 96
}

// O "VENCIMENTO" e a data ficam em LINHAS separadas no -layout da Caixa (o nome do
// titular entra no meio) → não dá pra ancorar pelo rótulo. As ÚNICAS datas completas
// (dd/mm/yyyy) no PDF são vencimento (12/08) + documento/processamento (28/07) — todas
// ≤ vencimento. Logo a MAIOR data completa = vencimento (determinístico, sem relógio).
function readVenc(text: string): { month: number; year: number; dueDate: string | null } {
  let best: { iso: string; month: number; year: number } | null = null
  for (const m of text.matchAll(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g)) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`
    if (!best || iso > best.iso) best = { iso, month: Number(m[2]), year: Number(m[3]) }
  }
  if (best) return { month: best.month, year: best.year, dueDate: best.iso }
  return { month: 12, year: 0, dueDate: null }
}

function resolveDate(dd: string, mm: string, vencMonth: number, vencYear: number): string {
  const day = Number(dd), mon = Number(mm)
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return vencYear ? `${vencYear}-01-01` : '1970-01-01'
  const year = mon > vencMonth ? vencYear - 1 : vencYear // trap 6
  return `${year || 1970}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function readDeclared(text: string): CaixaFaturaParsed['declared'] {
  const grab = (re: RegExp): number | null => {
    const m = text.match(re)
    return m ? parseBRNumber(m[1]) : null
  }
  const totalFinalByCard: Record<string, number> = {}
  for (const m of text.matchAll(/Total final\s*\(cart[ãa]o\s*(\d{4})\)\s*([\d.]+,\d{2})\s*D/gi)) {
    const v = parseBRNumber(m[2])
    if (v != null) totalFinalByCard[m[1]] = v
  }
  return {
    valorTotalFatura: grab(/Valor total desta fatura\s*R?\$?\s*([\d.]+,\d{2})\s*D/i),
    totalFinalByCard,
    totalCompras: grab(/Total COMPRAS\s+([\d.]+,\d{2})\s*D/i),
    totalParceladas: grab(/Total COMPRAS PARCELADAS\s+([\d.]+,\d{2})\s*D/i),
    // ⛔ o `totalDemonstrativo` NÃO é lido aqui: ele é ancorado na SEÇÃO, dentro do laço.
    totalDemonstrativo: null,
  }
}

export function parseCaixaFatura(text: string): CaixaFaturaParsed {
  const rawLines = text.split(/\r?\n/)
  const cut = resolveCutCol(rawLines)
  const venc = readVenc(text)
  const declared = readDeclared(text)

  const cardFinals = new Set<string>()
  let currentCard: string | null = null
  let section: Section = 'NONE'
  let lastDate = venc.dueDate ?? (venc.year ? `${venc.year}-01-01` : '1970-01-01')
  const pendingDates: string[] = []
  const pendingDescs: string[] = []

  const lines: InvoiceLine[] = []
  const debitsByCard: Record<string, number> = {}
  let sumDebits = 0, sumCredits = 0, comprasSum = 0, parceladasSum = 0

  // o PAR do Demonstrativo (trap 5) — acumulado, nunca pulado por nome
  let faturaAnterior = 0, pagamentoAnterior = 0
  let dataFaturaAnterior: string | null = null
  let posicaoDoResiduo: number | null = null
  // net do Demonstrativo FORA do par (o par entra depois, como resíduo)
  let demonstrativoOutros = 0

  const setCardFrom = (s: string) => {
    const m = s.match(/cart[ãa]o\s*(\d{4})/i)
    if (m) { currentCard = m[1]; cardFinals.add(m[1]) }
  }

  for (const raw of rawLines) {
    const right = raw.slice(cut).replace(/\s+$/, '')
    const t = right.trim()
    if (!t) continue

    // cabeçalhos de seção (PARCELADAS antes de COMPRAS)
    if (/^Demonstrativo\b/i.test(t)) { section = 'DEMONSTRATIVO'; pendingDates.length = 0; pendingDescs.length = 0; continue }
    if (/^Data\s+Descri/i.test(t)) continue // cabeçalho de coluna
    if (/^COMPRAS PARCELADAS\b/i.test(t)) { section = 'PARCELADAS'; setCardFrom(t); continue }
    if (/^COMPRAS\b/i.test(t) && !lastValueSuffix(t)) { section = 'COMPRAS'; setCardFrom(t); continue }
    if (/^OUTROS\b/i.test(t)) { section = 'OUTROS'; setCardFrom(t); continue }
    if (/^ANUIDADE\s*$/i.test(t)) { section = 'ANUIDADE'; continue } // header puro
    if (/\(cart[ãa]o\s*\d{4}\)/i.test(t) && !lastValueSuffix(t)) { setCardFrom(t); continue } // "TITULAR (Cartão XXXX)"

    // linhas "Total ..." — totais declarados, NÃO transação
    if (/^Total\b/i.test(t)) {
      // ⭐ o Total do DEMONSTRATIVO, ancorado na seção e com o SINAL do sufixo
      if (section === 'DEMONSTRATIVO' && declared.totalDemonstrativo == null) {
        const m = t.match(/^Total\s+([\d.]+,\d{2})\s*([DC])\b/i)
        const v = m ? parseBRNumber(m[1]) : null
        if (m && v != null) {
          declared.totalDemonstrativo = m[2].toUpperCase() === 'C' ? round2(-v) : v
        }
      }
      continue
    }

    const vs = lastValueSuffix(t)
    if (!vs) {
      // sem valor: no Demonstrativo pode ser data-nua ou desc-nua (linha quebrada)
      if (section === 'DEMONSTRATIVO') {
        if (/^\d{2}\/\d{2}$/.test(t)) pendingDates.push(t)
        else if (/[a-zA-Z]/.test(t) && !/Valor Original|Cotação/i.test(t)) pendingDescs.push(t)
      }
      continue
    }

    // linha COM valor
    const dateM = t.match(/^(\d{2})\/(\d{2})\b/)
    let desc = t
      .replace(/^(\d{2})\/(\d{2})\s*/, '')
      .replace(/[\d.]+,\d{2}\s*[DC]\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    let date: string
    if (!dateM && desc === '') {
      // valor NU (linha quebrada do Demonstrativo): casa com as filas pendentes
      date = pendingDates.length ? resolveDateFromToken(pendingDates.shift()!, venc) : lastDate
      desc = pendingDescs.shift() ?? 'Ajuste/crédito'
    } else {
      date = dateM ? resolveDate(dateM[1], dateM[2], venc.month, venc.year) : lastDate
      if (dateM) lastDate = date
    }

    const signed = vs.suffix === 'C' ? -vs.value : vs.value

    // ⭐⭐ TRAP 5 — O PAR SE ANULA OU DEIXA RESÍDUO. Nenhum dos dois vira linha AQUI:
    // só depois do bloco inteiro lido dá pra saber se sobrou algo (pode haver mais de
    // um pagamento). Os dois CONTAM no net do Demonstrativo, via `residuoAnterior`.
    if (/TOTAL DA FATURA ANTERIOR/i.test(desc)) {
      faturaAnterior = round2(faturaAnterior + signed)
      // a linha do resíduo nasce ONDE a anterior estava: ela é a 1ª coisa do bloco, e
      // jogá-la pro fim faria a fatura contar a história fora de ordem.
      if (posicaoDoResiduo == null) { posicaoDoResiduo = lines.length; dataFaturaAnterior = date }
      continue
    }
    if (/OBRIGADO PELO PAGAMENTO/i.test(desc)) {
      pagamentoAnterior = round2(pagamentoAnterior + signed)
      continue
    }
    if (/Valor total desta fatura/i.test(desc)) continue

    if (section === 'DEMONSTRATIVO') demonstrativoOutros = round2(demonstrativoOutros + signed)
    const card = currentCard

    if (vs.suffix === 'C') {
      sumCredits += signed
    } else {
      sumDebits += vs.value
      if (card) debitsByCard[card] = round2((debitsByCard[card] ?? 0) + vs.value)
      if (section === 'COMPRAS') comprasSum += vs.value
      else if (section === 'PARCELADAS') parceladasSum += vs.value
    }

    const parcela = extractParcelaCaixa(desc)
    const kind: InvoiceLineKind =
      vs.suffix === 'C' ? 'ESTORNO'
      : /\biof\b|anuidade|juros|multa|\bmora\b|encargo|rotativo/i.test(desc) ? 'ENCARGO_FINANCEIRO'
      : (parcela || section === 'PARCELADAS') ? 'COMPRA_PARCELADA'
      : 'COMPRA_AVISTA'

    lines.push({
      date,
      description: desc || '(sem descrição)',
      amount: round2(vs.value),
      suggestedKind: kind,
      ...(parcela ? { installmentNumber: parcela.number, installmentTotal: parcela.total } : {}),
      ...(card ? { cardLastDigits: card } : {}),
      ...(vs.suffix === 'C' ? { note: 'crédito/estorno (sufixo C na fatura)' } : {}),
    })
  }

  /**
   * ⭐⭐⭐ O RESÍDUO DO PAR — e ele cobre o caso GERAL, não um caso de borda:
   * quitação total (Σ≈0, o comum) · **pagamento parcial** · **nenhum pagamento**
   * (a fatura de outubro/2026 do dono) · pagamento a MAIS (crédito carregado).
   *
   * ⛔ SEM PORTADOR, de propósito: a dívida é da FATURA, não de um dos cartões —
   * medido no documento real, o Demonstrativo fica FORA de todo `Total final
   * (cartão N)`. Somá-la em `debitsByCard` quebraria o `V cartão N` na hora.
   */
  const residuoAnterior = round2(faturaAnterior + pagamentoAnterior)
  if (Math.abs(residuoAnterior) > CENTAVO) {
    const ehDivida = residuoAnterior > 0
    lines.splice(posicaoDoResiduo ?? lines.length, 0, {
      date: dataFaturaAnterior ?? lastDate,
      description: ehDivida ? 'dívida carregada da fatura anterior' : 'crédito carregado da fatura anterior',
      amount: round2(Math.abs(residuoAnterior)),
      suggestedKind: ehDivida ? 'ENCARGO_FINANCEIRO' : 'ESTORNO',
      note: ehDivida
        ? `fatura anterior ${fmt(faturaAnterior)} − pagamento ${fmt(-pagamentoAnterior)} · sem portador (a dívida é da fatura, não de um cartão)`
        : `pagamento ${fmt(-pagamentoAnterior)} acima da fatura anterior ${fmt(faturaAnterior)} · sem portador`,
    })
    if (ehDivida) sumDebits = round2(sumDebits + residuoAnterior)
    else sumCredits = round2(sumCredits + residuoAnterior)
  }

  const net = round2(sumDebits + sumCredits)
  const mainCard = Array.from(cardFinals)[0] ?? (text.match(/(\d{4})\s*$/m) ? null : null)

  const extraction: InvoiceExtraction = {
    dueDate: venc.dueDate,
    closingDate: null,
    totalDeclared: declared.valorTotalFatura,
    totalToPay: declared.valorTotalFatura,
    creditLimit: null,
    availableLimit: null,
    detectedBank: 'Caixa',
    cardLastDigitsFound: Array.from(cardFinals),
    scanQuality: 'GOOD',
    lines,
    notes: [],
  }
  void mainCard
  return {
    extraction,
    declared,
    computed: {
      debitsByCard,
      sumDebits: round2(sumDebits),
      sumCredits: round2(sumCredits),
      comprasSum: round2(comprasSum),
      parceladasSum: round2(parceladasSum),
      net,
      count: lines.length,
      demonstrativoNet: round2(demonstrativoOutros + residuoAnterior),
      faturaAnterior: round2(faturaAnterior),
      pagamentoAnterior: round2(pagamentoAnterior),
      residuoAnterior,
    },
  }
}

function resolveDateFromToken(tok: string, venc: { month: number; year: number }): string {
  const m = tok.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return venc.year ? `${venc.year}-01-01` : '1970-01-01'
  return resolveDate(m[1], m[2], venc.month, venc.year)
}
