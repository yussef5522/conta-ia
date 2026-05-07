'use client'

// Banner de Saúde Financeira (Sub-etapa 5.4.C).
// 3 estados (HEALTHY/ATTENTION/ALERT) com cores semânticas, score 0-100,
// e listas de pontos positivos / atenções.

import { CheckCircle2, AlertCircle, AlertOctagon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { FinancialHealthResult } from '@/lib/dre/kpis'

interface HealthBannerProps {
  health: FinancialHealthResult
}

export function HealthBanner({ health }: HealthBannerProps) {
  const config = HEALTH_CONFIG[health.status]
  const Icon = config.icon

  return (
    <Card className={`p-4 ${config.bgClass} ${config.borderClass} border-l-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconClass} shrink-0`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-bold ${config.textClass}`}>
              🏥 Saúde Financeira: {config.label}
            </h3>
            <Badge variant="outline" className="text-xs">
              Score: {health.score}/100
            </Badge>
          </div>

          {(health.positives.length > 0 || health.attentions.length > 0) && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {health.positives.length > 0 && (
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    ✅ {health.positives.length} ponto
                    {health.positives.length > 1 ? 's' : ''} positivo
                    {health.positives.length > 1 ? 's' : ''}:
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {health.positives.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {health.attentions.length > 0 && (
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400 mb-1">
                    ⚠️ {health.attentions.length}{' '}
                    {health.attentions.length > 1 ? 'atenções' : 'atenção'}:
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {health.attentions.map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

const HEALTH_CONFIG = {
  HEALTHY: {
    label: 'SAUDÁVEL',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-900 dark:text-emerald-100',
  },
  ATTENTION: {
    label: 'ATENÇÃO',
    icon: AlertCircle,
    iconClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-900 dark:text-orange-100',
  },
  ALERT: {
    label: 'ALERTA',
    icon: AlertOctagon,
    iconClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30',
    borderClass: 'border-rose-500',
    textClass: 'text-rose-900 dark:text-rose-100',
  },
} as const
