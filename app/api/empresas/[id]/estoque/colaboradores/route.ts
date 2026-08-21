// ESTOQUE FASE 2 item 2.0 — colaboradores (GET lista, POST cria). Só nome, lista simples.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { listColaboradores, criarColaborador } from '@/lib/stock/producao/cadastros'

interface Params { params: Promise<{ id: string }> }

async function auth(request: NextRequest, companyId: string) {
  const user = await getAuthUser(request)
  if (!user) return { erro: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) return { erro: NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 }) }
  return { user }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  return NextResponse.json({ colaboradores: await listColaboradores(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await auth(request, companyId)
  if (a.erro) return a.erro
  const parsed = z.object({ nome: z.string().min(1).max(80) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe o nome do colaborador.' }, { status: 400 })
  return NextResponse.json({ colaborador: await criarColaborador(companyId, parsed.data.nome) })
}
