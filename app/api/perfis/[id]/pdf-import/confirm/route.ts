// Sprint PF Fatia 3.5 — POST confirm PDF.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import {
  confirmPdfImport,
  isPdfConfirmError,
} from '@/lib/pdf-import/confirm'
import { ProfileAccessError } from '@/lib/personal-profile/queries'
import { isCreditCardError } from '@/lib/credit-card/queries'
import { checkPdfImportFlag } from '@/lib/pdf-import/feature-flag'

function errorResponse(err: unknown) {
  if (err instanceof ProfileAccessError) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    const s = err.code === 'CARD_NOT_FOUND' ? 404 : 400
    return NextResponse.json({ erro: err.message, code: err.code }, { status: s })
  }
  if (isPdfConfirmError(err)) {
    const map: Record<string, number> = {
      IMPORT_NOT_FOUND: 404,
      INVALID_STATUS: 409,
      WRONG_SOURCE: 400,
      CACHE_EXPIRED: 410,
      NO_CARD: 400,
      NO_HASH: 400,
      INVALID_CATEGORY: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

const schema = z.object({
  importId: z.string().min(1),
  decisions: z.array(
    z.object({
      fitid: z.string().min(1),
      skip: z.boolean(),
      categoryId: z.string().nullable(),
    }),
  ).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params

  const gate = checkPdfImportFlag()
  if (!gate.allowed) {
    return NextResponse.json(
      { erro: gate.message, code: gate.reason },
      { status: 403 },
    )
  }

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
    const result = await confirmPdfImport({
      userId: user.sub,
      profileId: id,
      importId: parsed.data.importId,
      decisions: parsed.data.decisions,
    })
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
