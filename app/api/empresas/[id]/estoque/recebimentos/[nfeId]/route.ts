// ESTOQUE FASE 1 item 2 — GET conferência da NOTA REAL (read-only; CONFIRMAR ainda
// desligado). Só lê stock_nfe/item/emit + mapeamentos. Nenhuma escrita.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { buildConferenceView } from '@/lib/stock/conference'

interface Params { params: Promise<{ id: string; nfeId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const [conference, itensExistentes] = await Promise.all([
    buildConferenceView(companyId, nfeId),
    prisma.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true, unidadeControle: true, categoria: true }, orderBy: { nome: 'asc' }, take: 300 }),
  ])
  if (!conference) return NextResponse.json({ erro: 'Nota não encontrada' }, { status: 404 })
  // PONTE 1 — a tela precisa saber se ESTE usuário pode criar conta a pagar (stock.manage).
  // Quem não pode confere a nota normalmente; as parcelas ficam esperando o dono.
  const ctx = await getAuthContext(request, companyId)
  return NextResponse.json({ conference, itensExistentes, podeEnviarBoletos: ctx.hasPermission('stock.manage') })
}
