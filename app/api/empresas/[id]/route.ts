import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { empresaSchema } from '@/lib/validations/empresa'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request, id)
    ctx.requirePermission('company.view')

    const empresa = await prisma.company.findUnique({ where: { id } })
    if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    return NextResponse.json({ empresa })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request, id)
    ctx.requirePermission('company.update')

    const antiga = await prisma.company.findUnique({ where: { id } })
    if (!antiga) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const body = await request.json()
    // Em edição, o CNPJ não é alterado — remover do parse
    const { cnpj: _cnpj, ...rest } = body
    const data = empresaSchema.omit({ cnpj: true }).parse(rest)

    const empresa = await prisma.company.update({
      where: { id },
      data: {
        name: data.name,
        tradeName: data.tradeName || null,
        type: data.type,
        taxRegime: data.taxRegime,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
      },
    })

    const fieldsChanged = diffFields(
      antiga as unknown as Record<string, unknown>,
      empresa as unknown as Record<string, unknown>,
      ['name', 'tradeName', 'type', 'taxRegime', 'email', 'phone', 'address', 'city', 'state', 'zipCode'],
    )

    if (fieldsChanged) {
      await logAudit(ctx, {
        action: 'UPDATE',
        entityType: 'Company',
        entityId: empresa.id,
        fieldsChanged,
        metadata: { name: empresa.name },
        request,
      })
    }

    return NextResponse.json({ empresa })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const ctx = await getAuthContext(request, id)
    ctx.requirePermission('company.delete')

    const empresa = await prisma.company.findUnique({ where: { id } })
    if (!empresa) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    // Audit log ANTES do delete (cascade vai apagar audit_log junto via FK companyId).
    // Snapshot do nome em metadata pra rastreabilidade fora desta empresa.
    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'Company',
      entityId: id,
      metadata: { name: empresa.name, cnpj: empresa.cnpj },
      request,
    })

    await prisma.company.delete({ where: { id } })

    return NextResponse.json({ mensagem: 'Empresa excluída com sucesso' })
  } catch (error) {
    return handleApiError(error)
  }
}
