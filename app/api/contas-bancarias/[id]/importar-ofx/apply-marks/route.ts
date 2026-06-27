// Sprint OFX V3 Premium (27/06/2026) — POST /apply-marks
//
// Recebe array de marks {transactionId, kind, params}.
// Pra cada tx ja criada, aplica a marcacao SINCRONA (sem race):
//   - RECEITA / DESPESA: cash-code (categoryId + status=RECONCILED + cashCoded=true)
//   - TRANSFER: marca categoryId=null + nota (scanRetroativo pareia depois quando par vier)
//   - PAGAMENTO_CARTAO: isCardPayment=true + businessCreditCardId=cardId + categoryId=null
//   - PAGAMENTO_EMPRESTIMO: marca parcela como PAID + linka tx (delega ao endpoint /parcelas)
//   - IGNORAR: ignoredAt=now + status=IGNORED
//
// Idempotente: se a marcacao ja foi aplicada (ex: tx ja tem isCardPayment=true),
// retorna 'skipped' em vez de erro. Falhas individuais NAO abortam o batch.
//
// CRITICO: nao mexe em origin, fitidKey, contentHash, dedupHash (preserva
// anti-reimport via ImportedIdentity).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isOfxImportV3Enabled } from '@/lib/ofx-v3/feature-flag'
import type { OfxApplyMarksResult, OfxLineKind } from '@/lib/ofx-v3/types'

interface Params { params: Promise<{ id: string }> }

const markSchema = z.object({
  transactionId: z.string().cuid(),
  kind: z.enum(['RECEITA', 'DESPESA', 'TRANSFER', 'PAGAMENTO_CARTAO', 'PAGAMENTO_EMPRESTIMO', 'IGNORAR']),
  params: z
    .object({
      categoryId: z.string().cuid().nullable().optional(),
      supplierId: z.string().cuid().nullable().optional(),
      customerId: z.string().cuid().nullable().optional(),
      criarRegra: z.boolean().optional(),
      cardId: z.string().cuid().nullable().optional(),
      loanId: z.string().cuid().nullable().optional(),
      installmentNumber: z.number().int().min(1).max(480).nullable().optional(),
    })
    .optional()
    .default({}),
})

const bodySchema = z.object({
  marks: z.array(markSchema).min(1).max(2000),
})

