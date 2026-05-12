// Saúde Financeira — Sprint 1 Dia 4.
// Server component que faz fetch + renderiza 4 indicadores num único Card.

import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHealthCheck } from '@/lib/dashboard/queries'
import { HealthIndicator } from './HealthIndicator'

interface HealthCheckProps {
  companyId: string
}

export async function HealthCheck({ companyId }: HealthCheckProps) {
  const health = await getHealthCheck(companyId)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Saúde Financeira
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
          {health.indicators.map((indicator, idx) => (
            <HealthIndicator
              key={indicator.id}
              indicator={indicator}
              delay={idx * 0.05}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
