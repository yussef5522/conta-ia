// Sprint 5.0.2.h — CRUD SocioPF.
//
// Cadastro de sócios PF (e familiares/administradores) com chaves Pix.
// Usado pra detecção automática de Pix → Distribuição de Lucros / Pró-labore.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

const socioSchema = z.object({
  nome: z.string().min(2).max(120),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos').nullable().optional(),
  pixKeys: z.array(z.string().min(1).max(120)).max(10).default([]),
  papel: z.enum(['SOCIO', 'ADMINISTRADOR', 'FAMILIAR']).default('SOCIO'),
})

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const socios = await prisma.socioPF.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      socios: socios.map((s) => ({
        ...s,
        pixKeys: safeParseArray(s.pixKeys),
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
    const data = socioSchema.parse(body)

    const created = await prisma.socioPF.create({
      data: {
        companyId,
        nome: data.nome,
        cpf: data.cpf ?? null,
        pixKeys: JSON.stringify(data.pixKeys),
        papel: data.papel,
      },
    })

    return NextResponse.json({ socio: { ...created, pixKeys: data.pixKeys } }, { status: 201 })
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
