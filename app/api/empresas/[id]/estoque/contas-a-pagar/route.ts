// ESTOQUE ↔ FINANCEIRO — PONTE 1. GET lista as parcelas esperando · POST envia.
//
// ⚠️ FRONTEIRA DE PAPEL: enviar boleto pro Contas a Pagar é criar OBRIGAÇÃO FINANCEIRA —
// é `stock.manage`, não `stock.operate`. O OPERADOR_ESTOQUE confere a nota e o estoque
// entra normal; as parcelas ficam esperando o dono aprovar. Ninguém da loja cria conta
// a pagar sem querer.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { listarPendentes, enviarParaContasPagar, PonteError } from '@/lib/stock/ponte-contas-pagar'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const pendentes = await listarPendentes(companyId, prisma)

  // ⭐ AS JÁ ENVIADAS (29/08/2026) — sem elas, renegociar DEPOIS do envio não teria por
  // onde começar: a lista de pendentes some justamente quando a parcela vira conta a
  // pagar. Agrupadas por NOTA, que é a unidade em que o fornecedor renegocia.
  const links = await prisma.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE' },
    select: { refId: true, chave: true, nDup: true, valor: true, dVenc: true, transactionId: true },
    orderBy: { dVenc: 'asc' },
  })
  const contasVivas = links.length
    ? await prisma.transaction.findMany({
        where: { id: { in: links.map((l) => l.transactionId) } },
        select: { id: true, paymentDate: true, reconciledWithId: true, reconcileGroupId: true, lifecycle: true },
      })
    : []
  const porTx = new Map(contasVivas.map((t) => [t.id, t]))
  const notasIds = [...new Set(links.map((l) => l.refId))]
  const notas = notasIds.length
    ? await prisma.stockNfe.findMany({ where: { companyId, id: { in: notasIds } }, select: { id: true, vNF: true, emitNome: true, chave: true } })
    : []
  const combinadas = notasIds.length
    ? await prisma.stockParcelaCombinada.findMany({ where: { companyId, origemDoc: 'NFE', refId: { in: notasIds }, ativo: true, origem: 'RENEGOCIADO' }, select: { refId: true } })
    : []
  const renegociadas = new Set(combinadas.map((c) => c.refId))

  const enviadas = notas.map((n) => {
    const daNota = links.filter((l) => l.refId === n.id)
    const parcelas = daNota.map((l) => {
      const t = porTx.get(l.transactionId)
      return {
        numero: l.nDup,
        valor: l.valor,
        dVenc: l.dVenc.toISOString(),
        existe: !!t,
        // ⛔ paga/conciliada não pode ser reescrita — a tela avisa ANTES de o dono tentar
        intocavel: !!t && (t.paymentDate !== null || t.reconciledWithId !== null || t.reconcileGroupId !== null || t.lifecycle === 'EFFECTED'),
      }
    })
    return {
      nfeId: n.id,
      fornecedor: n.emitNome ?? '(sem nome)',
      total: n.vNF ?? 0,
      renegociada: renegociadas.has(n.id),
      parcelas,
      somaEnviada: Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100,
      temIntocavel: parcelas.some((p) => p.intocavel),
    }
  })

  return NextResponse.json({ pendentes, enviadas })
}

const schema = z.object({
  suggestionIds: z.array(z.string().min(1)).min(1).max(200),
  cadastrarFornecedores: z.boolean().default(true),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Escolha ao menos uma parcela.' }, { status: 400 })
  try {
    const ctx = await getAuthContext(request, companyId)
    const r = await enviarParaContasPagar({ companyId, ...parsed.data, ctx, userId: auth.userId }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof PonteError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
