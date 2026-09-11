// ⭐ O CORTE DE ÉPOCA DA CONCILIAÇÃO — GET lê, PUT define (11/09/2026).
//
// ⚠️ Rota PRÓPRIA, e não mais um campo no `PUT /empresas/[id]`: aquele é o formulário
// completo do cadastro e exige o payload inteiro — um controle de uma linha na Conciliação
// teria que reenviar nome, CNPJ e endereço pra mudar uma data. O corte é decisão de
// OPERAÇÃO, não de cadastro.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'

const schema = z.object({
  empresaId: z.string().cuid(),
  // ⭐ `null` = sem corte (a fila enxerga tudo) — é um estado válido, não "não informado"
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export async function GET(request: NextRequest) {
  const empresaId = request.nextUrl.searchParams.get('empresaId')
  if (!empresaId) return NextResponse.json({ erro: 'empresaId é obrigatório' }, { status: 400 })
  const ctx = await getAuthContext(request, empresaId)
  ctx.requirePermission('transaction.view')
  const c = await prisma.company.findUnique({ where: { id: empresaId }, select: { conciliarAPartirDe: true } })
  return NextResponse.json({ corte: c?.conciliarAPartirDe?.toISOString().slice(0, 10) ?? null })
}

export async function PUT(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { empresaId, data } = parsed.data
  const ctx = await getAuthContext(request, empresaId)
  // ⛔ mudar o que a fila oferece é decisão de quem CONCILIA, não de quem só lê
  ctx.requirePermission('transaction.update')
  await prisma.company.update({
    where: { id: empresaId },
    // ⚠️ meia-noite UTC: o corte é DATA DE CALENDÁRIO ("a partir do dia 1"), não instante.
    data: { conciliarAPartirDe: data ? new Date(`${data}T00:00:00.000Z`) : null },
  })
  return NextResponse.json({ ok: true, corte: data })
}
