import { readFileSync } from 'fs'
import { parseOFX } from '@/lib/ofx/parser'
import { isFutureStatementLine, endOfTodayBrazil, isFutureLineBrazil } from '@/lib/ofx/future-line'

const raw = readFileSync('__tests__/fixtures/Extrato_20260809.ofx', 'utf8')
const { transactions, ledgerBalance } = parseOFX(raw)
const dtAsOf = ledgerBalance!.asOfDate
const futuras = transactions.filter(t => t.datePosted.toISOString().slice(0,10) >= '2026-08-10')
console.log('DTASOF =', dtAsOf.toISOString(), '(dia', dtAsOf.toISOString().slice(0,10) + ')')
for (const now of [new Date('2026-08-09T18:00:00Z'), new Date('2026-08-10T06:00:00Z')]) {
  console.log('\n===== now =', now.toISOString(), '· fimHojeBRT =', endOfTodayBrazil(now).toISOString(), '=====')
  for (const t of futuras) {
    const lineDay = t.datePosted.toISOString().slice(0,10)
    const dtAsOfDay = dtAsOf.toISOString().slice(0,10)
    const gtDtAsOf = lineDay > dtAsOfDay
    const gtToday = isFutureLineBrazil(t.datePosted, now)
    const fitid = false
    const verdict = isFutureStatementLine(t.datePosted, dtAsOf, fitid, now)
    console.log(`  ${lineDay} ${t.memo.slice(0,20).padEnd(20)} dp=${t.datePosted.toISOString()} | >DTASOF=${gtDtAsOf} >hojeBRT=${gtToday} => FUTURA=${verdict}`)
  }
}
