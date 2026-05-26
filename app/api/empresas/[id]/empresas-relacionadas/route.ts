// Sprint 5.0.2.h — CRUD EmpresaRelacionada.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const empresaRelSchema = z.object({
  cnpjRelacionado: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
  nomeFantasia: z.string().min(2).max(120),
  pixKeys: z.array(z.string().min(1).max(120)).max(10).default([]),
  relacao: z.enum(['MESMO_GRUPO', 'SOCIO_COMUM', 'CONTROLADA', 'CONTROLADORA']).default('MESMO_GRUPO'),
})

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const empresas = await prisma.empresaRelacionada.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      empresas: empresas.map((e) => ({
        ...e,
        pixKeys: safeParseArray(e.pixKeys),
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const body = await request.json()
    const data = empresaRelSchema.parse(body)

    const created = await prisma.empresaRelacionada.create({
      data: {
        companyId,
        cnpjRelacionado: data.cnpjRelacionado,
        nomeFantasia: data.nomeFantasia,
        pixKeys: JSON.stringify(data.pixKeys),
        relacao: data.relacao,
      },
    })

    return NextResponse.json({ empresa: { ...created, pixKeys: data.pixKeys } }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

function safeParseArray(json: string): string[] {
  try {
    const r = JSON.parse(json)
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
