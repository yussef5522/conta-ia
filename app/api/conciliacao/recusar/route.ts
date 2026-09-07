// POST /api/conciliacao/recusar — "não é isso".
//
// ⭐ A recusa ENSINA: o par recusado não volta a ser sugerido, em tela nenhuma.
// ⚠️ É do PAR, nunca da linha: o mesmo extrato continua podendo casar com outra
// nota do mesmo fornecedor — foi assim que a confusão entre as duas notas do
// Cancian (834771 × 835271) deixou de ser possível de "resolver escondendo".

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const schema = z.object({
  empresaId: z.string().cuid(),
  extratoId: z.string().cuid(),
  contaId: z.string().cuid(),
  motivo: z.string().max(300).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const data = schema.parse(await request.json())
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.update')

    // ⛔ o unique por par faz o "recusar duas vezes" ser inofensivo por construção
    const r = await prisma.conciliacaoParRecusado.upsert({
      where: { extratoId_contaId: { extratoId: data.extratoId, contaId: data.contaId } },
      create: {
        companyId: data.empresaId,
        extratoId: data.extratoId,
        contaId: data.contaId,
        motivo: data.motivo ?? null,
        recusadoPorId: ctx.user?.id ?? null,
      },
      update: {},
    })
    return NextResponse.json({ ok: true, id: r.id })
  } catch (error) {
    return handleApiError(error)
  }
}

/** DELETE — desfaz a recusa (o dono mudou de ideia; nada aqui é definitivo) */
export async function DELETE(request: NextRequest) {
  try {
    const data = schema.parse(await request.json())
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.update')

    await prisma.conciliacaoParRecusado.deleteMany({
      where: { companyId: data.empresaId, extratoId: data.extratoId, contaId: data.contaId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
