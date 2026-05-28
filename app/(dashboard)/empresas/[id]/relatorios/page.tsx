// Sprint 5.0.4.0a — Index per-empresa de Relatórios.
//
// 3 cards inicial: DRE Gerencial / Análise por Categoria / Comparativo 3 Meses.
// Sub-sprints b/c/d adicionam mais cards (Fluxo de Caixa, Fornecedores,
// Funcionários, Variâncias, Multi-empresa).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, BarChart3, PieChart, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { prisma } from '@/lib/db'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'

export const metadata: Metadata = { title: 'Relatórios' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ReportCard {
  id: string
  title: string
  description: string
  href: (empresaId: string) => string
  icon: typeof BarChart3
  accentClass: string
}

const REPORTS: ReportCard[] = [
  {
    id: 'dre-gerencial',
    title: 'DRE Gerencial',
    description:
      'Demonstrativo de resultado do exercício — receita, custos, lucro mensal e variações vs período anterior.',
    href: (id) => `/empresas/${id}/relatorios/dre-gerencial`,
    icon: BarChart3,
    accentClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'categorias',
    title: 'Análise por Categoria',
    description:
      'Top 10 categorias onde sua empresa mais gastou. Drill-down em fornecedores e transações.',
    href: (id) => `/empresas/${id}/relatorios/categorias`,
    icon: PieChart,
    accentClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'comparativo',
    title: 'Comparativo Mensal',
    description:
      '3 meses lado a lado. Veja o que aumentou, o que diminuiu e o que apareceu pela primeira vez.',
    href: (id) => `/empresas/${id}/relatorios/comparativo`,
    icon: TrendingUp,
    accentClass: 'text-purple-600 dark:text-purple-400',
  },
]

export default async function RelatoriosIndexPage({ params }: PageProps) {
  const { id: empresaId } = await params
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-access' || access.kind === 'forbidden') notFound()
  if (access.kind === 'no-empresa-selected') notFound()

  // Garante que a URL bate com a empresa do cookie (defesa em profundidade)
  const empresa = await prisma.company.findUnique({
    where: { id: empresaId },
    select: { id: true, name: true, tradeName: true },
  })
  if (!empresa) notFound()

  return (
    <div className="space-y-6">
      <Header
        title="Relatórios"
        description={`Entenda para onde vai o dinheiro de ${empresa.tradeName ?? empresa.name}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon
          return (
            <Link
              key={r.id}
              href={r.href(empresaId)}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              data-testid={`report-card-${r.id}`}
            >
              <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md cursor-pointer">
                <CardContent className="py-6 px-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-8 w-8 shrink-0 ${r.accentClass}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{r.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {r.description}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-primary group-hover:gap-2 transition-all pt-1">
                    <span className="font-medium">Abrir relatório</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 px-5">
          <p className="text-xs text-muted-foreground">
            Mais relatórios chegando em breve: Fluxo de Caixa, Top Fornecedores,
            Análise de Variâncias com IA, Consolidado Multi-empresa.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
