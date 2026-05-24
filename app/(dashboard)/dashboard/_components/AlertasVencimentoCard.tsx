// Sprint 4.0.3 — Card "Alertas de Vencimento" no dashboard.
// Server component (sem state — só leitura).

import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'
import type { AlertasResult } from '@/lib/dashboard/alertas'

interface Props {
  data: AlertasResult
  companyId: string
}

export function AlertasVencimentoCard({ data, companyId }: Props) {
  const semAlertas =
    data.vencidas.count === 0 &&
    data.vencendoEm3Dias.count === 0 &&
    data.vencendoSemana.count === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {semAlertas ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            Nenhuma conta vencida ou próxima do vencimento.
          </div>
        ) : (
          <>
            {data.vencidas.count > 0 && (
              <AlertRow
                tone="red"
                count={data.vencidas.count}
                total={data.vencidas.total}
                label="vencida"
                labelPlural="vencidas"
              />
            )}
            {data.vencendoEm3Dias.count > 0 && (
              <AlertRow
                tone="amber"
                count={data.vencendoEm3Dias.count}
                total={data.vencendoEm3Dias.total}
                label="vence em até 3 dias"
                labelPlural="vencem em até 3 dias"
              />
            )}
            {data.vencendoSemana.count > 0 && (
              <AlertRow
                tone="neutral"
                count={data.vencendoSemana.count}
                total={data.vencendoSemana.total}
                label="vence essa semana"
                labelPlural="vencem essa semana"
              />
            )}
            <Button asChild size="sm" variant="outline" className="w-full mt-2">
              <Link href={`/contas-a-pagar?empresaId=${companyId}`}>
                Ver Contas a Pagar
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AlertRow({
  tone,
  count,
  total,
  label,
  labelPlural,
}: {
  tone: 'red' | 'amber' | 'neutral'
  count: number
  total: number
  label: string
  labelPlural: string
}) {
  const colors = {
    red: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
    amber: { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
    neutral: { dot: 'bg-zinc-400', text: 'text-zinc-700', bg: 'bg-zinc-50' },
  }[tone]

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md ${colors.bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 rounded-full ${colors.dot} shrink-0`} />
        <span className={`text-sm ${colors.text}`}>
          <strong className="tabular-nums">{count}</strong>{' '}
          {count === 1 ? label : labelPlural}
        </span>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${colors.text}`}>
        {formatBRL(total)}
      </span>
    </div>
  )
}
