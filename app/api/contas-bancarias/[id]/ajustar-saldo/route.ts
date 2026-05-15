// POST /api/contas-bancarias/[id]/ajustar-saldo — Sprint 1.5.
//
// Cria um lançamento de ajuste que faz o saldo do sistema bater com o saldo
// real do extrato bancário. Caso de uso: conta criada com saldo errado (ex: 0)
// + OFX importado por cima → saldo do sistema ≠ saldo do banco.
//
// O lançamento usa categoria com dreGroup='AJUSTE_SALDO' (não infla DRE).
// Data = 1 dia antes da transação mais antiga (mantém timeline do saldo
// cumulativo correta) ou ontem se a conta não tiver transações.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { buildBalanceAdjustment } from '@/lib/balance/adjust'

interface Params {
  params: Promise<{ id: string }>
}

// Limite de sanity: evita erro de digitação (ex: 10 bilhões). ±R$ 1 bilhão.
const MAX_ABS_BALANCE = 1_000_000_000

const ajustarSaldoSchema = z.object({
  // Pode ser negativo (cheque especial). Limitado pra evitar typo gigante.
  saldoCorreto: z.coerce
    .number({ invalid_type_error: 'Saldo deve ser um número' })
    .min(-MAX_ABS_BALANCE, 'Valor fora do limite permitido')
    .max(MAX_ABS_BALANCE, 'Valor fora do limite permitido'),
  motivo: z.string().max(200).optional(),
})

const CATEGORIA_AJUSTE_NOME = 'Ajuste de Saldo'

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: contaId } = await params
    const body = await request.json()
    const { saldoCorreto, motivo } = ajustarSaldoSchema.parse(body)

    // 1. Fetch conta
    const conta = await prisma.bankAccount.findUnique({
      where: { id: contaId },
      select: { id: true, companyId: true, name: true, balance: true },
    })
    if (!conta) {
      return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
    }

    // 2. RBAC
    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('transaction.create')

    // 3. Calcula o ajuste necessário (função pura)
    const adjustment = buildBalanceAdjustment({
      currentBalance: conta.balance,
      targetBalance: saldoCorreto,
    })

    if (!adjustment.needed) {
      return NextResponse.json({
        mensagem: 'O saldo já está correto. Nenhum ajuste necessário.',
        saldoAtual: conta.balance,
      })
    }

    // 4. Data do ajuste: 1 dia antes da transação mais antiga da conta.
    //    Mantém o saldo cumulativo (sparkline) correto desde o início.
    //    Fallback: ontem, se a conta não tiver transações.
    const txMaisAntiga = await prisma.transaction.findFirst({
      where: { bankAccountId: contaId },
      orderBy: { date: 'asc' },
      select: { date: true },
    })
    const adjustmentDate = new Date(
      (txMaisAntiga?.date ?? new Date()).getTime() - 24 * 60 * 60 * 1000,
    )

    // 5. find-or-create categoria "Ajuste de Saldo" da empresa
    let categoria = await prisma.category.findFirst({
      where: { companyId: conta.companyId, name: CATEGORIA_AJUSTE_NOME },
      select: { id: true },
    })
    if (!categoria) {
      categoria = await prisma.category.create({
        data: {
          companyId: conta.companyId,
          name: CATEGORIA_AJUSTE_NOME,
          // type da categoria é cosmético (DRE usa dreGroup). TRANSFER = neutro.
          type: 'TRANSFER',
          dreGroup: 'AJUSTE_SALDO',
          color: '#6B7280',
          description:
            'Lançamentos técnicos que ajustam o saldo do sistema ao extrato real do banco. Não entram no DRE.',
          isSystemDefault: true,
        },
        select: { id: true },
      })
    }

    // 6. Atomic: cria transação de ajuste + atualiza saldo cacheado
    const [transacao, contaAtualizada] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          bankAccountId: contaId,
          categoryId: categoria.id,
          date: adjustmentDate,
          competenceDate: adjustmentDate,
          paymentDate: adjustmentDate,
          description: `Ajuste de saldo inicial — ${conta.name}`,
          amount: adjustment.amount,
          type: adjustment.type,
          status: 'RECONCILED',
          origin: 'MANUAL',
          notes: motivo ?? null,
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      }),
      prisma.bankAccount.update({
        where: { id: contaId },
        data: { balance: { increment: adjustment.balanceDelta } },
        select: { id: true, name: true, balance: true },
      }),
    ])

    // 7. Audit log
    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'BalanceAdjustment',
      entityId: transacao.id,
      metadata: {
        bankAccountId: contaId,
        bankAccountName: conta.name,
        saldoAnterior: conta.balance,
        saldoNovo: contaAtualizada.balance,
        diferenca: adjustment.difference,
        tipo: adjustment.type,
        motivo: motivo ?? null,
        adjustmentDate: adjustmentDate.toISOString(),
      },
      request,
    })

    return NextResponse.json(
      {
        transacao,
        saldoAnterior: conta.balance,
        saldoNovo: contaAtualizada.balance,
        diferenca: adjustment.difference,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
