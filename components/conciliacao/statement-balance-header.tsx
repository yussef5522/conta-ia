'use client'

// Sprint A-effected Fase B.1 — Header sóbrio estilo Xero
// "Statement Balance" (banco) | "Balance in Xero" (sistema) | Diferença.
// Sem cores fortes (Xero é neutro). Visual ensina sozinho: bata o saldo.

import { useEffect, useState } from 'react'
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
  refreshKey?: number
}

export function StatementBalanceHeader({ empresaId, refreshKey = 0 }: Props) {
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
  }, [empresaId, refreshKey])

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Calculando saldos…
      </div>
    )
  }
  if (!data) return null

  const bate = data.status === 'OK'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-12 gap-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Saldo do extrato (banco)
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatBRL(data.saldoBanco)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Saldo no sistema
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatBRL(data.saldoSistema)}
          </p>
        </div>
      </div>

      <div className="text-sm">
        {bate ? (
          <span className="text-emerald-700 font-medium">
            → Saldos batem ✓
          </span>
        ) : (
          <>
            <span className="font-medium">
              → {formatBRL(data.diferencaAbs)} a conciliar pra bater
            </span>
            {data.causasProvaveis && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({data.causasProvaveis.duplicatasPotenciais} prováveis
                duplicatas somando{' '}
                {formatBRL(data.causasProvaveis.valorDuplicado)})
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
