// Sprint 5.0.2.3 — Script ad-hoc pra inspecionar a planilha real do Cacula.
// NÃO comita pro deploy — só usado em dev pra validar pipeline.
//
// Uso: npx tsx scripts/inspect-cacula-xlsx.ts
//
// Faz parse + heuristicFallback + classifyFavorecido + mapCategories
// SEM tocar no banco, e printa breakdown completo.

import { readFileSync } from 'fs'
import { parseXlsx, parseBRDate } from '@/lib/excel-import/parse-xlsx'
import { heuristicFallback } from '@/lib/excel-import/detect-columns'
import { classifyFavorecido } from '@/lib/excel-import/classify-favorecido'
import { mapCategories } from '@/lib/excel-import/map-categories'
import { detectExcelType } from '@/lib/excel-import/magic-bytes'

async function main() {
  const path = 'tests/fixtures/cacula-marco-2026.xlsx'
  const buffer = readFileSync(path)
  console.log('Arquivo:', path)
  console.log('Tamanho:', buffer.length, 'bytes')
  console.log('Magic bytes:', detectExcelType(buffer))
  console.log('')

  const parsed = await parseXlsx(buffer)
  console.log('═══ PARSE ═══')
  console.log('Aba:', parsed.sheetName, `(${parsed.totalSheets} aba(s))`)
  console.log('Headers:', JSON.stringify(parsed.headers))
  console.log('Header hash:', parsed.headerHash.slice(0, 16) + '...')
  console.log('Linhas válidas:', parsed.rows.length)
  console.log('Linhas filtradas:', parsed.filteredCount)
  console.log('')

  const mapping = heuristicFallback(parsed.headers)
  console.log('═══ MAPPING HEURÍSTICO ═══')
  console.log('Confidence:', mapping.confidence)
  console.log('Reasoning:', mapping.reasoning)
  console.log('Fields:')
  for (const [k, v] of Object.entries(mapping.fields)) {
    console.log(`  ${k.padEnd(20)} → ${v ?? '(não detectado)'}`)
  }
  console.log('')

  // Amostra de 3 linhas
  console.log('═══ AMOSTRA 3 LINHAS ═══')
  for (let i = 0; i < Math.min(3, parsed.rows.length); i++) {
    console.log(`Row #${parsed.rows[i].rowIndex}:`)
    for (const [k, v] of Object.entries(parsed.rows[i].cells)) {
      const display = v === null ? '(null)' : String(v).slice(0, 50)
      console.log(`  ${k.padEnd(20)} = ${display}`)
    }
    console.log('')
  }

  // Classify breakdown
  const favorecidoCol = mapping.fields.favorecido
  const beneficiarioCol = mapping.fields.beneficiario_tipo
  const ccCol = mapping.fields.centro_custo

  console.log('═══ CLASSIFY FAVORECIDOS (heurística local, sem IA) ═══')
  const tipoCount = { SUPPLIER: 0, EMPLOYEE: 0, ORGAO_PUBLICO: 0 }
  const lowConfidence: string[] = []
  for (const row of parsed.rows) {
    const fav = favorecidoCol ? (row.cells[favorecidoCol] as string | null) : null
    if (!fav) continue
    const result = classifyFavorecido({
      favorecido: String(fav),
      beneficiarioTipo: beneficiarioCol
        ? (row.cells[beneficiarioCol] as string | null)
        : null,
      centroCusto: ccCol ? (row.cells[ccCol] as string | null) : null,
    })
    tipoCount[result.type as keyof typeof tipoCount]++
    if (result.confidence < 0.7) {
      lowConfidence.push(`${result.type} ${result.confidence.toFixed(2)} — ${fav}`)
    }
  }
  console.log(JSON.stringify(tipoCount, null, 2))
  console.log('Confidence < 0.7:', lowConfidence.length)
  for (const lc of lowConfidence.slice(0, 10)) console.log('  ', lc)
  console.log('')

  // Map categories
  const ccSet = new Set<string>()
  if (ccCol) {
    for (const row of parsed.rows) {
      const cc = row.cells[ccCol]
      if (cc && typeof cc === 'string') ccSet.add(cc)
    }
  }
  console.log('═══ MAP CATEGORIES ═══')
  console.log('Centros de custo únicos:', ccSet.size)
  // Mock categorias empresa pra testar mapping (sem hit no DB)
  const mockCategorias = [
    { id: '1', name: 'Folha de Pagamento', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' },
    { id: '2', name: 'Matéria-Prima', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTOS' },
    { id: '3', name: 'Mercadoria Revenda', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTOS' },
    { id: '4', name: 'Tributos', type: 'EXPENSE', dreGroup: 'IMPOSTOS' },
    { id: '5', name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' },
    { id: '6', name: 'Energia', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' },
    { id: '7', name: 'Água', type: 'EXPENSE', dreGroup: 'DESPESAS_OPERACIONAIS' },
  ]
  const mapped = mapCategories({
    centrosCusto: Array.from(ccSet),
    categoriasEmpresa: mockCategorias,
  })
  let matched = 0
  let proposed = 0
  for (const m of mapped) {
    if (m.matchedCategoryId) matched++
    else if (m.proposedCategoryName) proposed++
  }
  console.log('Matched:', matched, '/ Proposed novas:', proposed)
  console.log('')
  for (const m of mapped.slice(0, 15)) {
    console.log(
      `  ${m.centroCusto.padEnd(40)} → ${m.matchedCategoryId ? 'MATCH' : 'NEW'} ${m.matchedCategoryId ?? m.proposedCategoryName} (conf ${m.confidence.toFixed(2)})`,
    )
  }
  console.log('')

  // Valor total + datas
  const valorCol = mapping.fields.valor
  const vencCol = mapping.fields.vencimento
  const pagCol = mapping.fields.pagamento
  let totalCents = 0
  let paidCount = 0
  let pendingCount = 0
  const dedupHashes = new Set<string>()
  const collisionRows: number[] = []
  const crypto = await import('node:crypto')

  for (const row of parsed.rows) {
    const v = valorCol ? row.cells[valorCol] : null
    let valor = 0
    if (typeof v === 'number') valor = Math.round(v * 100) / 100
    else if (typeof v === 'string') {
      const p = parseFloat(v.replace(/[^\d,.-]/g, '').replace(',', '.'))
      valor = Number.isFinite(p) ? Math.round(p * 100) / 100 : 0
    }
    totalCents += Math.round(valor * 100)

    const pag = pagCol ? row.cells[pagCol] : null
    if (pag && String(pag).trim() !== '') paidCount++
    else pendingCount++

    // Simula o dedupHash
    const fav = favorecidoCol ? (row.cells[favorecidoCol] as string | null) : null
    const desc = mapping.fields.descricao
      ? (row.cells[mapping.fields.descricao] as string | null)
      : null
    const venc = vencCol ? (row.cells[vencCol] as string | null) : null
    const vencDate = parseBRDate(venc)
    const basis = `${fav ?? ''}|${desc ?? ''}|${vencDate?.toISOString() ?? ''}|${valor.toFixed(2)}`
    const hash = crypto.createHash('sha256').update(basis).digest('hex')
    if (dedupHashes.has(hash)) {
      collisionRows.push(row.rowIndex)
    }
    dedupHashes.add(hash)
  }

  console.log('═══ TOTAIS ═══')
  console.log('Total da planilha: R$', (totalCents / 100).toFixed(2))
  console.log('Pagas (com pagamento):', paidCount)
  console.log('A pagar (sem pagamento):', pendingCount)
  console.log(
    'Dedup hashes ÚNICOS:',
    dedupHashes.size,
    '/ linhas:',
    parsed.rows.length,
  )
  if (collisionRows.length > 0) {
    console.log(
      '🔴 COLISÕES de dedupHash em rows:',
      collisionRows.slice(0, 20).join(', '),
      collisionRows.length > 20 ? `(+${collisionRows.length - 20})` : '',
    )
    console.log('   → essas linhas vão disparar P2002 no /confirm SE o constraint ativar')
  } else {
    console.log('✅ Sem colisões internas — todos os dedupHashes únicos')
  }
}

main().catch((e) => {
  console.error('ERRO:', e)
  process.exit(1)
})
