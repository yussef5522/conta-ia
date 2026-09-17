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
import { createOfxImportRecord } from '@/lib/ofx/persist-import'
import { checkCreditCardPjFlag } from '@/lib/credit-card-pj/feature-flag'
import { identidadeDaLinha, tipoDaLinha } from '@/lib/credit-card-pj/identidade-da-linha'
import { fecharImport } from '@/lib/credit-card-pj/fechamento-do-import'

interface Params { params: Promise<{ id: string; cardId: string }> }

const lineSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  kind: z.enum(['COMPRA_AVISTA', 'COMPRA_PARCELADA', 'ENCARGO_FINANCEIRO', 'ESTORNO']),
  // IGNORAR nao chega aqui (UI filtra antes). ESTORNO entra como CREDIT (reduz despesa).
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
  totalToPay: z.number().nullable().optional(),
  availableLimit: z.number().nullable().optional(),
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

  // Sprint rawOfxBlob (13/08): cartão também grava o cru. Aqui o "cru" é o JSON
  // das linhas da fatura (o PDF já foi parseado no preview); é o que o sistema
  // recebeu e decidiu importar. Mesmo ponto obrigatório (createOfxImportRecord).
  const rawLines = JSON.stringify(body.lines)
  const importRow = await createOfxImportRecord(prisma, {
    bankAccountId: placeholderBankAccountId,
    userId: user.sub,
    fileName: body.fileName,
    fileSize: body.fileSizeBytes,
    rawOfx: rawLines,
    fileHash: createHash('sha256').update(rawLines).digest('hex'),
    source: 'CREDIT_CARD_PDF',
    ipAddress,
    userAgent,
    totalTransactions: body.lines.length,
    periodStart,
    periodEnd,
  })

  // Sprint Fatura-Estorno (14/08): o import cobra a validação da FATURA (não só o
  // Total cartão). compras+encargos − estornos TEM que fechar com "Total desta
  // Fatura" (totalToPay). Se não fecha, NÃO grava (impossibilidade). Sem totalToPay
  // (banco sem esse campo) pula — não bloqueia leitura legítima.
  // Computa identidades pra dedup. ESTORNO é CREDIT (não colide com um débito de mesmo valor).
  // ⚠️ SOBE pra antes da conferência: é a mesma chave que parte novas × já-no-sistema.
  const linesWithIdentity = body.lines.map((line) => {
    // ⭐ a MESMA conta do preview — ver `identidadeDaLinha` (17/09)
    const identity = { contentHash: identidadeDaLinha(cardId, { date: line.date, description: line.description, amount: line.amount, kind: line.kind }) }
    return { line, identity }
  })

  // ⭐ a competência sobe pra CÁ: a conferência precisa dela pra achar o que já está gravado
  const invoiceMonth =
    body.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)
      ? body.dueDate.slice(0, 7)
      : null

  /**
   * ⭐⭐⭐ IMPORT MISTO FECHA POR `Σ(novas) + Σ(já no sistema)` (17/09/2026).
   *
   * ⛔⛔ Antes isto exigia que as linhas ENVIADAS fechassem sozinhas com o total — e a tela
   * de ontem passou a **impedir de marcar** as já-no-sistema (sem checkbox, em leitura). As
   * duas coisas juntas tornavam o import misto **impossível de gravar**: a diferença acusada
   * era, ao centavo, o que a própria tela tinha tirado da mão do dono.
   *
   * ⚠️ É a segunda régua de novo, agora entre **preview e confirm** — a dupla que já custou
   * o import de OFX inteiro. A partição aqui é a MESMA da tela porque nasce do mesmo
   * `contentHash`; o validador não inventa "o que é novo".
   *
   * ⛔ E a defesa NÃO afrouxou: em fatura 100% nova não há nada gravado, `jaNoSistema` é 0, e
   * o fechamento continua exigindo a soma cheia.
   */
  if (body.totalToPay != null) {
    const gravadas = invoiceMonth
      ? await prisma.transaction.findMany({
          where: { businessCreditCardId: cardId, invoiceMonth },
          select: { type: true, amount: true, contentHash: true, isCardPayment: true },
        })
      : []
    const f = fecharImport(
      linesWithIdentity.map((li) => ({
        kind: li.line.kind, amount: li.line.amount, contentHash: li.identity.contentHash,
      })),
      gravadas,
    )
    const diff = Math.round((body.totalToPay - f.net) * 100) / 100
    if (Math.abs(diff) > 0.02) {
      return NextResponse.json(
        {
          erro:
            `A fatura não fecha: R$ ${f.novas.toFixed(2)} nas linhas novas`
            + (f.jaNoSistema !== 0 ? ` + R$ ${f.jaNoSistema.toFixed(2)} já no sistema` : '')
            + ` = R$ ${f.net.toFixed(2)}, contra o Total desta Fatura de R$ ${body.totalToPay.toFixed(2)} `
            + `(diferença R$ ${diff.toFixed(2)}). `
            + `Confira se há estorno não marcado como Estorno, ou linha faltando/sobrando — não vou gravar sem fechar.`,
          code: 'VALIDATION_FAILED',
        },
        { status: 422 },
      )
    }
  }


  // Sprint R4 — Competencia da fatura (YYYY-MM) extraida do vencimento.
  // Caixa 12/06 -> 2026-06; Banrisul 15/06 -> 2026-06. Permite dashboard
  // agrupar por fatura (nao por data da compra, que pode ser velha pra
  // parceladas).
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
              // ESTORNO = crédito no cartão (devolução) → reduz a despesa; o resto é compra/encargo.
              type: tipoDaLinha(line.kind),
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

      // R5: grava metadata da fatura no cartao pra detector poder achar
      // candidatos por valor exato no dashboard
      if (invoiceMonth || body.totalDeclared || body.totalToPay) {
        await tx.businessCreditCard.update({
          where: { id: cardId },
          data: {
            lastInvoiceMonth: invoiceMonth,
            lastInvoiceTotalDeclared: body.totalDeclared ?? null,
            lastInvoiceTotalToPay: body.totalToPay ?? null,
            lastInvoiceAvailableLimit: body.availableLimit ?? null,
          },
        })
      }
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
