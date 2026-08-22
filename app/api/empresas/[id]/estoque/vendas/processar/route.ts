// ESTOQUE FASE 3 passo 2 — POST processar vendas. confirmar=false → PREVIEW (o que baixa +
// pendentes, não grava); confirmar=true → BAIXA_VENDA no ledger (idempotente por dia).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { montarPlanoVenda, processarVendas } from '@/lib/stock/vendas/baixa-venda'
import { SuitableParseError } from '@/lib/stock/vendas/parse-suitable'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({ html: z.string().min(1).max(5_000_000), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confirmar: z.boolean().optional() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o arquivo e a data (AAAA-MM-DD).' }, { status: 400 })
  try {
    if (parsed.data.confirmar) {
      return NextResponse.json({ ok: true, recibo: await processarVendas(companyId, parsed.data.data, parsed.data.html, user.sub, prisma) })
    }
    return NextResponse.json({ plano: await montarPlanoVenda(companyId, parsed.data.data, parsed.data.html, prisma) })
  } catch (e) {
    if (e instanceof SuitableParseError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
