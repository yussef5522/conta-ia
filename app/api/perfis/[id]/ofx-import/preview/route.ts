// Sprint PF Fatia 3 — POST preview do import OFX.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  createPreview,
  isOfxCardError,
  isProfileAccessError,
} from '@/lib/ofx-card/queries'
import { isCreditCardError } from '@/lib/credit-card/queries'

function errorResponse(err: unknown) {
  if (isProfileAccessError(err)) {
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: err.code === 'NO_ACCESS' ? 404 : 403 },
    )
  }
  if (isCreditCardError(err)) {
    const s = err.code === 'CARD_NOT_FOUND' ? 404 : 400
    return NextResponse.json({ erro: err.message, code: err.code }, { status: s })
  }
  if (isOfxCardError(err)) {
    const map: Record<string, number> = {
      PARSE_FAILED: 400,
      TOO_MANY_TX: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  const { id } = await params

  const ct = request.headers.get('content-type') ?? ''

  let creditCardId = ''
  let fileName = ''
  let fileSize = 0
  let rawContent = ''

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData()
    creditCardId = String(form.get('creditCardId') ?? '')
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ erro: 'file ausente' }, { status: 400 })
    }
    fileName = file.name
    fileSize = file.size
    rawContent = await file.text()
  } else {
    // JSON fallback (testes)
    const body = await request.json().catch(() => null) as
      | { creditCardId?: string; fileName?: string; rawContent?: string }
      | null
    if (!body) return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    creditCardId = body.creditCardId ?? ''
    fileName = body.fileName ?? 'import.ofx'
    fileSize = body.rawContent?.length ?? 0
    rawContent = body.rawContent ?? ''
  }

  if (!creditCardId) {
    return NextResponse.json({ erro: 'creditCardId obrigatório' }, { status: 400 })
  }
  if (!rawContent || rawContent.length < 50) {
    return NextResponse.json({ erro: 'Arquivo OFX vazio ou muito pequeno' }, { status: 400 })
  }
  if (rawContent.length > 5 * 1024 * 1024) {
    return NextResponse.json({ erro: 'Arquivo OFX muito grande (limite 5MB)' }, { status: 400 })
  }

  try {
    const result = await createPreview({
      userId: user.sub,
      profileId: id,
      creditCardId,
      fileName,
      fileSize,
      rawContent,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
