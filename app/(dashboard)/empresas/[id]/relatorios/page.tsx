// Sprint 5.0.4.0b — Index /relatorios redesenhado world-class.
//
// Estrutura:
// - HERO CARD (Lucro Líquido do mês + sparkline + 3 mini-stats + CTA pro DRE)
// - VISÃO GERAL (5 cards de preview com dados reais embutidos)
// - ANÁLISES INTELIGENTES — EM BREVE (3 cards desabilitados, Sprint 5.0.4.0c)
// - DEVE CHEGAR DEPOIS (lista textual com bullets)
//
// Server Component faz fetch único via getRelatoriosPreview (paralelo + cache 60s).

import { notFound } from 'next/navigation'
import {
  PieChart,
  TrendingUp,
  Wallet,
  Users,
  Building2,
  Sparkles,
  LayoutGrid,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  getRelatoriosPreview,
  monthLabelShort,
} from '@/lib/relatorios/preview-queries'
import { HeroCard } from '@/components/relatorios/HeroCard'
import {
  ReportPreviewCard,
  type ReportPreviewLine,
} from '@/components/relatorios/ReportPreviewCard'
import { FutureReportCard } from '@/components/relatorios/FutureReportCard'
import { AIInsightsPreviewCard } from '@/components/relatorios/AIInsightsPreviewCard'
import type { InsightOutput } from '@/lib/ai/insights-types'
import type { InsightMode } from '@/lib/dates/period-presets'

export const metadata: Metadata = { title: 'Relatórios' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)
}

