// ESTOQUE FASE 2 item 2.0 — ficha (GET detalhe + versões, PATCH edita com versionamento).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { getFicha, atualizarFicha, FichaError } from '@/lib/stock/producao/fichas'
import { excluirFicha, preverExclusaoDaFicha, ExcluirFichaError } from '@/lib/stock/producao/excluir-ficha'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string; fichaId: string }> }


const componenteSchema = z.object({ itemId: z.string().min(1), qtdPlanejada: z.number().positive(), unidade: z.string().min(1).max(6), posicao: z.number().int().optional() })
const patchSchema = z.object({
  nomeProduzido: z.string().min(1).max(120).optional(),
  setorId: z.string().nullable().optional(),
  valorVenda: z.number().positive().nullable().optional(),
  ativo: z.boolean().optional(),
  loteBase: z.number().positive().optional(),
  unidadeLoteBase: z.enum(['KG', 'UN', 'LT']).optional(),
  modoPreparo: z.string().max(4000).nullable().optional(),
  tempoPreparoMin: z.number().int().positive().nullable().optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  componentes: z.array(componenteSchema).min(1).optional(),
  // ⭐ etapas (06/09): lista ordenada de nomes. `[]` é significativo (apaga as anteriores).
  etapas: z.array(z.object({ nome: z.string().min(1).max(60), setorId: z.string().nullable().optional() })).max(12).optional(),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const r = await getFicha(companyId, fichaId)
  if (!r) return NextResponse.json({ erro: 'Ficha não encontrada' }, { status: 404 })
  return NextResponse.json(r)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ erro: 'Nada pra atualizar' }, { status: 400 })
  try {
    const r = await atualizarFicha(companyId, fichaId, { ...parsed.data, userId: a.user!.sub })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof FichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}

/**
 * ⭐⭐ A PRÉVIA DA EXCLUSÃO — o que o confirm imprime **antes** do dono clicar.
 *
 * ⚠️ Ela é a MESMA função que o DELETE executa: se a tela calculasse o caso por conta
 * própria, prometeria "será excluída" e o servidor desativaria.
 */
export async function OPTIONS(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try {
    return NextResponse.json(await preverExclusaoDaFicha(companyId, fichaId))
  } catch (e) {
    if (e instanceof ExcluirFichaError) return NextResponse.json({ erro: e.message }, { status: 404 })
    throw e
  }
}

/**
 * ⭐⭐⭐ EXCLUIR A RECEITA. ⛔ **Quem decide entre APAGAR e DESATIVAR é o servidor** — a
 * tela só pergunta. Receita sem lote some de vez; com história, desativa e o passado fica.
 *
 * ⚠️ `stock.manage`, não `operate`: apagar receita é decisão de quem manda no cardápio da
 * cozinha, a mesma fronteira do boleto (24/08).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: companyId, fichaId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try {
    const prometido = new URL(request.url).searchParams.get('prometido')
    const r = await excluirFicha(companyId, fichaId, prisma, a.user?.sub, prometido === 'EXCLUI' || prometido === 'DESATIVA' ? prometido : undefined)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ExcluirFichaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    const t = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (t) return NextResponse.json({ erro: t.erro, code: t.code, saida: t.saida }, { status: t.status })
    throw e
  }
}
