// ESTOQUE FASE 1 item 4 — POST buscar NF-e por chave ("chegou sem aparecer na fila").
// A câmera/OCR lê a chave no client; aqui a gente valida e bate na SEFAZ (consChNFe).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { buscarNfePorChave } from '@/lib/stock/sefaz/buscar-por-chave'

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({ chave: z.string().min(1).max(60) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a chave da nota (44 dígitos).' }, { status: 400 })

  try {
    const r = await buscarNfePorChave({ companyId, chave: parsed.data.chave })
    return NextResponse.json(r, { status: r.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: `Falha ao consultar a SEFAZ: ${(e as Error).message}` }, { status: 500 })
  }
}
