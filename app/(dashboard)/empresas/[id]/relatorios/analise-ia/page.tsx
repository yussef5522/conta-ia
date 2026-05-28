// Hotfix 5.0.4.0c1-fix — Página dedicada Análise da IA.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import { prisma } from '@/lib/db'
import { AnaliseIAClient } from './analise-ia-client'
import type { InsightOutput } from '@/lib/ai/insights-types'
import type { InsightMode } from '@/lib/dates/period-presets'

export const metadata: Metadata = { title: 'Análise da IA — Relatórios' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const MES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function formatPeriodLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  if (sy === ey && sm === em) {
    return `${sd} a ${ed} de ${MES_FULL[sm - 1]} de ${sy}`
  }
  if (sy === ey) {
    return `${sd} de ${MES_FULL[sm - 1]} a ${ed} de ${MES_FULL[em - 1]} de ${sy}`
  }
  return `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`
}

/** Normaliza período legado (YYYY-MM) pra YYYY-MM-DD pro PeriodSelector. */
function normalizePeriod(input: string | null): string | null {
  if (!input) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`
  return null
}

export default async function AnaliseIAPage({ params }: PageProps) {
  const { id: empresaId } = await params
  const access = await resolveEmpresaAccess({ requirePermission: 'dre.view' })
  if (access.kind !== 'ok') notFound()

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { id: true, name: true, tradeName: true },
  })
  if (!empresa) notFound()

  // Pega a última análise SUCEDIDA do banco (responseJson != null, sem erro)
  const ultimaAnalise = await prisma.aiInsightsLog.findFirst({
    where: {
      companyId: empresaId,
      feature: 'monthly-insights',
      responseJson: { not: null },
      errorMessage: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      mode: true,
      currentPeriod: true,
      currentEndPeriod: true,
      basePeriod: true,
      baseEndPeriod: true,
      responseJson: true,
      createdAt: true,
    },
  })

  let initialAnalysis = null
  if (ultimaAnalise?.responseJson) {
    try {
      const insights = JSON.parse(ultimaAnalise.responseJson) as InsightOutput
      const startDate = normalizePeriod(ultimaAnalise.currentPeriod)
      const endDate =
        normalizePeriod(ultimaAnalise.currentEndPeriod) ?? startDate
      // mode pode ser null em logs antigos pré-hotfix — defalta pra comparative
      const mode: InsightMode =
        (ultimaAnalise.mode as InsightMode | null) ?? 'comparative'

      if (startDate && endDate) {
        const compareStartDate = normalizePeriod(ultimaAnalise.basePeriod)
        const compareEndDate =
          normalizePeriod(ultimaAnalise.baseEndPeriod) ?? compareStartDate
        initialAnalysis = {
          insights,
          mode,
          periodLabel: formatPeriodLabel(startDate, endDate),
          compareLabel:
            compareStartDate && compareEndDate
              ? formatPeriodLabel(compareStartDate, compareEndDate)
              : undefined,
          generatedAt: ultimaAnalise.createdAt.toISOString(),
          lastParams: {
            startDate,
            endDate,
            compareStartDate: compareStartDate ?? undefined,
            compareEndDate: compareEndDate ?? undefined,
          },
        }
      }
    } catch {
      // JSON inválido — ignora, vai mostrar empty state
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/empresas/${empresaId}/relatorios`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        data-testid="breadcrumb-back"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar pra Relatórios
      </Link>

      <Header
        title="Análise da IA"
        description={`Insights gerados por IA sobre as finanças de ${empresa.tradeName ?? empresa.name}`}
      />

      <AnaliseIAClient empresaId={empresaId} initialAnalysis={initialAnalysis} />
    </div>
  )
}
