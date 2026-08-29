// Sprint OFX V3 Premium (27/06/2026) — POST /apply-marks
//
// Recebe array de marks {transactionId, kind, params}.
// Pra cada tx ja criada, aplica a marcacao SINCRONA (sem race):
//   - RECEITA / DESPESA: cash-code (categoryId + status=RECONCILED + cashCoded=true)
//   - TRANSFER: marca categoryId=null + nota (scanRetroativo pareia depois quando par vier)
// ⚠️ A LÓGICA SAIU DAQUI (29/08) → lib/ofx-v3/aplicar-marcacao.ts, porque o import passou
// a aplicar as marcações DENTRO da sua transação (atomicidade). Esta rota continua viva
// pro caminho legado e pro retry manual — casca fina sobre a MESMA função (REGRA 4).
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
import { aplicarMarcacao } from '@/lib/ofx-v3/aplicar-marcacao'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isOfxImportV3Enabled } from '@/lib/ofx-v3/feature-flag'
import type { OfxApplyMarksResult, OfxLineKind } from '@/lib/ofx-v3/types'
import { resolvePaidInvoiceMonth } from '@/lib/credit-card-pj/resolve-paid-month'

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
      const r = await aplicarMarcacao(tx, mark.kind, mark.params ?? {}, conta.companyId, user.sub, prisma)
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
