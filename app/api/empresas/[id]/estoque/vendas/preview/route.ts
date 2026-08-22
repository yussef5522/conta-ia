// ESTOQUE FASE 3 — POST preview do import de vendas do Suitable (parse + resolve o mapa).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { previewImportSuitable } from '@/lib/stock/vendas/venda-map'
import { SuitableParseError } from '@/lib/stock/vendas/parse-suitable'

interface Params { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = z.object({ html: z.string().min(1).max(5_000_000) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Envie o conteúdo do arquivo.' }, { status: 400 })
  try {
    return NextResponse.json({ preview: await previewImportSuitable(companyId, parsed.data.html, prisma) })
  } catch (e) {
    if (e instanceof SuitableParseError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
