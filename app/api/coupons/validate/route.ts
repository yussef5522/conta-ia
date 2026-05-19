// POST /api/coupons/validate — Sprint 1.7.
//
// Endpoint PÚBLICO: chamado pelo formulário de cadastro pra mostrar o desconto
// antes de submeter. Rate-limit agressivo (10/min/IP) anti-enumeration.
//
// Comportamento anti-enumeration:
//   - NOT_FOUND / EXPIRED / EXHAUSTED / PAUSED / DEACTIVATED / NOT_YET_VALID
//     → todas respondem com mesma mensagem "Cupom inválido ou expirado".
//   - Status 200 sempre (não 404 — não revela existência).
//   - Demora similar pra todos os caminhos (validateCoupon é O(1) na DB).

import { NextRequest, NextResponse } from 'next/server'
import { validateCoupon, reasonToUserMessage } from '@/lib/coupons/validate'
import { formatCouponValue } from '@/lib/coupons/format'
import { validatePublicSchema } from '@/lib/coupons/admin-schemas'
import { rateLimit, rateLimitKey } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit 10/min/IP — anti-enumeration
  const key = rateLimitKey(request, 'coupon-validate')
  const rl = rateLimit(key, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      {
        valid: false,
        message: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { valid: false, message: 'Cupom inválido ou expirado.' },
      { status: 200 },
    )
  }

  const parsed = validatePublicSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, message: 'Cupom inválido ou expirado.' },
      { status: 200 },
    )
  }

  const result = await validateCoupon(parsed.data.code)

  if (!result.valid) {
    return NextResponse.json(
      {
        valid: false,
        message: reasonToUserMessage(result.reason),
      },
      { status: 200 },
    )
  }

  const { coupon } = result
  return NextResponse.json({
    valid: true,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    valueFormatted: formatCouponValue(
      coupon.type,
      coupon.value,
      coupon.freeMonths,
    ),
    freeMonths: coupon.freeMonths,
  })
}
