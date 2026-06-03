'use client'

// Sprint Dashboard PF — Zona 3: Evolução nos últimos 12 meses.
// Wrapper client que importa dynamic(ssr:false) o ComposedChart.

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Activity, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { MonthlyEvolutionPoint } from '@/lib/dashboard-pf/types'

const MonthlyEvolutionChartInner = dynamic(
  () => import('./MonthlyEvolutionChartInner'),
  {
    ssr: false,
    loading: () => <div style={{ height: 280 }} className="animate-pulse bg-slate-50 rounded" />,
  },
)

interface Props {
  profileId: string
  months: MonthlyEvolutionPoint[]
}

export function MonthlyEvolutionChart({ profileId, months }: Props) {
  const totalIncome = months.reduce((s, p) => s + p.income, 0)
  const totalExpense = months.reduce((s, p) => s + p.expense, 0)
  const hasData = totalIncome > 0 || totalExpense > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Activity className="h-5 w-5 text-emerald-600" />
                Evolução nos últimos 12 meses
              </h2>
              <p className="text-sm text-slate-600">
                Entradas, saídas e saldo cumulativo
              </p>
            </div>
          </div>

          {hasData ? (
            <MonthlyEvolutionChartInner data={months} />
          ) : (
            <EmptyEvolution profileId={profileId} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EmptyEvolution({ profileId }: { profileId: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <div className="mb-3 text-4xl">📈</div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">
        Sem histórico ainda
      </h3>
      <p className="mb-4 text-xs text-slate-600">
        Sua evolução mensal aparece aqui assim que você tiver lançamentos em
        mais de um mês. Com 3+ meses de dados, dá pra ver tendência clara.
      </p>
      <Link href={`/perfis/${profileId}/importar`}>
        <Button size="sm" variant="outline">
          <ArrowRight className="mr-1 h-3.5 w-3.5" />
          Importar histórico
        </Button>
      </Link>
    </div>
  )
}
