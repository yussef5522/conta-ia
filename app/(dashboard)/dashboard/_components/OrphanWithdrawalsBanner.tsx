// Sprint Fluxo-Único-Retirada (08/06/2026) — Banner sutil no Dashboard PJ
// que mostra contador de retiradas órfãs (tx categorizada Distribuição/
// Pró-labore EFFECTED sem ponte PF). Server Component.

import Link from 'next/link'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { WITHDRAWAL_DRE_GROUPS } from '@/lib/withdrawals/is-orphan'

interface Props {
  companyId: string
}

export async function OrphanWithdrawalsBanner({ companyId }: Props) {
  const count = await prisma.transaction.count({
    where: {
      bankAccount: { companyId },
      type: 'DEBIT',
      lifecycle: 'EFFECTED',
      isInternalTransfer: false,
      transferGroupId: null,
      bridge: { is: null },
      category: {
        dreGroup: { in: Array.from(WITHDRAWAL_DRE_GROUPS) },
      },
    },
  })

  if (count === 0) return null

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {count}{' '}
              {count === 1 ? 'retirada de sócio' : 'retiradas de sócio'}{' '}
              sem entrada no PF
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
              {count === 1
                ? 'Categorizou como Distribuição/Pró-labore mas a entrada no perfil PF ainda não foi registrada.'
                : 'Categorizou como Distribuição/Pró-labore mas as entradas no perfil PF ainda não foram registradas.'}
            </p>
          </div>
        </div>
        <Link
          href={`/transacoes?empresaId=${companyId}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          Revisar
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}
