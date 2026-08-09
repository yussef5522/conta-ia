'use client'

// Sprint Fechar-Ponte (08/08/2026) — FASE B. Banner OBVIO de retiradas órfãs.
// Aparece logo onde o usuário cai após confirmar um import (Transações) e em
// Pendentes. Impossível de ignorar (mesmo padrão dos banners de CDB/transfer).
// É o que impede a pilha de órfãs de voltar. Link direto pro lote.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wallet } from 'lucide-react'

export function OrphanWithdrawalsActionBanner({ empresaId }: { empresaId: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    fetch(`/api/empresas/${empresaId}/retiradas-orfas`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.count === 'number') setCount(d.count)
      })
      .catch(() => {
        /* silencioso: banner some se não conseguir contar */
      })
    return () => {
      alive = false
    }
  }, [empresaId])

  if (count === 0) return null

  return (
    <Link
      href={`/empresas/${empresaId}/retiradas`}
      className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30"
    >
      <Wallet className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {count} retirada{count > 1 ? 's' : ''} precisa{count > 1 ? 'm' : ''} ser enviada
          {count > 1 ? 's' : ''} ao seu PF
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300/80">
          Saídas marcadas como retirada de sócio sem entrada no seu PF. Clique pra resolver em lote
          (com preview).
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-amber-800 dark:text-amber-300">
        Resolver →
      </span>
    </Link>
  )
}
