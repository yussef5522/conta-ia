// ESTOQUE PARTE C — POST registrar saída (perda/uso interno). Motivo obrigatório.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { registrarSaida, SaidaError, MOTIVOS } from '@/lib/stock/saida'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  itemId: z.string().min(1),
  quantidade: z.number().positive(),
  motivo: z.enum(Object.keys(MOTIVOS) as [string, ...string[]]),
  motivoTexto: z.string().max(300).nullable().optional(),
  fotoBase64: z.string().max(2_000_000).nullable().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe item, quantidade e motivo.' }, { status: 400 })
  try {
    const r = await registrarSaida({ companyId, userId: user.sub, ...parsed.data, motivo: parsed.data.motivo as keyof typeof MOTIVOS }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof SaidaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
