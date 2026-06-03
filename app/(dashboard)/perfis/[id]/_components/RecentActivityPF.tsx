'use client'

// Sprint Dashboard PF — Zona 5: Movimentações recentes (timeline compacta).
// Avatar por tipo (CREDIT verde / DEBIT vermelho).

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Clock, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'

interface RecentTx {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  categoryName?: string | null
  categoryColor?: string | null
  isInternational?: boolean
  installmentLabel?: string | null // "4/10"
}

interface Props {
  profileId: string
  transactions: RecentTx[]
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 7) return `há ${days}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function RecentActivityPF({ profileId, transactions }: Props) {
  const isEmpty = transactions.length === 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Clock className="h-5 w-5 text-emerald-600" />
                Movimentações recentes
              </h2>
              <p className="text-sm text-slate-600">Últimas 8 transações</p>
            </div>
            <Link href={`/perfis/${profileId}/transacoes`}>
              <Button size="sm" variant="ghost">
                Ver todas →
              </Button>
            </Link>
          </div>

          {isEmpty ? (
            <EmptyActivity profileId={profileId} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.slice(0, 8).map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5"
                >
                  {/* Avatar semântico CREDIT/DEBIT */}
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                      tx.type === 'CREDIT'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {tx.type === 'CREDIT' ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Texto */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/perfis/${profileId}/transacoes`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-emerald-700"
                    >
                      {tx.description}
                      {tx.isInternational && (
                        <span className="ml-1 text-xs">🌐</span>
                      )}
                      {tx.installmentLabel && (
                        <span className="ml-1 text-xs text-slate-500">
                          ({tx.installmentLabel})
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatRelativeDate(tx.date)}</span>
                      {tx.categoryName && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            {tx.categoryColor && (
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: tx.categoryColor }}
                              />
                            )}
                            {tx.categoryName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Valor */}
                  <div
                    className={`flex-shrink-0 text-sm font-semibold tabular-nums ${
                      tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {tx.type === 'CREDIT' ? '+' : '−'}
                    {formatBRL(Math.abs(tx.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EmptyActivity({ profileId }: { profileId: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <div className="mb-2 text-3xl">📋</div>
      <p className="mb-2 text-sm font-semibold text-slate-900">
        Sem movimentações ainda
      </p>
      <p className="mb-4 text-xs text-slate-600">
        Comece importando um extrato OFX ou lançando uma despesa manual.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={`/perfis/${profileId}/importar`}>
          <Button size="sm">
            <Plus className="mr-1 h-3 w-3" />
            Importar OFX
          </Button>
        </Link>
        <Link href={`/perfis/${profileId}/transacoes`}>
          <Button size="sm" variant="outline">
            Lançar manualmente
          </Button>
        </Link>
      </div>
    </div>
  )
}
