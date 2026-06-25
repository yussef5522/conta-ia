// Sprint Cartao Credito PJ (24/06/2026) — POST .../importar-fatura/confirm
//
// Recebe linhas FINAIS (apos user editar/remover/adicionar) com kind e
// categoryId definidos. Cria Transactions vinculadas ao cartao + opcionalmente
// reclassifica tx existente em conta bancaria como TRANSFER (pagamento da fatura).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkCreditCardPjFlag } from '@/lib/credit-card-pj/feature-flag'
import { computeIdentity } from '@/lib/import-identity/compute-identity'

interface Params { params: Promise<{ id: string; cardId: string }> }

const lineSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  kind: z.enum(['COMPRA_AVISTA', 'COMPRA_PARCELADA', 'ENCARGO_FINANCEIRO']),
  // IGNORAR nao chega aqui (UI filtra antes)
  categoryId: z.string().cuid().nullable().optional(),
  installmentNumber: z.number().int().min(1).max(99).optional(),
  installmentTotal: z.number().int().min(1).max(99).optional(),
  cardLastDigits: z.string().regex(/^\d{2,6}$/).nullable().optional(),
})

const bodySchema = z.object({
  fileName: z.string().min(1).max(200).default('fatura.pdf'),
  fileSizeBytes: z.number().int().nonnegative().default(0),
  /** Vencimento da fatura — usado como date do pagamento se reclassificarPagamentoTxId presente */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  totalDeclared: z.number().nullable().optional(),
  detectedBank: z.string().max(60).nullable().optional(),
  lines: z.array(lineSchema).min(1).max(1000),
  /**
   * ID de uma Transaction EXISTENTE na conta bancaria que era pagamento da
   * fatura (foi importada como despesa). Se enviado, RECLASSIFICA pra
   * TRANSFER banco -> cartao. Caso real R$ 2.654,63 Banrisul.
   * Vai mudar isCardPayment=true e businessCreditCardId=cardId.
   */
  reclassificarPagamentoTxId: z.string().cuid().nullable().optional(),
})

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

  let body
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { erro: 'Body inválido', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  // Validar categoryId quando presentes — mesma empresa
  const categoryIds = body.lines
    .map((l) => l.categoryId)
    .filter((c): c is string => !!c)
  if (categoryIds.length > 0) {
    const validCats = await prisma.category.count({
      where: { id: { in: categoryIds }, companyId },
    })
    if (validCats !== new Set(categoryIds).size) {
      return NextResponse.json(
        { erro: 'Alguma categoria não pertence a esta empresa' },
        { status: 400 },
      )
    }
  }

  // Validar tx pra reclassificar (se houver) — tem que ser da mesma empresa
  let reclassTx = null
  if (body.reclassificarPagamentoTxId) {
    reclassTx = await prisma.transaction.findFirst({
      where: {
        id: body.reclassificarPagamentoTxId,
        bankAccount: { companyId },
      },
      select: { id: true, type: true, amount: true, bankAccountId: true, businessCreditCardId: true },
    })
    if (!reclassTx) {
      return NextResponse.json(
        { erro: 'Transação pra reclassificar não encontrada' },
        { status: 400 },
      )
    }
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // Periodo do batch
  const dates = body.lines.map((l) => new Date(l.date).getTime())
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : null

  // OfxImport.bankAccountId é NOT NULL. Usa a conta default do cartão; se
  // não houver, pega a 1ª conta ativa da empresa como placeholder pro
  // master record (compras nao apontam pra bankAccountId).
  let placeholderBankAccountId = card.defaultPaymentBankAccountId
  if (!placeholderBankAccountId) {
    const firstAcc = await prisma.bankAccount.findFirst({
      where: { companyId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!firstAcc) {
      return NextResponse.json(
        {
          erro: 'Empresa não tem nenhuma conta bancária ativa — cadastre uma antes.',
        },
        { status: 400 },
      )
    }
    placeholderBankAccountId = firstAcc.id
  }

  const importRow = await prisma.ofxImport.create({
    data: {
      bankAccountId: placeholderBankAccountId,
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
      fileHash: createHash('sha256').update(JSON.stringify(body.lines)).digest('hex'),
      source: 'CREDIT_CARD_PDF',
    },
  })

  // Computa identidades pra dedup
  const linesWithIdentity = body.lines.map((line) => {
    const identity = computeIdentity({
      accountId: `card:${cardId}`,
      fitid: null,
      date: line.date,
      amount: line.amount,
      type: 'DEBIT',
      memo: line.description,
    })
    return { line, identity }
  })

  // Sprint R4 — Competencia da fatura (YYYY-MM) extraida do vencimento.
  // Caixa 12/06 -> 2026-06; Banrisul 15/06 -> 2026-06. Permite dashboard
  // agrupar por fatura (nao por data da compra, que pode ser velha pra
  // parceladas).
  const invoiceMonth =
    body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
      ? body.dueDate.slice(0, 7)
      : null

  // GroupId por parcelamento (compartilhado pelas N parcelas — neste batch
  // só vem 1 parcela do mês, mas o ID pode ser usado em batches futuros).
  const installmentGroupByLine = new Map<number, string>()
  for (let i = 0; i < body.lines.length; i++) {
    const l = body.lines[i]
    if (l.kind === 'COMPRA_PARCELADA' && l.installmentNumber && l.installmentTotal) {
      installmentGroupByLine.set(
        i,
        createHash('sha1')
          .update(`${cardId}|${l.description}|${l.installmentTotal}|${l.amount}`)
          .digest('hex')
          .slice(0, 16),
      )
    }
  }

  let inseridas = 0
  let duplicadas = 0
  let reclassificadaTxId: string | null = null

  try {
    await prisma.$transaction(async (tx) => {
      const incomingHashes = linesWithIdentity.map((li) => li.identity.contentHash)

      // Dedup explicit: tx existentes na conta cartao com mesmo contentHash
      const existingTx = await tx.transaction.findMany({
        where: {
          businessCreditCardId: cardId,
          contentHash: { in: incomingHashes },
        },
        select: { contentHash: true },
      })
      const blockedHashes = new Set(
        existingTx.map((e) => e.contentHash).filter((c): c is string => !!c),
      )

      const filtered = linesWithIdentity.filter(
        (li) => !blockedHashes.has(li.identity.contentHash),
      )
      duplicadas = linesWithIdentity.length - filtered.length

      if (filtered.length > 0) {
        await tx.transaction.createMany({
          data: filtered.map((li) => {
            const origIdx = linesWithIdentity.findIndex((x) => x === li)
            const line = li.line
            return {
              bankAccountId: null,
              businessCreditCardId: cardId,
              categoryId: line.categoryId ?? null,
              date: new Date(line.date),
              description: line.description,
              amount: line.amount,
              type: 'DEBIT',
              status: 'RECONCILED',
              origin: 'CREDIT_CARD_PDF',
              externalId: null,
              dedupHash: null,  // dedupHash @@unique tem bankAccountId; cartao usa só contentHash
              contentHash: li.identity.contentHash,
              importId: importRow.id,
              installmentNumber: line.installmentNumber ?? null,
              installmentTotal: line.installmentTotal ?? null,
              installmentGroupId: installmentGroupByLine.get(origIdx) ?? null,
              isCardPayment: false,
              invoiceMonth: invoiceMonth,
            }
          }),
        })
        inseridas = filtered.length
      }

      // RECLASSIFICAR pagamento (caso real R$ 2.654,63)
      if (reclassTx) {
        await tx.transaction.update({
          where: { id: reclassTx.id },
          data: {
            isCardPayment: true,
            businessCreditCardId: cardId,
            // Mantém type=DEBIT na conta bancária (saiu dinheiro), mas
            // o filtro isCardPayment=true vai removê-la do DRE como despesa.
            categoryId: null, // remove categoria de despesa que tinha antes
          },
        })
        reclassificadaTxId = reclassTx.id
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
    console.error('[credit-card-pj/confirm] erro persistência:', err)
    return NextResponse.json(
      { erro: 'Erro ao salvar transações', importId: importRow.id },
      { status: 500 },
    )
  }

  console.log('[credit-card-pj/confirm]', {
    companyId,
    cardId,
    importId: importRow.id,
    fileName: body.fileName,
    total: body.lines.length,
    inseridas,
    duplicadas,
    reclassificadaTxId,
  })

  return NextResponse.json({
    importId: importRow.id,
    inseridas,
    duplicadas,
    total: body.lines.length,
    reclassificadaTxId,
  })
}
