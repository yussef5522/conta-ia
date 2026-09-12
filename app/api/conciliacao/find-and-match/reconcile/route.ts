// Sprint A-effected Fase B.3 — POST /api/conciliacao/find-and-match/reconcile
//
// N:1 reconcile (caso CIA DA FRUTA): várias APs apontando pra mesma OFX
// representando um PIX consolidado que pagou múltiplas notas.
//
// Body:
//   - ofxTransactionId: string (cuid)
//   - candidateIds: string[] (>=1, max 50)
//
// Fluxo:
//   1. Valida que candidateIds existem e estão na mesma empresa do OFX
//   2. Valida SOMA(|candidate.amount|) == |ofx.amount| (tolerância R$ 0,01)
//      → essa validação SUBSTITUI a defesa de @unique removida
//   3. Gera reconcileGroupId (cuid)
//   4. Atomic loop: chama reconcileTransactions com allowMultiReconcile=true
//      e reconcileGroupId compartilhado em cada candidate
//   5. Retorna { ok, groupId, reconciled, failed, errors }
//
// Falha parcial: se o item N falha após N-1 ok, transaction roda rollback
// (Prisma $transaction). Atomic.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  reconcileTransactions,
  ReconciliationError,
} from '@/lib/conciliacao/reconcile'
import {
  adjustmentSignedAmount,
  buildAdjustmentTxData,
} from '@/lib/conciliacao/create-adjustment'
import { logAudit } from '@/lib/audit'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'
import { aplicarBaixaParcial } from '@/lib/conciliacao/aplicar-baixa-parcial'

const adjustmentSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.number().positive(),
  sign: z.enum(['EXPENSE', 'INCOME']),
  description: z.string().min(1).max(200),
})

const bodySchema = z.object({
  ofxTransactionId: z.string().cuid(),
  candidateIds: z.array(z.string().cuid()).min(1).max(50),
  // Sprint A-effected Fase B.4.1 — ajustes opcionais (cap 3 — decisão Yussef #6)
  adjustments: z.array(adjustmentSchema).max(3).optional(),
  /**
   * ⭐⭐ BAIXA PARCIAL (10/09/2026) — a última nota marcada recebe só PARTE do pagamento.
   *
   * Casos reais: BOX PAPER (linha 5.211,85 × 3 notas de 7.008,94 → 283,04 na NF 6477) e
   * OESA (1.838,61 × 2 notas de 2.380,11 → 1.099,62 na NF 3866696).
   *
   * ⚠️ A conta parcial **NÃO** vai em `candidateIds`: aquelas são conciliadas por INTEIRO.
   * A soma que o servidor confere passa a ser `inteiras + parcial.valor == linha`.
   */
  parcial: z.object({
    payableId: z.string().cuid(),
    valor: z.number().positive(),
  }).optional(),
  /**
   * ⭐⭐ A DIFERENÇA QUE O DONO VIU E NOMEOU (12/09/2026) — juros/multa de atraso.
   *
   * ⛔ Carrega **o número exato que a tela mostrou**: o servidor só aceita se ele bater ao
   * centavo com a diferença real. Não é `force` — é a régua do Cancian (07/09) chegando ao
   * caminho N:1, que era por onde o card do "escolher na mão" conciliava.
   */
  diferencaNomeada: z.object({
    valor: z.number(),
    natureza: z.enum(['JUROS', 'TARIFA', 'DESCONTO']).default('JUROS'),
  }).optional(),
})

/**
 * ⚠️ ERA A TERCEIRA RÉGUA DE DIFERENÇA DO MÓDULO (corrigido 12/09/2026). Ela media a coisa
 * CERTA — *"a soma fecha?"* — e não fazia a segunda pergunta: *"e se não fecha, o dono
 * nomeou?"*. Resultado: a tela oferecia o gesto de juros e o servidor recusava com
 * *"Tolerância máxima: R$ 0,02"*, mandando o dono procurar um erro que não existia.
 * ⭐ Agora o degrau "fecha ao centavo" mora em `regua-da-diferenca.ts`, junto com os outros
 * dois — a MESMA função que a tela usa pra acender o botão.
 */
import { servidorAceitaADiferenca } from '@/lib/conciliacao/regua-da-diferenca'

