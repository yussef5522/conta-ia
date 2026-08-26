// NÚCLEO COMPARTILHADO DA FATURA BANRISUL (26/08) — PJ e PF.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE: a fatura PJ e a fatura PF do Banrisul têm o MESMO
// dialeto de linha (data dd/mm, valor com vírgula, parcela dd/dd embutida na descrição,
// internacional com US$+R$, IOF como continuação sem data, "TX DÓLAR" informativa,
// negativo = estorno) e LAYOUTS DE COLUNA diferentes:
//   · PJ  → transações só na coluna ESQUERDA; a direita é BanriClube/pontos/limites.
//   · PF  → transações nas DUAS colunas (dois portadores), e a fronteira MUDA de página.
//
// Então o que é compartilhado é a LEITURA DA LINHA; o que é específico é COMO FATIAR a
// página em colunas. Duplicar a leitura seria a segunda cópia da mesma decisão — o
// padrão que já custou caro neste projeto (5 detectores de par, 3 cópias da regra de
// competência). Aqui: um motor, duas estratégias de coluna.
//
// As ARMADILHAS abaixo vieram todas de fatura real e viram teste (REGRA 3):
//  1) internacional = linha datada com DOIS números (US$ e R$): valor = o ÚLTIMO
//     (R$ convertido), o penúltimo é US$. Vai pro bucket EXTERIOR.
//  2) IOF sobre transação no exterior vem em linha SEM data (continuação da compra
//     internacional acima) — é VALOR, soma como encargo, bucket IOF.
//  3) "USD 200,00 TX DÓLAR R$ 5,2621" é INFORMATIVA (a cotação) — NÃO é transação.
//  4) pagamento da fatura anterior vem como "DEB 0230/06 ... -2.677,29" (negativo,
//     prefixo DEB) — NÃO importa (já está no extrato; entra em Pagamentos/Créditos).
//  5) par de anuidade: "DESC. ANUID. ... -18,00" (CRÉDITO) + "ANUIDADEINT DIFER ...
//     18,00" (DÉBITO). Net 0. NÃO deduplicar — os dois entram.
//  6) "TOTAL DE GASTOS" é a Σ declarada (validação), não transação.
//  7) datas sem ano: mês > mês do vencimento ⇒ ano anterior.

import type { InvoiceExtraction, InvoiceLine, InvoiceLineKind } from '@/lib/credit-card-pj/types'

export const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** "-2.677,29" → -2677.29 · "85,70" → 85.70. Null se não casar (comma + 2 decimais). */
export function parseBRNumber(raw: string): number | null {
  const m = raw.match(/(-?)\s*([\d.]+),(\d{2})/)
  if (!m) return null
  const v = Number(`${m[2].replace(/\./g, '')}.${m[3]}`)
  return isNaN(v) ? null : round2((m[1] === '-' ? -1 : 1) * v)
}

/** Todos os tokens monetários (comma + 2 decimais) da string, na ordem. */
export function allBRNumbers(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(/-?[\d.]+,\d{2}/g)) {
    const n = parseBRNumber(m[0])
    if (n != null) out.push(n)
  }
  return out
}

/** Parcela dd/dd na descrição (01/06, 09/10). n≤total, total≤24, ambos>0. */
export function extractParcela(desc: string): { number: number; total: number } | null {
  let found: { number: number; total: number } | null = null
  for (const m of desc.matchAll(/\b(\d{2})\/(\d{2})\b/g)) {
    const n = Number(m[1]), t = Number(m[2])
    if (n > 0 && t > 0 && n <= t && t <= 24) found = { number: n, total: t } // última ocorrência
  }
  return found
}


export const MONTHS_TX = /^(\d{2})\/(\d{2})\s+(.*)$/


export interface Bucketed {
  bucket: 'BRASIL' | 'EXTERIOR' | 'IOF' | 'ESTORNO' | 'PAYMENT'
  description: string
  value: number // COM sinal
  date: string
  parcela: { number: number; total: number } | null
  card: string | null
}


