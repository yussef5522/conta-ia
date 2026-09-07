// Sprint 4.0.3 — GET /api/dashboard/badges?empresaId=...
// Retorna contadores pra badges do sidebar (polling 60s).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { contarVinculosEsperandoDecisao } from '@/lib/conciliacao/fila-de-conciliacao'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const empresaId = sp.get('empresaId')
    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    // ⚠️ O FILTRO POR TIPO SAIU DAQUI (07/09/2026). Ele existia pra o badge casar
    // com o "apenas-pagamentos" que a tela velha aplicava por default. A fila nova
    // não filtra por tipo — ela pergunta por VÍNCULO, e uma conta a receber sem
    // pagamento casado é trabalho igual. Manter o filtro faria o badge esconder
    // metade do que a tela mostra.

    const now = new Date()
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // Tenant filter: usa OR pra pegar tx sem bankAccount (PAYABLE/RECEIVABLE sem conta)
    const tenantOR = {
      OR: [
        { bankAccount: { companyId: empresaId } },
        { supplier: { companyId: empresaId } },
        { customer: { companyId: empresaId } },
        { category: { companyId: empresaId } },
      ],
    }

    // Sprint Fix-Badge-Contas-Pagar (05/07/2026): as duas primeiras contagens
    // eram `lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }` — incluíam contas a
    // RECEBER no badge de "Contas a Pagar". Bug ficou latente até a Cacula ter
    // 27 RECEIVABLE + PENDING (PIX D+1 do Sicredi agendados pra 06/07); a partir
    // desses lançamentos o badge do menu "Contas a Pagar" mostrava 27 enquanto
    // a tela `/contas-a-pagar` (que filtra corretamente `lifecycle='PAYABLE'`)
    // mostrava 0 pendentes.
    //
    // Fix: filtrar SÓ `lifecycle: 'PAYABLE'` nos dois counts do apBadge.
    // Bonus: adicionar contagens análogas pra RECEIVABLE — o menu "Contas a
    // Receber" ganha badge próprio (as 27 aparecem no lugar certo).
    const [
      vencidas,
      vencendoEm3,
      conciliacaoPendente,
      transacoesPendentes,
      arVencidas,
      arVencendoEm3,
    ] = await Promise.all([
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: 'PAYABLE',
          status: 'PENDING',
          dueDate: { lt: now },
        },
      }),
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: 'PAYABLE',
          status: 'PENDING',
          dueDate: { gte: now, lte: in3Days },
        },
      }),
      // ⛔⛔ ESTE BADGE ERA A SEGUNDA DERIVAÇÃO (corrigido em 07/09/2026).
      //
      // Ele contava `origin=OFX` + `categoryId IS NULL` + `cashCoded=false` — a
      // definição VELHA da fila, que era a de CLASSIFICAÇÃO com nome trocado. Com
      // a tela passando a perguntar "que vínculo falta?", o badge passaria a mentir
      // ao contrário do erro antigo: **0 no menu com 2 pares esperando decisão**.
      //
      // ⭐ Agora o número sai da MESMA função que a tela desenha
      // (`filaDeConciliacao`). É a lição do B1: duas derivações da mesma pergunta
      // divergem no primeiro caso de borda — e este caso de borda já estava aqui.
      contarVinculosEsperandoDecisao(empresaId),
      // Badge "Pendentes" — alinha com /pendentes via fonte única.
      // Sprint Fundação Status (28/06/2026): REMOVIDO status='PENDING' forçado
      // — pendência é sobre FALTA de classificação, não sobre o nome do estado.
      // Tx RECONCILED-sem-categoria (bug pré-backfill) também conta como trabalho.
      prisma.transaction.count({
        where: {
          ...NEEDS_REVIEW_WHERE_PRISMA,
          bankAccount: { companyId: empresaId },
          lifecycle: 'EFFECTED',
        },
      }),
      // Sprint Fix-Badge-Contas-Pagar (05/07/2026): counts RECEIVABLE análogos
      // pro badge do menu "Contas a Receber". Mesmo tenant OR + status/dueDate.
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: 'RECEIVABLE',
          status: 'PENDING',
          dueDate: { lt: now },
        },
      }),
      prisma.transaction.count({
        where: {
          ...tenantOR,
          lifecycle: 'RECEIVABLE',
          status: 'PENDING',
          dueDate: { gte: now, lte: in3Days },
        },
      }),
    ])

    return NextResponse.json({
      contasAPagar: {
        vencidas,
        vencendoEm3Dias: vencendoEm3,
      },
      contasAReceber: {
        vencidas: arVencidas,
        vencendoEm3Dias: arVencendoEm3,
      },
      conciliacao: {
        pendentes: conciliacaoPendente,
      },
      transacoesPendentes,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
