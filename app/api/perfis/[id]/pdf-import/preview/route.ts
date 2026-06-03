// Sprint PF Fatia 3.5 — POST preview do import PDF.
//
// Aceita multipart/form-data com 'file' (.pdf) + 'creditCardId' opcional 'bankHint'.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  createPdfPreview,
  isPdfImportError,
  isPdfExtractError,
  isProfileAccessError,
  isCreditCardError,
} from '@/lib/pdf-import/queries'
import { checkPdfImportFlag } from '@/lib/pdf-import/feature-flag'
import type { BankHint } from '@/lib/pdf-import/pdf-templates'

const VALID_BANK_HINTS: BankHint[] = ['NUBANK', 'ITAU', 'BRADESCO', 'INTER', 'C6', 'GENERIC']

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
  if (isPdfImportError(err)) {
    // gate codes — DISABLED|ZDR_NOT_CONFIRMED
    const status = err.code === 'DISABLED' || err.code === 'ZDR_NOT_CONFIRMED' ? 403 : 400
    return NextResponse.json({ erro: err.message, code: err.code }, { status })
  }
  if (isPdfExtractError(err)) {
    const map: Record<string, number> = {
      PDF_TOO_LARGE: 413,
      PDF_TOO_MANY_PAGES: 400,
      PDF_ENCRYPTED: 400,
      PDF_INVALID: 400,
      IS_PHOTO_REJECTED: 400,
      CLAUDE_API_ERROR: 502,
      CLAUDE_INVALID_JSON: 502,
      CLAUDE_TIMEOUT: 504,
      CLAUDE_RATE_LIMITED: 429,
      VALIDATION_FAILED: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 500 },
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

  const gate = checkPdfImportFlag()
  if (!gate.allowed) {
    return NextResponse.json(
      { erro: gate.message, code: gate.reason },
      { status: 403 },
    )
  }

  const ct = request.headers.get('content-type') ?? ''
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json(
      { erro: 'Esperado multipart/form-data com campo "file"' },
      { status: 400 },
    )
  }

  const form = await request.formData()
  const creditCardId = String(form.get('creditCardId') ?? '')
  if (!creditCardId) {
    return NextResponse.json({ erro: 'creditCardId obrigatório' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: 'file ausente' }, { status: 400 })
  }
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ erro: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ erro: 'PDF maior que 5MB' }, { status: 413 })
  }
  const bankHintRaw = String(form.get('bankHint') ?? '').toUpperCase()
  const bankHint: BankHint | undefined = VALID_BANK_HINTS.includes(bankHintRaw as BankHint)
    ? (bankHintRaw as BankHint)
    : undefined

  const arrayBuffer = await file.arrayBuffer()
  const pdfBytes = new Uint8Array(arrayBuffer)

  try {
    const result = await createPdfPreview({
      userId: user.sub,
      profileId: id,
      creditCardId,
      fileName: file.name,
      pdfBytes,
      bankHint,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
