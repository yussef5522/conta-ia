// GET /api/transacoes/[id]/similares
// Fase 3 Etapa 1 + Sprint 5.0.2.k (STEM fallback).
//
// Conta + lista preview de transações pendentes COM MESMO PADRÃO que [id].
// Usado pra mostrar modal "276 similares · aplicar todas?" antes do bulk.
//
// Estratégia tripla (ordem):
//   1. EXACT/NORMALIZED (lib/ai-categorizer Fase 3 Etapa 1)
//   2. STEM fallback (Sprint 5.0.2.k) — quando 1 retorna 0, tenta substring
//      do stem (remove CPF/CNPJ/datas/IDs/nomes). Cobre "RECEBIMENTO
//      PIX-PIX_CRED ... João" onde 150 tx têm mesma estrutura mas CPF/nome
//      diferentes — sem " - " no meio (não cai no NORMALIZED).
//
// Response: {
//   total: number,
//   totalAmount: number,
//   tipoMatch: 'EXACT' | 'NORMALIZED' | 'STEM',
//   padrao: string,
//   preview: [{ id, description, amount, date }, ... até 5]
// }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  findSimilarTransactions,
} from '@/lib/ai-categorizer/similar'
import { buildNewRule } from '@/lib/ai-categorizer/learn'
import { extractDescriptionStem } from '@/lib/rules/extract-stem'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const base = await prisma.transaction.findUnique({
      where: { id },
      include: {
        bankAccount: { select: { companyId: true } },
      },
    })
    if (!base) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, base.bankAccount!.companyId)
    ctx.requirePermission('transaction.view')

    // Decide tipoMatch usando a mesma heurística da criação de regra:
    // se desc tem " - " → NORMALIZED, senão EXACT
    const ruleShape = buildNewRule(
      base.bankAccount!.companyId,
      base.description,
      'placeholder', // categoria não importa aqui, só usamos tipoMatch+padrao
    )

    // Pega candidatas (pendentes sem categoria, da mesma empresa)
    const candidatas = await prisma.transaction.findMany({
      where: {
        id: { not: id },
        categoryId: null,
        status: 'PENDING',
        type: { not: 'TRANSFER' },
        bankAccount: { companyId: base.bankAccount!.companyId },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        type: true,
        bankAccountId: true,
        status: true,
        categoryId: true,
        date: true,
      },
      take: 5000,
    })

    const similares = findSimilarTransactions(
      {
        baseDescription: base.description,
        tipoMatch: ruleShape.tipoMatch,
        candidatas: candidatas.map((c) => ({
          id: c.id,
          description: c.description,
          amount: c.amount,
          type: c.type,
          bankAccountId: c.bankAccountId,
          status: c.status,
          categoryId: c.categoryId,
        })),
      },
      id,
    )

    // Mapa id → {date, bankAccountId} pra preview + items completos.
    // Sprint UX-bulk-review: items inclui TODAS as similares (cap 500) pra modal
    // mostrar lista navegável com checkbox em vez de só 5 + "X escondidas".
    const dateMap = new Map(candidatas.map((c) => [c.id, c.date]))
    const accountIds = Array.from(
      new Set(candidatas.map((c) => c.bankAccountId).filter((id): id is string => id !== null)),
    )
    const accounts = await prisma.bankAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, bankName: true },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    // Sprint 5.0.2.k+l — STEM fallback: se EXACT/NORMALIZED retornaram 0,
    // tenta substring do stem (corta no primeiro número 6+ dígitos).
    let finalSimilares: typeof similares = similares
    let finalTipoMatch: 'EXACT' | 'NORMALIZED' | 'STEM' = ruleShape.tipoMatch as
      | 'EXACT'
      | 'NORMALIZED'
    let finalPadrao = ruleShape.padrao

    if (similares.length === 0) {
      const stem = extractDescriptionStem(base.description)
      if (stem && stem.length >= 4) {
        const stemUpper = stem.toUpperCase()
        const stemMatches = candidatas
          .filter((c) => c.id !== id)
          .filter((c) => c.categoryId === null)
          .filter((c) => c.type === base.type)
          .filter((c) => (c.description ?? '').toUpperCase().includes(stemUpper))

        // Sprint 5.0.2.l — log debug PM2 prod
        console.log(
          `[SIMILARES] base="${base.description?.slice(0, 60)}" ` +
            `tipoMatch_inicial=${ruleShape.tipoMatch} count_inicial=0 ` +
            `stem="${stem}" stem_matches=${stemMatches.length}`,
        )

        if (stemMatches.length >= 2) {
          finalSimilares = stemMatches.map((c) => ({
            id: c.id,
            description: c.description,
            amount: c.amount,
            type: c.type,
            bankAccountId: c.bankAccountId,
            status: c.status,
            categoryId: c.categoryId,
          }))
          finalTipoMatch = 'STEM'
          finalPadrao = stem
        }
      } else {
        console.log(
          `[SIMILARES] base="${base.description?.slice(0, 60)}" stem_vazio_ou_curto stem="${stem}"`,
        )
      }
    }

    const totalAmount = finalSimilares.reduce(
      (s, t) => s + Math.abs(t.amount),
      0,
    )

    const preview = finalSimilares.slice(0, 5).map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      date: dateMap.get(t.id),
    }))

    // Sprint UX-bulk-review: items completos (cap 500) com bankAccount nome+banco.
    // Modal usa pra checkbox individual + busca + detecção de outliers.
    const ITEMS_CAP = 500
    const items = finalSimilares.slice(0, ITEMS_CAP).map((t) => {
      const accInfo = candidatas.find((c) => c.id === t.id)
      const acc =
        accInfo && accInfo.bankAccountId
          ? accountMap.get(accInfo.bankAccountId)
          : null
      return {
        id: t.id,
        description: t.description,
        amount: t.amount,
        type: t.type,
        date: dateMap.get(t.id),
        bankAccount: acc
          ? { name: acc.name, bankName: acc.bankName ?? null }
          : null,
      }
    })

    return NextResponse.json({
      total: finalSimilares.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      tipoMatch: finalTipoMatch,
      padrao: finalPadrao,
      preview,
      items,
      itemsCap: ITEMS_CAP,
      itemsTruncated: finalSimilares.length > ITEMS_CAP,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
