// Sprint Export CSV+PDF (29/05/2026) — Endpoint export Funcionários.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { computePayroll } from '@/lib/relatorios/payroll'
import { renderFuncionariosCSV, renderFuncionariosPDF } from '@/lib/export/render/funcionarios'
import { exportFilename } from '@/lib/export/csv/format'

export const runtime = 'nodejs'

const querySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  tipo: z.string().optional(),
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

    const start = new Date(`${input.from}T00:00:00.000Z`)
    const end = new Date(`${input.to}T23:59:59.999Z`)

    const [grouped, employees, totalAtivos] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['employeeId'],
        where: {
          OR: [
            { bankAccount: { companyId: empresaId } },
            { employee: { companyId: empresaId } },
          ],
          lifecycle: 'EFFECTED',
          reconciledWithId: null,
          type: 'DEBIT',
          employeeId: { not: null },
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.employee.findMany({
        where: { companyId: empresaId },
        select: { id: true, nome: true, tipo: true, ativo: true },
      }),
      prisma.employee.count({ where: { companyId: empresaId, ativo: true } }),
    ])

    const result = computePayroll({
      aggregated: grouped
        .filter((g) => !!g.employeeId)
        .map((g) => ({
          employeeId: g.employeeId!,
          amount: g._sum.amount ?? 0,
          count: g._count,
        })),
      employees,
      totalFuncionariosAtivos: totalAtivos,
    })

    const filtered = {
      ...result,
      rows: input.tipo ? result.rows.filter((r) => r.tipo === input.tipo) : result.rows,
    }

    if (input.format === 'csv') {
      return new NextResponse(renderFuncionariosCSV(filtered), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename('funcionarios', empresaNome, 'csv')}"`,
          'X-Row-Count': String(filtered.rows.length),
        },
      })
    }

    const buf = await renderToBuffer(
      renderFuncionariosPDF(filtered, {
        empresaNome,
        from: input.from,
        to: input.to,
        filterTipo: input.tipo ?? null,
        geradoEm: formatGeradoEmBR(new Date()),
      }),
    )
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportFilename('funcionarios', empresaNome, 'pdf')}"`,
        'X-Row-Count': String(filtered.rows.length),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
