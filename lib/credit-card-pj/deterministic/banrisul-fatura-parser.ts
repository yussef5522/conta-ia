// Sprint Cartão FASE 4 (18/08/2026) — parser DETERMINÍSTICO da fatura Banrisul por
// texto (pdftotext -layout). Custo zero, sem Vision, sem timeout/truncamento.
//
// A fatura Banrisul tem as transações na COLUNA ESQUERDA da página 2; a coluna
// direita (BanriClube/Pontos/Limites/Taxas) invade as MESMAS linhas no -layout.
// Uma regex "valor no fim da linha" pega os números da direita (Pontos 2.066,96,
// Limite 80.000,00). Defesa: CORTAR a linha na coluna do header "R$" (a coluna R$
// das transações termina ~col 62; a direita começa ~col 65) e só então extrair.
//
// ARMADILHAS (todas do dado real, viram teste — REGRA 3):
//  1) internacional = linha datada com DOIS números (US$ e R$): valor = o ÚLTIMO
//     (R$ convertido), o penúltimo é US$. Vai pro bucket EXTERIOR.
//  2) IOF sobre transação no exterior vem em linha SEM data (continuação da compra
//     internacional acima) — é VALOR, soma como encargo, bucket IOF.
//  3) "USD 200,00 TX DÓLAR R$ 5,2621" é INFORMATIVA (a cotação) — NÃO é transação.
//     Pula qualquer continuação com "TX D" (o 5,2621 nem casa: exijo 2 decimais).
//  4) pagamento da fatura anterior vem como "DEB 0230/06 ... -2.677,29" (negativo,
//     prefixo DEB) — NÃO importa (já está no extrato; entra em Pagamentos/Créditos).
//  5) par de anuidade: "DESC. ANUID. ... -18,00" (CRÉDITO/estorno) + "ANUIDADEINT
//     DIFER ... 18,00" (DÉBITO). Net 0. NÃO deduplicar — os dois entram.
//  6) "TOTAL DE GASTOS 13.797,73" (fim da pág 2) é a Σ declarada (validação), não tx.
//  7) datas sem ano: mês > mês do vencimento ⇒ ano anterior.
//  8) o "Saldo da fatura atual" (13.779,73 = o que se paga) = TOTAL DE GASTOS −
//     estornos. O -18,00 do estorno é o carryover; net das linhas TEM que dar isso.
//
// A VALIDAÇÃO É JUIZ (impossibilidade): se a Σ não fecha com os totais declarados,
// o import FALHA (validate-banrisul-fatura). Nunca grava fatura que não bate.

import type { InvoiceExtraction, InvoiceLine, InvoiceLineKind } from '../types'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** "-2.677,29" → -2677.29 · "85,70" → 85.70. Null se não casar (comma + 2 decimais). */
export function parseBRNumber(raw: string): number | null {
  const m = raw.match(/(-?)\s*([\d.]+),(\d{2})/)
  if (!m) return null
  const v = Number(`${m[2].replace(/\./g, '')}.${m[3]}`)
  return isNaN(v) ? null : round2((m[1] === '-' ? -1 : 1) * v)
}

/** Todos os tokens monetários (comma + 2 decimais) da string, na ordem. */
function allBRNumbers(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(/-?[\d.]+,\d{2}/g)) {
    const n = parseBRNumber(m[0])
    if (n != null) out.push(n)
  }
  return out
}

/** Parcela dd/dd na descrição (01/06, 09/10). n≤total, total≤24, ambos>0. */
function extractParcela(desc: string): { number: number; total: number } | null {
  let found: { number: number; total: number } | null = null
  for (const m of desc.matchAll(/\b(\d{2})\/(\d{2})\b/g)) {
    const n = Number(m[1]), t = Number(m[2])
    if (n > 0 && t > 0 && n <= t && t <= 24) found = { number: n, total: t } // última ocorrência
  }
  return found
}

const MONTHS_TX = /^(\d{2})\/(\d{2})\s+(.*)$/

interface Bucketed {
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

/** Coluna de corte esquerda: header "R$" da seção de transações + 8 (a coluna R$
 *  termina ~6-7 cols depois; a direita começa ~9 cols depois). Fallback 64. */
function resolveCutCol(lines: string[]): number {
  for (const l of lines) {
    if (/\bUS\$\s+R\$/.test(l) && /NR\.|HIST[ÓO]RICO|TITULAR/i.test(l + '')) {
      const r = l.indexOf('R$', l.indexOf('US$'))
      if (r > 0) return r + 8
    }
  }
  // header pode estar em linha separada — procura "US$" e "R$" alinhados
  for (const l of lines) {
    const us = l.indexOf('US$')
    const r = l.indexOf('R$', us + 1)
    if (us >= 0 && r > us && r - us < 20) return r + 8
  }
  return 64
}

function readDeclared(text: string): BanrisulFaturaParsed['declared'] {
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

function readVenc(text: string): { month: number; year: number; dueDate: string | null } {
  const m = text.match(/Vencimento:?\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (m) return { month: Number(m[2]), year: Number(m[3]), dueDate: `${m[3]}-${m[2]}-${m[1]}` }
  return { month: 12, year: 0, dueDate: null }
}

function resolveDate(dd: string, mm: string, vencMonth: number, vencYear: number): string {
  const day = Number(dd), mon = Number(mm)
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return vencYear ? `${vencYear}-01-01` : '1970-01-01'
  const year = mon > vencMonth ? vencYear - 1 : vencYear // trap 7
  return `${year || 1970}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function classifyKind(bucket: Bucketed['bucket'], desc: string, parcela: Bucketed['parcela']): InvoiceLineKind {
  if (bucket === 'ESTORNO') return 'ESTORNO'
  if (bucket === 'IOF') return 'ENCARGO_FINANCEIRO'
  const d = desc.toLowerCase()
  if (/\biof\b|juros|multa|\bmora\b|anuidade|encargo|rotativo/.test(d)) return 'ENCARGO_FINANCEIRO'
  if (parcela) return 'COMPRA_PARCELADA'
  return 'COMPRA_AVISTA'
}

export function parseBanrisulFatura(text: string): BanrisulFaturaParsed {
  const rawLines = text.split(/\r?\n/)
  const cutCol = resolveCutCol(rawLines)
  const declared = readDeclared(text)
  const venc = readVenc(text)

  const cardFinals = Array.from(new Set((text.match(/NR\.\s*(\d{4})/gi) ?? []).map((s) => s.replace(/\D/g, '')))).filter((s) => s.length === 4)

  const bucketed: Bucketed[] = []
  let currentCard: string | null = null
  let lastDate = venc.dueDate ?? (venc.year ? `${venc.year}-01-01` : '1970-01-01')

  for (const raw of rawLines) {
    const full = raw.replace(/\s+$/, '')
    // header de bloco de cartão (define o cartão corrente das próximas linhas)
    const cardHdr = full.match(/NR\.\s*(\d{4})/i)
    if (cardHdr) currentCard = cardHdr[1]

    const left = full.slice(0, cutCol) // trap principal: só a coluna esquerda
    const trimmed = left.trim()
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

  // monta linhas + somas por bucket
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
