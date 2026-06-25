// Sprint PDF Extrato Bancário (24/06/2026) — POST /confirm.
//
// Recebe o array final de linhas (após user editar/remover/adicionar) e
// cria as Transactions. Reusa pipeline:
//   - origin='PDF' + source='PDF' no OfxImport
//   - dedupHash = contentHash (constraint UNIQUE intercepta reimport)
//   - seed ImportedIdentity (seen-ledger pra futuras importações)
//   - Recalcula balance via lib/balance/recalcular
//
// Anti-duplicata em 2 camadas:
//   1. UI sugere desmarcar duplicatas (PDF preview)
//   2. UNIQUE([bankAccountId, dedupHash]) intercepta caso force

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPdfBankStatementFlag } from '@/lib/pdf-bank-statement/feature-flag'
import { computeIdentity } from '@/lib/import-identity/compute-identity'

interface Params { params: Promise<{ id: string }> }

const lineSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  type: z.enum(['CREDIT', 'DEBIT']),
})

const bodySchema = z.object({
  fileName: z.string().min(1).max(200).default('extrato.pdf'),
  fileSizeBytes: z.number().int().nonnegative().default(0),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  detectedBank: z.string().max(60).nullable().optional(),
  openingBalance: z.number().nullable().optional(),
  closingBalance: z.number().nullable().optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  totalsMatched: z.boolean().default(false),
  lines: z.array(lineSchema).min(1).max(2000),
})

export async function POST(request: NextRequest, { params }: Params) {
  const gate = checkPdfBankStatementFlag()
  if (!gate.allowed) {
    return NextResponse.json(
      { erro: gate.message, code: 'PDF_BANK_STATEMENT_DISABLED' },
      { status: 403 },
    )
  }

  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
    select: { id: true, companyId: true },
  })
  if (!conta) {
    return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
  }

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      {
        erro: 'Body inválido',
        details: err instanceof z.ZodError ? err.issues : String(err),
      },
      { status: 400 },
    )
  }

  // Calcula identidades pra todas as linhas (mesma fórmula do OFX → cross-format)
  const linesWithIdentity = body.lines.map((line) => {
    const identity = computeIdentity({
      accountId: contaId,
      fitid: null,
      date: line.date,
      amount: line.amount,
      type: line.type,
      name: null,
      memo: line.description,
    })
    return { line, identity }
  })

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // Período do batch
  const dates = body.lines.map((l) => new Date(l.date).getTime())
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : null

  // OfxImport (master record do batch — usa source='PDF')
  const importRow = await prisma.ofxImport.create({
    data: {
      bankAccountId: contaId,
      userId: user.sub,
      status: 'PROCESSING',
      fileName: body.fileName,
      fileSize: body.fileSizeBytes,
      totalTransactions: body.lines.length,
      duplicates: 0,
      periodStart,
      periodEnd,
      ipAddress,
      userAgent,
      fileHash:
        body.fileSha256 ??
        createHash('sha256').update(JSON.stringify(body.lines)).digest('hex'),
      source: 'PDF',
    },
  })

  // Atomic: filtra duplicatas explicitamente (em vez de skipDuplicates) +
  // cria Transactions + ImportedIdentity.
  let inseridas = 0
  let duplicadas = 0
  try {
    await prisma.$transaction(async (tx) => {
      // Filtra colisão por contentHash já existente em ImportedIdentity vivo
      const incomingHashes = linesWithIdentity.map((li) => li.identity.contentHash)
      const existingLedger = await tx.importedIdentity.findMany({
        where: {
          bankAccountId: contaId,
          contentHash: { in: incomingHashes },
          tombstone: false,
        },
        select: { contentHash: true },
      })
      const blockedHashes = new Set(existingLedger.map((e) => e.contentHash))

      // Também filtra contra dedupHash já em transactions (rede dupla,
      // protege importações antigas anteriores ao ImportedIdentity)
      const existingTxByHash = await tx.transaction.findMany({
        where: { bankAccountId: contaId, dedupHash: { in: incomingHashes } },
        select: { dedupHash: true },
      })
      for (const e of existingTxByHash) {
        if (e.dedupHash) blockedHashes.add(e.dedupHash)
      }

      const filtered = linesWithIdentity.filter(
        (li) => !blockedHashes.has(li.identity.contentHash),
      )
      duplicadas = linesWithIdentity.length - filtered.length

      // Cria transações
      if (filtered.length > 0) {
        await tx.transaction.createMany({
          data: filtered.map((li) => ({
            bankAccountId: contaId,
            date: new Date(li.line.date),
            description: li.line.description,
            amount: li.line.amount,
            type: li.line.type,
            status: 'RECONCILED',
            origin: 'PDF',
            externalId: null,
            dedupHash: li.identity.contentHash,
            fitidKey: null,
            contentHash: li.identity.contentHash,
            importId: importRow.id,
          })),
        })
      }

      // Seed ImportedIdentity pras futuras importações (OFX ou PDF)
      const createdTxs = await tx.transaction.findMany({
        where: { importId: importRow.id },
        select: { id: true, contentHash: true },
      })
      inseridas = createdTxs.length
      const identityRows = createdTxs
        .filter((t) => !!t.contentHash)
        .map((t) => ({
          companyId: conta.companyId,
          bankAccountId: contaId,
          importBatchId: importRow.id,
          fitidKey: null,
          contentHash: t.contentHash as string,
          transactionId: t.id,
          tombstone: false,
        }))
      if (identityRows.length > 0) {
        await tx.importedIdentity.createMany({ data: identityRows })
      }

      await tx.ofxImport.update({
        where: { id: importRow.id },
        data: {
          status: 'SUCCESS',
          newTransactions: inseridas,
          duplicates: duplicadas,
        },
      })
    })
  } catch (err) {
    await prisma.ofxImport.update({
      where: { id: importRow.id },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    console.error('[pdf-bank-statement/confirm] erro persistência:', err)
    return NextResponse.json(
      {
        erro: 'Erro ao salvar transações',
        importId: importRow.id,
      },
      { status: 500 },
    )
  }

  // Recalcula saldo (idêntico ao import OFX)
  try {
    const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
    await recalcularSaldoConta(prisma, contaId)
  } catch (err) {
    console.error('[pdf-bank-statement/confirm] recalcularSaldo falhou:', err)
  }

  // Final import count
  const updatedImport = await prisma.ofxImport.findUniqueOrThrow({
    where: { id: importRow.id },
    select: {
      id: true,
      newTransactions: true,
      duplicates: true,
      totalTransactions: true,
    },
  })

  console.log('[pdf-bank-statement/confirm]', {
    contaId,
    importId: importRow.id,
    fileName: body.fileName,
    total: body.lines.length,
    inseridas: updatedImport.newTransactions,
    duplicadas: updatedImport.duplicates,
  })

  return NextResponse.json({
    importId: importRow.id,
    inseridas: updatedImport.newTransactions,
    duplicadas: updatedImport.duplicates,
    total: updatedImport.totalTransactions,
  })
}
