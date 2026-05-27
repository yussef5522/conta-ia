// Sprint 5.0.2.u — Upload múltiplo de OFX em staging.
//
// Multipart FormData:
//   - file_0 (OFX content)
//   - file_0_bankAccountId (cuid da conta destino)
//   - file_0_name (nome de arquivo pra debug)
//   - (repete pra file_1, file_2, ...)
//
// Cria 1 ImportStaging por arquivo, todos com mesmo batchId.
// Pula arquivos com fileHash já visto (idempotência por empresa).

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { parseOFX } from '@/lib/ofx/parser'

interface Params {
  params: Promise<{ id: string }>
}

interface UploadResult {
  fileName: string
  bankAccountId: string
  stagingId?: string
  status: 'CREATED' | 'DUPLICATE' | 'ERROR'
  totalTransactions?: number
  error?: string
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const form = await request.formData()
    const fieldNames = Array.from(form.keys())
    // Encontra todos prefixos file_N
    const fileIndices = new Set<string>()
    for (const name of fieldNames) {
      const m = name.match(/^file_(\d+)$/)
      if (m) fileIndices.add(m[1])
    }
    if (fileIndices.size === 0) {
      return NextResponse.json(
        { erro: 'Nenhum arquivo file_N enviado' },
        { status: 400 },
      )
    }

    const batchId = `batch_${Date.now()}_${companyId.slice(-6)}`
    const results: UploadResult[] = []

    // Pre-load bankAccounts da empresa pra validar ownership
    const contas = await prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    })
    const contasIds = new Set(contas.map((c) => c.id))

    for (const idx of Array.from(fileIndices).sort()) {
      const file = form.get(`file_${idx}`)
      const bankAccountId = form.get(`file_${idx}_bankAccountId`)?.toString() ?? ''
      const fileName =
        form.get(`file_${idx}_name`)?.toString() ?? `arquivo_${idx}.ofx`

      if (!(file instanceof File)) {
        results.push({ fileName, bankAccountId, status: 'ERROR', error: 'Arquivo inválido' })
        continue
      }
      if (!contasIds.has(bankAccountId)) {
        results.push({
          fileName,
          bankAccountId,
          status: 'ERROR',
          error: 'Conta bancária inválida pra esta empresa',
        })
        continue
      }

      const content = await file.text()
      const fileHash = sha256(content)

      // Idempotência: pula se já existe staging desse arquivo pra empresa
      const existing = await prisma.importStaging.findUnique({
        where: { companyId_fileHash: { companyId, fileHash } },
      })
      if (existing) {
        results.push({
          fileName,
          bankAccountId,
          stagingId: existing.id,
          status: 'DUPLICATE',
          totalTransactions: existing.totalTransactions,
        })
        continue
      }

      const parsed = parseOFX(content)
      if (parsed.transactions.length === 0) {
        results.push({
          fileName,
          bankAccountId,
          status: 'ERROR',
          error: 'Nenhuma transação no OFX',
        })
        continue
      }

      // Agrega snapshot
      let credits = 0
      let debits = 0
      let minDate: Date | null = null
      let maxDate: Date | null = null
      for (const t of parsed.transactions) {
        const cents = Math.round(t.amount * 100)
        if (t.type === 'CREDIT') credits += cents
        else debits += cents
        if (!minDate || t.datePosted < minDate) minDate = t.datePosted
        if (!maxDate || t.datePosted > maxDate) maxDate = t.datePosted
      }

      const staging = await prisma.importStaging.create({
        data: {
          companyId,
          batchId,
          bankAccountId,
          fileName,
          fileHash,
          totalTransactions: parsed.transactions.length,
          totalCreditsCents: credits,
          totalDebitsCents: debits,
          periodStart: minDate,
          periodEnd: maxDate,
          status: 'PENDING_REVIEW',
          stagedTransactions: {
            create: parsed.transactions.map((t) => ({
              fitId: t.fitid,
              effectedDate: t.datePosted,
              amount: t.amount,
              type: t.type,
              description: t.memo ?? '',
            })),
          },
        },
      })

      results.push({
        fileName,
        bankAccountId,
        stagingId: staging.id,
        status: 'CREATED',
        totalTransactions: parsed.transactions.length,
      })
    }

    const created = results.filter((r) => r.status === 'CREATED').length
    console.log(
      `[STAGING-UPLOAD] company=${companyId} batchId=${batchId} created=${created} ` +
        `duplicate=${results.filter((r) => r.status === 'DUPLICATE').length} ` +
        `error=${results.filter((r) => r.status === 'ERROR').length}`,
    )

    return NextResponse.json({ batchId, files: results })
  } catch (error) {
    return handleApiError(error)
  }
}