function formatBRLPrecise(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

export default async function RelatoriosIndexPage({ params }: PageProps) {
  const { id: empresaId } = await params
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-access' || access.kind === 'forbidden') notFound()
  if (access.kind === 'no-empresa-selected') notFound()

  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { id: true, name: true, tradeName: true },
  })
  if (!empresa) notFound()

  const [preview, ultimaAIRaw] = await Promise.all([
    getRelatoriosPreview(empresaId),
    prisma.aiInsightsLog.findFirst({
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
    }),
  ])

  // Helpers locais
  const MES_FULL_INDEX = [
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
  const normalizePeriod = (s: string | null): string | null => {
    if (!s) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`
    return null
  }
  const formatLabel = (start: string, end: string): string => {
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    if (sy === ey && sm === em) return `${sd} a ${ed} de ${MES_FULL_INDEX[sm - 1]} de ${sy}`
    if (sy === ey) return `${MES_FULL_INDEX[sm - 1]} a ${MES_FULL_INDEX[em - 1]}/${sy}`
    return `${sd}/${sm}/${sy} a ${ed}/${em}/${ey}`
  }

  let ultimaAI: {
    mode: InsightMode | null
    periodLabel: string
    compareLabel?: string | null
    generatedAt: Date
    destaquesCount: number
  } | null = null

  if (ultimaAIRaw?.responseJson) {
    const sd = normalizePeriod(ultimaAIRaw.currentPeriod)
    const ed = normalizePeriod(ultimaAIRaw.currentEndPeriod) ?? sd
    const csd = normalizePeriod(ultimaAIRaw.basePeriod)
    const ced = normalizePeriod(ultimaAIRaw.baseEndPeriod) ?? csd
    if (sd && ed) {
      try {
        const parsed = JSON.parse(ultimaAIRaw.responseJson) as InsightOutput
        ultimaAI = {
          mode: ultimaAIRaw.mode as InsightMode | null,
          periodLabel: formatLabel(sd, ed),
          compareLabel: csd && ced ? formatLabel(csd, ced) : null,
          generatedAt: ultimaAIRaw.createdAt,
          destaquesCount: parsed.destaques?.length ?? 0,
        }
      } catch {
        ultimaAI = null
      }
    }
  }

  // ---- Build cards data ----

  // Categorias
  const categoriasLines: ReportPreviewLine[] = preview.categorias.top3.map(
    (c) => ({
      label: c.name,
      value: `${c.percent.toFixed(0)}%`,
      tone: 'neutral',
    }),
  )

  // Comparativo — sparkline 3m em vermelho (despesas)
  const compSpark = preview.comparativo.sparkline3m

  // Fluxo Caixa — saldo positivo verde / negativo vermelho
  const fluxoSaldoTone = preview.fluxoCaixa.isPositive ? 'emerald' : 'red'
  const proxResultTone =
    preview.fluxoCaixa.proxima30.resultado >= 0 ? 'emerald' : 'red'

  // Fornecedores — top supplier + crescimento
  const fornecedoresLines: ReportPreviewLine[] = []
  if (preview.fornecedores.maiorCrescimento) {
    fornecedoresLines.push({
      label: 'Maior crescimento',
      value: `${preview.fornecedores.maiorCrescimento.name} +${preview.fornecedores.maiorCrescimento.percent.toFixed(0)}%`,
      tone: 'amber',
    })
  }
  fornecedoresLines.push({
    label: 'Cadastrados',
    value: String(preview.fornecedores.totalSuppliers),
  })

  // Funcionários
  const funcMediaPorFunc =
    preview.funcionarios.ativos > 0
      ? preview.funcionarios.totalFolhaMes / preview.funcionarios.ativos
      : 0

  return (
    <div className="space-y-8">
      <Header
        title="Relatórios"
        description={`Entenda para onde vai o dinheiro de ${empresa.tradeName ?? empresa.name}`}
      />

      {/* HERO CARD */}
      <HeroCard preview={preview.hero} empresaId={empresaId} />

      {/* VISÃO GERAL */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <LayoutGrid className="h-3.5 w-3.5" />
          Visão Geral
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Análise por Categoria */}
          <ReportPreviewCard
            icon={PieChart}
            iconColor="#0ea5e9"
            title="Análise por Categoria"
            primaryStat={
              preview.categorias.topCategory
                ? {
                    label: 'Top categoria',
                    value: `${preview.categorias.topCategory.name} ${formatBRL(preview.categorias.topCategory.value)}`,
                    tone: 'sky',
                  }
                : undefined
            }
            lines={categoriasLines}
            hasData={preview.categorias.hasData}
            emptyMessage="Sem despesas categorizadas no mês."
            ctaHref={`/empresas/${empresaId}/relatorios/categorias`}
            ctaLabel="Abrir análise"
            testId="preview-card-categorias"
          />

          {/* Comparativo Mensal */}
          <ReportPreviewCard
            icon={TrendingUp}
            iconColor="#a855f7"
            title="Comparativo Mensal"
            primaryStat={{
              label: 'Categorias subindo este mês',
              value: String(preview.comparativo.subindo),
              tone: preview.comparativo.subindo > 0 ? 'amber' : 'neutral',
            }}
            lines={
              preview.comparativo.maiorAlta
                ? [
                    {
                      label: 'Maior alta',
                      value: `${preview.comparativo.maiorAlta.name} +${preview.comparativo.maiorAlta.percent.toFixed(0)}%`,
                      tone: 'red',
                    },
                  ]
                : undefined
            }
            sparkline={
              compSpark.length >= 2
                ? { data: compSpark, color: '#ef4444' }
                : undefined
            }
            hasData={preview.comparativo.subindo > 0 || compSpark.some((p) => p.value > 0)}
            emptyMessage="Sem dados suficientes para comparar (mínimo 2 meses)."
            ctaHref={`/empresas/${empresaId}/relatorios/comparativo`}
            ctaLabel="Ver comparativo"
            testId="preview-card-comparativo"
          />

          {/* Fluxo de Caixa (NOVO) */}
          <ReportPreviewCard
            icon={Wallet}
            iconColor="#10b981"
            title="Fluxo de Caixa"
            primaryStat={{
              label: `Saldo ${preview.fluxoCaixa.monthLabel}`,
              value: formatBRLPrecise(preview.fluxoCaixa.saldoMesAtual),
              tone: fluxoSaldoTone,
            }}
            lines={[
              {
                label: 'Próx 30d — Entradas',
                value: formatBRL(preview.fluxoCaixa.proxima30.entradas),
                tone: 'emerald',
              },
              {
                label: 'Próx 30d — Saídas',
                value: formatBRL(preview.fluxoCaixa.proxima30.saidas),
                tone: 'red',
              },
              {
                label: 'Próx 30d — Resultado',
                value:
                  (preview.fluxoCaixa.proxima30.resultado >= 0 ? '+' : '') +
                  formatBRL(preview.fluxoCaixa.proxima30.resultado),
                tone: proxResultTone,
              },
            ]}
            hasData={true}
            ctaHref={`/empresas/${empresaId}/relatorios/fluxo-caixa`}
            ctaLabel="Ver fluxo completo"
            testId="preview-card-fluxo-caixa"
          />

          {/* Top Fornecedores (NOVO) */}
          <ReportPreviewCard
            icon={Building2}
            iconColor="#f59e0b"
            title="Top Fornecedores"
            primaryStat={
              preview.fornecedores.topSupplier
                ? {
                    label: 'Top fornecedor do mês',
                    value: `${preview.fornecedores.topSupplier.name}`,
                    tone: 'amber',
                  }
                : undefined
            }
            lines={
              preview.fornecedores.topSupplier
                ? [
                    {
                      label: 'Pago',
                      value: formatBRL(preview.fornecedores.topSupplier.value),
                    },
                    {
                      label: '% do total',
                      value: `${preview.fornecedores.topSupplier.percent.toFixed(0)}%`,
                    },
                    ...fornecedoresLines,
                  ]
                : fornecedoresLines
            }
            hasData={preview.fornecedores.topSupplier !== null}
            emptyMessage="Sem pagamentos a fornecedores no mês."
            ctaHref={`/empresas/${empresaId}/relatorios/fornecedores`}
            ctaLabel="Ver top fornecedores"
            testId="preview-card-fornecedores"
          />

          {/* Folha Funcionários (NOVO) */}
          <ReportPreviewCard
            icon={Users}
            iconColor="#8b5cf6"
            title="Folha de Pagamento"
            primaryStat={{
              label: `Folha ${preview.funcionarios.monthLabel}`,
              value: formatBRL(preview.funcionarios.totalFolhaMes),
              tone: 'purple',
            }}
            lines={[
              {
                label: 'Funcionários ativos',
                value: String(preview.funcionarios.ativos),
              },
              ...(preview.funcionarios.ativos > 0
                ? [
                    {
                      label: 'Média por funcionário',
                      value: formatBRL(funcMediaPorFunc),
                    },
                  ]
                : []),
            ]}
            hasData={
              preview.funcionarios.ativos > 0 ||
              preview.funcionarios.totalFolhaMes > 0
            }
            emptyMessage="Sem funcionários cadastrados."
            ctaHref={`/empresas/${empresaId}/relatorios/funcionarios`}
            ctaLabel="Detalhar folha"
            testId="preview-card-funcionarios"
          />

          {/* DRE Gerencial — mantém visibilidade próxima ao hero (último card) */}
          <ReportPreviewCard
            icon={FileText}
            iconColor="#0d9488"
            title="DRE Gerencial"
            primaryStat={{
              label: 'Demonstrativo completo',
              value: 'Receita → Lucro',
              tone: 'emerald',
            }}
            lines={[
              {
                label: 'Margem líquida',
                value:
                  preview.hero.margemPct !== null
                    ? `${preview.hero.margemPct.toFixed(1)}%`
                    : '—',
                tone: 'emerald',
              },
              {
                label: 'Comparativo',
                value: `${preview.hero.monthLabel.split('/')[0]} vs ${monthLabelShort(
                  new Date(
                    Date.UTC(
                      Number(preview.hero.monthLabel.split('/')[1]),
                      ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].indexOf(
                        preview.hero.monthLabel.split('/')[0],
                      ) - 1,
                      1,
                    ),
                  ),
                )}`,
              },
            ]}
            hasData={true}
            ctaHref={`/empresas/${empresaId}/relatorios/dre-gerencial`}
            ctaLabel="Abrir DRE"
            testId="preview-card-dre"
          />

          {/* Variâncias (NOVO Sprint 5.0.4.0c1) */}
          <ReportPreviewCard
            icon={AlertTriangle}
            iconColor="#ef4444"
            title="Variâncias Detectadas"
            primaryStat={{
              label: 'Mudanças significativas',
              value: 'Mês atual vs anterior',
              tone: 'red',
            }}
            lines={[
              {
                label: 'Threshold',
                value: 'Variação > 15% · R$ 500+',
              },
              {
                label: 'Detecta',
                value: '↑↑ críticas · 🆕 novas · ✕ sumiu',
              },
            ]}
            hasData={true}
            ctaHref={`/empresas/${empresaId}/relatorios/variancias`}
            ctaLabel="Ver variâncias"
            testId="preview-card-variancias"
          />

          {/* Análise da IA (Hotfix 5.0.4.0c1-fix — agora preview card) */}
          <AIInsightsPreviewCard empresaId={empresaId} ultima={ultimaAI} />
        </div>
      </div>

      {/* ANÁLISES INTELIGENTES — EM BREVE */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Análises Inteligentes — em breve
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FutureReportCard
            icon={Building2}
            title="Multi-empresa Consolidado"
            description="DRE consolidada das suas 13 academias num único painel comparativo."
            sprintLabel="Sprint 5.0.4.0c2"
          />
          <FutureReportCard
            icon={FileText}
            title="Export PDF profissional"
            description="DRE + Categorias + Variâncias num PDF com sua marca pra enviar pro contador."
            sprintLabel="Sprint 5.0.4.0d"
          />
        </div>
      </div>

      {/* DEVE CHEGAR DEPOIS */}
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Deve chegar depois
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Export PDF profissional (Sprint 5.0.4.0d)</li>
          <li>Comparativo orçado vs realizado</li>
          <li>Análise por centro de custo</li>
        </ul>
      </div>
    </div>
  )
}
