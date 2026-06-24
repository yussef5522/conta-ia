'use client'

// Sprint 14 — Error boundary pra /contas-a-pagar.
//
// Próposito: substituir o "This page couldn't load" default do Next 16
// (que aparece quando algum erro JS sobe da árvore de render/effect)
// por uma UI controlada com mensagem útil + botão reset.
//
// Causa real do erro continua sendo investigada; este boundary é o
// SAFETY NET pra Yussef nunca mais ver "This page can't find" na tela
// de Contas a Pagar mesmo se algum efeito falhar.

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { reportClientError } from '@/lib/dev/report-client-error'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ContasAPagarError({ error, reset }: Props) {
  useEffect(() => {
    // Log no console pra debug (sem expor pro usuário)
    // eslint-disable-next-line no-console
    console.error('[contas-a-pagar/error.tsx]', error)
    // Sprint 15 — reporta pro servidor pra capturar stack no PM2 log
    reportClientError({
      context: 'contas-a-pagar/error.tsx (page boundary)',
      error,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8">
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">
              Algo deu errado em Contas a Pagar
            </h2>
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
              A última ação foi processada no servidor (criar/excluir/marcar
              paga funcionam mesmo quando esta tela quebra). Recarregue a
              lista pra ver o estado atualizado.
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
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar pro dashboard
        </Link>
      </div>
    </div>
  )
}
