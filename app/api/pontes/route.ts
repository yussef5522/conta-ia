// Sprint PF Fatia 4 — POST /api/pontes (criar)
//
// Body: { companyId, pjTransactionId, profileId, pfBankAccountId, pfCategoryId,
//         kind, createdVia?, socioPFId?, notes? }
//
// Auth: 3 camadas
// 1. JWT cookie (getAuthContext)
// 2. RBAC: companyId + permission 'transaction.create'
// 3. checkProfileAccess(OWNER) — feito dentro de createBridge

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { createBridge } from '@/lib/bridges/create'
import { isBridgeError, type BridgeKind } from '@/lib/bridges/types'

const schema = z.object({
  companyId: z.string().min(1),
  pjTransactionId: z.string().min(1),
  profileId: z.string().min(1),
  pfBankAccountId: z.string().min(1),
  pfCategoryId: z.string().min(1),
  kind: z.enum(['PRO_LABORE', 'DISTRIBUICAO', 'REEMBOLSO', 'ADIANTAMENTO', 'RETIRADA_SOCIOS']),
  createdVia: z.enum(['CREATED_MANUAL', 'CREATED_FROM_DETECTION']).optional(),
  socioPFId: z.string().nullish(),
  notes: z.string().max(1000).nullish(),
})

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  if (isBridgeError(err)) {
    const map: Record<string, number> = {
      PJ_NOT_FOUND: 404,
      PJ_WRONG_TYPE: 400,
      PJ_ALREADY_BRIDGED: 409,
      PJ_INVALID_LIFECYCLE: 409,
      PJ_INTERNAL_TRANSFER: 409,
      PF_PROFILE_NOT_FOUND: 404,
      PF_ACCOUNT_NOT_FOUND: 404,
      PF_CATEGORY_INVALID: 400,
      INVALID_KIND: 400,
      COMPANY_MISMATCH: 400,
      NO_RBAC_PJ: 403,
      NO_ACCESS_PF: 403,
      BRIDGE_NOT_FOUND: 404,
      INVALID_MODE: 400,
    }
    return NextResponse.json(
      { erro: err.message, code: err.code },
      { status: map[err.code] ?? 400 },
    )
  }
  throw err
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          erro: parsed.error.issues[0]?.message ?? 'Dados inválidos',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      )
    }

    // RBAC: precisa ter transaction.create na empresa
    const ctx = await getAuthContext(request, parsed.data.companyId)
    ctx.requirePermission('transaction.create')

    const result = await createBridge({
      userId: ctx.user.id,
      companyId: parsed.data.companyId,
      pjTransactionId: parsed.data.pjTransactionId,
      profileId: parsed.data.profileId,
      pfBankAccountId: parsed.data.pfBankAccountId,
      pfCategoryId: parsed.data.pfCategoryId,
      kind: parsed.data.kind as BridgeKind,
      createdVia: parsed.data.createdVia,
      socioPFId: parsed.data.socioPFId ?? null,
      notes: parsed.data.notes ?? null,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
