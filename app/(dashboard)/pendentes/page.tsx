// Sprint 4.0.5.b — Pendentes global. Lê empresa do cookie.

import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { PendentesClient } from '@/app/(dashboard)/empresas/[id]/pendentes/pendentes-client'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'

export const metadata: Metadata = { title: 'Pendentes de Classificação' }

export default async function PendentesPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const hojeInicio = new Date()
  hojeInicio.setUTCHours(0, 0, 0, 0)

  const [categorias, autoClassificadasHoje, regrasAtivas, fornecedoresDetectados, iaUsageHoje] =
    await Promise.all([
      prisma.category.findMany({
        where: { companyId: access.empresaId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, color: true },
      }),
      prisma.transaction.count({
        where: {
          bankAccount: { companyId: access.empresaId },
          classificationSource: 'RULE',
          updatedAt: { gte: hojeInicio },
        },
      }),
      prisma.aiLearningRule.count({
        where: { companyId: access.empresaId, isActive: true },
      }),
      prisma.supplier.count({
        where: { companyId: access.empresaId, isActive: true },
      }),
      prisma.aiUsageLog.aggregate({
        where: { companyId: access.empresaId, createdAt: { gte: hojeInicio } },
        _count: { id: true },
        _sum: { costCents: true },
      }),
    ])

  const claudeEnabled =
    process.env.AI_CLAUDE_ENABLED !== 'false' && !!process.env.ANTHROPIC_API_KEY

  return (
    <PendentesClient
      empresaId={access.empresaId}
      empresaNome={access.empresa.tradeName ?? access.empresa.name}
      categorias={categorias}
      stats={{
        autoClassificadasHoje,
        regrasAtivas,
        fornecedoresDetectados,
        iaSugestoesHoje: iaUsageHoje._count.id ?? 0,
        iaCustoCentavosHoje: iaUsageHoje._sum.costCents ?? 0,
        claudeEnabled,
      }}
    />
  )
}
