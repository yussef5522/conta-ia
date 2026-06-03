// Sprint PF Fatia 4 — Radio component com os 5 kinds de retirada.
// Mostra info contábil de cada tipo (afeta DRE? categoria PF sugerida?).

'use client'

import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import type { BridgeKind } from '@/lib/bridges/types'

interface Props {
  value: BridgeKind
  onChange: (kind: BridgeKind) => void
}

const KIND_ORDER: BridgeKind[] = [
  'DISTRIBUICAO',
  'PRO_LABORE',
  'REEMBOLSO',
  'ADIANTAMENTO',
  'RETIRADA_SOCIOS',
]

const ACCENT: Record<BridgeKind, string> = {
  DISTRIBUICAO: 'border-amber-200 bg-amber-50',
  PRO_LABORE: 'border-blue-200 bg-blue-50',
  REEMBOLSO: 'border-slate-200 bg-slate-50',
  ADIANTAMENTO: 'border-purple-200 bg-purple-50',
  RETIRADA_SOCIOS: 'border-gray-200 bg-gray-50',
}

export function BridgeKindRadio({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      {KIND_ORDER.map((kind) => {
        const d = KIND_DEFAULTS[kind]
        const checked = value === kind
        return (
          <label
            key={kind}
            className={`block cursor-pointer rounded-lg border-2 p-3 transition ${
              checked
                ? ACCENT[kind] + ' border-primary'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="bridge-kind"
                value={kind}
                checked={checked}
                onChange={() => onChange(kind)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <span className="text-lg">{d.emoji}</span>
                  <span>{d.label}</span>
                  {!d.affectsDre && (
                    <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                      fora do DRE
                    </span>
                  )}
                  {d.affectsDre && (
                    <span className="ml-auto rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                      afeta DRE
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{d.description}</p>
              </div>
            </div>
          </label>
        )
      })}
    </div>
  )
}
