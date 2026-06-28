// Sprint Transfer-Pairing-Retroativo (16/06/2026).
//
// POST /api/empresas/[id]/transferencias/scan-retroativo
//
// Varre tx OFX órfãs (transferGroupId=null) de TODAS as contas da empresa
// dos últimos N dias e propõe pares de transferência interna.
//
// Body: {
//   dias?: number (default 7, max 90)
//   dryRun?: boolean (default true)
//   minConfidence?: number (default 0.70 = CONFIRM_THRESHOLD)
//   applyLevel?: 'HIGH' | 'HIGH_AND_MEDIUM' (default 'HIGH' — só auto-parea HIGH+nameOk)
// }
//
// Resposta:
//   - candidates: array com from/to/score/level/nameMatchOk/evidences
//   - stats: { high, mediumOnly, pairableSafely, applied }
//   - applied: array de transferGroupIds criados (vazio se dryRun)
//
// Multi-tenant: scoped por companyId; refs.names inclui SocioPF.nome (caso
// real Yussef: transferências internas passam pelo nome do dono na descrição
// do PIX).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'node:crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  scanRetroativo,
  type OrphanTxForScan,
} from '@/lib/transfers/scan-retroativo'
import {
  type OwnEntityRefs,
} from '@/lib/transfers/own-entity-signals'

const bodySchema = z.object({
  dias: z.coerce.number().int().min(1).max(90).default(7),
  dryRun: z.coerce.boolean().default(true),
  minConfidence: z.coerce.number().min(0).max(1).default(0.7),
  applyLevel: z.enum(['HIGH', 'HIGH_AND_MEDIUM']).default('HIGH'),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json().catch(() => ({}))
    const input = bodySchema.parse(body)

    const sinceMs = Date.now() - input.dias * 24 * 60 * 60 * 1000
    const sinceDate = new Date(sinceMs)

    // 1) Sprint Owner Detection (28/06/2026): refs centralizadas via helper.
    // Inclui CPF + nome dos sócios como sinais separados (CPF=FORTE,
    // nome=MEDIO). Antes o nome do dono entrava em `names` com peso
    // errado (sinal de "nome empresa").
    const { loadOwnEntityRefs } = await import('@/lib/transfers/load-own-entity-refs')
    const refs: OwnEntityRefs = await loadOwnEntityRefs(prisma, empresaId)
    const empresaAccounts = await prisma.bankAccount.findMany({
      where: { companyId: empresaId, isActive: true },
      select: { id: true },
    })
    if (refs.cnpj === null && refs.names.length === 0 && refs.ownerNames.length === 0) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    }

    // 2) Tx OFX órfãs da empresa dos últimos N dias
    const accountIds = empresaAccounts.map((a) => a.id)
    const orphanRows = await prisma.transaction.findMany({
      where: {
        bankAccountId: { in: accountIds },
        origin: 'OFX',
        lifecycle: 'EFFECTED',
        transferGroupId: null,
        type: { in: ['CREDIT', 'DEBIT'] },
        date: { gte: sinceDate },
        reconciledWithId: null,
        reconciledFrom: { none: {} },
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
      orderBy: { date: 'asc' },
    })

    const txs: OrphanTxForScan[] = orphanRows.map((r) => ({
      id: r.id,
      bankAccountId: r.bankAccountId!,
      bankAccountName: r.bankAccount?.name ?? '',
      date: r.date,
      type: r.type as 'CREDIT' | 'DEBIT',
      amount: r.amount,
      description: r.description,
    }))

    // 3) Scan
    const scan = scanRetroativo({
      txs,
      refs,
      minConfidence: input.minConfidence,
    })

    // 4) Serializar candidatos pra UI
    const candidates = scan.pairs.map((p) => ({
      level: p.level,
      confidence: Math.round(p.confidence * 100) / 100,
      nameMatchOk: p.nameMatchOk,
      deltaDays: p.deltaDays,
      evidences: p.evidences,
      from: {
        id: p.from.id,
        bankAccountId: p.from.bankAccountId,
        bankAccountName: p.from.bankAccountName,
        date: p.from.date.toISOString().slice(0, 10),
        amount: p.from.amount,
        description: p.from.description,
      },
      to: {
        id: p.to.id,
        bankAccountId: p.to.bankAccountId,
        bankAccountName: p.to.bankAccountName,
        date: p.to.date.toISOString().slice(0, 10),
        amount: p.to.amount,
        description: p.to.description,
      },
    }))

    // 5) Apply (só se dryRun=false)
    const applied: Array<{
      transferGroupId: string
      fromTxId: string
      toTxId: string
      amount: number
      date: string
    }> = []
    const skipped: Array<{ fromTxId: string; toTxId: string; reason: string }> = []

    if (!input.dryRun) {
      const toApply = scan.pairs.filter((p) => {
        if (!p.nameMatchOk) return false
        if (input.applyLevel === 'HIGH') return p.level === 'HIGH'
        return p.level === 'HIGH' || p.level === 'MEDIUM'
      })

      if (toApply.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const p of toApply) {
            const groupId = crypto.randomUUID()
            const r1 = await tx.transaction.updateMany({
              where: {
                id: p.from.id,
                transferGroupId: null, // anti-race
                type: 'DEBIT',
              },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: 'OUT',
                status: 'RECONCILED',
              },
            })
            const r2 = await tx.transaction.updateMany({
              where: {
                id: p.to.id,
                transferGroupId: null,
                type: 'CREDIT',
              },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: 'IN',
                status: 'RECONCILED',
              },
            })
            if (r1.count === 1 && r2.count === 1) {
              applied.push({
                transferGroupId: groupId,
                fromTxId: p.from.id,
                toTxId: p.to.id,
                amount: p.from.amount,
                date: p.from.date.toISOString().slice(0, 10),
              })
            } else {
              skipped.push({
                fromTxId: p.from.id,
                toTxId: p.to.id,
                reason: `race-condition: from updated ${r1.count}, to updated ${r2.count}`,
              })
              // Reverte se um lado pareou e outro não
              if (r1.count === 1 && r2.count !== 1) {
                await tx.transaction.update({
                  where: { id: p.from.id },
                  data: {
                    type: 'DEBIT',
                    transferGroupId: null,
                    transferDirection: null,
                    status: 'PENDING',
                  },
                })
              }
              if (r2.count === 1 && r1.count !== 1) {
                await tx.transaction.update({
                  where: { id: p.to.id },
                  data: {
                    type: 'CREDIT',
                    transferGroupId: null,
                    transferDirection: null,
                    status: 'PENDING',
                  },
                })
              }
            }
          }
        })
      }
    }

    return NextResponse.json({
      stats: {
        orphansScanned: txs.length,
        candidates: candidates.length,
        high: scan.high,
        mediumOnly: scan.mediumOnly,
        pairableSafely: scan.pairableSafely,
        applied: applied.length,
        skipped: skipped.length,
      },
      candidates,
      applied,
      skipped,
      meta: {
        dias: input.dias,
        dryRun: input.dryRun,
        minConfidence: input.minConfidence,
        applyLevel: input.applyLevel,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
