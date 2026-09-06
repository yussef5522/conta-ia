// ⭐ INATIVAR / REATIVAR colaborador de produção pela tela (06/09/2026).
//
// ⛔⛔ INATIVAR NUNCA APAGA: o colaborador é quem ASSINA etapa de produção — apagar deixaria
// etapas antigas apontando pro nada. E o caminho de VOLTA existe de propósito: sem ele,
// inativar seria porta sem maçaneta (o mesmo beco do PIN esquecido).
//
// ⚠️ O GUARD mora na LIB e o script chama a mesma função (REGRA 4): duas cópias divergiriam
// na primeira regra nova, e a divergente seria justamente a que deixa passar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { inativarColaborador, reativarColaborador, ColaboradorEmUsoError } from '@/lib/equipe/inativar-colaborador'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ colaboradorId: z.string().min(1), ativo: z.boolean() })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⚠️ tirar alguém da produção é GERÊNCIA — é decidir quem pode assinar trabalho
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    if (parsed.data.ativo) await reativarColaborador(companyId, parsed.data.colaboradorId, prisma)
    else await inativarColaborador(companyId, parsed.data.colaboradorId, prisma)
  } catch (e) {
    // ⚠️ a mensagem vai INTEIRA pra tela: "tem 2 etapas em andamento" ensina o que fazer;
    // "não foi possível" manda adivinhar.
    if (e instanceof ColaboradorEmUsoError) return NextResponse.json({ erro: e.message }, { status: 409 })
    throw e
  }
  return NextResponse.json({ ok: true })
}
