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
  const margemLabel = `Margem operacional ${margemPct.toFixed(0)}%`

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        label="Saldo atual"
        kpi={kpis.saldoAtual}
        icon={<Wallet className="h-4 w-4" />}
        sparkColor="#185FA5"
        delay={0}
        tooltip="Soma do saldo de todas as contas bancárias da empresa, atualizado em tempo real."
      />
      <KPICard
        label="Receita bruta"
        kpi={kpis.receitaMes}
        icon={<TrendingUp className="h-4 w-4" />}
        sparkColor="#1D9E75"
        delay={0.05}
        tooltip="Total de vendas no mês, antes de deduções (devoluções, impostos sobre vendas)."
      />
      <KPICard
        label="Despesas operacionais"
        kpi={kpis.despesasMes}
        icon={<TrendingDown className="h-4 w-4" />}
        sparkColor="#E24B4A"
        delay={0.1}
        tooltip="CMV + Pessoal + Comerciais + Administrativas. NÃO inclui Despesas Financeiras (juros, IOF), que aparecem separadamente no Lucro Líquido do DRE."
      />
      <KPICard
        label="Resultado operacional"
        kpi={kpis.resultadoMes}
        variant="primary"
        icon={<Target className="h-4 w-4" />}
        footnote={margemLabel}
        delay={0.15}
        tooltip="Receita Bruta − Deduções − CMV − Despesas Operacionais. Saúde do negócio ANTES de juros e impostos sobre lucro. O Lucro Líquido completo aparece no DRE."
      />
    </div>
  )
}
