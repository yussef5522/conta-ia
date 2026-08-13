// Sprint Rearquitetura-Import FASE 2 (13/08) — extração dos campos de ARQUIVO
// (DTASOF/DTSTART/DTEND/LEDGERBAL/BANKID/ACCTID) SEM RELÓGIO.
//
// Por que não reusar o parseOFX inteiro pra isto: o `extractLedgerBalance` do
// parser antigo cai em `new Date()` quando o DTASOF falta (parser.ts:70) — o
// relógio se escondia ali. No canônico, DTASOF ausente = NULL. O arquivo é a
// fonte; o sistema não inventa "hoje".

const DATE_RE = (tag: string) => new RegExp(`<${tag}>([0-9]{8,})`, 'i')
const TAG_RE = (tag: string) => new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')

/** YYYYMMDD[HHMMSS…] → Date (meio-dia UTC, igual parseOFXDate do projeto). Null se inválida. */
export function parseOfxDateStrict(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const cleaned = raw.replace(/\[.*\]/, '').split('.')[0].trim()
  const y = cleaned.slice(0, 4)
  const mo = cleaned.slice(4, 6)
  const d = cleaned.slice(6, 8)
  if (y.length !== 4 || mo.length !== 2 || d.length !== 2) return null
  const date = new Date(`${y}-${mo}-${d}T12:00:00Z`)
  return isNaN(date.getTime()) ? null : date
}

function matchDate(content: string, tag: string): Date | null {
  const m = content.match(DATE_RE(tag))
  return m ? parseOfxDateStrict(m[1]) : null
}

function ledgerBlock(content: string): string | null {
  const xml = content.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i)
  if (xml) return xml[1]
  const sgml = content.match(
    /<LEDGERBAL>([\s\S]*?)(?:<\/?(?:STMTRS|BANKMSGSRSV1|STMTTRNRS|AVAILBAL|OFX)>|$)/i,
  )
  return sgml ? sgml[1] : null
}

/**
 * Extrai os campos de arquivo do OFX cru. TUDO null-safe, ZERO relógio:
 *  - DTASOF ausente → null (NÃO vira hoje)
 *  - LEDGERBAL ausente → null
 */
export function parseStatementFileFields(raw: string): {
  bankId: string | null
  accountId: string | null
  dtAsOf: Date | null
  dtStart: Date | null
  dtEnd: Date | null
  ledgerBalance: number | null
} {
  const bankId = raw.match(TAG_RE('BANKID'))?.[1]?.trim() ?? null
  const accountId = raw.match(TAG_RE('ACCTID'))?.[1]?.trim() ?? null
  const dtStart = matchDate(raw, 'DTSTART')
  const dtEnd = matchDate(raw, 'DTEND')

  const block = ledgerBlock(raw)
  let ledgerBalance: number | null = null
  let dtAsOf: Date | null = null
  if (block) {
    const amountStr = block.match(TAG_RE('BALAMT'))?.[1]
    if (amountStr) {
      const amt = parseFloat(amountStr.replace(',', '.'))
      ledgerBalance = isNaN(amt) ? null : amt
    }
    dtAsOf = matchDate(block, 'DTASOF') // NULL se ausente — SEM new Date()
  }

  return { bankId, accountId, dtAsOf, dtStart, dtEnd, ledgerBalance }
}
