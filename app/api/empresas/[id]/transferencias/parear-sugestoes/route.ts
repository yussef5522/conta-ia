// Sprint Parear-Transferencias (01/07/2026).
//
// GET /api/empresas/[id]/transferencias/parear-sugestoes
//
// Retorna pares candidatos a virar transferência via /api/transferencias/pair-pendentes.
// Regras (idênticas ao buildPairPendentes pra que TODAS as sugestões passem
// nas validações do endpoint):
//   - Ambas PENDING
//   - Contas diferentes DA MESMA EMPRESA
//   - Tipos opostos (1 DEBIT + 1 CREDIT)
//   - Valor idêntico (±0.01)
//   - Datas ±3 dias
//
// READ-ONLY. Zero mutação.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { isUnifiedTransferEnabled } from '@/lib/transfers/unified-transfer-flag'
import { detectTransfersForCompany } from '@/lib/transfers/detect-transfers-for-company'

export const runtime = 'nodejs'

export interface PearTxOption {
  id: string
  date: string
  amount: number
  description: string
  bankAccountId: string
  bankAccountName: string
}

export interface ParearSugestao {
  /** id determinístico do par (debitId + creditId) — usado como key React. */
  key: string
  debit: PearTxOption
  credit: PearTxOption
  daysApart: number
  sameDay: boolean
  // Motor único (FASE 4): explicabilidade + confiança. Presentes com a flag ON.
  layer?: 'DETERMINISTIC' | 'STRONG' | 'WEAK'
  confidence?: number
  evidences?: string[]
}

export interface ParearSugestoesResponse {
  sugestoes: ParearSugestao[]
  totalDebitPending: number
  totalCreditPending: number
  /** 'unified' quando o motor único está ligado (drop 2× PENDING). */
  engine?: 'unified' | 'legacy'
  /** Motor único: TODAS as órfãs pro CAMINHO MANUAL (incl. RECONCILED). */
  manualDebits?: PearTxOption[]
  manualCredits?: PearTxOption[]
}

const DAYS_WINDOW = 3

function daysBetween(a: Date, b: Date): number {
  const ONE_DAY = 86400000
  return Math.abs(Math.round((a.getTime() - b.getTime()) / ONE_DAY))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // ── FASE 4 (10/08): MOTOR ÚNICO atrás de flag. Tela 2 (/parear).
    // Fonte ÚNICA (detectTransfersForCompany) = MESMA do banner → concordam.
    // Sugestões só das camadas 1+2. A regra "2× PENDING" SAI: as órfãs do
    // manual incluem RECONCILED (o par com uma perna já reconciliada aparece).
    if (isUnifiedTransferEnabled()) {
      const MS_DAY = 86400000
      const { suggestions } = await detectTransfersForCompany(empresaId, { matchOwnerName: true })
      // Órfãs pro CAMINHO MANUAL — recente (120d), incl. RECONCILED (não só PENDING).
      const orfas = await prisma.transaction.findMany({
        where: {
          bankAccount: { companyId: empresaId, isActive: true },
          type: { in: ['CREDIT', 'DEBIT'] },
          lifecycle: 'EFFECTED',
          transferGroupId: null,
          transferDismissedAt: null,
          isInternalTransfer: false,
          date: { gte: new Date(Date.now() - 120 * MS_DAY) },
        },
        select: { id: true, date: true, amount: true, description: true, type: true, bankAccountId: true, bankAccount: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 400,
      })
      const opt = (t: (typeof orfas)[number]): PearTxOption => ({
        id: t.id, date: t.date.toISOString(), amount: t.amount, description: t.description,
        bankAccountId: t.bankAccountId!, bankAccountName: t.bankAccount?.name ?? '—',
      })
      const manualDebits = orfas.filter((t) => t.type === 'DEBIT' && t.bankAccountId).map(opt)
      const manualCredits = orfas.filter((t) => t.type === 'CREDIT' && t.bankAccountId).map(opt)
      return NextResponse.json<ParearSugestoesResponse>({
        engine: 'unified',
        sugestoes: suggestions.map((s) => ({
          key: `${s.from.id}_${s.to.id}`,
          debit: { id: s.from.id, date: s.from.date.toISOString(), amount: s.from.amount, description: s.from.description, bankAccountId: s.from.bankAccountId, bankAccountName: s.from.bankAccountName ?? '—' },
          credit: { id: s.to.id, date: s.to.date.toISOString(), amount: s.to.amount, description: s.to.description, bankAccountId: s.to.bankAccountId, bankAccountName: s.to.bankAccountName ?? '—' },
          daysApart: s.deltaDays,
          sameDay: s.deltaDays === 0,
          layer: s.layer,
          confidence: s.confidence,
          evidences: s.evidences,
        })),
        totalDebitPending: manualDebits.length,
        totalCreditPending: manualCredits.length,
        manualDebits,
        manualCredits,
      })
    }

    // 1. Todas PENDING DEBIT + CREDIT da empresa (não-TRANSFER, sem group)
    const [debits, credits] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId: empresaId, isActive: true },
          type: 'DEBIT',
          status: 'PENDING',
          transferGroupId: null,
        },
        select: {
          id: true,
          date: true,
          amount: true,
          description: true,
          bankAccountId: true,
          bankAccount: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.transaction.findMany({
        where: {
          bankAccount: { companyId: empresaId, isActive: true },
          type: 'CREDIT',
          status: 'PENDING',
          transferGroupId: null,
        },
        select: {
          id: true,
          date: true,
          amount: true,
          description: true,
          bankAccountId: true,
          bankAccount: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
    ])

    // 2. Match: valor exato (±0.01), contas diferentes, data ±3d.
    // Complexidade: O(N*M) — mas com PENDING geralmente ≤ 50 de cada lado,
    // O(2500) trivial. Sem índice special.
    const sugestoes: ParearSugestao[] = []

    for (const d of debits) {
      if (!d.bankAccountId) continue
      for (const c of credits) {
        if (!c.bankAccountId) continue
        if (d.bankAccountId === c.bankAccountId) continue
        // Valor idêntico ±1 centavo
        if (Math.abs(d.amount - c.amount) > 0.01) continue
        // Data ±3 dias
        const da = daysBetween(d.date, c.date)
        if (da > DAYS_WINDOW) continue
        sugestoes.push({
          key: `${d.id}_${c.id}`,
          debit: {
            id: d.id,
            date: d.date.toISOString(),
            amount: d.amount,
            description: d.description,
            bankAccountId: d.bankAccountId,
            bankAccountName: d.bankAccount?.name ?? '—',
          },
          credit: {
            id: c.id,
            date: c.date.toISOString(),
            amount: c.amount,
            description: c.description,
            bankAccountId: c.bankAccountId,
            bankAccountName: c.bankAccount?.name ?? '—',
          },
          daysApart: da,
          sameDay: da === 0,
        })
      }
    }

    // 3. Ordena: same-day primeiro (mais confiança), depois por valor desc,
    // depois por data mais recente.
    sugestoes.sort((a, b) => {
      if (a.sameDay !== b.sameDay) return a.sameDay ? -1 : 1
      if (a.debit.amount !== b.debit.amount) return b.debit.amount - a.debit.amount
      return b.debit.date.localeCompare(a.debit.date)
    })

    return NextResponse.json<ParearSugestoesResponse>({
      sugestoes,
      totalDebitPending: debits.length,
      totalCreditPending: credits.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
