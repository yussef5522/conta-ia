// Sprint 8 — Widget Maiores Fornecedores.
// Top 5 por DEBIT non-NON_DRE no período. Avatar iniciais + barra
// proporcional + valor. Link "ver todos" + click por fornecedor.

import Link from 'next/link'
import { Building2, ArrowRight, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import { getTopFornecedores } from '@/lib/dashboard/widgets'
import type { Regime } from '@/lib/dashboard/engine'
import type { CustomPeriod } from '@/lib/dashboard/engine'

interface Props {
  empresaId: string
  regime: Regime
  customPeriod: CustomPeriod
}

export async function MaioresFornecedoresWidget({ empresaId, regime, customPeriod }: Props) {
  const data = await getTopFornecedores({
    companyId: empresaId,
    periodStart: customPeriod.start,
    periodEnd: customPeriod.end,
    regime,
    limit: 5,
  })

  const top = data.fornecedores
  const maxValor = Math.max(1, ...top.map((f) => f.total))

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Maiores fornecedores
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Despesas com contraparte identificada
            </div>
          </div>
          <Link
            href={`/empresas/${empresaId}/fornecedores`}
            className="text-xs text-foreground hover:underline underline-offset-2 inline-flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {top.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum fornecedor identificado no período.
            <div className="text-xs mt-1">
              Importe OFX ou cadastre fornecedores em <Link href={`/empresas/${empresaId}/fornecedores`} className="underline">/fornecedores</Link>.
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {top.map((f) => {
              const widthPct = (f.total / maxValor) * 100
              return (
                <li key={f.supplierId}>
                  <Link
                    href={`/transacoes?empresaId=${empresaId}&supplierId=${f.supplierId}`}
                    className="group block"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar nome={f.razaoSocial} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-sm truncate group-hover:underline underline-offset-2 decoration-muted-foreground/40">
                            {f.razaoSocial}
                          </span>
                          <span className="text-sm font-medium tabular-nums shrink-0">
                            {formatBRL(f.total)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground/70 rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                          <span className="text-[11px] text-muted-foreground">
                            {f.qtdTx} {f.qtdTx === 1 ? 'transação' : 'transações'}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {f.pct.toFixed(1)}% das despesas
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Avatar({ nome }: { nome: string }) {
  const initials = nome
    .replace(/\s*(LTDA|S\.A\.|ME|EPP|EIRELI)\b/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div
      aria-hidden
      className="h-8 w-8 rounded-md bg-muted text-xs font-medium text-muted-foreground flex items-center justify-center shrink-0"
    >
      {initials || '—'}
    </div>
  )
}
