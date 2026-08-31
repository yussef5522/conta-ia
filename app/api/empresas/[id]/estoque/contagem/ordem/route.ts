// ⭐ O CAMINHO FÍSICO — a ordem em que se ANDA pelo estoque.
//
// ⚠️ Ninguém preenche 91 campos à mão: a fila é ARRASTÁVEL e o sistema guarda. A primeira
// contagem estabelece o caminho andando. Item sem posição vai pro FIM.
//
// ⚠️ É `stock.manage`: a ordem vale pra TODA contagem futura — mudar o caminho é decisão
// de organização do estoque, não gesto de quem está contando hoje.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const linhas = await prisma.stockContagemOrdem.findMany({ where: { companyId }, select: { itemId: true, ordem: true } })
  return NextResponse.json({ caminho: Object.fromEntries(linhas.map((l) => [l.itemId, l.ordem])) })
}

const schema = z.object({ caminho: z.array(z.object({ itemId: z.string().min(1), ordem: z.number().int().min(0) })).max(2000) })

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Caminho inválido.' }, { status: 400 })

  // ⚠️ grava o caminho INTEIRO renumerado: guardar só a linha movida deixaria buracos e
  // empates, e empate faz a fila trocar de ordem sozinha entre dois carregamentos.
  await prisma.$transaction(
    parsed.data.caminho.map((c) =>
      prisma.stockContagemOrdem.upsert({
        where: { companyId_itemId: { companyId, itemId: c.itemId } },
        create: { companyId, itemId: c.itemId, ordem: c.ordem, definidoPorId: auth.userId ?? null },
        update: { ordem: c.ordem, definidoPorId: auth.userId ?? null },
      }),
    ),
  )
  return NextResponse.json({ ok: true, itens: parsed.data.caminho.length })
}
