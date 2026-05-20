'use client'

// Badge "Atualizado há X dias" — Sprint 2.4 Onda 2.

import {
  daysSince,
  freshnessTier,
  freshnessLabel,
  freshnessColor,
} from '@/lib/ofx/format-imports'

interface Props {
  lastImportAt: string | Date | null
}

export function FreshnessBadge({ lastImportAt }: Props) {
  const days = daysSince(lastImportAt)
  const tier = freshnessTier(days)
  const colors = freshnessColor(tier)
  const label = freshnessLabel(tier, days)

  const title = lastImportAt
    ? `Último import bem-sucedido: ${new Date(lastImportAt).toLocaleString('pt-BR')}`
    : 'Nenhum extrato OFX importado ainda'

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  )
}
