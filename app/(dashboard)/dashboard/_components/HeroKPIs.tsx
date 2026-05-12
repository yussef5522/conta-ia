// Hero Strip — 4 KPIs principais. Server Component.
// Sprint 1 Dia 1.

import { Wallet, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { getHeroKPIs } from '@/lib/dashboard/queries'
import { KPICard } from './KPICard'

interface HeroKPIsProps {
  companyId: string
}

export async function HeroKPIs({ companyId }: HeroKPIsProps) {
  const kpis = await getHeroKPIs(companyId)

  const margemPct = kpis.margemLiquida
  const margemLabel =
    `Margem ${margemPct >= 0 ? '' : ''}${margemPct.toFixed(0)}%`

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        label="Saldo atual"
        kpi={kpis.saldoAtual}
        icon={<Wallet className="h-4 w-4" />}
        sparkColor="#185FA5"
        delay={0}
      />
      <KPICard
        label="Receita do mês"
        kpi={kpis.receitaMes}
        icon={<TrendingUp className="h-4 w-4" />}
        sparkColor="#1D9E75"
        delay={0.05}
      />
      <KPICard
        label="Despesas do mês"
        kpi={kpis.despesasMes}
        icon={<TrendingDown className="h-4 w-4" />}
        sparkColor="#E24B4A"
        delay={0.1}
      />
      <KPICard
        label="Resultado"
        kpi={kpis.resultadoMes}
        variant="primary"
        icon={<Target className="h-4 w-4" />}
        footnote={margemLabel}
        delay={0.15}
      />
    </div>
  )
}
