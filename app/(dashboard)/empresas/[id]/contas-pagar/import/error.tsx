'use client'

// Sprint 5.0.2.3 — Error boundary global da rota /import.
//
// Captura qualquer erro NÃO tratado durante render ou Server Component
// e mostra uma tela amigável em vez do "This page couldn't load" cru.
// Usuário pode tentar de novo (reset) ou voltar pra lista.

import Link from 'next/link'
import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ImportError({ error, reset }: Props) {
  const params = useParams()
  const empresaId =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : ''

  useEffect(() => {
    // Logger best-effort no console pra debugging local + Sentry-like futuro
    console.error('[IMPORT-EXCEL ERROR BOUNDARY]', error)
  }, [error])

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
                Algo inesperado aconteceu na importação
              </h2>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Não conseguimos carregar essa tela. Pode ter sido uma falha
                temporária — tentar de novo costuma resolver.
              </p>
            </div>

            {error.message && (
              <details className="text-xs text-red-700/80 dark:text-red-300/80">
                <summary className="cursor-pointer font-mono uppercase tracking-wide">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-red-100/50 dark:bg-red-950/40 p-2 font-mono text-[11px]">
                  {error.message}
                  {error.digest && `\nDigest: ${error.digest}`}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={reset} size="sm" variant="outline">
                <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                Tentar de novo
              </Button>
              {empresaId && (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/contas-a-pagar">Voltar pra Contas a Pagar</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