export interface BanrisulFaturaParsed {
  extraction: InvoiceExtraction
  declared: {
    totalGastos: number | null // "TOTAL DE GASTOS" — Σ de todos os débitos do período
    saldoAtual: number | null // "Saldo da fatura atual" — o que se paga (net)
    anterior: number | null // "Total da fatura anterior"
    pagamentosCreditos: number | null // "Pagamentos / Créditos"
    brasil: number | null // "Despesas / Débitos no Brasil"
    exterior: number | null // "Saldo Convertido em Reais (+)"
    iof: number | null // "IOF sobre transações no exterior"
  }
  computed: {
    sumBrasil: number
    sumExterior: number
    sumIof: number
    sumPositives: number // brasil + exterior + iof (débitos)
    sumEstornos: number // créditos/estornos (negativo, não-pagamento)
    sumPayments: number // pagamento(s) da fatura anterior
    net: number // sumPositives + sumEstornos = Saldo da fatura atual
    count: number // linhas importáveis (exclui pagamento)
  }
}


export function readDeclared(text: string): BanrisulFaturaParsed['declared'] {
  const grab = (re: RegExp): number | null => {
    const m = text.match(re)
    return m ? parseBRNumber(m[1]) : null
  }
  return {
    totalGastos: grab(/TOTAL DE GASTOS\s+([\d.]+,\d{2})/i),
    saldoAtual: grab(/Saldo da fatura atual\s+([\d.]+,\d{2})/i),
    anterior: grab(/Total da fatura anterior\s+([\d.]+,\d{2})/i),
    pagamentosCreditos: grab(/Pagamentos\s*\/\s*Cr[eé]ditos\s+([\d.]+,\d{2})/i),
    brasil: grab(/Despesas\s*\/\s*D[eé]bitos no Brasil\s+([\d.]+,\d{2})/i),
    exterior: grab(/Saldo Convertido em Reais\s*\(\+\)\s+([\d.]+,\d{2})/i),
    iof: grab(/IOF sobre transa[çc][õo]es no exterior\s+([\d.]+,\d{2})/i),
  }
}

