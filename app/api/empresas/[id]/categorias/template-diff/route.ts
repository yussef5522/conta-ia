import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  computeTemplateDiff,
  summarize,
  templateToFlat,
} from '@/lib/categories/template-diff'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/empresas/[id]/categorias/template-diff
// Calcula o diff entre as categorias atuais da empresa e o template do setor.
export async function GET(request: NextRequest, { params }: Params) {
  const { id: empresaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    // Multi-tenant
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId: user.sub, companyId: empresaId },
      include: { company: { select: { id: true, type: true, taxRegime: true } } },
    })
    if (!userCompany) {
      return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 403 })
    }

    const setor = userCompany.company.type
    const regime = userCompany.company.taxRegime

    // Gera template flat
    const template = templateToFlat(setor)
    if (template.length === 0) {
      return NextResponse.json(
        { erro: `Setor "${setor}" não tem template definido.` },
        { status: 400 },
      )
    }

    // Carrega categorias da empresa (incluindo inativas)
    const cats = await prisma.category.findMany({
      where: { companyId: empresaId },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        dreGroup: true,
        code: true,
        description: true,
        color: true,
        icon: true,
        order: true,
        visibleInRegimes: true,
        isActive: true,
        isSystemDefault: true,
        templateKey: true,
        _count: { select: { transactions: true, children: true } },
      },
    })

    const diff = computeTemplateDiff(cats, template)
    const summary = summarize(diff)

    return NextResponse.json({ setor, regime, diff, summary })
  } catch (error) {
    console.error('[TEMPLATE-DIFF GET] Erro:', error)
    return NextResponse.json({ erro: 'Erro ao calcular diff' }, { status: 500 })
  }
}
