import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PendentesClient } from './pendentes-client'

interface Props {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Pendentes de Classificação' }

export default async function PendentesPage({ params }: Props) {
  const { id: empresaId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)

  // Verifica acesso e carrega empresa + categorias em paralelo
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.sub, companyId: empresaId },
    include: {
      company: { select: { id: true, name: true, tradeName: true, type: true } },
    },
  })
  if (!userCompany) notFound()

  // Fase 3 Etapa 1: stats da IA Contadora pro header
  // Hoje UTC 00:00 → agora (cobre o dia atual em UTC, suficiente pra mostragem)
  const hojeInicio = new Date()
  hojeInicio.setUTCHours(0, 0, 0, 0)

  const [
    categorias,
    autoClassificadasHoje,
    regrasAtivas,
    fornecedoresDetectados,
    iaUsageHoje,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { companyId: empresaId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, color: true },
    }),
    prisma.transaction.count({
      where: {
        bankAccount: { companyId: empresaId },
        classificationSource: 'RULE',
        updatedAt: { gte: hojeInicio },
      },
    }),
    prisma.aiLearningRule.count({
      where: { companyId: empresaId, isActive: true },
    }),
    // Fase 3 Etapa 2: total de Suppliers ativos (todas as fontes)
    prisma.supplier.count({
      where: { companyId: empresaId, isActive: true },
    }),
    // Fase 3 Etapa 3: stats IA hoje (sugestões + custo agregado)
    prisma.aiUsageLog.aggregate({
      where: {
        companyId: empresaId,
        createdAt: { gte: hojeInicio },
      },
      _count: { id: true },
      _sum: { costCents: true },
    }),
  ])

  // Fase 3 Etapa 3: flag claudeEnabled deriva de env (mesmo gate do server)
  const claudeEnabled =
    process.env.AI_CLAUDE_ENABLED !== 'false' &&
    !!process.env.ANTHROPIC_API_KEY

  return (
    <PendentesClient
      empresaId={empresaId}
      empresaNome={userCompany.company.tradeName ?? userCompany.company.name}
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
