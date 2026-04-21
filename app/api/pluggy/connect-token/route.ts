import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createConnectToken, PLUGGY_ENABLED } from '@/lib/pluggy/client'

// POST /api/pluggy/connect-token
// Body: { itemId?: string } — itemId para reconectar item existente
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  if (!PLUGGY_ENABLED) {
    return NextResponse.json({ erro: 'Integração Pluggy não configurada' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const token = await createConnectToken(body.itemId)

  if (!token) return NextResponse.json({ erro: 'Falha ao gerar token Pluggy' }, { status: 502 })

  return NextResponse.json({ connectToken: token })
}
