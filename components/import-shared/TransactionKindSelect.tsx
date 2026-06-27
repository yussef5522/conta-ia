// Sprint OFX V3 — seletor de tipo da tx (reusavel).

'use client'

import type { OfxLineKind } from '@/lib/ofx-v3/types'

export interface KindOption {
  value: OfxLineKind
  label: string
  /** Quando ausente, opção sempre disponível. Permite restringir por type=CREDIT/DEBIT */
  availableWhen?: 'CREDIT' | 'DEBIT' | 'BOTH'
}

const DEFAULT_OPTIONS: KindOption[] = [
  { value: 'RECEITA', label: 'Receita', availableWhen: 'CREDIT' },
  { value: 'DESPESA', label: 'Despesa', availableWhen: 'DEBIT' },
  { value: 'TRANSFER', label: 'Transferência', availableWhen: 'BOTH' },
  { value: 'PAGAMENTO_CARTAO', label: 'Pgto cartão', availableWhen: 'DEBIT' },
  { value: 'PAGAMENTO_EMPRESTIMO', label: 'Pgto empréstimo', availableWhen: 'DEBIT' },
  { value: 'IGNORAR', label: 'Ignorar', availableWhen: 'BOTH' },
]

export function TransactionKindSelect({
  value,
  type,
  onChange,
  className,
  options = DEFAULT_OPTIONS,
}: {
  value: OfxLineKind
  type: 'CREDIT' | 'DEBIT'
  onChange: (kind: OfxLineKind) => void
  className?: string
  options?: KindOption[]
}) {
  const filtered = options.filter(
    (o) => !o.availableWhen || o.availableWhen === 'BOTH' || o.availableWhen === type,
  )
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as OfxLineKind)}
      className={
        className ??
        'text-xs border border-border bg-background rounded h-8 px-2 w-full hover:border-foreground/30 transition-colors'
      }
    >
      {filtered.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
