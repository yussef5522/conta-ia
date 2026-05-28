// AI Insights — Sprint 2 Dia 5 (polish).
// Server component: busca insights detectados + renderiza via InsightsClient.
// Posição no dashboard: abaixo do Hero Strip, antes do Mini-DRE.

import { Sparkles, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getInsights } from '@/lib/insights/queries'
import type { Insight } from '@/lib/insights/types'
import { InsightsClient } from './InsightsClient'

interface AIInsightsProps {
  companyId: string
  // Sprint 2 Dia 5: ?demoInsights=N injeta N mock insights pra testar carrossel
  // em dev. IGNORADO em produção (NODE_ENV === 'production').
  demoCount?: number
}

export async function AIInsights({ companyId, demoCount }: AIInsightsProps) {
  let insights = await getInsights(companyId)

  // Demo mode: APENAS em dev. Segurança: em prod retorna lista real intocada.
  if (
    process.env.NODE_ENV !== 'production' &&
    demoCount !== undefined &&
    demoCount > 0
  ) {
    insights = buildDemoInsights(companyId, demoCount)
  }

  // Empty state: nada detectado pelos detectors registrados
  if (insights.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center gap-3 py-5">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-muted-foreground">
            Tudo sob controle. Sistema monitorando seus dados.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Descobertas da IA
        </h2>
      </div>
      <InsightsClient insights={insights} />
    </div>
  )
}

// Helper de DEV — gera N insights mock pra testar carrossel mobile.
// Não é exportado e só roda em NODE_ENV !== 'production'.
function buildDemoInsights(companyId: string, count: number): Insight[] {
  const demos: Insight[] = [
    {
      id: 'pending-classifications',
      severity: 'alerta',
      priority: 9,
      title: '963 transações aguardam classificação',
      description:
        'Sem categoria, o DRE não reflete a realidade do seu negócio.',
      action: { label: 'Revisar', url: `/pendentes` },
    },
    {
      id: 'large-uncategorized',
      severity: 'oportunidade',
      priority: 7,
      title: '12 transações grandes sem categoria (R$ 160.900,00)',
      description: 'Movimentações acima de R$ 5.000 sem categoria.',
      action: { label: 'Classificar agora', url: `/pendentes` },
    },
    {
      id: 'high-overdraft-usage',
      severity: 'sugestao',
      priority: 6,
      title: 'Cheque especial da Banrisul em 75%',
      description: 'Considere transferir saldo de outra conta.',
      action: { label: 'Ver contas', url: `/contas` },
    },
    {
      id: 'burn-rate-spike',
      severity: 'sugestao',
      priority: 5,
      title: 'Despesas cresceram 35% nos últimos 3 meses',
      description: 'Confira no fluxo de caixa onde o aumento se concentrou.',
      action: { label: 'Ver fluxo de caixa', url: '/dashboard?wf=trimestre' },
    },
    {
      id: 'concentration-risk',
      severity: 'oportunidade',
      priority: 6,
      title: 'Top 3 clientes = 82% da receita',
      description: 'Ampliar a base de clientes traz mais previsibilidade.',
      action: { label: 'Ver receitas', url: `/empresas/${companyId}/relatorios/dre-gerencial` },
    },
    {
      id: 'revenue-growth',
      severity: 'parabens',
      priority: 7,
      title: '🚀 Receita cresceu 80% no mês',
      description: 'Crescimento expressivo — vale entender o que funcionou.',
      action: { label: 'Ver DRE', url: `/empresas/${companyId}/relatorios/dre-gerencial` },
    },
    {
      id: 'duplicate-subscriptions',
      severity: 'sugestao',
      priority: 6,
      title: '3 cobranças recorrentes detectadas (~R$ 135,00/mês)',
      description: 'NETFLIX, SPOTIFY, GOOGLE WORKSPACE.',
      action: { label: 'Revisar despesas', url: `/empresas/${companyId}/relatorios/dre-gerencial` },
    },
  ]
  return demos.slice(0, Math.min(count, demos.length))
}
