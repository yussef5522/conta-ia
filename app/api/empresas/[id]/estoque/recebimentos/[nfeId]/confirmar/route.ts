// ESTOQUE FASE 1 item 2 — POST confirmar a conferência. Gera movimentos + contas a
// pagar sugerido + Confirmação SEFAZ. Só escreve stock_*. Auth + empresa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { confirmarConferencia } from '@/lib/stock/confirmar-conferencia'

interface Params { params: Promise<{ id: string; nfeId: string }> }

const itemSchema = z.object({
  nfeItemId: z.string(),
  cProd: z.string().default(''),
  xProd: z.string(),
  uCom: z.string().default(''),
  qtdNota: z.coerce.number(),
  vUnCom: z.coerce.number(),
  qtdRecebida: z.coerce.number().positive('quantidade recebida tem que ser > 0'),
  motivo: z.string().nullable().optional(),
  fotoBase64: z.string().nullable().optional(),
  mapeado: z.object({
    itemId: z.string(),
    nome: z.string().min(1),
    unidadeControle: z.enum(['KG', 'UN', 'LT']),
    categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).optional(),
    fatorConversao: z.coerce.number().positive().default(1),
    novo: z.boolean(),
  }),
})
const bodySchema = z.object({
  fornecedor: z.object({ cnpj: z.string(), nome: z.string(), uf: z.string().nullable().optional() }),
  itens: z.array(itemSchema).min(1),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos', detalhe: parsed.error.issues[0]?.message }, { status: 400 })

  try {
    const r = await confirmarConferencia({ companyId, nfeId, userId: user.sub, fornecedor: parsed.data.fornecedor, itens: parsed.data.itens })
    return NextResponse.json({ ok: true, resultado: r })
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 422 })
  }
}
