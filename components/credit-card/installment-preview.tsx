// Sprint PF Fatia 2 — Preview de parcelas inline no form de nova compra.
// Mostra: "1ª R$ 33,33 em jul/2026 / 2ª R$ 33,33 em ago/2026 / ..."

'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface InstallmentRow {
  installmentNumber: number
  installmentTotal: number
  date: string
  amount: number
  reference: string
  closingDate: string
  dueDate: string
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function formatRef(ref: string): string {
  const [y, m] = ref.split('-').map(Number)
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${meses[m - 1]}/${y}`
}

export function InstallmentPreview({
  profileId,
  cardId,
  date,
  totalAmount,
  installments,
}: {
  profileId: string
  cardId: string
  date: string
  totalAmount: number
  installments: number
}) {
  const [rows, setRows] = useState<InstallmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!date || !totalAmount || !installments || !cardId || !profileId) {
      setRows([])
      return
    }
    let canceled = false
    setLoading(true)
    setError(null)
    fetch(`/api/perfis/${profileId}/cartoes/${cardId}/installments-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date(date).toISOString(),
        totalAmount,
        installments,
      }),
    })
      .then(async (r) => {
        if (canceled) return
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          setError(d.erro ?? 'Erro')
          setRows([])
          return
        }
        const d = await r.json()
        setRows(d.installments ?? [])
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [profileId, cardId, date, totalAmount, installments])

  if (!totalAmount || !installments) return null

  return (
    <div className="rounded-lg border bg-emerald-50/50 p-3 mt-2">
      <div className="text-xs uppercase font-semibold tracking-wide text-emerald-700 mb-2">
        {installments === 1
          ? 'À vista — cai na fatura:'
          : `Preview · ${installments}x`}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Calculando…
        </div>
      ) : error ? (
        <div className="text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? null : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {rows.map((r) => (
            <div
              key={r.installmentNumber}
              className="flex items-center justify-between text-sm py-1 border-b border-emerald-200/40 last:border-0"
            >
              <span className="text-zinc-700 tabular-nums">
                {installments > 1 && (
                  <span className="font-semibold text-emerald-700">
                    {r.installmentNumber}ª
                  </span>
                )}{' '}
                {formatRef(r.reference)}
              </span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {formatBRL(r.amount)}
              </span>
            </div>
          ))}
          {installments > 1 && (
            <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-emerald-300 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatBRL(totalAmount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
