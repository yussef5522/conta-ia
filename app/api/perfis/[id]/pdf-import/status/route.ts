// Sprint PF Fatia 3.5 — GET status do PDF import (UI decide se mostra opção).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { checkPdfImportFlag } from '@/lib/pdf-import/feature-flag'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const status = checkPdfImportFlag()
  return NextResponse.json(status)
}
