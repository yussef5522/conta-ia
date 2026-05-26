// Sprint 5.0.2.i — Re-categoriza retroativamente transações Pix de uma empresa.
//
// Fluxo:
//   1. Garante categorias do sistema (Distribuição/Pró-labore/Transferência)
//   2. Busca Tx PENDING com descrição contendo "PIX" (sem relatedPartyType ainda)
//   3. Pra cada uma, roda detect-pix + applica patch direto
//   4. Pra GRUPO_PJ aplicados, tenta conciliação automática (match-internal-transfer)
//   5. Retorna sumário { socioPF, grupoPJ, conciliacoes }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { ensureSystemCategoriesForPix } from '@/lib/categorias/ensure-system-categories'
import {
  detectAndPlanPixApply,
} from '@/lib/pix-detection/auto-apply-pix'
import { matchInternalTransferForTransaction } from '@/lib/conciliation/match-internal-transfer'

interface Params {
  params: Promise<{ id: string }>
}

const BATCH_CAP = 2000 // segurança: não roda em milhões de tx

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    // Carrega cadastros + categorias
    const [socios, empresas, systemCategories] = await Promise.all([
      prisma.socioPF.findMany({ where: { companyId } }),
      prisma.empresaRelacionada.findMany({ where: { companyId } }),
      ensureSystemCategoriesForPix(companyId),
    ])

    if (socios.length === 0 && empresas.length === 0) {
      return NextResponse.json({
        analisadas: 0,
        socioPF: 0,
        grupoPJ: 0,
        conciliacoes: 0,
        mensagem: 'Nenhum sócio ou empresa relacionada cadastrada — cadastre primeiro em Pessoas Vinculadas.',
      })
    }

    // Busca candidatas: PIX na descrição + sem relatedPartyType
    const candidates = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId },
        // SQLite-dev não suporta mode:insensitive; OFX em geral usa "PIX" caixa-alta
        description: { contains: 'PIX' },
        relatedPartyType: null,
        // só Tx EFFECTED (real) — ignora previstas
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
    let grupoPJCount = 0
    let conciliacoes = 0

    for (const tx of candidates) {
      const plan = detectAndPlanPixApply(tx, sociosMapped, empresasMapped, systemCategories)
      if (!plan.apply || !plan.patch) continue

      await prisma.transaction.update({
        where: { id: tx.id },
        data: plan.patch,
      })

      if (plan.patch.relatedPartyType === 'SOCIO_PF') {
        socioPFCount++
      } else if (plan.patch.relatedPartyType === 'GRUPO_PJ') {
        grupoPJCount++
        // Tenta conciliação automática
        const dateForMatch = tx.paymentDate ?? tx.date
        const matchResult = await matchInternalTransferForTransaction({
          transactionId: tx.id,
          companyId,
          type: tx.type,
          amount: tx.amount,
          date: dateForMatch,
          relatedPartyType: 'GRUPO_PJ',
          relatedPartyId: plan.patch.relatedPartyId,
        })
        if (matchResult.matched) conciliacoes++
      }
    }

    return NextResponse.json({
      analisadas: candidates.length,
      socioPF: socioPFCount,
      grupoPJ: grupoPJCount,
      conciliacoes,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

function safeArray(stored: string): string[] {
  try {
    const r = JSON.parse(stored)
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
