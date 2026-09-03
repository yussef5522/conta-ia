// ESTOQUE FASE 2 item 2.0 — fichas técnicas (GET lista, POST cria com versão + ciclo).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listFichas, criarFicha, FichaError } from '@/lib/stock/producao/fichas'

interface Params { params: Promise<{ id: string }> }


const componenteSchema = z.object({
  itemId: z.string().min(1), qtdPlanejada: z.number().positive(), unidade: z.string().min(1).max(6), posicao: z.number().int().optional() })
const criarSchema = z.object({
  nomeProduzido: z.string().min(1).max(120),
  unidadeProduzido: z.enum(['KG', 'UN', 'LT']),
  tipoProduto: z.enum(['INTERMEDIARIO', 'PRODUTO_FINAL', 'SABOR']),
  setorId: z.string().nullable().optional(),
  valorVenda: z.number().positive().nullable().optional(),
  loteBase: z.number().positive(),
  unidadeLoteBase: z.enum(['KG', 'UN', 'LT']),
  modoPreparo: z.string().max(4000).nullable().optional(),
  tempoPreparoMin: z.number().int().positive().nullable().optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  componentes: z.array(componenteSchema).min(1),
  // ⭐ o nome do PDV que esta ficha atende. Quando vem, o vínculo nome→ficha é criado na
  // MESMA transação — foi a ausência dele que deixou 3 fichas órfãs em 01/09.
  mapearNomeSuitable: z.string().min(1).max(200).nullable().optional(),
  // ⭐ o mesmo, no mapa dos COMPLEMENTOS (sabores). Mutuamente exclusivo com o de cima.
  mapearComplemento: z.string().min(1).max(200).nullable().optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ fichas: await listFichas(companyId) })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ficha inválidos.', detalhe: parsed.error.issues[0]?.message }, { status: 400 })
  try {
    const r = await criarFicha({ companyId, userId: a.user!.sub, ...parsed.data })
    // ⭐ ITEM 5 do dono: a resposta DIZ se o vínculo foi feito. "salvou mas não vinculou" é
    // infinitamente melhor que voltar em silêncio — foi o silêncio que gerou a duplicata.
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
