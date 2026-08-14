// Sprint BUG B FASE a (14/08/2026) — parser DETERMINÍSTICO da fatura Sicredi por
// texto (pdftotext -layout). Custo zero, sem Vision, sem timeout/truncamento.
//
// A fatura Sicredi tem UMA transação por linha, colunas alinhadas pelo -layout:
//   27/jul 13:44   Balneario Cam   Presencial   Ross Confeitaria Ltda      R$ 99,94
//   10/jul 12:22   Vila Olimpia    Online       Shein Shein Co    01/04     R$ 47,94
//
// 7 ARMADILHAS (todas provadas rodando pelo Yussef, viram teste — REGRA 3):
//  1) descrição em 2+ linhas físicas (internacional): junta linha de cima e de baixo
//     quando NÃO começam com data.
//  2) NÃO deduplicar por data+descrição: 2 compras "Mercadolivre Tioali 01/03" no
//     mesmo minuto, cidades e valores diferentes, são DISTINTAS. Só cidade+valor separa.
//  3) "Total cartao (final XXXX)" REPETE em toda página — não somar como transação.
//  4) datas sem ano: mês > mês de fechamento ⇒ ano anterior (out/2025 vs jul/2026).
//  5) coluna PARCELA (01/04) parece data — não confundir.
//  6) linha "Pagamento ..." é o pagamento da fatura ANTERIOR — NÃO importar (e não
//     entra em nenhum total, então a validação já a exclui).
//  7) linhas sem cidade e sem Presencial/Online existem (IOF) — não exigir campos.
//
// A VALIDAÇÃO É JUIZ (impossibilidade, não combinado): se a Σ não fecha com os
// totais declarados, o import FALHA. Nunca grava fatura que não bate.

import type { InvoiceExtraction, InvoiceLine, InvoiceLineKind } from '../types'

const MONTHS_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

const TIPO_PRESENCA = new Set(['presencial', 'online'])
const round2 = (n: number) => Math.round(n * 100) / 100

/** "-R$ 2.304,83" → -2304.83 · "R$ 99,94" → 99.94. Null se não for valor. */
export function parseBRL(raw: string): number | null {
  const m = raw.match(/(-?)\s*R\$\s*([\d.]+),(\d{2})/i)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const intPart = m[2].replace(/\./g, '')
  const val = Number(`${intPart}.${m[3]}`)
  return isNaN(val) ? null : round2(sign * val)
}

/** "01/04" → {number:1, total:4}. Null se não for parcela (dd/dd, ambos ≤ total). */
function parseParcela(token: string): { number: number; total: number } | null {
  const m = token.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return null
  const n = Number(m[1]), t = Number(m[2])
  if (t === 0 || n === 0 || n > t) return null
  return { number: n, total: t }
}

