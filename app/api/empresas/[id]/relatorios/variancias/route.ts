// Sprint 5.0.4.0c1 Fase 3 — Endpoint variâncias.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { collectVariances } from '@/lib/variance/collect'

export const runtime = 'nodejs'

const ymRegex = /^\d{4}-\d{2}$/

const querySchema = z.object({
  current: z.string().regex(ymRegex, 'Formato YYYY-MM esperado'),
  base: z.string().regex(ymRegex, 'Formato YYYY-MM esperado'),
  /** Materiality threshold em R$. Default 500 via env */
  minValue: z.coerce.number().min(0).max(1_000_000).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const envThreshold = Number(process.env.VARIANCE_MIN_ABSOLUTE_VALUE)
    const minAbsoluteValue =
      input.minValue ?? (isFinite(envThreshold) ? envThreshold : 500)

    const result = await collectVariances({
      empresaId,
      current: { ym: input.current },
      base: { ym: input.base },
      options: { minAbsoluteValue },
    })

    return NextResponse.json({
      ...result,
      minAbsoluteValue,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
