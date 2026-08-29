// ⭐ AJUSTAR PARCELAS — o combinado ≠ a nota (29/08/2026, caso BOX PAPER).
//
// GET  → o que a NOTA diz (XML, cru) + o que está COMBINADO hoje, lado a lado.
// PUT  → grava o combinado novo. Se a nota já mandou parcelas pro financeiro, cancela as
//        PENDENTES e recria (nunca as pagas/conciliadas — a rota devolve 422 nomeando).
//
// ⚠️ PERMISSÃO: mexer em parcela é mexer em OBRIGAÇÃO FINANCEIRA → `stock.manage`, a
// mesma régua de enviar boleto. O OPERADOR_ESTOQUE confere a mercadoria; o combinado com
// o fornecedor é assunto do dono. Ler é `stock.view` — ler nunca exige gerenciar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { combinadoDaNota, validarCombinado, CombinadoError } from '@/lib/stock/ponte/combinado'
import { renegociarParcelasDaNota } from '@/lib/stock/ponte/renegociar-enviadas'

interface Params { params: Promise<{ id: string; nfeId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const c = await combinadoDaNota(companyId, nfeId, prisma)
  if (!c) return NextResponse.json({ erro: 'Nota não encontrada.' }, { status: 404 })

  // quais já viraram conta a pagar? (o dono precisa saber o que a edição vai cancelar)
  const links = await prisma.stockPayableLink.findMany({
    where: { companyId, origem: 'NFE', refId: nfeId },
    select: { nDup: true, transactionId: true, valor: true },
  })
  const contas = links.length
    ? await prisma.transaction.findMany({
        where: { id: { in: links.map((l) => l.transactionId) } },
        select: { id: true, paymentDate: true, reconciledWithId: true, reconcileGroupId: true, lifecycle: true },
      })
    : []
  const porId = new Map(contas.map((t) => [t.id, t]))
  const enviadas = links.map((l) => {
    const t = porId.get(l.transactionId)
    return {
      numero: l.nDup,
      valor: l.valor,
      existe: !!t,
      intocavel: !!t && (t.paymentDate !== null || t.reconciledWithId !== null || t.reconcileGroupId !== null || t.lifecycle === 'EFFECTED'),
    }
  })

  return NextResponse.json({
    nota: { id: nfeId, total: c.totalNota },
    xml: c.xml.map((x) => ({ numero: x.numero, valor: x.valor, dVenc: x.dVenc?.toISOString() ?? null })),
    combinado: c.parcelas.map((p) => ({ numero: p.numero, valor: p.valor, dVenc: p.dVenc.toISOString(), origem: p.origem })),
    renegociado: c.renegociado,
    motivo: c.motivo,
    somaCombinado: c.somaCombinado,
    fechaComANota: c.fechaComANota,
    enviadas,
  })
}

const schema = z.object({
  parcelas: z
    .array(z.object({ valor: z.number().positive(), dVenc: z.string().min(8) }))
    .min(1)
    .max(60),
  motivo: z.string().max(200).nullish(),
  /** só valida e devolve os avisos, sem gravar — é o que a tela usa enquanto o dono digita */
  simular: z.boolean().optional(),
})

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Cada parcela precisa de valor e vencimento.' }, { status: 400 })
  }
  const { parcelas, motivo, simular } = parsed.data

  const atual = await combinadoDaNota(companyId, nfeId, prisma)
  if (!atual) return NextResponse.json({ erro: 'Nota não encontrada.' }, { status: 404 })

  // ⚠️ SIMULAR devolve 200 mesmo com erro de validação: é a tela conversando enquanto o
  // dono digita, não um envio. Erro de digitação em progresso não é falha de requisição.
  if (simular) {
    return NextResponse.json({
      simulacao: validarCombinado({
        parcelas: parcelas.map((p, i) => ({ numero: `R${i + 1}`, valor: p.valor, dVenc: p.dVenc })),
        totalNota: atual.totalNota,
        motivo,
        hoje: new Date(),
      }),
    })
  }

  try {
    const ctx = await getAuthContext(request, companyId)
    // ⭐ UM caminho só pra gravar, tenha a nota mandado parcelas ou não: se não mandou,
    // `contasCanceladas` volta 0 e o efeito é exatamente a edição pré-envio. Dois caminhos
    // (um "antes", outro "depois") divergiriam na primeira regra nova — REGRA 4/5.
    const r = await renegociarParcelasDaNota(
      { companyId, nfeId, parcelas, motivo, reenviar: true, ctx, userId: auth.userId },
      prisma,
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof CombinadoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
