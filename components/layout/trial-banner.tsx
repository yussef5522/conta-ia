// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Banner trial.
// Server component: lê subscription do user logado e renderiza
// "Trial: X dias restantes" se status=TRIAL. Some quando GRANTED/ACTIVE.

import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getEffectiveStatusByUserId } from '@/lib/subscription/queries'

export async function TrialBanner() {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  let userId: string
  try {
    const payload = await verifyToken(token)
    userId = payload.sub
  } catch {
    return null
  }

  const status = await getEffectiveStatusByUserId(userId)
  if (!status) return null

  // Mostra SÓ se TRIAL ativo
  if (status.effectiveStatus !== 'TRIAL') return null
  const dias = status.diasRestantesTrial ?? 0

  // Urgência crescente conforme o trial acaba
  const isUrgent = dias <= 3
  const isWarning = dias <= 7 && !isUrgent

  return (
    <div
      className={[
        'w-full px-5 py-2 text-sm flex items-center justify-center gap-3 border-b',
        isUrgent
          ? 'bg-red-50 border-red-200 text-red-800'
          : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-violet-50 border-violet-200 text-violet-800',
      ].join(' ')}
    >
      <span className="text-xs font-semibold uppercase tracking-wider">
        Trial
      </span>
      <span>
        {dias === 0
          ? 'Último dia do seu período de teste'
          : dias === 1
            ? 'Resta 1 dia do seu período de teste'
            : `${dias} dias restantes do seu período de teste`}
      </span>
      <Link
        href="/assinar"
        className={[
          'ml-2 font-semibold underline underline-offset-2',
          isUrgent ? 'text-red-900' : isWarning ? 'text-amber-900' : 'text-violet-900',
        ].join(' ')}
      >
        Ver planos →
      </Link>
    </div>
  )
}
