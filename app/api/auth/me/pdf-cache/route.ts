// Sprint PF Fatia 3.5 — Lista caches PDF do user (LGPD transparency).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { listOwnerCaches } from '@/lib/pdf-import/cache'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const caches = await listOwnerCaches(user.sub)
  return NextResponse.json({ caches })
}
