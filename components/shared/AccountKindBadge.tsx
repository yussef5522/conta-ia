// Sprint Account Kind PJ/PF (27/06/2026, modelo QuickBooks/Wave/FreshBooks).
//
// Selo visual PJ (empresa) vs PF (pessoal do dono). Reusado em TODAS as
// telas onde conta aparece pra usuário distinguir contas com mesmo banco
// (ex: Banrisul PJ vs Banrisul PF) e entender a classificação de pares.

import type { AccountKind } from '@/lib/accounts/kind'

interface Props {
  kind: AccountKind | string
  size?: 'sm' | 'md'
  className?: string
}

export function AccountKindBadge({ kind, size = 'sm', className }: Props) {
  const isPF = kind === 'PF'
  const label = isPF ? 'PF' : 'PJ'
  const title = isPF ? 'Pessoa Física (conta do dono)' : 'Pessoa Jurídica (conta da empresa)'

  const sizeCls = size === 'md'
    ? 'text-[11px] px-2 py-0.5'
    : 'text-[10px] px-1.5 py-0.5'

  const toneCls = isPF
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-400/40 dark:border-violet-700/40'
    : 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-400/40 dark:border-sky-700/40'

  return (
    <span
      title={title}
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded border ${sizeCls} ${toneCls} ${className ?? ''}`}
    >
      {label}
    </span>
  )
}
