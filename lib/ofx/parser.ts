export interface OFXTransaction {
  fitid: string
  datePosted: Date
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

export interface OFXParseResult {
  accountId?: string
  bankId?: string
  currency?: string
  transactions: OFXTransaction[]
  errors: string[]
}

function extractTag(content: string, tag: string): string | null {
  const patterns = [
    new RegExp(`<${tag}>([^<]+)`, 'i'),
    new RegExp(`<${tag}>([^\\r\\n<]+)`, 'i'),
  ]
  for (const pattern of patterns) {
    const m = content.match(pattern)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function parseOFXDate(raw: string): Date | null {
  // Formatos: YYYYMMDDHHMMSS, YYYYMMDD, YYYYMMDDHHMMSS.XXX[+|-HH:mm]
  const cleaned = raw.replace(/\[.*\]/, '').split('.')[0].trim()
  const y = cleaned.slice(0, 4)
  const mo = cleaned.slice(4, 6)
  const d = cleaned.slice(6, 8)
  if (!y || !mo || !d) return null
  const date = new Date(`${y}-${mo}-${d}T12:00:00Z`)
  return isNaN(date.getTime()) ? null : date
}

function extractStmtTrnList(content: string): string[] {
  const blocks: string[] = []
  const stmtListMatch = content.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i)
  const source = stmtListMatch ? stmtListMatch[1] : content

  // Suporte tanto SGML (sem closing tags) quanto XML (com closing tags)
  const xmlBlocks = source.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)
  if (xmlBlocks) return xmlBlocks

  // SGML: cada STMTTRN começa com <STMTTRN> e vai até o próximo
  const sgmlParts = source.split(/<STMTTRN>/i)
  for (let i = 1; i < sgmlParts.length; i++) {
    blocks.push('<STMTTRN>' + sgmlParts[i])
  }
  return blocks
}

export function parseOFX(raw: string): OFXParseResult {
  const errors: string[] = []
  const transactions: OFXTransaction[] = []

  const content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const accountId = extractTag(content, 'ACCTID') ?? undefined
  const bankId = extractTag(content, 'BANKID') ?? undefined
  const currency = extractTag(content, 'CURSYM') ?? extractTag(content, 'CURDEF') ?? undefined

  const blocks = extractStmtTrnList(content)

  for (const block of blocks) {
    const fitid = extractTag(block, 'FITID')
    const dateRaw = extractTag(block, 'DTPOSTED')
    const amountRaw = extractTag(block, 'TRNAMT')
    const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME') ?? ''
    const trntype = extractTag(block, 'TRNTYPE') ?? ''

    if (!fitid) { errors.push('Transação sem FITID — ignorada'); continue }
    if (!dateRaw) { errors.push(`FITID ${fitid}: data ausente — ignorada`); continue }
    if (!amountRaw) { errors.push(`FITID ${fitid}: valor ausente — ignorado`); continue }

    const date = parseOFXDate(dateRaw)
    if (!date) { errors.push(`FITID ${fitid}: data inválida "${dateRaw}" — ignorada`); continue }

    const rawAmount = parseFloat(amountRaw.replace(',', '.'))
    if (isNaN(rawAmount)) { errors.push(`FITID ${fitid}: valor inválido "${amountRaw}" — ignorado`); continue }

    // TRNTYPE pode ser CREDIT/DEBIT/DEP/CHECK/etc; o sinal do amount é canônico
    const amount = Math.abs(rawAmount)
    const type: 'CREDIT' | 'DEBIT' =
      rawAmount > 0 ? 'CREDIT' :
      rawAmount < 0 ? 'DEBIT' :
      trntype.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT'

    transactions.push({ fitid, datePosted: date, amount, type, memo: memo || `Transação ${fitid}` })
  }

  return { accountId, bankId, currency, transactions, errors }
}
