// Sprint PDF Extrato Bancário (24/06/2026) — POST /preview.
//
// Recebe PDF de extrato bancário (multipart). Chama Claude Vision pra extrair
// transações, calcula dedup contra o ledger, confere totais, retorna shape
// pra tela de conferência editar antes de confirmar.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkPdfBankStatementFlag } from '@/lib/pdf-bank-statement/feature-flag'
import {
  extractBankStatement,
  BankStatementExtractError,
} from '@/lib/pdf-bank-statement/extract'
import { computeDedupForPreview } from '@/lib/pdf-bank-statement/dedup-preview'
import { checkTotals } from '@/lib/pdf-bank-statement/totals-check'

interface Params { params: Promise<{ id: string }> }

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

  // Multi-tenant: conta deve pertencer a uma empresa do user
  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
    select: {
      id: true,
      name: true,
      bankName: true,
      companyId: true,
      balance: true,
      ledgerBal: true,
    },
  })
  if (!conta) {
    return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
  }

  // Upload + validação básica
  let pdfBytes: Uint8Array
  let fileName = 'extrato.pdf'
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { erro: 'Arquivo PDF não enviado' },
        { status: 400 },
      )
    }
    fileName = (file as File).name || 'extrato.pdf'
    pdfBytes = new Uint8Array(await (file as File).arrayBuffer())
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  // Extração via Claude
  let extractionResult
  try {
    extractionResult = await extractBankStatement({ pdfBytes, fileName })
  } catch (err) {
    if (err instanceof BankStatementExtractError) {
      const status =
        err.code === 'NOT_A_PDF' ||
        err.code === 'FILE_TOO_LARGE' ||
        err.code === 'NO_FILE' ||
        err.code === 'ENCRYPTED_PDF'
          ? 400
          : err.code === 'CLAUDE_TIMEOUT'
            ? 504
            : 500
      return NextResponse.json(
        { erro: err.message, code: err.code },
        { status },
      )
    }
    console.error('[pdf-bank-statement/preview] erro inesperado:', err)
    return NextResponse.json(
      { erro: 'Erro inesperado ao extrair PDF' },
      { status: 500 },
    )
  }

  const { extraction, metrics } = extractionResult

  // Dedup vs ledger existente
  const dedup = await computeDedupForPreview(contaId, extraction.lines)

  // Totais
  const totals = checkTotals(extraction)

  // Log observabilidade (não vaza conteúdo)
  console.log('[pdf-bank-statement/preview]', {
    contaId: conta.id,
    fileName,
    pdfSize: metrics.pdfSize,
    durationMs: metrics.durationMs,
    model: metrics.model,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    linhas: extraction.lines.length,
    duplicatas: dedup.duplicateCount,
    novas: dedup.newCount,
    totaisOk: totals.matches,
  })

  return NextResponse.json({
    conta: {
      id: conta.id,
      name: conta.name,
      bankName: conta.bankName,
      balance: conta.balance,
      ledgerBal: conta.ledgerBal,
    },
    extraction: {
      openingBalance: extraction.openingBalance,
      closingBalance: extraction.closingBalance,
      periodStart: extraction.periodStart,
      periodEnd: extraction.periodEnd,
      detectedBank: extraction.detectedBank,
      scanQuality: extraction.scanQuality,
      notes: extraction.notes,
    },
    totals: {
      matches: totals.matches,
      insufficient: totals.insufficient,
      totalEntradas: totals.totalEntradas,
      totalSaidas: totals.totalSaidas,
      saldoCalculado: totals.saldoCalculado,
      saldoDeclarado: totals.saldoDeclarado,
      diferenca: totals.diferenca,
      message: totals.message,
    },
    lines: dedup.lines.map((d) => ({
      index: d.index,
      date: d.line.date,
      description: d.line.description,
      amount: d.line.amount,
      type: d.line.type,
      balanceAfter: d.line.balanceAfter ?? null,
      needsReview: d.line.needsReview === true,
      note: d.line.note ?? null,
      isDuplicate: d.isDuplicate,
      duplicateReason: d.duplicateReason ?? null,
      contentHash: d.identity.contentHash,
    })),
    counts: {
      total: extraction.lines.length,
      novas: dedup.newCount,
      duplicatas: dedup.duplicateCount,
      precisaRevisar: extraction.lines.filter((l) => l.needsReview).length,
    },
    metrics: {
      durationMs: metrics.durationMs,
      model: metrics.model,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
    },
  })
}
