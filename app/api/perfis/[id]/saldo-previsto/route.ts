// Sprint PF Fatia 2 — Saldo previsto (alimenta dashboard).
//
// = saldo atual das contas - faturas em aberto - parcelas futuras (>30d)

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  getSaldoPrevisto,
  isCreditCardError,
  isProfileAccessError,
} from '@/lib/credit-card/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    return NextResponse.json({ erro: err.message, code: err.code }, { status: 400 })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  try {
    const data = await getSaldoPrevisto(user.sub, id)
    return NextResponse.json(data)
  } catch (err) {
    return errorResponse(err)
  }
}
