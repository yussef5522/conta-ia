// Sprint 5.0.2 — Ícone Info discreto com tooltip nativo (HTML title).
// Substitui o banner amarelo gigante da Sprint 5.0.1 por padrão TurboTax/QuickBooks.

import Link from 'next/link'
import { Info } from 'lucide-react'

const TOOLTIP_TEXT =
  'Análise tributária baseada em dados oficiais (LC 123/2006 + Lei 9.249/95 + Lei 10.637/02 + Lei 10.833/03). Recomendamos validação com seu contador antes de decisões fiscais.'

export function DisclaimerInfo() {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500"
      title={TOOLTIP_TEXT}
    >
      <Info className="h-3.5 w-3.5" />
      <Link
        href="/tributario/metodologia"
        className="hover:text-zinc-900 hover:underline transition-colors"
      >
        Metodologia
      </Link>
    </span>
  )
}
