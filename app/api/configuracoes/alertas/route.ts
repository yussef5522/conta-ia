// Sprint 4.0.4 — preferências de email alerts do user logado.
// GET retorna estado atual. PATCH atualiza enabled + frequency.
//
// Multi-tenant: NÃO se aplica (preferência é do User, não da empresa).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/api/handle-error'
import { verifyToken } from '@/lib/auth'

const updateSchema = z.object({
  emailAlertsEnabled: z.boolean().optional(),
  emailAlertsFrequency: z.enum(['DAILY', 'WEEKLY', 'NONE']).optional(),
})

async function loadUserFromRequest(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  try {
    const payload = await verifyToken(token)
    if (!payload.sub) return null
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        emailAlertsEnabled: true,
        emailAlertsFrequency: true,
      },
    })
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await loadUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({
      emailAlertsEnabled: user.emailAlertsEnabled,
      emailAlertsFrequency: user.emailAlertsFrequency,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await loadUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.emailAlertsEnabled !== undefined
          ? { emailAlertsEnabled: data.emailAlertsEnabled }
          : {}),
        ...(data.emailAlertsFrequency !== undefined
          ? { emailAlertsFrequency: data.emailAlertsFrequency }
          : {}),
      },
      select: {
        emailAlertsEnabled: true,
        emailAlertsFrequency: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
