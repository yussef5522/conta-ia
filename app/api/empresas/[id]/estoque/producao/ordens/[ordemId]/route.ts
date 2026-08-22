// ESTOQUE FASE 2 item 2.1 — detalhe da ordem + separação pré-preenchida (explode a ficha).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { explodirSeparacao, OrdemError } from '@/lib/stock/producao/ordens'
import { listConclusoes, rendimentoMedioDaFicha } from '@/lib/stock/producao/conclusao'

interface Params { params: Promise<{ id: string; ordemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  try {
    const { ordem, linhas } = await explodirSeparacao(companyId, ordemId)
    const [conclusoes, colaboradores, rendimentoMedio] = await Promise.all([
      listConclusoes(companyId, ordemId),
      prisma.stockColaborador.findMany({ where: { companyId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      rendimentoMedioDaFicha(companyId, ordem.fichaId),
    ])
    return NextResponse.json({ ordem, linhas, conclusoes, colaboradores, rendimentoMedio })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}
