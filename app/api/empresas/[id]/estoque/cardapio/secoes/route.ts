// ⭐ As seções do cardápio: listar, criar/renomear, reordenar.
//
// *"Lista editável (cadastro simples, ordem minha) — seção nova nasce quando eu precisar,
// sem sprint."* — o dono.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/api/handle-error'
import { guardStock } from '@/lib/stock/require-stock'
import { secoesDaEmpresa } from '@/lib/stock/cardapio/secoes-db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params
    const a = await guardStock(request, companyId, 'stock.view')
    if (a.erro) return a.erro
    return NextResponse.json({ secoes: await secoesDaEmpresa(companyId) })
  } catch (error) { return handleApiError(error) }
}

const corpo = z.object({
  chave: z.string().min(1).max(40).regex(/^[A-Z0-9_]+$/, 'a chave é MAIÚSCULA, sem espaço'),
  nome: z.string().min(1).max(60),
  ordem: z.coerce.number().int().min(0).max(999).optional(),
  ativo: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params
    const a = await guardStock(request, companyId, 'stock.manage')
    if (a.erro) return a.erro
    const d = corpo.parse(await request.json())
    // ⚠️ garante o seed antes de mexer, senão a 1ª edição criaria uma lista de 1 seção
    await secoesDaEmpresa(companyId)
    const s = await prisma.stockCardapioSecao.upsert({
      where: { companyId_chave: { companyId, chave: d.chave } },
      create: { companyId, chave: d.chave, nome: d.nome, ordem: d.ordem ?? 50 },
      update: { nome: d.nome, ...(d.ordem != null ? { ordem: d.ordem } : {}), ...(d.ativo != null ? { ativo: d.ativo } : {}) },
      select: { chave: true, nome: true, ordem: true, ativo: true },
    })
    return NextResponse.json({ ok: true, secao: s })
  } catch (error) { return handleApiError(error) }
}
