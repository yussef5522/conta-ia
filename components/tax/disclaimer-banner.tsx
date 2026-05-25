// Sprint 5.0.1 — Banner de aviso legal reutilizável.

import { AlertTriangle } from 'lucide-react'

export function DisclaimerBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}
      role="alert"
    >
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-semibold">
            ⚠️ Cálculos são ESTIMATIVAS — não substituem orientação contábil.
          </p>
          <p>
            Valores baseados em LC 123/2006 + tabelas vigentes 2026. Sempre
            confirme com seu contador antes de pagar ou tomar decisões fiscais.
            Tabelas e regras podem mudar; valor real do DAS no sistema oficial
            (gov.br) é a fonte autoritativa.
          </p>
        </div>
      </div>
    </div>
  )
}
