// ⭐ RESTAURAR uma conta da lixeira — pela porta única de criação (20/09/2026).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { restaurarConta, RestaurarError } from '@/lib/contas-pagar/lixeira'

const schema = z.object({
  empresaId: z.string().min(1),
  auditId: z.string().min(1),
  /** ⚠️ obrigatório nas remoções antigas — a auditoria da época não guardava o vencimento */
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const p = schema.safeParse(await request.json().catch(() => null))
    if (!p.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
    const ctx = await getAuthContext(request, p.data.empresaId)
    ctx.requirePermission('transaction.create')

    const r = await restaurarConta({
      companyId: p.data.empresaId,
      auditId: p.data.auditId,
      // ⛔ meio-dia UTC: a data é de CALENDÁRIO, e sem o Z ela dependeria do fuso do
      //   processo (a lição da ordem do ano 202, 19/09)
      dueDate: p.data.dueDate ? new Date(`${p.data.dueDate}T12:00:00Z`) : null,
      categoryId: p.data.categoryId ?? null,
      userId: ctx.user.id,
    }, ctx, prisma)

    return NextResponse.json({ ok: true, id: r.id })
  } catch (e) {
    // ⭐ a recusa da restauração ENSINA (falta o vencimento) — não é erro de sistema
    if (e instanceof RestaurarError) return NextResponse.json({ erro: e.message, code: 'RESTAURAR' }, { status: 422 })
    return handleApiError(e)
  }
}
