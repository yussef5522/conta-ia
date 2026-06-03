'use client'

// Sprint Dashboard PF — Zona 6: faixa compacta de contas + pendentes.

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Wallet, Inbox, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'

interface Account {
  id: string
  name: string
  balance: number
}

interface Props {
  profileId: string
  accounts: Account[]
  pendingCount: number
}

export function PFFooterStrip({ profileId, accounts, pendingCount }: Props) {
  const noAccounts = accounts.length === 0
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]"
    >
      <Card>
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Contas ({accounts.length})
            </h3>
            <Link
              href={`/perfis/${profileId}/contas`}
              className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              Gerenciar →
            </Link>
          </div>
          {noAccounts ? (
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
              <p className="mb-2 text-xs font-medium text-slate-900">
                Nenhuma conta bancária ainda
              </p>
              <p className="mb-3 text-xs text-slate-600">
                Adicione suas contas (Nubank, Banrisul, Inter etc) pra começar.
              </p>
              <Link href={`/perfis/${profileId}/contas`}>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar primeira conta
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {accounts.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/perfis/${profileId}/contas`}
                  className="rounded border border-slate-200 bg-white p-2 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <p className="truncate text-xs text-slate-600">{a.name}</p>
                  <p className={`mt-0.5 text-sm font-semibold tabular-nums ${a.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatBRL(a.balance)}
                  </p>
                </Link>
              ))}
              {accounts.length > 4 && (
                <Link
                  href={`/perfis/${profileId}/contas`}
                  className="flex items-center justify-center rounded border border-dashed border-slate-200 bg-white p-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  + {accounts.length - 4} mais
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col justify-center p-4 sm:min-w-[180px]">
          {pendingCount > 0 ? (
            <>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                <Inbox className="h-4 w-4" />
                Pendentes ({pendingCount})
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Movimentações aguardando classificação
              </p>
              <Link href={`/perfis/${profileId}/transacoes?status=PENDING`}>
                <Button size="sm" className="mt-2 w-full" variant="outline">
                  Classificar agora →
                </Button>
              </Link>
            </>
          ) : (
            <>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                🎉 Tudo em dia
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Sem pendências de classificação
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
