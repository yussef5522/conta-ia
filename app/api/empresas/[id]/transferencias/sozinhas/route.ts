// GET /api/empresas/[id]/transferencias/sozinhas
//
// Sprint Central de Transferências — Aba 3.
// Retorna tx ÓRFÃS (sem par) que TÊM sinais fortes de transferência interna
// (CNPJ próprio, nome da empresa, nome de outra conta, keyword TRANSF/PIX_DEB).
// Significa "essa parece transferência, mas o outro lado ainda não foi
// importado — importe o extrato do banco destino".

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  findRetroactivePairs,
  type TxForDetect,
} from '@/lib/transfers/detect-retroactive'
import {
  normalizeCnpj,
  type OwnEntityRefs,
} from '@/lib/transfers/own-entity-signals'

interface Params {
  params: Promise<{ id: string }>
}

const DEFAULT_MONTHS = 12

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sp = new URL(request.url).searchParams
    const months = Math.max(
      1,
      Math.min(36, Number(sp.get('months')) || DEFAULT_MONTHS),
    )

    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { cnpj: true, name: true, tradeName: true },
    })
    if (!empresa) {
      return NextResponse.json(
        { erro: 'Empresa não encontrada' },
        { status: 404 },
      )
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId: empresaId, isActive: true },
      select: { id: true, name: true },
    })

    const refs: OwnEntityRefs = {
      cnpj: normalizeCnpj(empresa.cnpj),
      names: [empresa.tradeName, empresa.name].filter(
        (n): n is string => n !== null && n !== '',
      ),
      accountNames: bankAccounts.map((a) => a.name),
    }

    const since = new Date()
    since.setMonth(since.getMonth() - months)

    const txs = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        type: { in: ['CREDIT', 'DEBIT'] },
        transferGroupId: null,
        transferDismissedAt: null,
        isInternalTransfer: false,
        date: { gte: since },
      },
      select: {
        id: true,
        bankAccountId: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        bankAccount: { select: { name: true } },
      },
      take: 5000,
    })

    const txsForDetect: TxForDetect[] = txs.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId ?? '',
      bankAccountName: t.bankAccount?.name ?? '?',
      date: t.date,
      type: t.type as 'CREDIT' | 'DEBIT',
      amount: t.amount,
      description: t.description,
    }))

    const result = findRetroactivePairs(txsForDetect, refs)

    return NextResponse.json({
      lonely: result.lonely.map((l) => ({
        tx: {
          id: l.tx.id,
          bankAccountName: l.tx.bankAccountName,
          date: l.tx.date.toISOString(),
          type: l.tx.type,
          amount: l.tx.amount,
          description: l.tx.description,
        },
        signals: l.signals,
        signalCount: l.signalCount,
      })),
      meta: {
        txScanned: txs.length,
        months,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
