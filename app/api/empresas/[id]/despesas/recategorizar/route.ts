// Sprint 10 — POST /api/empresas/[id]/despesas/recategorizar
//
// Recebe { transactionIds: string[], novaCategoriaId: string } e atualiza
// categoryId em lote (1 ou N).
//
// Regras (todas auditadas):
// - Tx tem que pertencer à empresa (bankAccount.companyId == empresaId) —
//   defesa multi-tenant. Filtra silenciosamente IDs que não batem.
// - novaCategoriaId tem que ser categoria ativa da MESMA empresa.
// - classificationSource = 'MANUAL' (ação humana explícita).
// - classifiedByRuleId = null (rompe vínculo com qualquer regra anterior).
// - NÃO mexe em amount/date/bankAccountId/lifecycle/transferGroupId — só
//   categoria + status (via escada). Saldo intacto, conciliação intacta.
// - Sprint Category-Combobox PJ Batch (30/06/2026): agora aplica a escada
//   via enforceStatusLadder por tx (fetch categoryId+accountType, agrupa por
//   status resultante, updateMany por grupo dentro de $transaction).
// - Invalida cache via revalidateTag(`dashboard:${empresaId}`) → dashboard
//   + /despesas + DRE refletem no próximo render.
// - Idempotente: rodar 2x não muda nada além de updatedAt.
//
// NÃO cria regra. Criação de regra é separada (Sprint 9 endpoint).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { whereCategoriaAceita } from '@/lib/categorias/destino-valido'
import { enforceStatusLadder } from '@/lib/transacoes/needs-review'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  transactionIds: z.array(z.string().min(1)).min(1).max(500),
  novaCategoriaId: z.string().min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.categorize')

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { erro: 'Payload inválido', detalhes: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { transactionIds, novaCategoriaId } = parsed.data

    // Valida categoria
    const cat = await prisma.category.findFirst({
      where: { ...whereCategoriaAceita(companyId), id: novaCategoriaId },
      select: { id: true, name: true, dreGroup: true, type: true },
    })
    if (!cat) {
      /**
       * ⭐ A RECUSA ENSINA A SAÍDA (17/09) — a régua do tradutor 422 do estoque.
       * ⛔ *"Categoria não encontrada ou inativa."* mandava o dono adivinhar QUAL das 260
       * opções era o problema. Agora ela diz o NOME e o PORQUÊ.
       */
      const qualquer = await prisma.category.findFirst({
        where: { id: novaCategoriaId },
        select: { name: true, isActive: true, companyId: true },
      })
      const motivo = !qualquer
        ? 'essa categoria não existe mais'
        : qualquer.companyId !== companyId
          ? 'essa categoria é de outra empresa'
          : `“${qualquer.name}” está INATIVA`
      return NextResponse.json(
        {
          erro: `Não dá pra usar essa categoria: ${motivo}.`,
          code: 'CATEGORIA_INVALIDA',
          saida: { rotulo: 'ver e reativar categorias', href: `/empresas/${companyId}/categorias` },
        },
        { status: 400 },
      )
    }

    // Filtra defensivamente: só tx que realmente pertencem à empresa.
    // Sprint Category-Combobox PJ Batch (30/06/2026): também carrega status
    // atual + accountType pra aplicar enforceStatusLadder por tx.
    const ownedTx = await prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        /**
         * ⛔⛔ AQUI ERA SÓ `bankAccount: { companyId }` — e **compra de cartão nasce SEM
         * conta bancária** (`bankAccountId` null; é o `businessCreditCardId` que a prende à
         * empresa). Então a fatura inteira ficava fora do alcance: mesmo com categoria
         * válida, a resposta era *"Nenhuma transação encontrada na empresa"*.
         *
         * ⚠️ Foi o erro de 17/09 ao reusar esta porta pra a tela da fatura **sem medir se
         * ela alcançava cartão**. REGRA 4 tem duas metades: achar a porta única *e*
         * provar que ela abre pro caso novo.
         */
        OR: [
          { bankAccount: { companyId } },
          { businessCreditCard: { companyId } },
        ],
      },
      select: {
        id: true,
        categoryId: true,
        amount: true,
        type: true,
        description: true,
        status: true,
        bankAccount: { select: { accountType: true } },
      },
    })

    const ownedIds = ownedTx.map((t) => t.id)
    if (ownedIds.length === 0) {
      return NextResponse.json(
        { erro: 'Nenhuma transação encontrada na empresa.' },
        { status: 404 },
      )
    }

    // Snapshot ANTES (pra undo + payload de retorno)
    const previousByTxId = new Map(
      ownedTx.map((t) => [t.id, t.categoryId]),
    )

    // Sprint Category-Combobox PJ Batch (30/06/2026) — aplica escada por tx.
    // Como categoryId virá NOT NULL (novaCategoriaId) pra todas, o resultado
    // é RECONCILED (exceto IGNORED que preserva). Agrupa por status resultante
    // pra fazer updateMany por grupo (mantém performance de lote).
    const groups = new Map<
      'PENDING' | 'RECONCILED' | 'IGNORED',
      string[]
    >()
    for (const t of ownedTx) {
      const nextStatus = enforceStatusLadder({
        intendedStatus: t.status as 'PENDING' | 'RECONCILED' | 'IGNORED',
        categoryId: novaCategoriaId,
        accountType: t.bankAccount?.accountType ?? null,
      })
      const arr = groups.get(nextStatus) ?? []
      arr.push(t.id)
      groups.set(nextStatus, arr)
    }

    // Atomic: updateMany por status resultante dentro de $transaction.
    let totalUpdated = 0
    await prisma.$transaction(async (tx) => {
      for (const [statusFinal, ids] of groups) {
        if (ids.length === 0) continue
        const r = await tx.transaction.updateMany({
          where: { id: { in: ids } },
          data: {
            categoryId: novaCategoriaId,
            classificationSource: 'MANUAL',
            classifiedByRuleId: null,
            status: statusFinal,
            // aiConfidence preservado (informativo só)
          },
        })
        totalUpdated += r.count
      }
    })
    const result = { count: totalUpdated }

    // Invalida cache: dashboard, /despesas, Top5 — tudo no mesmo tag.
    // Next.js 16 mudou a assinatura: revalidateTag(tag, profile).
    // 'default' invalida imediatamente (não usa cache-life custom).
    revalidateTag(`dashboard:${companyId}`, 'default')

    return NextResponse.json({
      updated: result.count,
      requested: transactionIds.length,
      skippedNotOwned: transactionIds.length - ownedIds.length,
      novaCategoria: cat,
      previousByTxId: Object.fromEntries(previousByTxId), // pra undo client-side
      totalAmount: ownedTx.reduce((s, t) => s + t.amount, 0),
    })
  } catch (err) {
    return handleApiError(err)
  }
}
