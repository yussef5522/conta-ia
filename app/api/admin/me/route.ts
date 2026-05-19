// GET /api/admin/me — Sprint 1.6.
// Retorna gerenciador autenticado (fresh from DB pra checar active/role).

import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminSessionFromRequest,
  loadGerenciador,
} from '@/lib/admin-auth/session'
import { isAdminHost } from '@/lib/middleware/subdomain'

export async function GET(request: NextRequest) {
  if (!isAdminHost(request.headers.get('host'))) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json(
      { erro: 'Não autenticado', success: false },
      { status: 401 },
    )
  }

  const gerenciador = await loadGerenciador(session.sub)
  if (!gerenciador || !gerenciador.active) {
    return NextResponse.json(
      { erro: 'Sessão inválida', success: false },
      { status: 401 },
    )
  }

  return NextResponse.json({
    success: true,
    gerenciador,
  })
}
