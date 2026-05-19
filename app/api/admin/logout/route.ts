// POST /api/admin/logout — Sprint 1.6.
// Limpa cookie admin_session + audit ADMIN_LOGOUT.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions,
} from '@/lib/admin-auth/jwt'
import { getAdminSessionFromRequest } from '@/lib/admin-auth/session'
import { isAdminHost } from '@/lib/middleware/subdomain'

export async function POST(request: NextRequest) {
  if (!isAdminHost(request.headers.get('host'))) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const session = await getAdminSessionFromRequest(request)
  if (session) {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      null
    const userAgent = request.headers.get('user-agent') ?? null
    await prisma.gerenciadorAuditLog
      .create({
        data: {
          gerenciadorId: session.sub,
          action: 'ADMIN_LOGOUT',
          ipAddress,
          userAgent,
        },
      })
      .catch(() => null)
  }

  const response = NextResponse.json({ success: true })
  // Sobrescreve o cookie com maxAge=0 (mesmo Domain pra browser remover)
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    ...getAdminCookieOptions(),
    maxAge: 0,
  })

  return response
}
