// Sprint 5.0.2.0 — Upload de planilha .xlsx pra staging.
//
// FormData: file (.xlsx ou .xls, ≤10MB).
//
// Fluxo:
//   1. Parse local (exceljs) — filtra subtotais, arredonda valores
//   2. Detect colunas via HEURÍSTICA (sem IA — instantâneo, grátis)
//   3. Cria ExcelImportBatch + N StagedPayableRow já com raw* normalizado
//      e valor/datas extraídos pelo mapping heurístico
//   4. /detect refina com Claude se confidence heurístico baixo
//
// Idempotência: fileHash unique por empresa.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { parseXlsx, parseBRDate } from '@/lib/excel-import/parse-xlsx'
import {
  heuristicFallback,
  type ColumnMapping,
} from '@/lib/excel-import/detect-columns'
import { isValidExcel } from '@/lib/excel-import/magic-bytes'

// Sprint 5.0.2.3 — runtime explícito + maxDuration generoso pra batches grandes.
// Node runtime é OBRIGATÓRIO (exceljs usa Buffer/fs internamente).
export const runtime = 'nodejs'
export const maxDuration = 60

interface Params {
  params: Promise<{ id: string }>
}

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 5000

function sha256(buf: ArrayBuffer | Buffer): string {
  const ab =
    buf instanceof ArrayBuffer
      ? buf
      : (buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
  const data = Buffer.from(ab)
  return createHash('sha256').update(data).digest('hex')
}

function pickStr(
  cells: Record<string, string | number | null>,
  col: string | null | undefined,
): string | null {
  if (!col) return null
  const v = cells[col]
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function pickNumber(
  cells: Record<string, string | number | null>,
  col: string | null | undefined,
): number | null {
  if (!col) return null
  const v = cells[col]
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Math.round(v * 100) / 100
  const parsed = parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(',', '.'))
  if (Number.isFinite(parsed)) return Math.round(parsed * 100) / 100
  return null
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { erro: 'Arquivo não enviado', code: 'FILE_REQUIRED' },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { erro: 'Arquivo excede 10MB', code: 'FILE_TOO_LARGE' },
        { status: 413 },
      )
    }
    const fileName = file.name || 'planilha.xlsx'
    if (!/\.xlsx?$/i.test(fileName)) {
      return NextResponse.json(
        { erro: 'Apenas .xlsx ou .xls suportados', code: 'FILE_TYPE_INVALID' },
        { status: 415 },
      )
    }

    const ab = await file.arrayBuffer()

    // Sprint 5.0.2.3 — magic bytes check (defesa em profundidade vs extensão renomeada)
    if (!isValidExcel(ab)) {
      return NextResponse.json(
        {
          erro:
            'Arquivo não tem assinatura de Excel válido (pode estar corrompido ou ser outro formato renomeado)',
          code: 'FILE_CORRUPTED',
        },
        { status: 400 },
      )
    }

    const fileHash = sha256(ab)

    // Idempotência: reupload mesmo arquivo
    const existing = await prisma.excelImportBatch.findUnique({
      where: { companyId_fileHash: { companyId, fileHash } },
    })
    if (existing) {
      return NextResponse.json({
        batchId: existing.id,
        status: existing.status,
        duplicate: true,
        code: 'DUPLICATE_BATCH',
        totalRows: existing.totalRows,
      })
    }

    // Parse local — try/catch pra encapsular erros de exceljs em PARSE_FAILED
    let parsed
    try {
      parsed = await parseXlsx(ab)
    } catch (parseErr) {
      console.error('[EXCEL-UPLOAD] parseXlsx failed:', parseErr)
      return NextResponse.json(
        {
          erro:
            'Não conseguimos ler a planilha (pode estar protegida por senha ou em formato não suportado)',
          code: 'PARSE_FAILED',
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        },
        { status: 422 },
      )
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        {
          erro: 'Planilha sem linhas válidas (após filtrar totais e vazias)',
          code: 'EMPTY_FILE',
          totalSheets: parsed.totalSheets,
        },
        { status: 400 },
      )
    }
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json(
        {
          erro: `Planilha excede ${MAX_ROWS} linhas (recebeu ${parsed.rows.length})`,
          code: 'TOO_MANY_ROWS',
          rowCount: parsed.rows.length,
        },
        { status: 413 },
      )
    }

    // Heurística inicial de mapeamento (sem IA — instantânea)
    // /detect refinará com Claude se confidence baixo
    const mapping: ColumnMapping = heuristicFallback(parsed.headers)

    // Calcula totais e período
    let credits = 0
    let debits = 0
    let minDate: Date | null = null
    let maxDate: Date | null = null

    const stagedData = parsed.rows.map((row) => {
      const cells = row.cells
      const rawValor = pickNumber(cells, mapping.fields.valor)
      const rawValorBaixa = pickNumber(cells, mapping.fields.valor_baixa)
      const valor = rawValor ?? 0
      const vencimento = parseBRDate(pickStr(cells, mapping.fields.vencimento))
      const pagamento = parseBRDate(pickStr(cells, mapping.fields.pagamento))
      const competencia = parseBRDate(pickStr(cells, mapping.fields.competencia))
      const paymentStatus = pagamento ? 'PAID' : 'PENDING'

      if (paymentStatus === 'PAID') {
        credits += Math.round(valor * 100)
      } else {
        debits += Math.round(valor * 100)
      }
      const ref = pagamento ?? vencimento
      if (ref) {
        if (!minDate || ref < minDate) minDate = ref
        if (!maxDate || ref > maxDate) maxDate = ref
      }

      // dedup hash: favorecido + descricao + vencimento + valor
      const dedupBasis = `${pickStr(cells, mapping.fields.favorecido) ?? ''}|${pickStr(cells, mapping.fields.descricao) ?? ''}|${vencimento?.toISOString() ?? ''}|${valor.toFixed(2)}`
      const dedupHash = createHash('sha256').update(dedupBasis).digest('hex')

      return {
        batchId: '', // setado depois no createMany via mapping
        rowIndex: row.rowIndex,
        rawFavorecido: pickStr(cells, mapping.fields.favorecido),
        rawBeneficiario: pickStr(cells, mapping.fields.beneficiario_tipo),
        rawDescricao: pickStr(cells, mapping.fields.descricao),
        rawCentroCusto: pickStr(cells, mapping.fields.centro_custo),
        rawLancamento: pickStr(cells, mapping.fields.lancamento),
        rawCompetencia: pickStr(cells, mapping.fields.competencia),
        rawVencimento: pickStr(cells, mapping.fields.vencimento),
        rawPagamento: pickStr(cells, mapping.fields.pagamento),
        rawValor,
        rawValorBaixa,
        rawNota: pickStr(cells, mapping.fields.nota),
        rawStatus: pickStr(cells, mapping.fields.status),
        valor,
        vencimento,
        pagamento,
        competencia,
        paymentStatus,
        dedupHash,
        userDecision: 'INCLUDE',
      }
    })

    const batch = await prisma.excelImportBatch.create({
      data: {
        companyId,
        fileName,
        fileHash,
        headerHash: parsed.headerHash,
        totalRows: parsed.rows.length,
        totalCreditsCents: credits,
        totalDebitsCents: debits,
        periodStart: minDate,
        periodEnd: maxDate,
        status: 'PENDING_REVIEW',
        columnMapping: JSON.stringify(mapping),
        detectConfidence: mapping.confidence,
        detectCostUsd: 0,
      },
    })

    await prisma.stagedPayableRow.createMany({
      data: stagedData.map((d) => ({ ...d, batchId: batch.id })),
    })

    console.log(
      `[EXCEL-UPLOAD] company=${companyId} batch=${batch.id} fileName=${fileName} ` +
        `rows=${parsed.rows.length} filtered=${parsed.filteredCount} ` +
        `mapping_confidence=${mapping.confidence.toFixed(2)}`,
    )

    return NextResponse.json({
      batchId: batch.id,
      fileName,
      totalRows: parsed.rows.length,
      filteredCount: parsed.filteredCount,
      headers: parsed.headers,
      headerHash: parsed.headerHash,
      totalSheets: parsed.totalSheets,
      sheetName: parsed.sheetName,
      mapping,
      status: 'PENDING_REVIEW',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
