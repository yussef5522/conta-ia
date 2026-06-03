// Sprint PF Fatia 3 — POST reverter import.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  revertImport,
  isOfxCardError,
  isProfileAccessError,
} from '@/lib/ofx-card/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isOfxCardError(err)) {
    const s = err.code === 'IMPORT_NOT_FOUND' ? 404 : err.code === 'INVALID_STATUS' ? 409 : 400
    return NextResponse.json({ erro: err.message, code: err.code }, { status: s })
  }
  throw err
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; importId: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id, importId } = await params
  try {
    const result = await revertImport({
      userId: user.sub,
      profileId: id,
      importId,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
