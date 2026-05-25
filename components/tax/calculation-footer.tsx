// Sprint 5.0.2 — Footer sutil em cards de cálculo fiscal (TurboTax-style).

import Link from 'next/link'
import { Info } from 'lucide-react'

export function CalculationFooter({ versaoTabela = '2026' }: { versaoTabela?: string }) {
  return (
    <div className="border-t border-zinc-100 pt-3 mt-4">
      <p className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
        <Info className="h-3 w-3 shrink-0" />
        <span>
          Cálculo baseado em LC 123/2006 e regulamentos vigentes ({versaoTabela}).
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Link
            href="/tributario/metodologia"
            className="text-zinc-600 hover:text-zinc-900 hover:underline"
          >
            Metodologia
          </Link>
        </span>
      </p>
    </div>
  )
}
