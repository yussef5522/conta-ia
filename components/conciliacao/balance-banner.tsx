'use client'

// Sprint A-effected Fase 1 — Banner de saldo sistema vs banco.
//
// Mostra diferença colorida (verde/amarelo/vermelho) + heurística de
// causas prováveis (duplicatas detectadas via pareamento valor+data).

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'

interface BalanceCheckResponse {
  saldoBanco: number
  saldoSistema: number
  diferenca: number
  diferencaAbs: number
  status: 'OK' | 'INFO' | 'WARN' | 'ERROR'
  causasProvaveis: {
    duplicatasPotenciais: number
    valorDuplicado: number
  } | null
}

interface Props {
  empresaId: string
}

export function BalanceBanner({ empresaId }: Props) {
  const [data, setData] = useState<BalanceCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!empresaId) return
    setLoading(true)
    fetch(`/api/conciliacao/balance-check?empresaId=${empresaId}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [empresaId])

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Calculando saldo...
      </div>
    )
  }
  if (!data) return null

  const colorClass =
    data.status === 'OK'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : data.status === 'INFO'
        ? 'border-slate-300 bg-slate-50 text-slate-900'
        : data.status === 'WARN'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-red-300 bg-red-50 text-red-900'

  const Icon =
    data.status === 'OK' ? Check : data.status === 'INFO' ? Info : AlertTriangle

  const title =
    data.status === 'OK'
      ? 'Saldo bate com o banco'
      : `Saldo com diferença de ${formatBRL(data.diferencaAbs)}`

  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
            <span>
              Saldo sistema: <strong className="text-foreground">{formatBRL(data.saldoSistema)}</strong>
            </span>
            <span>
              Saldo banco: <strong className="text-foreground">{formatBRL(data.saldoBanco)}</strong>
            </span>
          </div>
          {data.causasProvaveis && (
            <p className="text-xs mt-1">
              Causa provável:{' '}
              <strong>{data.causasProvaveis.duplicatasPotenciais} duplicatas</strong>
              {' '}potenciais somando{' '}
              <strong>{formatBRL(data.causasProvaveis.valorDuplicado)}</strong>.
              Concilie pra resolver.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
