// ESTOQUE FASE 1 — GET ficha do produto (lê o ledger). Só lê.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { renomearEmLote } from '@/lib/stock/nomes/renomear-em-lote'
import { buildFichaItem } from '@/lib/stock/ficha-item'

interface Params { params: Promise<{ id: string; itemId: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  // ⭐ ?forense=1 abre os pares que se anulam. O padrão é CLEAN (11/09).
  const ficha = await buildFichaItem(companyId, itemId, undefined, { forense: request.nextUrl.searchParams.get('forense') === '1' })
  if (!ficha) return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 })
  return NextResponse.json({ ficha })
}

// PATCH — renomear/recategorizar o item. O NOME é do dono, não da nota (bug do prefixo).
const patchSchema = z.object({
  nome: z.string().min(1).max(120).optional(),
  categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).optional(),
  unidadeControle: z.enum(['KG', 'UN', 'LT']).optional(),
  estoqueMin: z.number().nonnegative().nullable().optional(),
  estoqueMax: z.number().positive().nullable().optional(),
  ativo: z.boolean().optional(),
})
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, itemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ erro: 'Nada pra atualizar' }, { status: 400 })
  const existe = await prisma.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, estoqueMin: true, estoqueMax: true } })
  if (!existe) return NextResponse.json({ erro: 'Item não encontrado' }, { status: 404 })
  // validação min < max (app-level; stockItem já existe, não dá pra ALTER + CHECK sob o isolamento)
  const novoMin = parsed.data.estoqueMin !== undefined ? parsed.data.estoqueMin : existe.estoqueMin
  const novoMax = parsed.data.estoqueMax !== undefined ? parsed.data.estoqueMax : existe.estoqueMax
  if (novoMin != null && novoMax != null && novoMin >= novoMax) {
    return NextResponse.json({ erro: 'O mínimo tem que ser menor que o máximo.' }, { status: 400 })
  }
  // ⭐⭐ O RENAME TEM UM DONO SÓ (09/09/2026) — REGRA 4.
  //
  // ⛔ Este PATCH renomeava por conta própria: **sem gravar o apelido** (então buscar pelo
  // nome antigo deixava de achar — justo o que a tabela de apelido existe pra impedir) e
  // **sem checar nome duplicado** (o lote checa; aqui dois itens podiam ficar com o mesmo
  // nome e a busca parava de distinguir). Medido: **11 itens renomeados por aqui e 0
  // apelidos gravados**.
  //
  // ⚠️ O resto do PATCH (categoria, unidade, mín/máx) segue igual — só o NOME passou a ir
  // pelo dono.
  const { nome, ...resto } = parsed.data
  if (nome !== undefined) {
    const r = await renomearEmLote({ companyId, userId: a.user!.sub, pedidos: [{ itemId, nomeNovo: nome }] }, prisma)
    if (r.pulados.length && !r.aplicados.length) {
      const motivo = r.pulados[0].motivo
      // ⚠️ "nome igual ao atual" não é erro — é no-op; o resto é conflito que o dono resolve
      if (!/igual ao atual/i.test(motivo)) return NextResponse.json({ erro: motivo }, { status: 409 })
    }
  }
  const item = Object.keys(resto).length
    ? await prisma.stockItem.update({ where: { id: itemId }, data: resto, select: { id: true, nome: true, categoria: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } })
    : (await prisma.stockItem.findUniqueOrThrow({ where: { id: itemId }, select: { id: true, nome: true, categoria: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } }))
  return NextResponse.json({ ok: true, item })
}
