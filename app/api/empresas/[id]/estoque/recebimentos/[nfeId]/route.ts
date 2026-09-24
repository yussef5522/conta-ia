// ESTOQUE FASE 1 item 2 — GET conferência da NOTA REAL (read-only; CONFIRMAR ainda
// desligado). Só lê stock_nfe/item/emit + mapeamentos. Nenhuma escrita.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { buildConferenceView } from '@/lib/stock/conference'
import { itensParaCasarNoRecebimento } from '@/lib/stock/itens-do-recebimento'

interface Params { params: Promise<{ id: string; nfeId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const user = a.user
  const [conference, itensExistentes] = await Promise.all([
    buildConferenceView(companyId, nfeId),
    /**
     * ⭐ 23/09: esta rota listava `{ companyId, ativo: true }` com `take: 300` — **sem
     * declarar universo**, então 189 invólucros de cardápio comiam as vagas e o `sal`
     * (o 341º em ordem alfabética) **não chegava na tela**. Um dono só da pergunta.
     */
    itensParaCasarNoRecebimento(companyId, prisma),
  ])
  if (!conference) return NextResponse.json({ erro: 'Nota não encontrada' }, { status: 404 })
  // PONTE 1 — a tela precisa saber se ESTE usuário pode criar conta a pagar (stock.manage).
  // Quem não pode confere a nota normalmente; as parcelas ficam esperando o dono.
  const ctx = await getAuthContext(request, companyId)
  return NextResponse.json({ conference, itensExistentes, podeEnviarBoletos: ctx.hasPermission('stock.manage') })
}
