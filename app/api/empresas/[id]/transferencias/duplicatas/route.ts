// Sprint R1 (10/06/2026) — GET /api/empresas/[id]/transferencias/duplicatas
//
// Detecta OFX órfãs (transferGroupId IS NULL + sem dismiss) que coincidem
// com lado MANUAL já pareado de um grupo TRANSFER existente:
//   - Mesma conta
//   - Mesmo amount ±0.015
//   - Janela ≤ 2 dias
//
// Caso real (Gap 2): Stone OFX CREDIT +R$ 8.000 entrou via reimport,
// duplicando o lado MANUAL +R$ 8.000 do grupo já pareado (Sicredi → Stone).
//
// Retorna lista pra UI mostrar "Possível duplicata" — usuário decide
// (ignorar alerta vs deletar a OFX). NUNCA deleta nada sozinho.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  findRetroactivePairs,
  type TxForDetect,
  type PairedTxForDetect,
} from '@/lib/transfers/detect-retroactive'
import { type OwnEntityRefs } from '@/lib/transfers/own-entity-signals'

interface Params {
  params: Promise<{ id: string }>
}

// Janela padrão: 30 dias (suficiente pra pegar reimport recente sem peso)
const DEFAULT_DAYS = 30

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sp = new URL(request.url).searchParams
    const days = Math.max(1, Math.min(90, Number(sp.get('days')) || DEFAULT_DAYS))

    // Sprint Owner Detection (28/06/2026): refs centralizadas via helper
    const { loadOwnEntityRefs } = await import('@/lib/transfers/load-own-entity-refs')
    const refs: OwnEntityRefs = await loadOwnEntityRefs(prisma, empresaId)
    if (refs.cnpj === null && refs.names.length === 0 && refs.ownerNames.length === 0) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Órfãs candidatas (CREDIT/DEBIT, sem grupo, sem dismiss)
    const orfas = await prisma.transaction.findMany({
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
        origin: true,
        bankAccount: { select: { name: true } },
      },
      take: 5000,
    })

    // Pareadas (TRANSFER com grupo, mesma janela)
    const pareadas = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: empresaId },
        type: 'TRANSFER',
        transferGroupId: { not: null },
        date: { gte: since },
      },
      select: {
        id: true,
        bankAccountId: true,
        date: true,
        type: true,
        amount: true,
        description: true,
        transferGroupId: true,
        bankAccount: { select: { name: true } },
      },
      take: 5000,
    })

    const orfasForDetect: TxForDetect[] = orfas.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId ?? '',
      bankAccountName: t.bankAccount?.name ?? '?',
      date: t.date,
      type: t.type as 'CREDIT' | 'DEBIT',
      amount: t.amount,
      description: t.description,
    }))

    const pareadasForDetect: PairedTxForDetect[] = pareadas.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId ?? '',
      bankAccountName: t.bankAccount?.name ?? '?',
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      transferGroupId: t.transferGroupId!,
    }))

    const result = findRetroactivePairs(orfasForDetect, refs, pareadasForDetect)

    // Enriquece duplicates com origin da órfã + nomes pra UI
    const orfaById = new Map(orfas.map((o) => [o.id, o]))
    const pareadaById = new Map(pareadas.map((p) => [p.id, p]))

    const duplicatas = result.duplicates.map((d) => {
      const orfaRow = orfaById.get(d.orphan.id)
      const pairedRow = pareadaById.get(d.pairedSide.id)
      return {
        orphan: {
          id: d.orphan.id,
          bankAccountName: d.orphan.bankAccountName,
          date: d.orphan.date.toISOString(),
          type: d.orphan.type,
          amount: d.orphan.amount,
          description: d.orphan.description,
          origin: orfaRow?.origin ?? 'OFX',
        },
        pairedSide: {
          id: d.pairedSide.id,
          bankAccountName: d.pairedSide.bankAccountName,
          date: d.pairedSide.date.toISOString(),
          amount: d.pairedSide.amount,
          description: d.pairedSide.description,
        },
        transferGroupId: d.transferGroupId,
        deltaDays: d.deltaDays,
        // Hint pra UI: se órfã é OFX e pareada é MANUAL, é o cenário típico
        // de "Replace OFX criou MANUAL + reimport trouxe OFX nova" (Stone 8k).
        scenario:
          orfaRow?.origin === 'OFX' ? 'OFX_AFTER_MANUAL_PAIR' : 'OTHER',
      }
    })

    return NextResponse.json({
      duplicatas,
      meta: {
        days,
        orfasScanned: orfas.length,
        pareadasScanned: pareadas.length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
