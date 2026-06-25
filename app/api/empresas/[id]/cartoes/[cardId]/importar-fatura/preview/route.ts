// Sprint Cartao Credito PJ (24/06/2026) — POST .../importar-fatura/preview
//
// Recebe PDF da fatura, chama Claude Vision, sugere categorias, detecta
// duplicatas, confere totais. Retorna tudo pra UI conferir antes do confirm.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkCreditCardPjFlag } from '@/lib/credit-card-pj/feature-flag'
import { extractInvoice } from '@/lib/credit-card-pj/extract'
import { CreditCardPjExtractError } from '@/lib/credit-card-pj/types'
import { checkInvoiceTotals } from '@/lib/credit-card-pj/totals-check'
import { suggestCategoriesForInvoiceLines } from '@/lib/credit-card-pj/suggest-category'
import { computeIdentity } from '@/lib/import-identity/compute-identity'
import { findCardPaymentCandidatesInBank } from '@/lib/credit-card-pj/queries'

interface Params { params: Promise<{ id: string; cardId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const gate = checkCreditCardPjFlag()
  if (!gate.allowed) {
    return NextResponse.json(
      { erro: gate.message, code: 'CREDIT_CARD_PJ_DISABLED' },
      { status: 403 },
    )
  }

  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  // Acesso: empresa + cartao
  const card = await prisma.businessCreditCard.findFirst({
    where: {
      id: cardId,
      companyId,
      company: { users: { some: { userId: user.sub } } },
    },
  })
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  // Carrega categorias da empresa (pra UI montar dropdowns)
  const categories = await prisma.category.findMany({
    where: { companyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, dreGroup: true, color: true },
  })

  // Carrega o PDF
  let pdfBytes: Uint8Array
  let fileName = 'fatura.pdf'
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo PDF não enviado' }, { status: 400 })
    }
    fileName = (file as File).name || 'fatura.pdf'
    pdfBytes = new Uint8Array(await (file as File).arrayBuffer())
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  // Extracao Claude Vision
  let result
  try {
    result = await extractInvoice({ pdfBytes, fileName })
  } catch (err: unknown) {
    if (err instanceof CreditCardPjExtractError) {
      const code = err.code
      const status =
        code === 'NOT_A_PDF' ||
        code === 'FILE_TOO_LARGE' ||
        code === 'NO_FILE' ||
        code === 'ENCRYPTED_PDF'
          ? 400
          : code === 'CLAUDE_TIMEOUT'
            ? 504
            : 500
      return NextResponse.json({ erro: err.message, code }, { status })
    }
    console.error('[credit-card-pj/preview] erro inesperado:', err)
    return NextResponse.json({ erro: 'Erro ao processar fatura' }, { status: 500 })
  }

  const { extraction, metrics } = result

  // Sugestoes de categoria (reusa pipeline IA do OFX)
  const suggestions = await suggestCategoriesForInvoiceLines(extraction.lines, {
    companyId,
  })

  // Totais
  const totals = checkInvoiceTotals(extraction)

  // Dedup: pra cada linha que ENTRA (nao IGNORAR), calcula identity contra
  // o "ledger" da conta cartao. Como cartao nao tem fitidKey, dedup eh
  // por contentHash (cross-format) usando businessCreditCardId como scope.
  const lineHashes = extraction.lines.map((line) => {
    const id = computeIdentity({
      accountId: `card:${cardId}`,
      fitid: null,
      date: line.date,
      amount: line.amount,
      type: 'DEBIT',
      memo: line.description,
    })
    return id.contentHash
  })

  // Carrega tx existentes da MESMA conta cartao com contentHash batendo
  const existingHashes = new Set<string>()
  if (lineHashes.length > 0) {
    const dups = await prisma.transaction.findMany({
      where: {
        businessCreditCardId: cardId,
        contentHash: { in: lineHashes },
      },
      select: { contentHash: true },
    })
    for (const d of dups) {
      if (d.contentHash) existingHashes.add(d.contentHash)
    }
  }

  // Detector de "pagamento ja registrado como despesa" — busca candidatos
  // pelos 2 valores possiveis da fatura (totalToPay = valor que sai do banco;
  // totalDeclared = soma das compras+encargos do periodo). Caso real R$ 2.654,63.
  // Sempre busca tambem pagamentos aguardando (isCardPayment=true sem cardId).
  const targetTotals: number[] = []
  if (extraction.totalToPay && extraction.totalToPay > 0) {
    targetTotals.push(extraction.totalToPay)
  }
  if (
    extraction.totalDeclared &&
    extraction.totalDeclared > 0 &&
    Math.abs(extraction.totalDeclared - (extraction.totalToPay ?? 0)) > 0.02
  ) {
    targetTotals.push(extraction.totalDeclared)
  }
  const paymentCandidates = await findCardPaymentCandidatesInBank(
    companyId,
    targetTotals,
  )

