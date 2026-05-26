// Sprint 5.0.2.i+j — Re-categoriza retroativamente transações Pix de uma empresa.
//
// Fluxo (ordem de prioridade):
//   FASE 0 — Same-company-transfer: Pix entre contas DA MESMA empresa
//            (Sicredi ↔ Banrisul ↔ Stone). NÃO precisa cadastro.
//   FASE 1 — Pix relacionado: sócio PF ou empresa do grupo (cadastrados em
//            /pessoas-vinculadas).
//   FASE 2 — Conciliação externa: se a Empresa B do GRUPO_PJ está no sistema,
//            tenta marcar par bilateralmente.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { ensureSystemCategoriesForPix } from '@/lib/categorias/ensure-system-categories'
import { detectAndPlanPixApply } from '@/lib/pix-detection/auto-apply-pix'
import { matchInternalTransferForTransaction } from '@/lib/conciliation/match-internal-transfer'
import { matchSameCompanyTransfer } from '@/lib/conciliation/match-same-company-transfer'

interface Params {
  params: Promise<{ id: string }>
}

const BATCH_CAP = 2000

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const [socios, empresas, systemCategories] = await Promise.all([
      prisma.socioPF.findMany({ where: { companyId } }),
      prisma.empresaRelacionada.findMany({ where: { companyId } }),
      ensureSystemCategoriesForPix(companyId),
    ])

    // Sprint 5.0.2.j — same-company NÃO precisa cadastro, sempre roda

    const candidates = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        description: { contains: 'PIX' },
        relatedPartyType: null,
        isInternalTransfer: false,
        lifecycle: 'EFFECTED',
      },
      select: {
        id: true,
        description: true,
        type: true,
        amount: true,
        date: true,
        paymentDate: true,
        dedupHash: true,
        bankAccountId: true,
      },
      take: BATCH_CAP,
    })

    const sociosMapped = socios.map((s) => ({
      id: s.id,
      nome: s.nome,
      cpf: s.cpf,
      pixKeys: safeArray(s.pixKeys),
      papel: s.papel,
    }))
    const empresasMapped = empresas.map((e) => ({
      id: e.id,
      nomeFantasia: e.nomeFantasia,
      cnpjRelacionado: e.cnpjRelacionado,
      pixKeys: safeArray(e.pixKeys),
      relacao: e.relacao,
    }))

    let socioPFCount = 0
    let socioPFImpact = 0
    const socioPFIds: string[] = []
    let grupoPJCount = 0
    let grupoPJImpact = 0
    const grupoPJIds: string[] = []
    let sameCompanyCount = 0
    let sameCompanyImpact = 0
    const sameCompanyIds: string[] = []
    let conciliacoesExternas = 0

    for (const tx of candidates) {
      const dateForMatch = tx.paymentDate ?? tx.date

      // FASE 0 — Same-company transfer (sem cadastro, prioridade máxima)
      const sameCompany = await matchSameCompanyTransfer({
        transactionId: tx.id,
        bankAccountId: tx.bankAccountId ?? '',
        companyId,
        type: tx.type,
        amount: tx.amount,
        date: dateForMatch,
        description: tx.description,
      })
      if (sameCompany.matched) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            categoryId: systemCategories.transferenciaInternaId,
            status: 'RECONCILED',
            classificationSource: 'AI',
            aiConfidence: 1.0,
          },
        })
        if (sameCompany.linkedTransactionId) {
          await prisma.transaction.update({
            where: { id: sameCompany.linkedTransactionId },
            data: {
              categoryId: systemCategories.transferenciaInternaId,
              status: 'RECONCILED',
              classificationSource: 'AI',
              aiConfidence: 1.0,
            },
          })
        }
        sameCompanyCount++
        sameCompanyImpact += tx.amount
        sameCompanyIds.push(tx.id)
        continue
      }

      // FASE 1 — Pix relacionado (sócio/grupo externo)
      if (sociosMapped.length === 0 && empresasMapped.length === 0) continue

      const plan = detectAndPlanPixApply(tx, sociosMapped, empresasMapped, systemCategories)
      if (!plan.apply || !plan.patch) continue

      await prisma.transaction.update({
        where: { id: tx.id },
        data: plan.patch,
      })

      if (plan.patch.relatedPartyType === 'SOCIO_PF') {
        socioPFCount++
        socioPFImpact += tx.amount
        socioPFIds.push(tx.id)
      } else if (plan.patch.relatedPartyType === 'GRUPO_PJ') {
        grupoPJCount++
        grupoPJImpact += tx.amount
        grupoPJIds.push(tx.id)

        // FASE 2 — Conciliação externa (Empresa A ↔ Empresa B cadastrada)
        const matchResult = await matchInternalTransferForTransaction({
          transactionId: tx.id,
          companyId,
          type: tx.type,
          amount: tx.amount,
          date: dateForMatch,
          relatedPartyType: 'GRUPO_PJ',
          relatedPartyId: plan.patch.relatedPartyId,
        })
        if (matchResult.matched) conciliacoesExternas++
      }
    }

    return NextResponse.json({
      analisadas: candidates.length,
      socioPF: socioPFCount,
      socioPFImpact: round2(socioPFImpact),
      socioPFIds,
      grupoPJ: grupoPJCount,
      grupoPJImpact: round2(grupoPJImpact),
      grupoPJIds,
      sameCompany: sameCompanyCount,
      sameCompanyImpact: round2(sameCompanyImpact),
      sameCompanyIds,
      conciliacoes: conciliacoesExternas + sameCompanyCount,
      impactoDRETotal: round2(socioPFImpact + grupoPJImpact + sameCompanyImpact),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function safeArray(stored: string): string[] {
  try {
    const r = JSON.parse(stored)
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
