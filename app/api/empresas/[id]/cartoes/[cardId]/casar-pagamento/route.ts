// Sprint Cartao R2 (24/06/2026) — casar/desfazer pagamento <-> cartao.
//
// POST   { txId } -> vincula a tx ao cartao (isCardPayment=true,
//                    businessCreditCardId=cardId, remove categoryId que tinha)
// DELETE ?txId=xxx -> desfaz (mantem isCardPayment=true mas zera cardId)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { casarPagamentoDeCartao, CasarPagamentoError } from '@/lib/credit-card-pj/casar-pagamento'

interface Params { params: Promise<{ id: string; cardId: string }> }

/**
 * ⭐⭐⭐ O RASTRO DO GESTO (20/10/2026) — e ele nasceu de uma perícia que NÃO pôde concluir.
 *
 * ⛔⛔ Esta rota move dinheiro (manda uma linha do extrato quitar uma fatura, e tira a despesa
 * do DRE) e **não deixava rastro nenhum**. Quando a fatura de outubro apareceu paga em
 * setembro, o `AuditLog` da transação tinha **ZERO** eventos: deu pra provar que NÃO veio da
 * conciliação (lá o `resolverLinha` grava com o id da linha desde 24/09) e **não deu pra
 * provar por onde veio** — a porta foi deduzida pela hora e pela frase do banner.
 *
 * ⚠️ **FAIL-SOFT, e a razão está escrita na casa desde 24/09:** *rastro que derruba o gesto
 * seria pior que rastro nenhum.* A gravação já aconteceu quando isto roda; falhar aqui só
 * perderia o diagnóstico — derrubar perderia o trabalho do dono.
 *
 * ⚠️ E ele **não mexe no controle de acesso**: quem autoriza continua sendo o `ensureAccess`
 * acima (`UserCompany`). O `getAuthContext` entra só porque o `logAudit` exige o `ctx.company`
 * pra escrever a linha — misturar as duas coisas num gesto de diagnóstico mudaria quem passa
 * pela porta.
 */
