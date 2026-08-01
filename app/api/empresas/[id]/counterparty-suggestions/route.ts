// Sprint FASE 4 (01/08/2026) — GET sugestões por contraparte pras tx pendentes.
// READ-ONLY: não grava, não auto-aplica. Só devolve, por tx, a sugestão (regra do
// usuário / intra-grupo / recebimento próprio) com motivo pro selo na tela.
// Isolamento por empresa: regras e "outras empresas" são do usuário logado.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'
import { buildCounterpartySuggestion } from '@/lib/counterparty/suggest'
import { CONTRAPARTE_TIPO_MATCH, type CpRule } from '@/lib/counterparty/rules'
import type { CompanyRef } from '@/lib/counterparty/detect-company'

export const runtime = 'nodejs'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const own = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { id: true, name: true, cnpj: true },
    })
    if (!own) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    // Outras empresas do MESMO usuário (pra detectar intra-grupo). Isolamento:
    // só empresas que o usuário logado participa.
    const userId = ctx.user.id
    const minhas = await prisma.company.findMany({
      where: { users: { some: { userId } }, id: { not: empresaId } },
      select: { id: true, name: true, cnpj: true },
    })
    const ownRef: CompanyRef = { id: own.id, name: own.name, cnpj: own.cnpj }
    const otherRefs: CompanyRef[] = minhas.map((c) => ({ id: c.id, name: c.name, cnpj: c.cnpj }))

    // Regras CONTRAPARTE ativas DESTA empresa (nunca global).
    const rulesDb = await prisma.aiLearningRule.findMany({
      where: { companyId: empresaId, tipoMatch: CONTRAPARTE_TIPO_MATCH, isActive: true },
      select: { id: true, padrao: true, categoryId: true },
    })
    const rules: CpRule[] = rulesDb.map((r) => ({ id: r.id, padrao: r.padrao, categoryId: r.categoryId }))

    // Tx pendentes (fonte única needsReview) COM contraparte.
    const pend = await prisma.transaction.findMany({
      where: {
        ...NEEDS_REVIEW_WHERE_PRISMA,
        bankAccount: { companyId: empresaId },
        lifecycle: 'EFFECTED',
        counterpartyName: { not: null },
      },
      select: { id: true, counterpartyName: true, counterpartyDocument: true },
    })

    const suggestions: Array<{
      txId: string
      kind: 'RULE' | 'INTRA_GROUP' | 'OWN'
      categoryId: string | null
      reason: string
      source: 'RULE' | 'CADASTRO'
    }> = []
    for (const t of pend) {
      const s = buildCounterpartySuggestion(
        { counterpartyName: t.counterpartyName, counterpartyDocument: t.counterpartyDocument },
        { rules, ownCompany: ownRef, otherCompanies: otherRefs },
      )
      if (s) suggestions.push({ txId: t.id, kind: s.kind, categoryId: s.categoryId, reason: s.reason, source: s.source })
    }

    const byKind = suggestions.reduce<Record<string, number>>((a, s) => ((a[s.kind] = (a[s.kind] ?? 0) + 1), a), {})
    return NextResponse.json({ total: suggestions.length, byKind, suggestions })
  } catch (error) {
    return handleApiError(error)
  }
}