export async function POST(request: NextRequest, { params }: Params) {
  if (!isOfxImportV3Enabled()) {
    return NextResponse.json(
      { erro: 'OFX_IMPORT_V3 desativado', code: 'OFX_V3_DISABLED' },
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
      { erro: 'Body inválido', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  // Carrega TODAS as tx envolvidas — multi-tenant + scope da conta
  const txIds = body.marks.map((m) => m.transactionId)
  const txs = await prisma.transaction.findMany({
    where: {
      id: { in: txIds },
      bankAccountId: contaId, // CRITICO: só tx da conta importada
    },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      date: true,
      categoryId: true,
      isCardPayment: true,
      businessCreditCardId: true,
      transferGroupId: true,
      reconciledWithId: true,
      status: true,
      ignoredAt: true,
      cashCoded: true,
    },
  })
  const txById = new Map(txs.map((t) => [t.id, t]))

  const result: OfxApplyMarksResult = { applied: 0, skipped: 0, failed: [] }

  for (const mark of body.marks) {
    const tx = txById.get(mark.transactionId)
    if (!tx) {
      result.failed.push({
        transactionId: mark.transactionId,
        kind: mark.kind,
        error: 'tx não encontrada nesta conta',
      })
      continue
    }
    try {
      const r = await applyMark(tx, mark.kind, mark.params ?? {}, conta.companyId, user.sub)
      if (r === 'applied') result.applied++
      else result.skipped++
    } catch (err) {
      result.failed.push({
        transactionId: mark.transactionId,
        kind: mark.kind,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json(result)
}

type AppliedResult = 'applied' | 'skipped'

async function applyMark(
  tx: {
    id: string
    type: string
    amount: number
    description: string
    date: Date
    categoryId: string | null
    isCardPayment: boolean
    businessCreditCardId: string | null
    transferGroupId: string | null
    status: string
    ignoredAt: Date | null
    cashCoded: boolean
  },
  kind: OfxLineKind,
  params: NonNullable<z.infer<typeof markSchema>['params']>,
  companyId: string,
  userId: string,
): Promise<AppliedResult> {
  switch (kind) {
    case 'RECEITA':
    case 'DESPESA': {
      if (!params.categoryId) throw new Error('categoryId obrigatório pra RECEITA/DESPESA')
      // Idempotente: se já tem essa categoria + cashCoded, skip
      if (tx.categoryId === params.categoryId && tx.cashCoded) return 'skipped'
      const cat = await prisma.category.findFirst({
        where: { id: params.categoryId, companyId },
        select: { id: true, type: true },
      })
      if (!cat) throw new Error('categoria inválida')
      // Coerência: RECEITA → categoria INCOME; DESPESA → EXPENSE
      if (kind === 'RECEITA' && cat.type !== 'INCOME')
        throw new Error('categoria escolhida não é receita')
      if (kind === 'DESPESA' && cat.type !== 'EXPENSE')
        throw new Error('categoria escolhida não é despesa')
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          categoryId: params.categoryId,
          supplierId: params.supplierId ?? undefined,
          customerId: params.customerId ?? undefined,
          status: 'RECONCILED',
          cashCoded: true,
          cashCodedAt: new Date(),
        },
      })
      return 'applied'
    }

    case 'TRANSFER': {
      // Estratégia MVP: marca categoryId=null + nota informativa.
      // O scanRetroativo já roda pos-import e tenta parear automaticamente
      // contra tx do outro banco quando ele for importado (Sprint Transfer
      // Pairing Retroativo). User vê em /transferencias > Sozinhas se
      // ficar sem par.
      // NAO mudar type=DEBIT->TRANSFER aqui pra preservar contentHash/sinal
      // exato no seen-ledger (Sprint Import Idempotente). Conversão pra
      // TRANSFER acontece quando o par real aparece e scanRetroativo pareia.
      if (tx.transferGroupId) return 'skipped' // já pareado
      if (tx.categoryId === null && (tx.status === 'PENDING' || tx.status === 'RECONCILED')) {
        // Apenas garante que está marcada como "aguardando" via notes
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { notes: '[V3:AGUARDANDO_PAR_TRANSFERENCIA]' },
        })
        return 'applied'
      }
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          categoryId: null,
          notes: '[V3:AGUARDANDO_PAR_TRANSFERENCIA]',
        },
      })
      return 'applied'
    }

    case 'PAGAMENTO_CARTAO': {
      if (!params.cardId) throw new Error('cardId obrigatório')
      // Idempotente: se já casado com esse cartão, skip
      if (tx.isCardPayment && tx.businessCreditCardId === params.cardId) return 'skipped'
      const card = await prisma.businessCreditCard.findFirst({
        where: { id: params.cardId, companyId },
        select: { id: true },
      })
      if (!card) throw new Error('cartão inválido')
      if (tx.type !== 'DEBIT') throw new Error('apenas DEBIT pode ser pagamento de cartão')
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          isCardPayment: true,
          businessCreditCardId: params.cardId,
          categoryId: null, // pagamento de cartão não é despesa direta
        },
      })
      return 'applied'
    }

    case 'PAGAMENTO_EMPRESTIMO': {
      if (!params.loanId || params.installmentNumber == null)
        throw new Error('loanId e installmentNumber obrigatórios')
      if (tx.type !== 'DEBIT') throw new Error('apenas DEBIT pode ser pagamento de parcela')
      const loan = await prisma.loan.findFirst({
        where: { id: params.loanId, companyId },
        select: { id: true, bankAccountId: true },
      })
      if (!loan) throw new Error('empréstimo inválido')
      const installment = await prisma.loanInstallment.findFirst({
        where: { loanId: params.loanId, number: params.installmentNumber },
        select: { id: true, status: true, reconciledTransactionId: true },
      })
      if (!installment) throw new Error('parcela não encontrada')
      // Idempotente
      if (installment.reconciledTransactionId === tx.id) return 'skipped'
      if (installment.reconciledTransactionId)
        throw new Error('parcela já conciliada com outra tx')
      // Reusa o padrão do endpoint /parcelas/[number] POST
      await prisma.$transaction(async (trx) => {
        await trx.loanInstallment.update({
          where: { id: installment.id },
          data: {
            status: 'PAID',
            paidDate: tx.date,
            reconciledTransactionId: tx.id,
          },
        })
        const remaining = await trx.loanInstallment.count({
          where: { loanId: params.loanId!, status: { not: 'PAID' } },
        })
        if (remaining === 0) {
          await trx.loan.update({
            where: { id: params.loanId! },
            data: { status: 'PAID_OFF' },
          })
        }
      })
      // Silenciar warning de "userId não usado" — caller pode logar audit
      void userId
      return 'applied'
    }

    case 'IGNORAR': {
      if (tx.ignoredAt) return 'skipped'
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          ignoredAt: new Date(),
          status: 'IGNORED',
        },
      })
      return 'applied'
    }
  }
}
