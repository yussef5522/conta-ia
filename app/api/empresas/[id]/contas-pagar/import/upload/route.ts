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
import { isValidExcel, isValidCsv } from '@/lib/excel-import/magic-bytes'
// Sprint CSV Import (30/05/2026)
import { parseCsv } from '@/lib/csv-import/parse-csv'
import { parseCsvAsXlsx } from '@/lib/csv-import/parse-csv-as-xlsx'
import { isCaculaHeader } from '@/lib/csv-import/detect-cacula'
import { mapearCacula } from '@/lib/csv-import/map-cacula'
// Sprint CSV-Encoding: diagnóstico encoding-aware (UTF-8/ANSI/UTF-16) +
// detecção de separador (TAB) + mensagem de erro rica pra UI.
import {
  diagnoseCsv,
  diagnosticoPermiteBatch,
  type CsvDiagnostico,
} from '@/lib/csv-import/diagnose-csv'
// Sprint Reimport-DedupByData: detecta dedup REAL por dado (não por arquivo).
import {
  checkBatchAlive,
  type BatchAliveStats,
} from '@/lib/excel-import/check-batch-alive'

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

/**
 * Sprint CSV-Encoding: serializa diagnóstico pra response sem expor o texto
 * inteiro do arquivo (decodedText fica só no server). Preview é trunc 3 linhas.
 */
