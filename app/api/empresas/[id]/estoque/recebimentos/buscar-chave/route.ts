// ESTOQUE FASE 1 item 4 — POST buscar NF-e por chave ("chegou sem aparecer na fila").
// A câmera/OCR lê a chave no client; aqui a gente valida e bate na SEFAZ (consChNFe).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buscarNfePorChave } from '@/lib/stock/sefaz/buscar-por-chave'

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({ chave: z.string().min(1).max(60) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 })
  if (!(await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } }))) {
    return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a chave da nota (44 dígitos).' }, { status: 400 })

  try {
    const r = await buscarNfePorChave({ companyId, chave: parsed.data.chave })
    return NextResponse.json(r, { status: r.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, motivo: `Falha ao consultar a SEFAZ: ${(e as Error).message}` }, { status: 500 })
  }
}
