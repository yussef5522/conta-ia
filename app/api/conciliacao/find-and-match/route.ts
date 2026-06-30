// Sprint A-effected Fase B.2 — GET /api/conciliacao/find-and-match
//
// Sprint Find&Match World-Class (15/06/2026) — agora ranqueia.
//
// ANTES: retornava 87 candidatos crus ordenados por dueDate desc — sem ranking,
// sem sinal de relevância. Caso real Cacula (JUROS R$ 1.546,70): nenhum dos 87
// estava próximo do valor; user ficava perdido.
//
// AGORA:
//   - Aplica scoreMatch (allowAnyAmount=true) sobre TODOS os candidatos.
//   - Retorna top N ranqueados (default 15) + hasMore + total.
//   - Cada candidato traz score + reasons[] (chaves estáveis pros chips).
//   - topScore + hasAnyAmountClose alimentam o nudge "isso é Create".
//   - Janela de data como PARAMETRO (default ±15d; "all" = sem janela).
//
// Query params:
//   - empresaId: string (cuid)
//   - ofxTransactionId: string (cuid)
//   - busca: string opcional (description, supplier, cnpj, valor exato, externalId)
//   - excluirIds: string CSV opcional
//   - windowDays: int 1-365 OU 'all' (default 15)
//   - page: int >=0 (default 0)
//   - limit: int 1-50 (default 15)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import type { Prisma } from '@prisma/client'
import {
  rankCandidates,
  AMOUNT_CLOSE_MIN_POINTS,
  type MatchCandidate as MatchCandidateRanker,
  type OFXTransaction as OFXTransactionRanker,
} from '@/lib/conciliacao/match'
import { buildStrictReconciliationWhere } from '@/lib/conciliacao/strict-where'

// Aceita número (1-365) OU 'all'. Default 15.
const windowDaysSchema = z
  .union([z.coerce.number().int().min(1).max(365), z.literal('all')])
  .default(15)

const querySchema = z.object({
  empresaId: z.string().cuid(),
  ofxTransactionId: z.string().cuid(),
  busca: z.string().trim().optional(),
  excluirIds: z.string().optional(),
  windowDays: windowDaysSchema,
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  // SCAN_HARD_CAP de candidatos rankeáveis em memória. Multi-tenant + filtro
  // SQL já corta agressivo; este é só pra prevenir blow-up em empresas com
  // dezenas de milhares de pendências (improvável no nosso universo).
  scanLimit: z.coerce.number().int().min(50).max(500).default(200),
})