function serializeDiagnostico(d: CsvDiagnostico) {
  return {
    encoding: d.encoding,
    bomDetected: d.bomDetected,
    replacementCharsCount: d.replacementCharsCount,
    separator: d.separator,
    separatorLabel: d.separatorLabel,
    headers: d.headers,
    dataLineCount: d.dataLineCount,
    filteredBlankCount: d.filteredBlankCount,
    previewRows: d.previewRows,
    mapping: d.mapping,
    warnings: d.warnings,
  }
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
    const isCsv = /\.csv$/i.test(fileName)
    const isExcel = /\.xlsx?$/i.test(fileName)
    if (!isCsv && !isExcel) {
      return NextResponse.json(
        {
          erro: 'Apenas .xlsx, .xls ou .csv suportados',
          code: 'FILE_TYPE_INVALID',
        },
        { status: 415 },
      )
    }

    const ab = await file.arrayBuffer()

    // Sprint 5.0.2.3 + CSV (30/05/2026) — magic bytes check
    // (defesa em profundidade vs extensão renomeada)
    const magicOK = isCsv ? isValidCsv(ab) : isValidExcel(ab)
    if (!magicOK) {
      return NextResponse.json(
        {
          erro: isCsv
            ? 'Arquivo .csv parece binário ou corrompido (esperado texto UTF-8)'
            : 'Arquivo não tem assinatura de Excel válido (pode estar corrompido ou ser outro formato renomeado)',
          code: 'FILE_CORRUPTED',
        },
        { status: 400 },
      )
    }

    const fileHash = sha256(ab)

    // Sprint Reimport-DedupByData: ao invés de bloquear por fileHash, calcula
    // dedup REAL (quantas tx do batch antigo ainda existem). Cenários:
    //   - ALL_DELETED: reativa o batch (recria staged_rows do arquivo novo,
    //     status → PENDING_REVIEW). Flow segue normal pro user.
    //   - PARTIAL: idem ALL_DELETED mas confirm vai dedup automático por
    //     dedupHash (pular as N já vivas).
    //   - ALL_ALIVE: idem; user pode prosseguir mas confirm vai pular tudo.
    // O batch antigo é REUSADO (mesmo batch.id) — preserva @@unique([companyId,
    // fileHash]) sem mexer em schema.
    const existingBatch = await prisma.excelImportBatch.findUnique({
      where: { companyId_fileHash: { companyId, fileHash } },
    })

    let aliveStats: BatchAliveStats | null = null
    let isReactivation = false

    if (existingBatch) {
      // Conta dedup REAL: dedupHashes dos staged_rows IMPORTED vs tx vivas.
      aliveStats = await checkBatchAlive({
        loadImportedDedupHashes: async () => {
          const rows = await prisma.stagedPayableRow.findMany({
            where: { batchId: existingBatch.id, userDecision: 'IMPORTED' },
            select: { dedupHash: true },
          })
          return rows
            .map((r) => r.dedupHash)
            .filter((h): h is string => h !== null && h !== undefined)
        },
        countAliveTxByDedupHash: async (hashes) =>
          prisma.transaction.count({
            where: {
              bankAccount: { companyId },
              dedupHash: { in: hashes },
            },
          }),
      })

      // Se o batch existente JÁ ESTÁ em PENDING_REVIEW (não foi confirmado
      // ainda), só devolve o batch antigo — user pode continuar de onde parou.
      // Não reprocessa o arquivo (pode estar com edições no review).
      if (existingBatch.status === 'PENDING_REVIEW') {
        let existingMapping: ColumnMapping | null = null
        if (existingBatch.columnMapping) {
          try {
            existingMapping = JSON.parse(
              existingBatch.columnMapping,
            ) as ColumnMapping
          } catch {
            /* ignore */
          }
        }
        return NextResponse.json({
          batchId: existingBatch.id,
          status: existingBatch.status,
          duplicate: true,
          code: 'DUPLICATE_BATCH_PENDING',
          totalRows: existingBatch.totalRows,
          fileName: existingBatch.fileName,
          mapping: existingMapping,
          reimportInfo: {
            scenario: aliveStats.scenario,
            aliveCount: aliveStats.aliveCount,
            totalImported: aliveStats.totalImported,
            reactivated: false,
          },
        })
      }

      // Batch CONFIRMED → vamos reativar (deletar staged_rows antigas +
      // recriar do arquivo novo). Continua o fluxo normal abaixo, mas marca
      // pra usar update em vez de create no final.
      isReactivation = true
      await prisma.stagedPayableRow.deleteMany({
        where: { batchId: existingBatch.id },
      })
    }

    // Parse local — try/catch pra encapsular erros em PARSE_FAILED.
    // Sprint CSV Import (30/05/2026): branch por extensão.
    //   - CSV CACULA (header exato) → fast-path em loadCaculaFastPath
    //   - CSV genérico → adapter parseCsvAsXlsx → mesmo flow Excel
    //   - Excel → parseXlsx
    // Sprint CSV-Encoding: pra CSV, usa diagnose pra detectar encoding +
    // separador + retornar erro RICO se arquivo for ilegível (em vez de
    // EMPTY_FILE genérico).
    let parsed
    let caculaResult: ReturnType<typeof mapearCacula> | null = null
    let csvDiag: CsvDiagnostico | null = null
    try {
      if (isCsv) {
        csvDiag = diagnoseCsv(ab)
        if (!diagnosticoPermiteBatch(csvDiag)) {
          return NextResponse.json(
            {
              erro: csvDiag.dataLineCount === 0 && csvDiag.headers.length > 0
                ? 'Achei o cabeçalho mas 0 linhas de dado. Confere se o arquivo tem mesmo dados depois do cabeçalho.'
                : 'Não consegui ler o arquivo. Verifique se é um CSV válido com pelo menos uma linha de dado.',
              code: 'CSV_NO_DATA',
              diagnostico: serializeDiagnostico(csvDiag),
            },
            { status: 422 },
          )
        }
        const text = csvDiag.decodedText
        const rawCsv = parseCsv(text)
        if (isCaculaHeader(rawCsv.headers)) {
          // FAST-PATH CACULA: mapping determinístico (skip IA)
          caculaResult = mapearCacula(rawCsv)
          parsed = parseCsvAsXlsx(text) // shape compat pra stats/headerHash
        } else {
          // CSV genérico → cai no fluxo IA (mesmo do Excel)
          parsed = parseCsvAsXlsx(text)
        }
      } else {
        parsed = await parseXlsx(ab)
      }
    } catch (parseErr) {
      console.error('[IMPORT-UPLOAD] parse failed:', parseErr)
      return NextResponse.json(
        {
          erro:
            'Não conseguimos ler o arquivo (pode estar protegido por senha ou em formato não suportado)',
          code: 'PARSE_FAILED',
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
          // Sprint CSV-Encoding: se conseguimos diagnóstico parcial, embarca
          diagnostico: csvDiag ? serializeDiagnostico(csvDiag) : undefined,
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
          diagnostico: csvDiag ? serializeDiagnostico(csvDiag) : undefined,
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
    // CACULA fast-path: usa mapping fake com 100% confidence (já temos
    // mapping determinístico via mapearCacula).
    const mapping: ColumnMapping = caculaResult
      ? {
          confidence: 1,
          reasoning: 'Fast-path CACULA (header exato detectado)',
          fields: {
            // pra fins de audit; campos reais vêm do mapearCacula
            favorecido: 'CREDOR/PAGANTE',
            descricao: 'DESCRICAO',
            centro_custo: 'CATEGORIA CONTABIL',
            competencia: 'DATA COMPETENCIA',
            vencimento: 'DATA DE VENCIMENTO',
            pagamento: 'DATA DO PAGAMENTO',
            valor: 'TOTAL',
            status: 'STATUS',
            nota: 'NUMERO NOTA',
          },
        }
      : heuristicFallback(parsed.headers)

    // Calcula totais e período
    let credits = 0
    let debits = 0
    let minDate: Date | null = null
    let maxDate: Date | null = null

    // Sprint CSV Import (30/05/2026) — CACULA fast-path monta stagedData
    // direto do mapearCacula (preenche lifecycle, valida vs lib/lifecycle).
    const stagedData = caculaResult
      ? caculaResult.rows.map((r) => {
          const valorPos = r.valor // já Math.abs feito no mapper
          // lifecycle EFFECTED conta como crédito de "pago", PAYABLE como pendente.
          // Espelha convenção atual paymentStatus: PAID/PENDING.
          if (r.lifecycle === 'EFFECTED') {
            credits += Math.round(valorPos * 100)
          } else {
            debits += Math.round(valorPos * 100)
          }
          const ref = r.pagamento ?? r.vencimento ?? r.competencia
          if (ref) {
            if (!minDate || ref < minDate) minDate = ref
            if (!maxDate || ref > maxDate) maxDate = ref
          }

          const dedupBasis = `${r.rawFavorecido ?? ''}|${r.rawDescricao ?? ''}|${r.vencimento?.toISOString() ?? ''}|${valorPos.toFixed(2)}`
          const dedupHash = createHash('sha256').update(dedupBasis).digest('hex')

          // validationError mostra motivos pra revisão no preview UI
          const validationError =
            r.motivosRevisar.length + r.errosParse.length > 0
              ? [...r.motivosRevisar, ...r.errosParse].join(' · ')
              : null

          return {
            batchId: '',
            rowIndex: r.rowIndex + 2, // base-2 igual Excel
            rawFavorecido: r.rawFavorecido,
            rawBeneficiario: null,
            rawDescricao: r.rawDescricao,
            rawCentroCusto: r.categoriaLimpa || null,
            rawLancamento: null,
            rawCompetencia: r.rawCompetencia,
            rawVencimento: r.rawVencimento,
            rawPagamento: r.rawPagamento,
            rawValor: r.rawValor,
            rawValorBaixa: null,
            rawNota: r.rawNota,
            rawStatus: r.rawStatus,
            valor: valorPos,
            vencimento: r.vencimento,
            pagamento: r.pagamento,
            competencia: r.competencia,
            paymentStatus:
              r.lifecycle === 'EFFECTED' ? 'PAID' : 'PENDING',
            lifecycle: r.lifecycle, // CACULA fast-path: já decidido + validado
            dedupHash,
            userDecision: r.precisaRevisar
              ? 'NEEDS_REVIEW'
              : 'INCLUDE',
            validationError,
          }
        })
      : parsed.rows.map((row) => {
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

          const dedupBasis = `${pickStr(cells, mapping.fields.favorecido) ?? ''}|${pickStr(cells, mapping.fields.descricao) ?? ''}|${vencimento?.toISOString() ?? ''}|${valor.toFixed(2)}`
          const dedupHash = createHash('sha256').update(dedupBasis).digest('hex')

          return {
            batchId: '',
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
            lifecycle: null, // Excel/CSV genérico: confirm decide via paymentStatus
            dedupHash,
            userDecision: 'INCLUDE',
            validationError: null,
          }
        })

    // Sprint Reimport-DedupByData: na reativação, REUSA o batch.id antigo
    // (preserva @@unique([companyId, fileHash])) e faz UPDATE em vez de CREATE.
    // staged_rows antigas já foram deletadas acima; aqui só insere as novas.
    const batch = isReactivation && existingBatch
      ? await prisma.excelImportBatch.update({
          where: { id: existingBatch.id },
          data: {
            fileName,
            headerHash: parsed.headerHash,
            totalRows: parsed.rows.length,
            totalCreditsCents: credits,
            totalDebitsCents: debits,
            periodStart: minDate,
            periodEnd: maxDate,
            status: 'PENDING_REVIEW',
            importedAt: null,
            columnMapping: JSON.stringify(mapping),
            detectConfidence: mapping.confidence,
            detectCostUsd: 0,
          },
        })
      : await prisma.excelImportBatch.create({
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
        `mapping_confidence=${mapping.confidence.toFixed(2)}` +
        (isReactivation
          ? ` REACTIVATED scenario=${aliveStats?.scenario} alive=${aliveStats?.aliveCount}/${aliveStats?.totalImported}`
          : ''),
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
      // Sprint Reimport-DedupByData: info pra UI mostrar banner adequado
      reimportInfo: aliveStats
        ? {
            scenario: aliveStats.scenario,
            aliveCount: aliveStats.aliveCount,
            totalImported: aliveStats.totalImported,
            reactivated: isReactivation,
          }
        : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
