// GET /api/empresas/[id]/transferencias/sugestoes
//
// Sprint Central de Transferências — varredura retroativa.
// Cruza tx órfãs (sem transferGroupId + não-dismissed) e retorna pares
// candidatos com score ≥0.85.
//
// Cache 1h via revalidate (Sprint Central de Transferências decisão #4).
// User pode forçar refresh chamando POST /confirmar ou /recusar.

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

// Janela default: últimos 12 meses (configurável via ?months=N)
const DEFAULT_MONTHS = 12

async function runDetect(empresaId: string, months: number) {
  // Carrega refs da empresa pra sinais "OWN ENTITY"
  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: {
      cnpj: true,
      name: true,
      tradeName: true,
    },
  })
  if (!empresa) {
    return { error: 'Empresa não encontrada', status: 404 }
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

  // Janela de tempo
  const since = new Date()
  since.setMonth(since.getMonth() - months)

  // Carrega tx órfãs (sem par + não-dismissed) da empresa
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
    take: 5000, // teto de segurança pra perf
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

  return { result, refs, txCount: txs.length }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sp = new URL(request.url).searchParams
    const months = Math.max(1, Math.min(36, Number(sp.get('months')) || DEFAULT_MONTHS))

    // Sem cache por ora — recalcula a cada GET. Pra empresas de 100-5000 tx
    // roda em <500ms. Adicionar cache 1h depois se necessário.
    const data = await runDetect(empresaId, months)
    if ('error' in data) {
      return NextResponse.json({ erro: data.error }, { status: data.status })
    }

    return NextResponse.json({
      pairs: data.result.pairs.map((p) => ({
        from: {
          id: p.from.id,
          bankAccountId: p.from.bankAccountId,
          bankAccountName: p.from.bankAccountName,
          date: p.from.date.toISOString(),
          amount: p.from.amount,
          description: p.from.description,
        },
        to: {
          id: p.to.id,
          bankAccountId: p.to.bankAccountId,
          bankAccountName: p.to.bankAccountName,
          date: p.to.date.toISOString(),
          amount: p.to.amount,
          description: p.to.description,
        },
        confidence: p.confidence,
        evidences: p.evidences,
      })),
      lonely: data.result.lonely.map((l) => ({
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
        txScanned: data.txCount,
        months,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