function tryParseAmount(raw: string): number | null {
  // Aceita "1234.56", "1234,56", "1.234,56", "R$ 1.234,56"
  const cleaned = raw
    .replace(/r\$/i, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:,|$))/g, '') // remove . como separador de milhar
    .replace(',', '.')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    // 1) Resolve OFX pra saber direção (DEBIT/CREDIT) + data pra janela
    const ofx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        description: true,
        supplierId: true,
        bankAccountId: true,
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!ofx || !ofx.bankAccount) {
      return NextResponse.json({ erro: 'Tx OFX não encontrada' }, { status: 404 })
    }
    if (ofx.bankAccount.companyId !== data.empresaId) {
      return NextResponse.json({ erro: 'OFX não pertence à empresa' }, { status: 403 })
    }

    const excluirIds = data.excluirIds
      ? data.excluirIds.split(',').filter((s) => s.length > 0)
      : []

    // 2) Monta filtro de busca textual
    let buscaWhere: Prisma.TransactionWhereInput = {}
    if (data.busca && data.busca.length > 0) {
      const insensitive = { mode: 'insensitive' as const } as {
        mode: 'insensitive'
      }
      const orFilters: Prisma.TransactionWhereInput[] = [
        { description: { contains: data.busca, ...insensitive } as Prisma.StringFilter },
        {
          supplier: {
            razaoSocial: { contains: data.busca, ...insensitive } as Prisma.StringFilter,
          },
        },
        {
          supplier: {
            nomeFantasia: { contains: data.busca, ...insensitive } as Prisma.StringNullableFilter,
          },
        },
      ]
      const cnpjDigits = data.busca.replace(/\D/g, '')
      if (cnpjDigits.length >= 8) {
        orFilters.push({ supplier: { cnpj: { contains: cnpjDigits } } })
      }
      const possibleAmount = tryParseAmount(data.busca)
      if (possibleAmount !== null) {
        orFilters.push({
          amount: {
            gte: possibleAmount - 0.01,
            lte: possibleAmount + 0.01,
          },
        })
      }
      orFilters.push({
        externalId: { contains: data.busca, ...insensitive } as Prisma.StringNullableFilter,
      })
      buscaWhere = { OR: orFilters }
    }

    // 3) Janela de data (default ±15d, 'all' = sem janela).
    //    Helper recebe gte/lte de dueDate (PAYABLE/RECEIVABLE em aberto sempre
    //    tem dueDate; RAMO 2 que usava paymentDate/date foi REMOVIDO).
    let dueWindow: { gte: Date; lte: Date } | undefined
    if (data.windowDays !== 'all') {
      const ms = data.windowDays * 24 * 60 * 60 * 1000
      dueWindow = {
        gte: new Date(ofx.date.getTime() - ms),
        lte: new Date(ofx.date.getTime() + ms),
      }
    }

    // 4) Sprint Find-And-Match-Strict (30/06/2026) — FONTE DE VERDADE ÚNICA.
    //    Helper compartilhado com lib/conciliacao/find-candidates.ts. RAMO 2
    //    (EFFECTED MANUAL/IMPORT_EXCEL) REMOVIDO: nunca aparece despesa em
    //    dinheiro caixa loja, nunca tx de outra conta, nunca órfã Excel.
    const strictWhere = buildStrictReconciliationWhere(
      {
        type: ofx.type as 'CREDIT' | 'DEBIT',
        bankAccountId: ofx.bankAccountId ?? '',
      },
      data.empresaId,
      dueWindow,
    )

    const where: Prisma.TransactionWhereInput = {
      AND: [
        strictWhere,
        ...(Object.keys(buscaWhere).length > 0 ? [buscaWhere] : []),
        ...(excluirIds.length > 0 ? [{ id: { notIn: excluirIds } }] : []),
        { id: { not: data.ofxTransactionId } },
      ],
    }

    // 6) Scan: busca até `scanLimit` candidatos (cap defensivo).
    //    Total real (ignora cap) usa count separado.
    const [totalUnranked, scanned] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          dueDate: true,
          paymentDate: true,
          lifecycle: true,
          origin: true,
          externalId: true,
          supplierId: true,
          customerId: true,
          categoryId: true,
          supplier: {
            select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
          },
        },
        orderBy: [
          { dueDate: 'desc' },
          { date: 'desc' },
        ],
        take: data.scanLimit,
      }),
    ])

    // 7) RANKING — aplica scoreMatch sobre os candidatos com allowAnyAmount=true.
    //    Reaproveita a engine pura do auto-match (Sprint 4.0.2 + Sprint A).
    const ofxForRanker: OFXTransactionRanker = {
      id: ofx.id,
      description: ofx.description,
      amount: ofx.amount,
      type: ofx.type as 'CREDIT' | 'DEBIT',
      date: ofx.date,
      supplierId: ofx.supplierId,
      bankAccountId: ofx.bankAccountId ?? '',
    }
    const candidatesForRanker: MatchCandidateRanker[] = scanned.map((c) => ({
      id: c.id,
      // Sprint Find-And-Match-Strict: scan agora SÓ retorna PAYABLE/RECEIVABLE
      // (helper estrito). Cast seguro — RAMO 2 (EFFECTED) foi removido.
      lifecycle: c.lifecycle as 'PAYABLE' | 'RECEIVABLE',
      description: c.description,
      amount: c.amount,
      // Data alvo: PAYABLE/RECEIVABLE em aberto sempre tem dueDate. Fallbacks
      // mantidos pra robustez (caso histórico tenha PAYABLE sem dueDate).
      dueDate: c.dueDate ?? c.paymentDate ?? c.date,
      supplierId: c.supplierId,
      customerId: c.customerId,
      categoryId: c.categoryId,
    }))

    const ranked = rankCandidates(ofxForRanker, candidatesForRanker, {
      allowAnyAmount: true,
    })

    const scannedById = new Map(scanned.map((c) => [c.id, c]))
    const ranked_full = ranked.map((m) => {
      const raw = scannedById.get(m.candidateId)!
      return {
        id: raw.id,
        description: raw.description,
        amount: raw.amount,
        date: raw.date.toISOString(),
        dueDate: raw.dueDate?.toISOString() ?? null,
        paymentDate: raw.paymentDate?.toISOString() ?? null,
        lifecycle: raw.lifecycle,
        origin: raw.origin,
        externalId: raw.externalId,
        supplier: raw.supplier
          ? {
              id: raw.supplier.id,
              razaoSocial: raw.supplier.razaoSocial,
              nomeFantasia: raw.supplier.nomeFantasia,
              cnpj: raw.supplier.cnpj,
            }
          : null,
        score: m.score,
        reasons: m.reasons,
        // Compatibilidade: legível pra logs/debug (UI usa reasons[])
        reasoning: m.reasoning,
      }
    })

    // 8) Paginação aplicada ao array ranqueado.
    const totalRanked = ranked_full.length
    const start = data.page * data.limit
    const end = start + data.limit
    const pageSlice = ranked_full.slice(start, end)
    const hasMore = end < totalRanked

    // 9) Métricas pro nudge "isso é Create":
    //    - topScore: maior score
    //    - hasAnyAmountClose: algum candidato com valor dentro de ±5% (breakdown.amount >= 25)
    //    - nudgeCreate: true quando nenhum candidato tem valor próximo
    const topScore = ranked.length > 0 ? ranked[0].score : 0
    const hasAnyAmountClose = ranked.some(
      (r) => r.breakdown.amount >= AMOUNT_CLOSE_MIN_POINTS,
    )
    const nudgeCreate = ranked.length === 0 || !hasAnyAmountClose

    return NextResponse.json({
      // Compatibilidade com cliente atual:
      total: totalUnranked,
      ofx: {
        id: ofx.id,
        description: ofx.description,
        amount: ofx.amount,
        type: ofx.type,
        date: ofx.date.toISOString(),
      },
      candidates: pageSlice,
      // Sprint Find&Match World-Class:
      ranking: {
        totalRanked,
        page: data.page,
        limit: data.limit,
        hasMore,
        topScore,
        hasAnyAmountClose,
        nudgeCreate,
        windowDays: data.windowDays,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