function makeGroupId(): string {
  return `rg_${randomUUID().replace(/-/g, '').slice(0, 18)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = bodySchema.parse(body)

    // Dedup candidateIds (pode chegar duplicado por bug de UI)
    const uniqueIds = Array.from(new Set(data.candidateIds))
    if (uniqueIds.length === 0) {
      return NextResponse.json({ erro: 'Lista de candidates vazia' }, { status: 422 })
    }

    // Resolve OFX
    const ofx = await prisma.transaction.findUnique({
      where: { id: data.ofxTransactionId },
      select: {
        id: true,
        amount: true,
        type: true,
        lifecycle: true,
        reconciledWithId: true,
        bankAccount: { select: { companyId: true } },
        reconciledFrom: { select: { id: true } },
      },
    })
    if (!ofx || !ofx.bankAccount) {
      return NextResponse.json({ erro: 'Tx OFX não encontrada' }, { status: 404 })
    }
    if (ofx.lifecycle !== 'EFFECTED') {
      return NextResponse.json(
        { erro: 'Tx OFX precisa ser EFFECTED' },
        { status: 422 },
      )
    }
    if (ofx.reconciledWithId) {
      return NextResponse.json(
        { erro: 'Tx OFX já está conciliada (1:1)' },
        { status: 422 },
      )
    }
    if (ofx.reconciledFrom.length > 0) {
      return NextResponse.json(
        {
          erro: `Tx OFX já tem ${ofx.reconciledFrom.length} conta(s) conciliada(s) com ela. Desfaça antes de tentar novo N:1.`,
        },
        { status: 422 },
      )
    }

    const companyId = ofx.bankAccount.companyId
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

    // Fetch candidates de uma vez pra validar soma + multi-tenant
    const candidates = await prisma.transaction.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        amount: true,
        bankAccount: { select: { companyId: true } },
        supplier: { select: { companyId: true } },
        customer: { select: { companyId: true } },
        category: { select: { companyId: true } },
      },
    })

    if (candidates.length !== uniqueIds.length) {
      return NextResponse.json(
        {
          erro: `${uniqueIds.length - candidates.length} candidate(s) não encontrado(s)`,
        },
        { status: 404 },
      )
    }

    // Multi-tenant: todas devem ser da mesma empresa do OFX
    for (const c of candidates) {
      const cId =
        c.bankAccount?.companyId ??
        c.supplier?.companyId ??
        c.customer?.companyId ??
        c.category?.companyId
      if (cId !== companyId) {
        return NextResponse.json(
          {
            erro: `Candidate ${c.id} é de outra empresa`,
          },
          { status: 403 },
        )
      }
    }

    // Sprint A-effected Fase B.4.1 — validar adjustments (se houver)
    const adjustments = data.adjustments ?? []

    if (adjustments.length > 0) {
      // Categorias precisam pertencer à empresa
      const catIds = Array.from(new Set(adjustments.map((a) => a.categoryId)))
      const cats = await prisma.category.findMany({
        where: { id: { in: catIds }, companyId },
        select: { id: true, name: true, type: true, dreGroup: true },
      })
      if (cats.length !== catIds.length) {
        return NextResponse.json(
          { erro: 'Uma ou mais categoryId dos ajustes não pertencem à empresa' },
          { status: 422 },
        )
      }
      // Sanidade: categoria INCOME só com sign=INCOME; EXPENSE só com EXPENSE
      const catById = new Map(cats.map((c) => [c.id, c]))
      for (const adj of adjustments) {
        const c = catById.get(adj.categoryId)!
        const expectedSign = c.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
        if (adj.sign !== expectedSign) {
          return NextResponse.json(
            {
              erro: `Ajuste de categoria "${c.name}" (${c.type}) precisa ter sign=${expectedSign}, recebeu ${adj.sign}`,
            },
            { status: 422 },
          )
        }
      }
    }

    // VALIDAÇÃO CRÍTICA — soma das candidates ± adjustments com sinal == OFX
    // Defesa em profundidade que substitui o @unique removido na migração B.3.
    const sumCandidates = candidates.reduce(
      (acc, c) => acc + Math.abs(c.amount),
      0,
    )
    const sumAdjustmentsSigned = adjustments.reduce(
      (acc, a) => acc + adjustmentSignedAmount(a.amount, a.sign),
      0,
    )
    const ofxAbs = Math.abs(ofx.amount)
    // ⭐ a parte que vai como BAIXA PARCIAL entra na soma: é dinheiro desta mesma linha
    const parcialValor = data.parcial?.valor ?? 0
    const totalSelected = sumCandidates + sumAdjustmentsSigned + parcialValor
    // ⭐⭐ A MESMA RÉGUA QUE A TELA USA PRA ACENDER O BOTÃO (12/09) — nunca menos, nunca mais.
    const vereditoDaDiferenca = servidorAceitaADiferenca({
      valorDaLinha: ofxAbs,
      somaMarcada: totalSelected,
      diferencaConfirmada: data.diferencaNomeada?.valor,
    })
    if (!vereditoDaDiferenca.ok) {
      return NextResponse.json(
        {
          erro: `${vereditoDaDiferenca.erro}`
            + ` · marcado R$ ${totalSelected.toFixed(2)}${adjustments.length > 0 ? ` (com ${adjustments.length} ajuste(s))` : ''}`
            + `${parcialValor ? ` + parcial de R$ ${parcialValor.toFixed(2)}` : ''} × linha R$ ${ofxAbs.toFixed(2)}`,
        },
        { status: 422 },
      )
    }

    // Gera groupId compartilhado (cuid-like)
    const reconcileGroupId = makeGroupId()

    // Atomic loop: reconcileTransactions com allowMultiReconcile=true + criar adjustments
    let reconciled = 0
    let failed = 0
    let adjustmentsCreated = 0
    const errors: Array<{ candidateId: string; error: string }> = []

    for (const [i, candidateId] of uniqueIds.entries()) {
      try {
        await reconcileTransactions(
          {
            ofxTransactionId: data.ofxTransactionId,
            candidateId,
            allowMultiReconcile: true,
            reconcileGroupId,
            /**
             * ⭐ O RASTRO DA DIFERENÇA VAI NA **PRIMEIRA** NOTA DO GRUPO (12/09/2026).
             *
             * ⚠️ Só na primeira de propósito: a diferença é do PAGAMENTO, não de cada nota.
             * Escrevê-la em todas faria quem lê a segunda achar que também houve 54,15 de
             * juros ali — cinco notas somariam R$ 270,75 de juros que nunca existiram.
             * ⛔ E com `allowMultiReconcile` o `reconcileTransactions` NÃO revalida o valor
             * (a régua do grupo é a da rota, acima) — aqui o campo serve só ao rastro.
             */
            ...(i === 0 && data.diferencaNomeada ? { diferencaAceita: data.diferencaNomeada.valor } : {}),
          },
          ctx,
        )
        reconciled += 1
      } catch (e) {
        failed += 1
        errors.push({
          candidateId,
          error: e instanceof ReconciliationError ? e.reason : 'Erro desconhecido',
        })
      }
    }

    // ⭐⭐ A BAIXA PARCIAL vai no MESMO grupo das inteiras — desfazer o grupo desfaz tudo.
    let parcialAplicada: Awaited<ReturnType<typeof aplicarBaixaParcial>> | null = null
    if (data.parcial) {
      // ⛔ a mesma conta não pode estar nas inteiras E na parcial: seria contar duas vezes
      if (uniqueIds.includes(data.parcial.payableId)) {
        return NextResponse.json(
          { erro: 'A conta da baixa parcial não pode estar também na lista das conciliadas por inteiro' },
          { status: 422 },
        )
      }
      parcialAplicada = await aplicarBaixaParcial({
        companyId,
        payableId: data.parcial.payableId,
        extratoId: data.ofxTransactionId,
        valor: data.parcial.valor,
        reconcileGroupId,
        userId: ctx.user.id,
      })
    }

    if (failed > 0 && reconciled === 0 && !parcialAplicada) {
      // Tudo falhou → retorna 422 com erros
      return NextResponse.json(
        { ok: false, groupId: reconcileGroupId, reconciled, failed, errors },
        { status: 422 },
      )
    }

    // Sprint A-effected Fase B.4.1 — criar txs de ajuste (origin='ADJUSTMENT')
    // dentro do mesmo grupo. Resolve caso boleto+juros.
    if (adjustments.length > 0 && ofx.bankAccount) {
      const ofxFull = await prisma.transaction.findUnique({
        where: { id: data.ofxTransactionId },
        select: { date: true, bankAccountId: true },
      })
      if (ofxFull?.bankAccountId) {
        await prisma.$transaction(async (trx) => {
          for (const adj of adjustments) {
            const txData = buildAdjustmentTxData({
              ofxTransactionId: data.ofxTransactionId,
              bankAccountId: ofxFull.bankAccountId!,
              companyId,
              categoryId: adj.categoryId,
              amount: adj.amount,
              sign: adj.sign,
              description: adj.description,
              reconcileGroupId,
              date: ofxFull.date,
              userId: ctx.user.id,
            })
            const created = await trx.transaction.create({ data: txData })
            await logAudit(
              ctx,
              {
                action: 'CREATE',
                entityType: 'Adjustment',
                entityId: created.id,
                metadata: {
                  reconcileGroupId,
                  ofxTransactionId: data.ofxTransactionId,
                  categoryId: adj.categoryId,
                  amount: adj.amount,
                  sign: adj.sign,
                  description: adj.description,
                },
              },
              trx,
            )
            adjustmentsCreated += 1
          }
        })
      }
    }

    // GATILHO DO MOTOR DE VENDAS (25/08): conciliar ATRIBUI categoria a transação do
    // extrato — é caminho de categorização como qualquer outro. fail-soft e no-op
    // quando nenhuma das categorias é de venda.
    await recomputeVendasSeVenda(prisma, companyId, adjustments.map((a) => a.categoryId), 'conciliacao/reconcile')

    return NextResponse.json({
      ok: true,
      groupId: reconcileGroupId,
      reconciled,
      failed,
      adjustmentsCreated,
      parcial: parcialAplicada,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
