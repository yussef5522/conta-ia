// Sprint Export CSV+PDF (29/05/2026) — Endpoint export Variâncias.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { collectVariances } from '@/lib/variance/collect'
import { renderVarianciasCSV } from '@/lib/export/render/variancias'
import { exportFilename } from '@/lib/export/csv/format'
import { renderPdfInWorker } from '@/lib/export/pdf-worker-client'

export const runtime = 'nodejs'

const ymRegex = /^\d{4}-\d{2}$/
const querySchema = z.object({
  current: z.string().regex(ymRegex),
  base: z.string().regex(ymRegex),
  minValue: z.coerce.number().min(0).max(1_000_000).optional(),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

interface Params {
  params: Promise<{ id: string }>
}

function formatGeradoEmBR(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    const empresa = await prisma.company.findUnique({
      where: { id: empresaId },
      select: { name: true, tradeName: true },
    })
    const empresaNome = empresa?.tradeName ?? empresa?.name ?? 'Empresa'

    const envThreshold = Number(process.env.VARIANCE_MIN_ABSOLUTE_VALUE)
    const minAbsoluteValue =
      input.minValue ?? (isFinite(envThreshold) ? envThreshold : 500)

    const result = await collectVariances({
      empresaId,
      current: { ym: input.current },
      base: { ym: input.base },
      options: { minAbsoluteValue },
    })

    if (input.format === 'csv') {
      return new NextResponse(renderVarianciasCSV(result), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('variancias', empresaNome, 'csv')}"`,
          'X-Row-Count': String(result.variances.length),
        },
      })
    }

    const buf = await renderPdfInWorker('variancias', result, {
      empresaNome,
      minAbsoluteValue,
      geradoEm: formatGeradoEmBR(new Date()),
    })
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('variancias', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(result.variances.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