  // Log observabilidade
  console.log('[credit-card-pj/preview]', {
    companyId,
    cardId,
    fileName,
    pdfSize: metrics.pdfSize,
    durationMs: metrics.durationMs,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    linhas: extraction.lines.length,
    duplicatas: existingHashes.size,
    paymentCandidates: paymentCandidates.length,
  })

  return NextResponse.json({
    card: {
      id: card.id,
      name: card.name,
      bankName: card.bankName,
      lastDigits: card.lastDigits,
      creditLimit: card.creditLimit,
    },
    extraction: {
      dueDate: extraction.dueDate,
      closingDate: extraction.closingDate,
      totalDeclared: extraction.totalDeclared,
      totalToPay: extraction.totalToPay,
      creditLimit: extraction.creditLimit,
      availableLimit: extraction.availableLimit,
      detectedBank: extraction.detectedBank,
      cardLastDigitsFound: extraction.cardLastDigitsFound,
      scanQuality: extraction.scanQuality,
      notes: extraction.notes,
    },
    totals,
    lines: extraction.lines.map((line, idx) => {
      const sugg = suggestions.perIndex.get(idx) ?? {
        categoryId: null,
        source: 'NONE' as const,
        confidence: 0,
      }
      return {
        index: idx,
        date: line.date,
        description: line.description,
        amount: line.amount,
        suggestedKind: line.suggestedKind,
        installmentNumber: line.installmentNumber ?? null,
        installmentTotal: line.installmentTotal ?? null,
        cardLastDigits: line.cardLastDigits ?? null,
        needsReview: line.needsReview === true,
        note: line.note ?? null,
        // Dedup
        contentHash: lineHashes[idx],
        isDuplicate: existingHashes.has(lineHashes[idx]),
        // Sugestao de categoria
        suggestedCategoryId: sugg.categoryId,
        suggestedCategorySource: sugg.source,
        suggestedConfidence: sugg.confidence,
      }
    }),
    categories,
    counts: {
      total: extraction.lines.length,
      compraAvista: extraction.lines.filter((l) => l.suggestedKind === 'COMPRA_AVISTA').length,
      compraParcelada: extraction.lines.filter((l) => l.suggestedKind === 'COMPRA_PARCELADA').length,
      encargo: extraction.lines.filter((l) => l.suggestedKind === 'ENCARGO_FINANCEIRO').length,
      ignorar: extraction.lines.filter((l) => l.suggestedKind === 'IGNORAR').length,
      duplicatas: existingHashes.size,
      precisaRevisar: extraction.lines.filter((l) => l.needsReview).length,
    },
    /**
     * Candidatos a "este pagamento já foi importado como despesa antes" —
     * UI mostra avisa pro user marcar pra RECLASSIFICAR como TRANSFER.
     * Score: 0-1, mais alto = melhor match. Calculado pelo proximidade do
     * valor com totalToPay (preferido) ou totalDeclared (fallback).
     */
    paymentCandidates: paymentCandidates
      .map((c) => {
        // Match score: proximidade do valor + isCardPayment ja marcado
        let matchScore = 0
        if (extraction.totalToPay && extraction.totalToPay > 0) {
          const diff = Math.abs(c.amount - extraction.totalToPay)
          if (diff <= 0.02) matchScore = 1.0
          else if (diff <= 1.0) matchScore = 0.9
        }
        if (matchScore < 0.5 && extraction.totalDeclared && extraction.totalDeclared > 0) {
          const diff = Math.abs(c.amount - extraction.totalDeclared)
          if (diff <= 0.02) matchScore = Math.max(matchScore, 0.95)
          else if (diff <= 1.0) matchScore = Math.max(matchScore, 0.85)
        }
        // Boost pequeno se ja marcado pelo hook (isCardPayment=true aguardando)
        if (c.isCardPayment) matchScore = Math.max(matchScore, 0.7)
        return {
          id: c.id,
          date: c.date.toISOString().slice(0, 10),
          description: c.description,
          amount: c.amount,
          bankAccountId: c.bankAccountId,
          bankAccountName: c.bankAccount?.name ?? null,
          currentCategoryName: c.category?.name ?? null,
          isAlreadyMarkedPayment: c.isCardPayment,
          matchScore,
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore),
    metrics: {
      durationMs: metrics.durationMs,
      model: metrics.model,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
    },
  })
}
