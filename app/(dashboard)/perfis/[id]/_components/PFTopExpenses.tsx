'use client'

// Sprint Dashboard PF — Zona 2: a "BOLA" pedida.
// Donut grande + lista lateral com %, valor + drill-down ao clicar.
//
// Paleta esmeralda + pastéis pra coerência com Hero verde.

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { PieChart, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'
import type { ExpenseItem } from './pf-top-expenses-types'

const PFTopExpensesDonut = dynamic(() => import('./PFTopExpensesDonut'), {
  ssr: false,
  loading: () => <div style={{ width: 220, height: 220 }} />,
})

// Paleta esmeralda + neutros (foco visual no donut, não distrair)
const PALETTE = [
  '#059669', // emerald-600
  '#10b981', // emerald-500
  '#34d399', // emerald-400
  '#6ee7b7', // emerald-300
  '#0ea5e9', // sky-500 (variedade)
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#94a3b8', // slate-400 (outros)
]

export interface PFTopExpensesProps {
  profileId: string
  items: Array<{
    categoryId: string | null
    name: string
    color: string | null
    total: number
  }>
  periodLabel: string
  totalMonth: number
}

export function PFTopExpenses({
  profileId,
  items: rawItems,
  periodLabel,
  totalMonth,
}: PFTopExpensesProps) {
  // Top 8 + "Outros" agregado
  const sorted = [...rawItems].sort((a, b) => b.total - a.total)
  const top8 = sorted.slice(0, 8)
  const rest = sorted.slice(8)
  const otrosTotal = rest.reduce((s, it) => s + it.total, 0)

  const items: ExpenseItem[] = top8.map((it, i) => ({
    categoryId: it.categoryId,
    name: it.name,
    color: it.color || PALETTE[i % PALETTE.length],
    total: it.total,
    percent: totalMonth > 0 ? (it.total / totalMonth) * 100 : 0,
  }))
  if (otrosTotal > 0) {
    items.push({
      categoryId: null,
      name: 'Outros',
      color: PALETTE[PALETTE.length - 1],
      total: otrosTotal,
      percent: totalMonth > 0 ? (otrosTotal / totalMonth) * 100 : 0,
    })
  }

  const [hovered, setHovered] = useState<ExpenseItem | null>(null)
  const isEmpty = items.length === 0 || totalMonth === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <PieChart className="h-5 w-5 text-emerald-600" />
                Em que estou gastando?
              </h2>
              <p className="text-sm text-slate-600">{periodLabel}</p>
            </div>
          </div>

          {isEmpty ? (
            <EmptyExpenses profileId={profileId} />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
              {/* Donut + centro */}
              <div className="relative mx-auto">
                <PFTopExpensesDonut items={items} size={220} onHover={setHovered} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  {hovered ? (
                    <>
                      <p className="text-xs text-slate-500">{hovered.name}</p>
                      <p className="text-xl font-bold tabular-nums text-slate-900">
                        {formatBRL(hovered.total)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {hovered.percent.toFixed(1)}%
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">Total</p>
                      <p className="text-xl font-bold tabular-nums text-slate-900">
                        {formatBRL(totalMonth)}
                      </p>
                      <p className="text-xs text-slate-500">{items.length} categorias</p>
                    </>
                  )}
                </div>
              </div>

              {/* Lista lateral */}
              <ul className="space-y-2">
                {items.map((it, i) => (
                  <li
                    key={it.categoryId ?? `idx-${i}`}
                    className={`flex items-center justify-between gap-3 rounded px-2 py-1 transition ${
                      hovered?.categoryId === it.categoryId ? 'bg-emerald-50' : ''
                    }`}
                    onMouseEnter={() => setHovered(it)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ background: it.color ?? '#94a3b8' }}
                      />
                      <span className="truncate text-sm text-slate-700">
                        {it.name}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-baseline gap-2 tabular-nums">
                      <span className="text-xs text-slate-500">
                        {it.percent.toFixed(0)}%
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {formatBRL(it.total)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isEmpty && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <Link
                href={`/perfis/${profileId}/transacoes?type=DEBIT`}
                className="text-sm text-emerald-700 hover:text-emerald-900 hover:underline"
              >
                Ver todas as despesas →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function EmptyExpenses({ profileId }: { profileId: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mb-3 text-4xl">🥧</div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">
        Sem despesas registradas neste mês
      </h3>
      <p className="mb-4 text-xs text-slate-600">
        Quando você importar um extrato ou lançar uma despesa, a rosca aparece aqui
        coloridinha mostrando pra onde foi seu dinheiro.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={`/perfis/${profileId}/importar`}>
          <Button size="sm">
            <ArrowRight className="mr-1 h-3.5 w-3.5" />
            Importar fatura OFX
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