async function rastro(
  request: NextRequest,
  companyId: string,
  txId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const ctx = await getAuthContext(request, companyId)
    await logAudit(ctx, {
      action: 'UPDATE',
      entityType: 'Transaction',
      entityId: txId,
      metadata,
      request,
    })
  } catch (e) {
    // ⚠️ nunca silencioso: o log do servidor é o último lugar onde a falha de rastro aparece.
    console.warn(`[CASAR-PAGAMENTO] rastro NÃO gravado · tx=${txId} · ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function ensureAccess(userId: string, companyId: string, cardId: string) {
  const acesso = await prisma.userCompany.findFirst({
    where: { userId, companyId },
    select: { companyId: true },
  })
  if (!acesso) return null
  return prisma.businessCreditCard.findFirst({
    where: { id: cardId, companyId },
  })
}

const casarSchema = z.object({
  txId: z.string().cuid(),
  // Fatura-Paga-Por-Competencia (14/08/2026): QUAL fatura este pagamento quita (YYYY-MM).
  // A tela manda a competência que o dono está vendo — o banner da prévia manda a do PDF.
  //
  // ⛔⛔ AUSENTE → o servidor resolve por VALOR, e **nenhuma fatura batendo RECUSA ENSINANDO**.
  // ⚠️ Este comentário dizia *"usa a fatura mais recente do cartão (default seguro)"*. Não era
  // seguro e não era default: era o `sort().pop()` que mandou R$ 12.696,23 pra a competência
  // ERRADA em 20/10, e ele morreu junto com a frase.
  invoiceMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'competência inválida (YYYY-MM)')
    .optional()
    .nullable(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const card = await ensureAccess(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  let body
  try {
    body = casarSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      { erro: 'Body inválido', details: err instanceof z.ZodError ? err.issues : String(err) },
      { status: 400 },
    )
  }

  // Tx tem que ser da MESMA empresa
  const targetTx = await prisma.transaction.findFirst({
    where: {
      id: body.txId,
      bankAccount: { companyId },
    },
    select: {
      id: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      isCardPayment: true,
      businessCreditCardId: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  })
  if (!targetTx) {
    return NextResponse.json({ erro: 'Transação não encontrada' }, { status: 404 })
  }
  if (targetTx.type === 'CREDIT') {
    return NextResponse.json(
      { erro: 'Apenas DEBIT pode ser pagamento de cartão' },
      { status: 400 },
    )
  }

  /**
   * ⭐⭐ A GRAVAÇÃO MUDOU DE CASA (15/09) — ela mora em `lib/credit-card-pj/casar-pagamento`.
   *
   * ⛔ O balcão da caixa de entrada precisa do MESMO gesto, e copiar as 20 linhas seria a
   * **segunda porta de gravação do mesmo fato** — a doença que o `vincularPagamentoDeParcela`
   * (11/09) existe pra impedir do lado do empréstimo. Esta rota é CASCA FINA.
   */
  try {
    const r = await casarPagamentoDeCartao(
      { companyId, cardId, txId: targetTx.id, invoiceMonth: body.invoiceMonth ?? null },
      prisma,
    )
    /**
     * ⭐ O rastro diz **de onde veio a competência** — `tela` (o dono/banner mandou) ou
     * `resolvida-por-valor` (o servidor casou). Era exatamente esta distinção que faltava pra
     * perícia de 20/10 saber se o 2026-09 foi escolha de alguém ou chute do resolvedor.
     */
    await rastro(request, companyId, targetTx.id, {
      gesto: 'casar-pagamento-de-cartao',
      cardId,
      cardName: card.name,
      paidInvoiceMonth: r.paidInvoiceMonth,
      competenciaVeioDe: body.invoiceMonth ? 'tela' : 'resolvida-por-valor',
      amount: targetTx.amount,
      txDate: targetTx.date.toISOString(),
      txDescription: targetTx.description,
      previousCategoryId: r.previousCategoryId,
      previousCategoryName: targetTx.category?.name ?? null,
      deltaDespesaRemovidoDoDRE: r.deltaDespesaRemovidoDoDRE,
    })
    return NextResponse.json({
      casado: true,
      transactionId: r.transactionId,
      paidInvoiceMonth: r.paidInvoiceMonth,
      previousCategoryId: r.previousCategoryId,
      previousCategoryName: targetTx.category?.name ?? null,
      deltaDespesaRemovidoDoDRE: r.deltaDespesaRemovidoDoDRE,
    })
  } catch (e) {
    if (e instanceof CasarPagamentoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, cardId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json(
      { erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' },
      { status: 401 },
    )
  }

  const card = await ensureAccess(user.sub, companyId, cardId)
  if (!card) {
    return NextResponse.json({ erro: 'Cartão não encontrado' }, { status: 404 })
  }

  const txId = request.nextUrl.searchParams.get('txId')
  if (!txId) {
    return NextResponse.json({ erro: 'txId obrigatório' }, { status: 400 })
  }

  const targetTx = await prisma.transaction.findFirst({
    where: {
      id: txId,
      bankAccount: { companyId },
      businessCreditCardId: cardId,
    },
    select: { id: true, isCardPayment: true, amount: true, paidInvoiceMonth: true, description: true },
  })
  if (!targetTx) {
    return NextResponse.json(
      { erro: 'Transação não encontrada ou não casada com este cartão' },
      { status: 404 },
    )
  }

  // Desfaz vinculo (volta pra "aguardando casar"). Mantem isCardPayment=true.
  // Caller pode optar por unset isCardPayment via /api/transacoes/[id] PATCH
  // se quiser reverter pra despesa normal (caso 100% manual). Limpa também o
  // paidInvoiceMonth — sem vínculo de cartão, não quita fatura nenhuma.
  const updated = await prisma.transaction.update({
    where: { id: targetTx.id },
    data: { businessCreditCardId: null, paidInvoiceMonth: null },
    select: { id: true, isCardPayment: true, businessCreditCardId: true },
  })

  /**
   * ⭐⭐ O DESFAZER TAMBÉM DEIXA RASTRO — e ele é o gesto que o dono vai dar HOJE pra
   * desmanchar o vínculo errado de 2026-09. Sem isto, a correção do estrago seria ela própria
   * invisível, e a próxima perícia leria *"a fatura de setembro deixou de constar paga"* sem
   * saber que foi um gesto do dono, não um defeito novo.
   */
  await rastro(request, companyId, targetTx.id, {
    gesto: 'desfazer-casamento-de-cartao',
    cardId,
    cardName: card.name,
    paidInvoiceMonthAnterior: targetTx.paidInvoiceMonth,
    amount: targetTx.amount,
    txDescription: targetTx.description,
  })

  return NextResponse.json({ desfeito: true, transactionId: updated.id, state: updated })
}
