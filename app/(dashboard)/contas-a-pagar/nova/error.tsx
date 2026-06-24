'use client'

// Sprint 14 — Error boundary pra /contas-a-pagar/nova.
// Mesmo padrão do error.tsx do parent — evita "This page couldn't load"
// default do Next 16.

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { reportClientError } from '@/lib/dev/report-client-error'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ContasAPagarNovaError({ error, reset }: Props) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[contas-a-pagar/nova/error.tsx]', error)
    reportClientError({
      context: 'contas-a-pagar/nova/error.tsx (page boundary)',
      error,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="space-y-6 max-w-xl mx-auto py-8">
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">
              Algo deu errado ao carregar o formulário
            </h2>
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
              Se você acabou de criar uma conta a pagar, ela pode já estar
              salva — volte pra lista e confira.
            </p>
            {error.digest && (
              <p className="text-xs text-amber-900/60 dark:text-amber-100/60 font-mono">
                ref: {error.digest}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar de novo
        </button>
        <Link
          href="/contas-a-pagar"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar pra lista
        </Link>
      </div>
    </div>
  )
}
