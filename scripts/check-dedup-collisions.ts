// Sprint 5.0.2.3 — Calcula os dedupHashes da planilha local e gera SQL
// pra consultar prod. Não conecta no banco — output é SQL pra colar no psql.

import { readFileSync } from 'fs'
import { createHash } from 'node:crypto'
import { parseXlsx, parseBRDate } from '@/lib/excel-import/parse-xlsx'
import { heuristicFallback } from '@/lib/excel-import/detect-columns'

async function main() {
  const buffer = readFileSync('tests/fixtures/cacula-marco-2026.xlsx')
  const parsed = await parseXlsx(buffer)
  const mapping = heuristicFallback(parsed.headers)

  const rows: Array<{ rowIndex: number; hash: string; basis: string }> = []
  for (const row of parsed.rows) {
    const fav =
      mapping.fields.favorecido && row.cells[mapping.fields.favorecido]
        ? String(row.cells[mapping.fields.favorecido])
        : ''
    const desc =
      mapping.fields.descricao && row.cells[mapping.fields.descricao]
        ? String(row.cells[mapping.fields.descricao])
        : ''
    const venc =
      mapping.fields.vencimento && row.cells[mapping.fields.vencimento]
        ? String(row.cells[mapping.fields.vencimento])
        : null
    const vencDate = parseBRDate(venc)
    const valRaw = mapping.fields.valor
      ? row.cells[mapping.fields.valor]
      : null
    let valor = 0
    if (typeof valRaw === 'number') valor = Math.round(valRaw * 100) / 100
    else if (typeof valRaw === 'string') {
      const p = parseFloat(valRaw.replace(/[^\d,.-]/g, '').replace(',', '.'))
      valor = Number.isFinite(p) ? Math.round(p * 100) / 100 : 0
    }
    const basis = `${fav}|${desc}|${vencDate?.toISOString() ?? ''}|${valor.toFixed(2)}`
    const hash = createHash('sha256').update(basis).digest('hex')
    rows.push({ rowIndex: row.rowIndex, hash, basis })
  }

  const inList = rows.map((r) => `'${r.hash}'`).join(', ')
  console.log(`-- ${rows.length} dedupHashes`)
  console.log(
    `SELECT t."dedupHash", t."bankAccountId", t.origin, t.lifecycle, t.amount, t.description, t.date::date FROM transactions t WHERE t."dedupHash" IN (${inList}) ORDER BY t.date DESC LIMIT 20;`,
  )
  console.log()
  console.log(`-- Sample 5 hashes pra inspeção:`)
  for (const r of rows.slice(0, 5)) {
    console.log(`-- row ${r.rowIndex}: ${r.hash.slice(0, 16)}... basis="${r.basis.slice(0, 100)}"`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