/** dd/mmm + mês de fechamento → ISO YYYY-MM-DD. Trap 4: mês > fechamento ⇒ ano-1. */
function resolveDate(ddmmm: string, closingMonth: number, closingYear: number): string | null {
  const m = ddmmm.match(/^(\d{2})\/([a-z]{3})$/i)
  if (!m) return null
  const day = Number(m[1])
  const mon = MONTHS_PT[m[2].toLowerCase()]
  if (!mon || day < 1 || day > 31) return null
  const year = mon > closingMonth ? closingYear - 1 : closingYear
  return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Uma linha de transação = âncora (começa com dd/mmm hh:mm ... valor no fim). */
const ANCHOR_RE = /^\s*(\d{2}\/[a-z]{3})\s+(\d{2}:\d{2})\s+(.*?)(-?R\$\s*[\d.]+,\d{2})\s*$/i

interface RawAnchor {
  ddmmm: string
  time: string
  middle: string
  value: number
  prefix: string[] // fragmentos (linhas sem data) ACIMA
  suffix: string[] // fragmentos ABAIXO
}

/** Classifica a linha por natureza (trap 6/7 + encargo). */
function classifyKind(desc: string, value: number, parcela: { number: number; total: number } | null): {
  kind: InvoiceLineKind
  isPayment: boolean
} {
  const d = desc.toLowerCase()
  // Trap 6: pagamento da fatura anterior — não importa.
  if (/\bpagamento\b/.test(d) && value < 0) return { kind: 'IGNORAR', isPayment: true }
  // Estorno / crédito (valor negativo que não é pagamento) — não entra como despesa.
  if (value < 0) return { kind: 'IGNORAR', isPayment: false }
  // Encargo financeiro (IOF, juros, multa, mora, anuidade).
  if (/\biof\b|juros|multa|\bmora\b|anuidade|encargo|rotativo/.test(d)) {
    return { kind: 'ENCARGO_FINANCEIRO', isPayment: false }
  }
  if (parcela) return { kind: 'COMPRA_PARCELADA', isPayment: false }
  return { kind: 'COMPRA_AVISTA', isPayment: false }
}

/** Token que é só valor monetário (US$ 22,00 · R$ 5,12 · 22,00) — ruído da linha
 *  internacional, NÃO é descrição. */
const CURRENCY_NOISE = /^(us\$|r\$|€|£)?\s*\d[\d.]*,\d{2}$/i

/** Separa o miolo em cidade/tipo/descrição/parcela pelas colunas do -layout. */
function parseMiddle(middle: string): { description: string; parcela: { number: number; total: number } | null } {
  const tokens = middle.split(/\s{2,}/).map((t) => t.trim()).filter(Boolean)
  // parcela: qualquer token dd/dd (trap 5)
  let parcela: { number: number; total: number } | null = null
  const rest: string[] = []
  for (const t of tokens) {
    const p = parseParcela(t)
    if (p && !parcela) { parcela = p; continue }
    if (CURRENCY_NOISE.test(t)) continue // linha internacional: US$/R$/valor não é descrição
    rest.push(t)
  }
  // tipo Presencial/Online delimita: cidade = antes, descrição = depois.
  const tipoIdx = rest.findIndex((t) => TIPO_PRESENCA.has(t.toLowerCase()))
  let description: string
  if (tipoIdx >= 0) {
    description = rest.slice(tipoIdx + 1).join(' ').trim()
  } else {
    // sem tipo (IOF, pagamento, linha especial — trap 7): descrição = tudo restante.
    description = rest.join(' ').trim()
  }
  return { description, parcela }
}

export interface SicrediFaturaParsed {
  extraction: InvoiceExtraction
  /** totais declarados no PDF pra a validação (juiz). */
  declared: {
    totalCartao: number | null // "Total cartao (final XXXX)"
    totalFatura: number | null // "Total desta Fatura"
    brasil: number | null
    exterior: number | null
    pagamentosCreditos: number | null // "Pagamentos|Creditos"
  }
  /** somas COM SINAL, calculadas das linhas (pra a validação bater com o declarado). */
  computed: {
    sumPositives: number // compras + encargos (débitos) → deve bater "Total cartao"
    sumEstornos: number // créditos/estornos negativos (não-pagamento)
    sumPayments: number // pagamento(s) da fatura anterior
    count: number // nº de transações importáveis (exclui pagamento)
  }
}

/** Lê os totais declarados (uma vez — trap 3: repetem por página). */
function readDeclaredTotals(text: string): SicrediFaturaParsed['declared'] {
  const first = (re: RegExp): number | null => {
    const m = text.match(re)
    return m ? parseBRL(m[0]) : null
  }
  return {
    totalCartao: first(/total\s+cart[aã]o[^\n]*?-?R\$\s*[\d.]+,\d{2}/i),
    totalFatura: first(/total\s+desta\s+fatura[^\n]*?-?R\$\s*[\d.]+,\d{2}/i),
    // "total" no contexto pra NÃO casar a linha de IOF "Compra Internacional".
    brasil: first(/total[^\n]*?\bbrasil\b[^\n]*?-?R\$\s*[\d.]+,\d{2}/i),
    exterior: first(/total[^\n]*?(exterior|internacional)[^\n]*?-?R\$\s*[\d.]+,\d{2}/i),
    pagamentosCreditos: first(/pagamentos?\s*[|/e]*\s*cr[eé]ditos[^\n]*?-?R\$\s*[\d.]+,\d{2}/i),
  }
}

/** Fechamento/vencimento pra inferir o ano das datas sem ano (trap 4). */
function readClosing(text: string): { month: number; year: number; closingDate: string | null; dueDate: string | null } {
  const dateBR = (re: RegExp): string | null => {
    const m = text.match(re)
    if (!m) return null
    const dm = m[0].match(/(\d{2})\/(\d{2})\/(\d{4})/)
    return dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null
  }
  const closingDate = dateBR(/(fechamento|apurado?\s+em|data\s+de\s+fechamento)[^\n]*?\d{2}\/\d{2}\/\d{4}/i)
  const dueDate = dateBR(/(vencimento|vence\s+em)[^\n]*?\d{2}\/\d{2}\/\d{4}/i)
  // âncora do ano = fechamento; senão vencimento; senão null → caller decide.
  const anchor = closingDate ?? dueDate
  if (anchor) {
    const [y, mo] = anchor.split('-').map(Number)
    return { month: mo, year: y, closingDate, dueDate }
  }
  return { month: 12, year: new Date().getUTCFullYear(), closingDate, dueDate }
}

/**
 * Parseia o texto -layout da fatura Sicredi. NÃO valida aqui (a validação é
 * `validateSicrediFatura`, chamada pelo orquestrador — separa "extrair" de "julgar").
 */
export function parseSicrediFatura(text: string): SicrediFaturaParsed {
  const lines = text.split(/\r?\n/)
  const closing = readClosing(text)
  const declared = readDeclaredTotals(text)

  // 1ª passada: âncoras + fragmentos (trap 1). Um fragmento é linha não-vazia que
  // NÃO é âncora e NÃO é linha de total/cabeçalho.
  const isTotalLine = (l: string) => /total\s+(cart[aã]o|desta|nacional|internacional)|saldo|limite|dispon[ií]vel|vencimento|fechamento/i.test(l)
  const anchors: RawAnchor[] = []
  const pendingPrefix: string[] = []
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { pendingPrefix.length = 0; continue } // linha em branco quebra o grupo
    const m = line.match(ANCHOR_RE)
    if (m) {
      const value = parseBRL(m[4])
      if (value == null) { continue }
      anchors.push({ ddmmm: m[1], time: m[2], middle: m[3], value, prefix: [...pendingPrefix], suffix: [] })
      pendingPrefix.length = 0
    } else {
      if (isTotalLine(line)) { pendingPrefix.length = 0; continue } // trap 3: totais não são fragmento
      // fragmento: candidato a sufixo da âncora anterior E prefixo da próxima.
      const prev = anchors[anchors.length - 1]
      // dono = a âncora cujo miolo NÃO tem descrição (internacional). Se a anterior
      // precisa de descrição e ainda não tem sufixo forte, é dela (sufixo); senão
      // segura como prefixo da próxima.
      if (prev && parseMiddle(prev.middle).description === '' && prev.suffix.length === 0) {
        prev.suffix.push(line.trim())
      } else {
        pendingPrefix.push(line.trim())
      }
    }
  }

  // 2ª passada: monta as InvoiceLine (pula pagamento; mantém encargo/compras/estorno).
  // NÃO deduplica (trap 2). Acumula somas COM SINAL pra a validação.
  const invLines: InvoiceLine[] = []
  let sumPositives = 0, sumEstornos = 0, sumPayments = 0
  for (const a of anchors) {
    const mid = parseMiddle(a.middle)
    let description = mid.description
    if (description === '') {
      // internacional: junta prefixo + sufixo (trap 1)
      description = [...a.prefix, ...a.suffix].join(' ').replace(/\s+/g, ' ').trim()
    }
    const { kind, isPayment } = classifyKind(description, a.value, mid.parcela)
    if (isPayment) { sumPayments += a.value; continue } // trap 6: não entra
    if (a.value < 0) sumEstornos += a.value
    else sumPositives += a.value
    const date = resolveDate(a.ddmmm, closing.month, closing.year)
    invLines.push({
      date: date ?? `${closing.year}-01-01`,
      description: description || '(sem descrição)',
      amount: round2(Math.abs(a.value)),
      suggestedKind: kind,
      ...(mid.parcela ? { installmentNumber: mid.parcela.number, installmentTotal: mid.parcela.total } : {}),
      ...(a.value < 0 ? { note: 'crédito/estorno (valor negativo na fatura)' } : {}),
    })
  }

  const extraction: InvoiceExtraction = {
    dueDate: closing.dueDate,
    closingDate: closing.closingDate,
    totalDeclared: declared.totalCartao,
    totalToPay: declared.totalFatura,
    creditLimit: null,
    availableLimit: null,
    detectedBank: 'Sicredi',
    cardLastDigitsFound: Array.from(new Set((text.match(/final\s+(\d{4})/gi) ?? []).map((s) => s.replace(/\D/g, '')))),
    scanQuality: 'GOOD',
    lines: invLines,
    notes: [],
  }
  return {
    extraction,
    declared,
    computed: {
      sumPositives: round2(sumPositives),
      sumEstornos: round2(sumEstornos),
      sumPayments: round2(sumPayments),
      count: invLines.length,
    },
  }
}
