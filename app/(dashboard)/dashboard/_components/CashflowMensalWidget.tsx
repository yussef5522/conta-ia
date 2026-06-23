// Sprint 8 — Widget Fluxo de Caixa Mensal (6 meses).
// Barras verticais entrou (verde) vs saiu (coral). Mês incompleto fica
// esmaecido + asterisco. Hover mostra valores. Click vai pras movs do mês.

import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import { getCashflowMensal } from '@/lib/dashboard/widgets'
import type { Regime } from '@/lib/dashboard/engine'

interface Props {
  empresaId: string
  regime: Regime
}

const COLOR_ENTROU = '#1D9E75'
const COLOR_SAIU = '#D85A30'

export async function CashflowMensalWidget({ empresaId, regime }: Props) {
  const data = await getCashflowMensal(empresaId, new Date(), regime, 6)
  const meses = data.meses

  // Escala visual: maior valor (entrou OU saiu) define altura 100%
  const maxValor = Math.max(
    1,
    ...meses.flatMap((m) => [m.entrou, m.saiu]),
  )

  const mesAtual = meses[meses.length - 1]
  const temIncompleto = meses.some((m) => m.cobertura === 'parcial' && !m.isMTD)
  const temMTD = mesAtual?.isMTD

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Fluxo de caixa
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Últimos 6 meses · entradas e saídas reais
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <Legend dot={COLOR_ENTROU} label="Entrou" />
            <Legend dot={COLOR_SAIU} label="Saiu" />
          </div>
        </div>

        {/* Gráfico de barras */}
        <div className="grid grid-cols-6 gap-3 items-end h-44 mb-2">
          {meses.map((m) => {
            const hEntrou = (m.entrou / maxValor) * 100
            const hSaiu = (m.saiu / maxValor) * 100
            const esmaecido = m.cobertura === 'parcial' && !m.isMTD
            const opacity = esmaecido ? 0.4 : 1
            const tip = m.qtdTx === 0
              ? `${m.mesLabel} · sem dados`
              : `${m.mesLabel}\nEntrou: ${formatBRL(m.entrou)}\nSaiu: ${formatBRL(m.saiu)}\nResultado: ${formatBRL(m.resultado)}\n${m.qtdTx} transações${m.isMTD ? '\n(mês até hoje)' : ''}`
            return (
              <Link
                key={`${m.year}-${m.month}`}
                href={`/transacoes?empresaId=${empresaId}&de=${m.year}-${String(m.month + 1).padStart(2, '0')}-01&ate=${m.year}-${String(m.month + 1).padStart(2, '0')}-${String(new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate()).padStart(2, '0')}`}
                title={tip}
                className="flex flex-col justify-end items-center gap-0.5 h-full group cursor-pointer"
              >
                <div className="flex items-end gap-0.5 w-full h-full justify-center">
                  <div
                    style={{
                      height: `${hEntrou}%`,
                      backgroundColor: COLOR_ENTROU,
                      opacity,
                    }}
                    className="w-3 rounded-sm transition-opacity group-hover:opacity-100"
                  />
                  <div
                    style={{
                      height: `${hSaiu}%`,
                      backgroundColor: COLOR_SAIU,
                      opacity,
                    }}
                    className="w-3 rounded-sm transition-opacity group-hover:opacity-100"
                  />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Labels dos meses */}
        <div className="grid grid-cols-6 gap-3 text-center mb-3">
          {meses.map((m) => {
            const esmaecido = m.cobertura === 'parcial' && !m.isMTD
            return (
              <div
                key={`lbl-${m.year}-${m.month}`}
                className={`text-[11px] tabular-nums ${
                  m.isMTD
                    ? 'font-medium text-foreground'
                    : esmaecido
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground'
                }`}
              >
                {m.mesLabel}
                {esmaecido && <span>*</span>}
                {m.isMTD && <span>*</span>}
              </div>
            )
          })}
        </div>

        {/* Footer: resultado do mês corrente + nota */}
        <div className="pt-3 border-t flex items-baseline justify-between flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            Resultado de {mesAtual.mesLabel}:
          </div>
          <div className={`text-sm font-medium tabular-nums ${
            mesAtual.resultado >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatBRL(mesAtual.resultado)}
          </div>
        </div>
        {(temIncompleto || temMTD) && (
          <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
            * mês incompleto (cobertura parcial dos dados)
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: dot }} />
      {label}
    </span>
  )
}
