// ESTOQUE FASE 3 passo 2 — POST processar vendas. confirmar=false → PREVIEW (não grava);
// confirmar=true → BAIXA_VENDA (idempotente por dia). reprocessar=true → refaz um dia já
// importado a partir das linhas gravadas (sem re-upload). incluir = nomes marcados (checkbox).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { montarPlanoVenda, processarVendas, reprocessarDia } from '@/lib/stock/vendas/baixa-venda'
import { SuitableParseError } from '@/lib/stock/vendas/parse-suitable'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data das vendas (AAAA-MM-DD).'),
  html: z.string().max(5_000_000).optional(),
  confirmar: z.boolean().optional(),
  reprocessar: z.boolean().optional(),
  incluir: z.array(z.string()).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { data, html, confirmar, reprocessar, incluir } = parsed.data
  try {
    if (reprocessar) return NextResponse.json({ ok: true, recibo: await reprocessarDia(companyId, data, user.sub, prisma) })
    if (!html) return NextResponse.json({ erro: 'Envie o arquivo do dia.' }, { status: 400 })
    if (confirmar) return NextResponse.json({ ok: true, recibo: await processarVendas(companyId, data, html, user.sub, prisma, incluir ?? null) })
    return NextResponse.json({ plano: await montarPlanoVenda(companyId, data, html, prisma, incluir ?? null) })
  } catch (e) {
    if (e instanceof SuitableParseError) return NextResponse.json({ erro: e.message }, { status: 422 })
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 })
  }
}
