// Sprint 8 — Widget Receita por Forma.
// Barra empilhada (PIX verde / Cartão azul / Dinheiro âmbar / iFood rosa).
// Lista forma + valor + %. Soma BATE com card Receita bruta.

import { PieChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import { getReceitaPorForma } from '@/lib/dashboard/widgets'
import type { Regime, CustomPeriod } from '@/lib/dashboard/engine'

interface Props {
  empresaId: string
  regime: Regime
  customPeriod: CustomPeriod
}

export async function ReceitaPorFormaWidget({ empresaId, regime, customPeriod }: Props) {
  const data = await getReceitaPorForma({
    companyId: empresaId,
    periodStart: customPeriod.start,
    periodEnd: customPeriod.end,
    regime,
  })

  return (
    <Card>
      <CardContent className="py-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PieChart className="h-4 w-4 text-muted-foreground" />
            Receita por forma
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Soma:{' '}
            <span className="font-medium tabular-nums text-foreground">
              {formatBRL(data.totalReceita)}
            </span>
          </div>
        </div>

        {data.formas.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sem receita registrada no período.
          </div>
        ) : (
          <>
            {/* Barra empilhada */}
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/30 mb-5">
              {data.formas.map((f) => (
                <div
                  key={f.forma}
                  style={{
                    width: `${f.pct}%`,
                    backgroundColor: f.color,
                  }}
                  className="h-full transition-all"
                  title={`${f.label}: ${formatBRL(f.total)} (${f.pct.toFixed(1)}%)`}
                />
              ))}
            </div>

            {/* Lista */}
            <ul className="space-y-2">
              {data.formas.map((f) => (
                <li key={f.forma} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: f.color }}
                  />
                  <span className="flex-1 truncate text-foreground">
                    {f.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {f.qtdTx}x
                  </span>
                  <span className="font-medium tabular-nums shrink-0 min-w-[88px] text-right">
                    {formatBRL(f.total)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                    {f.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
