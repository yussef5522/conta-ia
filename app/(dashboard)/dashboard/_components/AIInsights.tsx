// AI Insights — Sprint 2 Dia 3.
// Server component: busca insights detectados + renderiza em grid responsivo.
// Posição no dashboard: abaixo do Hero Strip, antes do Mini-DRE.

import { Sparkles, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getInsights } from '@/lib/insights/queries'
import { InsightCard } from './InsightCard'

interface AIInsightsProps {
  companyId: string
}

export async function AIInsights({ companyId }: AIInsightsProps) {
  const insights = await getInsights(companyId)

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
      {/* Grid responsivo: 1 col mobile, 2 col tablet, 3 col desktop.
          TODO Sprint 2 Dia 4-5: carrossel touch swipeable se >3 insights */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
