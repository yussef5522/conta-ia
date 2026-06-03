// Sprint PF Fatia 3.5 — DELETE cache PDF (só owner).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { deleteCachedExtraction } from '@/lib/pdf-import/cache'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sha256: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { sha256 } = await params
  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    return NextResponse.json({ erro: 'SHA256 inválido' }, { status: 400 })
  }
  const deleted = await deleteCachedExtraction(sha256, user.sub)
  if (!deleted) {
    return NextResponse.json(
      { erro: 'Cache não encontrado ou você não é o owner', code: 'NOT_OWNER' },
      { status: 404 },
    )
  }
  return NextResponse.json({ ok: true })
}
