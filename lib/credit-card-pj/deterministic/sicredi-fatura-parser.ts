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

/** Número BR SEM exigir R$ (ex: "-2.404,06", "7.896,32"). */
function parseBRNumber(raw: string): number | null {
  const m = raw.match(/(-?)\s*([\d.]+),(\d{2})/)
  if (!m) return null
  const v = Number(`${m[2].replace(/\./g, '')}.${m[3]}`)
  return isNaN(v) ? null : round2((m[1] === '-' ? -1 : 1) * v)
}

/**
 * Lê os totais declarados. ARMADILHA CRÍTICA (o Yussef provou): na página 1 o
 * "Resumo da fatura" e o quadro "Limite" ocupam AS MESMAS LINHAS. Uma regex que
 * pega "Total" + R$ casa com o LIMITE (R$ 25.000,00), não com a fatura. Defesas:
 *  - rótulos ANCORADOS no início da linha (^\s*<rótulo>);
 *  - os valores do RESUMO NÃO têm "R$"; os do LIMITE têm → removo os "R$ X" da
 *    linha antes de pegar o número (mata o limite);
 *  - "Total cartão (final XXXX)" é o único que vem COM R$ e tem rótulo próprio.
 */
function readDeclaredTotals(text: string): SicrediFaturaParsed['declared'] {
  const lines = text.split(/\r?\n/)
  // valor do RESUMO: 1ª ocorrência do rótulo (ancorado), 1º número SEM R$ na linha.
  const resumo = (labelRe: RegExp): number | null => {
    for (const line of lines) {
      if (!labelRe.test(line)) continue
      const semLimite = line.replace(/R\$\s*[\d.]+,\d{2}/g, '  ') // tira o quadro Limite
      const n = parseBRNumber(semLimite)
      if (n != null) return n
    }
    return null
  }
  // "Total cartão (final XXXX) ... R$ 7.995,55" — rótulo COMPLETO + R$.
  const totalCartaoM = text.match(/total\s+cart[aã]o\s*\(final\s*\w*\)\s*R\$\s*[\d.]+,\d{2}/i)
  return {
    totalCartao: totalCartaoM ? parseBRL(totalCartaoM[0]) : null,
    totalFatura: resumo(/^\s*Total\s+desta\s+Fatura\b/i),
    brasil: resumo(/^\s*Despesas\s+atuais.*?\bBrasil\b/i),
    exterior: resumo(/^\s*Despesas\s+atuais.*?\bExterior\b/i),
    pagamentosCreditos: resumo(/^\s*Pagamentos\s*\|\s*Cr[eé]ditos\b/i),
  }
}

/**
 * Mês/ano de FECHAMENTO pra inferir o ano das datas sem ano (trap 4). Âncora = o
 * VENCIMENTO (13/08/2026), que vem com data completa e sem ambiguidade. O
 * fechamento é o mês ANTERIOR ao vencimento (Sicredi: vence 13/08, fecha 28/07).
 * ⚠️ NÃO usar a linha "Fechamento da próxima fatura 28/08/2026" (é a PRÓXIMA).
 * ZERO relógio: se não achar vencimento, não inventa — usa o fim-de-mês do texto
 * ("em 28/07") ou deixa o ano indefinido (a validação não depende de data).
 */
function readClosing(text: string): { month: number; year: number; closingDate: string | null; dueDate: string | null } {
  const venc = text.match(/vencimento\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (venc) {
    const vm = Number(venc[2]), vy = Number(venc[3])
    const month = vm === 1 ? 12 : vm - 1
    const year = vm === 1 ? vy - 1 : vy
    const dueDate = `${vy}-${venc[2]}-${venc[1]}`
    const closingDate = `${year}-${String(month).padStart(2, '0')}-28` // aproximação (dia real varia)
    return { month, year, closingDate, dueDate }
  }
  // fallback: "em DD/MM" do resumo (sem ano) — usa só o mês.
  const emMes = text.match(/\bem\s+(\d{2})\/(\d{2})\b/)
  if (emMes) return { month: Number(emMes[2]), year: 0, closingDate: null, dueDate: null }
  return { month: 12, year: 0, closingDate: null, dueDate: null }
}

/**
 * Parseia o texto -layout da fatura Sicredi. NÃO valida aqui (a validação é
 * `validateSicrediFatura`, chamada pelo orquestrador — separa "extrair" de "julgar").
 */
export function parseSicrediFatura(text: string): SicrediFaturaParsed {
  const lines = text.split(/\r?\n/)
  const closing = readClosing(text)
  const declared = readDeclaredTotals(text)

  // 1ª passada: âncoras + fragmentos de descrição (trap 1).
  // Fragmento = linha CURTA de texto que NÃO é âncora, não começa com data/número,
  // não tem R$/Total/cabeçalho, < 40 chars (regra do Yussef contra o dado real —
  // evita puxar "Total fatura de agosto"/"Visa Empresas"/nome do titular pro meio
  // da descrição). Qualquer outra linha (total/header/ruído) QUEBRA o grupo (trap 3).
  const isDescFragment = (l: string): boolean => {
    const t = l.trim()
    if (t.length === 0 || t.length > 40) return false
    if (/^\d/.test(t)) return false
    if (/R\$|US\$|total|vencimento|\bfinal\b|visa\s+empresas|d[eé]bito em conta|cart[aã]o\s*\(|transa[çc][õo]es|cidade\s+compra|\d\s+de\s+\d/i.test(t)) return false
    return /[a-z]/i.test(t)
  }
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
    } else if (isDescFragment(line)) {
      // sufixo da âncora anterior SE ela é internacional (miolo sem descrição) e
      // ainda não tem sufixo; senão segura como prefixo da próxima.
      const prev = anchors[anchors.length - 1]
      if (prev && parseMiddle(prev.middle).description === '' && prev.suffix.length === 0) {
        prev.suffix.push(line.trim())
      } else {
        pendingPrefix.push(line.trim())
      }
    } else {
      pendingPrefix.length = 0 // total/header/ruído quebra o grupo
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
