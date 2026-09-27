// Sprint 5.0.3.0a — 4 stats cards de /contas-a-pagar.
//
// ⚠️ Padronização visual (24/08): a implementação virou `components/ui/stat-card`, que é
// o MOLDE do sistema inteiro. Este arquivo ficou como CASCA FINA pra preservar a API que
// a página já usa (variant + amount + count). Uma implementação só — se existissem dois
// cards, eles divergiriam no primeiro ajuste (REGRA 4).

import { LucideIcon } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { StatCard, type StatTone } from '@/components/ui/stat-card'

export type StatsVariant = 'paid' | 'pending' | 'warn' | 'overdue'

const TONE: Record<StatsVariant, StatTone> = {
  paid: 'emerald', pending: 'sky', warn: 'amber', overdue: 'rose',
}

interface Props {
  variant: StatsVariant
  label: string
  amount: number
  count: number
  icon: LucideIcon
  onClick?: () => void
  /**
   * ⭐⭐ 26/09 — a RESSALVA como detalhe, dentro do cartão (decisão do dono).
   *
   * *"E DENTRO do cartão, a divisão honesta: «X conciliadas com o banco · Y sem vínculo» —
   * a ressalva que evita a mentira continua viva, só que como detalhe, não como recorte."*
   *
   * ⛔ Ele é **APENSADO** ao `N contas`, nunca substitui: a contagem é o que o card conta, e
   * deixar o detalhe tomar o lugar dela abriria a porta pros dois números divergirem — a
   * doença que o `contarFilas` existe pra impedir.
   */
  detalhe?: string
}

export function StatsCard({ variant, label, amount, count, icon, onClick, detalhe }: Props) {
  return (
    <StatCard
      tone={TONE[variant]}
      label={label}
      value={formatBRL(amount)}
      sub={`${count} conta${count !== 1 ? 's' : ''}${detalhe ? ` · ${detalhe}` : ''}`}
      icon={icon}
      onClick={onClick}
      testId={`stats-card-${variant}`}
    />
  )
}
