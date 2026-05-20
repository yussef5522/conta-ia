// GET, PATCH, DELETE /api/empresas/[id]/fornecedores/[supplierId] — Sprint 2.2.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { logAudit } from '@/lib/audit'
import { updateFornecedorSchema } from '@/lib/validations/fornecedor'

interface Params {
  params: Promise<{ id: string; supplierId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, supplierId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const sup = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId: empresaId },
      include: {
        category: { select: { id: true, name: true, color: true } },
        rules: {
          select: {
            id: true,
            padrao: true,
            tipoMatch: true,
            categoryId: true,
            isActive: true,
          },
        },
        _count: { select: { transactions: true } },
      },
    })
    if (!sup) {
      return NextResponse.json(
        { erro: 'Fornecedor não encontrado' },
        { status: 404 },
      )
    }
    return NextResponse.json({ fornecedor: sup })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, supplierId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const body = await request.json()
    const data = updateFornecedorSchema.parse(body)

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId: empresaId },
    })
    if (!existing) {
      return NextResponse.json(
        { erro: 'Fornecedor não encontrado' },
        { status: 404 },
      )
    }

    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: empresaId },
        select: { id: true },
      })
      if (!cat) {
        return NextResponse.json(
          { erro: 'Categoria inválida' },
          { status: 400 },
        )
      }
    }

    // Conflito de CNPJ (se mudou pra um CNPJ que já existe em outro supplier)
    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const dup = await prisma.supplier.findFirst({
        where: {
          companyId: empresaId,
          cnpj: data.cnpj,
          id: { not: supplierId },
        },
        select: { id: true, razaoSocial: true },
      })
      if (dup) {
        return NextResponse.json(
          { erro: `CNPJ já cadastrado em "${dup.razaoSocial}".` },
          { status: 409 },
        )
      }
    }

    const aplicarEmRegras = data.aplicarEmRegras === true
    const novaCategoria = data.categoryId
    // Remove aplicarEmRegras do payload do Prisma
    const { aplicarEmRegras: _ignore, ...prismaData } = data

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: prismaData,
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    })

    let regrasAtualizadas = 0
    if (aplicarEmRegras && novaCategoria !== undefined) {
      const result = await prisma.aiLearningRule.updateMany({
        where: { supplierId, companyId: empresaId },
        data: { categoryId: novaCategoria },
      })
      regrasAtualizadas = result.count
    }

    await logAudit(ctx, {
      action: 'SUPPLIER_UPDATED',
      entityType: 'Supplier',
      entityId: supplierId,
      metadata: {
        razaoSocial: existing.razaoSocial,
        changes: prismaData,
        aplicarEmRegras,
        regrasAtualizadas,
      },
      request,
    })

    return NextResponse.json({
      fornecedor: updated,
      regrasAtualizadas,
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, supplierId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId: empresaId },
    })
    if (!existing) {
      return NextResponse.json(
        { erro: 'Fornecedor não encontrado' },
        { status: 404 },
      )
    }

    // Desvincula transações e regras antes de deletar (FK preserva audit
    // semântico — não cascateamos transações automaticamente)
    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { supplierId },
        data: { supplierId: null },
      }),
      prisma.aiLearningRule.updateMany({
        where: { supplierId },
        data: { supplierId: null },
      }),
      prisma.supplier.delete({ where: { id: supplierId } }),
    ])

    await logAudit(ctx, {
      action: 'SUPPLIER_DELETED',
      entityType: 'Supplier',
      entityId: supplierId,
      metadata: {
        razaoSocial: existing.razaoSocial,
        cnpj: existing.cnpj,
        fonte: existing.fonte,
      },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err)
  }
}
