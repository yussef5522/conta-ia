// Sprint PF Fatia 3 — POST confirm import (cria PersonalTransactions).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  confirmImport,
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
    const map: Record<string, number> = {
      IMPORT_NOT_FOUND: 404,
      INVALID_STATUS: 409,
      NO_CARD: 400,
      INVALID_CATEGORY: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const decisionSchema = z.object({
  fitid: z.string().min(1),
  skip: z.boolean(),
  categoryId: z.string().nullable(),
})

const schema = z.object({
  importId: z.string().min(1),
  rawContent: z.string().min(50),
  decisions: z.array(decisionSchema).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  try {
    const result = await confirmImport({
      userId: user.sub,
      profileId: id,
      importId: parsed.data.importId,
      decisions: parsed.data.decisions,
      rawContent: parsed.data.rawContent,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