export function readVenc(text: string): { month: number; year: number; dueDate: string | null } {
  const m = text.match(/Vencimento:?\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (m) return { month: Number(m[2]), year: Number(m[3]), dueDate: `${m[3]}-${m[2]}-${m[1]}` }
  return { month: 12, year: 0, dueDate: null }
}


export function resolveDate(dd: string, mm: string, vencMonth: number, vencYear: number): string {
  const day = Number(dd), mon = Number(mm)
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return vencYear ? `${vencYear}-01-01` : '1970-01-01'
  const year = mon > vencMonth ? vencYear - 1 : vencYear // trap 7
  return `${year || 1970}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}


export function classifyKind(bucket: Bucketed['bucket'], desc: string, parcela: Bucketed['parcela']): InvoiceLineKind {
  if (bucket === 'ESTORNO') return 'ESTORNO'
  if (bucket === 'IOF') return 'ENCARGO_FINANCEIRO'
  const d = desc.toLowerCase()
  if (/\biof\b|juros|multa|\bmora\b|anuidade|encargo|rotativo/.test(d)) return 'ENCARGO_FINANCEIRO'
  if (parcela) return 'COMPRA_PARCELADA'
  return 'COMPRA_AVISTA'
}



/**
 * O MOTOR DE LEITURA — recebe as linhas JÁ FATIADAS na coluna certa e devolve os
 * lançamentos classificados. É aqui que moram as 7 armadilhas do topo.
 *
 * ⚠️ Quem chama decide COMO fatiar: o PJ manda a coluna esquerda (a direita é lixo de
 * BanriClube); o PF manda cada banda de portador separadamente. O motor não sabe nem
 * precisa saber — é essa fronteira que permite os dois layouts sem duas cópias.
 *
 * `cartaoInicial` permite ao PF dizer de qual portador é a banda, já que o cabeçalho
 * `NR. dddd` pode estar noutra coluna (a fatura PF tem os dois lado a lado).
 */
export function classificarLinhas(
  linhas: string[],
  venc: { month: number; year: number; dueDate: string | null },
  cartaoInicial: string | null = null,
): Bucketed[] {
  const bucketed: Bucketed[] = []
  let currentCard: string | null = cartaoInicial
  let lastDate = venc.dueDate ?? (venc.year ? `${venc.year}-01-01` : '1970-01-01')

  for (const raw of linhas) {
    const full = raw.replace(/\s+$/, '')
    // header de bloco de cartão (define o cartão corrente das próximas linhas)
    const cardHdr = full.match(/NR\.\s*(\d{4})/i)
    if (cardHdr) currentCard = cardHdr[1]

    const trimmed = full.trim()
    if (!trimmed) continue

    const dated = trimmed.match(MONTHS_TX)
    if (dated) {
      const [, dd, mm, rest] = dated
      const nums = allBRNumbers(rest)
      if (nums.length === 0) continue // linha datada sem valor (não é transação)
      const value = nums[nums.length - 1]
      const isIntl = nums.length >= 2
      const desc = rest.replace(/-?[\d.]+,\d{2}/g, ' ').replace(/\s+/g, ' ').trim()
      const parcela = extractParcela(desc)
      const date = resolveDate(dd, mm, venc.month, venc.year)
      lastDate = date

      let bucket: Bucketed['bucket']
      if (value < 0) {
        bucket = /^DEB\b/i.test(desc) || /pagamento|pagto/i.test(desc) ? 'PAYMENT' : 'ESTORNO'
      } else if (isIntl) {
        bucket = 'EXTERIOR'
      } else {
        bucket = 'BRASIL'
      }
      bucketed.push({ bucket, description: desc || '(sem descrição)', value, date, parcela, card: currentCard })
      continue
    }

    // continuação (sem data): IOF exterior · TX DÓLAR (informativa) · TOTAL DE GASTOS
    if (/\bTX\s*D[ÓO]?LAR|\bTX\s*D\b/i.test(trimmed)) continue // trap 3: cotação informativa
    if (/TOTAL DE GASTOS/i.test(trimmed)) continue // trap 6: total declarado, não tx
    if (/\bIOF\b/i.test(trimmed)) {
      const nums = allBRNumbers(trimmed)
      if (nums.length > 0 && nums[nums.length - 1] > 0) {
        bucketed.push({ bucket: 'IOF', description: 'IOF sobre transação no exterior', value: nums[nums.length - 1], date: lastDate, parcela: null, card: currentCard })
      }
    }
    // qualquer outra continuação: ignora (se sobrar valor real, a validação morde)
  }
  return bucketed
}

/** Monta linhas + somas por bucket a partir dos lançamentos classificados. */
export function montarResultado(
  bucketed: Bucketed[],
  declared: BanrisulFaturaParsed['declared'],
  venc: { dueDate: string | null },
  cardFinals: string[],
): BanrisulFaturaParsed {
  const invLines: InvoiceLine[] = []
  let sumBrasil = 0, sumExterior = 0, sumIof = 0, sumEstornos = 0, sumPayments = 0
  for (const b of bucketed) {
    if (b.bucket === 'PAYMENT') { sumPayments += b.value; continue } // trap 4: não entra
    if (b.bucket === 'BRASIL') sumBrasil += b.value
    else if (b.bucket === 'EXTERIOR') sumExterior += b.value
    else if (b.bucket === 'IOF') sumIof += b.value
    else if (b.bucket === 'ESTORNO') sumEstornos += b.value
    invLines.push({
      date: b.date,
      description: b.description,
      amount: round2(Math.abs(b.value)),
      suggestedKind: classifyKind(b.bucket, b.description, b.parcela),
      ...(b.parcela ? { installmentNumber: b.parcela.number, installmentTotal: b.parcela.total } : {}),
      ...(b.card ? { cardLastDigits: b.card } : {}),
      ...(b.bucket === 'ESTORNO' ? { note: 'crédito/estorno (valor negativo na fatura)' } : {}),
      ...(b.bucket === 'EXTERIOR' ? { note: 'compra internacional (R$ convertido)' } : {}),
    })
  }
  const sumPositives = round2(sumBrasil + sumExterior + sumIof)
  const net = round2(sumPositives + sumEstornos)

  const extraction: InvoiceExtraction = {
    dueDate: venc.dueDate,
    closingDate: null,
    totalDeclared: declared.totalGastos,
    totalToPay: declared.saldoAtual,
    creditLimit: null,
    availableLimit: null,
    detectedBank: 'Banrisul',
    cardLastDigitsFound: cardFinals,
    scanQuality: 'GOOD',
    lines: invLines,
    notes: [],
  }
  return {
    extraction,
    declared,
    computed: {
      sumBrasil: round2(sumBrasil),
      sumExterior: round2(sumExterior),
      sumIof: round2(sumIof),
      sumPositives,
      sumEstornos: round2(sumEstornos),
      sumPayments: round2(sumPayments),
      net,
      count: invLines.length,
    },
  }
}
