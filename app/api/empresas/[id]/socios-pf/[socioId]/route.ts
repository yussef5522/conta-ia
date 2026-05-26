// Sprint 5.0.2.h — PATCH/DELETE de um SocioPF específico.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string; socioId: string }>
}

const patchSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  cpf: z.string().regex(/^\d{11}$/).nullable().optional(),
  pixKeys: z.array(z.string().min(1).max(120)).max(10).optional(),
  papel: z.enum(['SOCIO', 'ADMINISTRADOR', 'FAMILIAR']).optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, socioId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = patchSchema.parse(body)

    const updated = await prisma.socioPF.update({
      where: { id: socioId, companyId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.cpf !== undefined && { cpf: data.cpf }),
        ...(data.pixKeys !== undefined && { pixKeys: JSON.stringify(data.pixKeys) }),
        ...(data.papel !== undefined && { papel: data.papel }),
      },
    })
    return NextResponse.json({ socio: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, socioId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.delete')

    await prisma.socioPF.delete({ where: { id: socioId, companyId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
