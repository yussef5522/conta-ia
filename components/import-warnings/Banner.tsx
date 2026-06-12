// Fase 4 — Banner global de warnings de duplicação pós-import.
// Aparece em todas as páginas quando user tem ≥1 warning não-resolvido.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface Props {
  empresaId: string | null
}

export function ImportWarningsBanner({ empresaId }: Props) {
  const [count, setCount] = useState(0)
  const [bankAccountId, setBankAccountId] = useState<string | null>(null)

  useEffect(() => {
    if (!empresaId) return
    let aborted = false
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/import-warnings?empresaId=${empresaId}`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        if (aborted) return
        setCount(data.count ?? 0)
        if (data.warnings?.[0]?.bankAccount?.id) {
          setBankAccountId(data.warnings[0].bankAccount.id)
        }
      } catch {
        // ignora — banner some quando user resolve
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000)  // polling 60s
    return () => { aborted = true; clearInterval(interval) }
  }, [empresaId])

  if (!empresaId || count === 0) return null

  return (
    <div
      className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      data-testid="import-warnings-banner"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
      <p className="flex-1">
        <span className="font-medium">{count}</span>{' '}
        {count === 1 ? 'duplicação suspeita detectada' : 'duplicações suspeitas detectadas'}{' '}
        no último import. Revise pra confirmar.
      </p>
      <Link
        href={`/empresas/${empresaId}/import-warnings`}
        className="rounded border border-amber-700 px-3 py-1 font-medium text-amber-900 hover:bg-amber-100"
      >
        Revisar →
      </Link>
    </div>
  )
}
