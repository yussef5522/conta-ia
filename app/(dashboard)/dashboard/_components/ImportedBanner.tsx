// Sprint 5.0.2.0 — Banner pós-import Excel no /dashboard.
//
// Renderiza quando query params `imported` + `totalAmount` estão presentes
// (redirect de /contas-pagar/import após confirm bem-sucedido).
//
// Server component — lê searchParams.

import { CheckCircle2 } from 'lucide-react'

interface Props {
  imported?: number
  totalAmount?: number
  fileName?: string
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ImportedBanner({ imported, totalAmount, fileName }: Props) {
  if (!imported || imported <= 0) return null

  return (
    <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
          ✨ {imported} contas importadas
          {typeof totalAmount === 'number' && (
            <>
              {' '}
              · R$ {formatBRL(totalAmount)}
            </>
          )}
        </p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
          {fileName
            ? `Planilha "${fileName}" processada com sucesso.`
            : 'Planilha processada com sucesso.'}{' '}
          Veja o impacto no dashboard abaixo.
        </p>
      </div>
    </div>
  )
}
