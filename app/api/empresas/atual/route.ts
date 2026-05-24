// Sprint 4.0.5.b — POST seta cookie current_empresa_id.
// Valida que o user tem acesso à empresa antes de setar (defesa).
// Chamado pelo EmpresaContext (client) quando user muda empresa no TopBar.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { handleApiError } from '@/lib/api/handle-error'
import {
  setCurrentEmpresaCookie,
  clearCurrentEmpresaCookie,
} from '@/lib/auth/current-empresa-cookie'

const bodySchema = z.object({
  empresaId: z.string().cuid().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    const payload = await verifyToken(token).catch(() => null)
    if (!payload?.sub) {
      return NextResponse.json({ erro: 'Token inválido' }, { status: 401 })
    }

    const body = await request.json()
    const { empresaId } = bodySchema.parse(body)

    if (empresaId === null) {
      await clearCurrentEmpresaCookie()
      return NextResponse.json({ ok: true, empresaId: null })
    }

    // Valida que user tem acesso (multi-tenant guard)
    const access = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: payload.sub, companyId: empresaId } },
      select: { id: true },
    })
    if (!access) {
      return NextResponse.json({ erro: 'Sem acesso a essa empresa' }, { status: 403 })
    }

    await setCurrentEmpresaCookie(empresaId)
    return NextResponse.json({ ok: true, empresaId })
  } catch (error) {
    return handleApiError(error)
  }
}
