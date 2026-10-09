/**
 * POST /api/empresas/[id]/emprestimos/[loanId]/devolucao — registrar devolução de mútuo flexível.
 *
 * ⭐ UMA ROTA, DOIS MODOS (`confirmar: false|true`) — o padrão da casa. ⚠️ E a prévia é a MESMA
 * função que a gravação executa (`previaDaDevolucao` é chamada dentro de `registrarDevolucao`):
 * sem isso a tela prometeria um número e o ledger gravaria outro, que é a cicatriz mais caras
 * deste projeto (o preview do import dizia *"N novas"* e o confirm fazia outra coisa, 17/08).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import { BalanceCheckError } from '@/lib/balance/check'
import {
  previaDaDevolucao,
  registrarDevolucao,
  DevolucaoError,
} from '@/lib/loans/devolucao-flexivel'
import { VinculoDeParcelaError } from '@/lib/loans/vincular-pagamento'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'

interface Params {
  params: Promise<{ id: string; loanId: string }>
}

/**
 * ⚠️ A DATA VEM `YYYY-MM-DD` E É CARIMBADA AO MEIO-DIA UTC — a convenção da casa.
 *
 * ⛔ `new Date('2026-10-09')` é meia-noite UTC, e em fuso negativo isso **volta um dia** na
 * exibição: a devolução de 09/10 apareceria como 08/10. É o débito registrado em 30/09 sobre o
 * lançamento manual, e aqui ele não se repete.
 */
const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'data precisa ser YYYY-MM-DD')
  .transform((s) => new Date(`${s}T12:00:00.000Z`))
  .refine((d) => Number.isFinite(d.getTime()), 'data inválida')

const schema = z
  .object({
    valor: z.number().positive().max(100_000_000),
    data: dataSchema,
    descricao: z.string().trim().max(200).optional(),
    categoryId: z.string().cuid().nullable().optional(),
    casarComTransactionId: z.string().cuid().optional(),
    criarMesmoComCandidata: z.boolean().optional(),
    confirmar: z.boolean().default(false),
  })
  /** ⛔ `.strict()`: campo a mais é chamada errada, não campo ignorado em silêncio */
  .strict()

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    const body = schema.parse(await request.json())

    const entrada = {
      companyId: empresaId,
      loanId,
      valor: body.valor,
      data: body.data,
      descricao: body.descricao,
      categoryId: body.categoryId ?? undefined,
      casarComTransactionId: body.casarComTransactionId,
      criarMesmoComCandidata: body.criarMesmoComCandidata,
      userId: ctx.user?.id ?? null,
    }

    if (!body.confirmar) {
      /** ⭐ ler é `view`; só a gravação exige `create` — *"ler nunca exige gerenciar"* */
      ctx.requirePermission('transaction.view')
      return NextResponse.json({ previa: await previaDaDevolucao(prisma, entrada) })
    }

    ctx.requirePermission('transaction.create')
    const gravado = await registrarDevolucao(prisma, entrada)

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'LoanInstallmentPayment',
      entityId: gravado.transactionId,
      metadata: {
        loanId,
        referencia: gravado.referencia,
        valor: gravado.valor,
        criouSaida: gravado.criouSaida,
        nDevolucao: gravado.nDevolucao,
        totalDevolvido: gravado.totalDevolvido,
        saldo: gravado.saldo,
      },
      request,
    })

    /**
     * ⚠️ O GATILHO DO MOTOR DE VENDAS — aqui ele é **no-op por desenho** (devolução de mútuo é
     * `TRANSFERENCIA`, nunca receita), e é chamado assim mesmo porque *"porta que CRIA transação
     * entra na lista"* (a lição de 25/08) e porque o log registra o no-op com o motivo: sem ele,
     * *"não logou"* voltaria a ser indistinguível de *"não foi chamado"*.
     */
    await recomputeVendasSeVenda(prisma, empresaId, [], 'emprestimos/devolucao')

    return NextResponse.json({ ok: true, gravado }, { status: 201 })
  } catch (error) {
    if (error instanceof DevolucaoError) {
      /** ⚠️ 409 no caso da saída que já existe (é pergunta, não erro); 422 no resto */
      const status = error.code === 'SAIDA_JA_EXISTE' ? 409 : 422
      return NextResponse.json({ erro: error.message, code: error.code }, { status })
    }
    if (error instanceof VinculoDeParcelaError) {
      return NextResponse.json({ erro: error.message, code: error.code }, { status: 422 })
    }
    if (error instanceof BalanceCheckError) {
      return NextResponse.json({ erro: error.message, saldoCheck: error.result }, { status: error.status })
    }
    return handleApiError(error)
  }
}
