'use client'

// Sprint Dashboard PF — Zona 4: 3 cards lado a lado (Bridge / Recorrentes / Cartões).
// Diferenciais que NÓS temos e Mobills/Organizze NÃO têm.
//
// 🔗 Card Bridge linka pra /socios (não /pontes — coerente com unificação).

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Workflow, Repeat, CreditCard, ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format/money'

interface BridgeItem {
  companyId: string
  companyName: string
  /** Soma das pontes deste mês desta empresa (todas que o user vê) */
  amount: number
  /** Quantidade de pontes este mês */
  count: number
}

interface RecurringItem {
  name: string
  monthlyAmount: number
}

interface CreditCardItem {
  id: string
  name: string
  brand?: string | null
  usedPercent: number  // 0-100
  invoiceOpenAmount: number
}

export interface DiferenciaisGridProps {
  profileId: string
  /** Pontes deste mês — vão linkar pra /empresas/<companyId>/socios */
  bridges: BridgeItem[]
  bridgeTotalMes: number
  recurring: RecurringItem[]
  recurringMonthlyTotal: number
  creditCards: CreditCardItem[]
  creditCardsTotalDue: number
}

export function DiferenciaisGrid(props: DiferenciaisGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      <BridgeCard {...props} />
      <RecurringCard {...props} />
      <CreditCardsCard {...props} />
    </motion.div>
  )
}

function BridgeCard({
  profileId,
  bridges,
  bridgeTotalMes,
}: DiferenciaisGridProps) {
  const hasData = bridges.length > 0 && bridgeTotalMes > 0
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">Recebido de empresas</h3>
        </div>
        {hasData ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">
              +{formatBRL(bridgeTotalMes)}
            </p>
            <p className="text-xs text-slate-500">
              {bridges.length} empresa{bridges.length === 1 ? '' : 's'} este mês
            </p>
            <ul className="space-y-1 border-t border-slate-100 pt-2 text-sm">
              {bridges.slice(0, 3).map((b) => (
                <li key={b.companyId}>
                  <Link
                    href={`/empresas/${b.companyId}/socios`}
                    className="flex items-center justify-between gap-2 rounded px-1 py-0.5 hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-700">{b.companyName}</span>
                    <span className="font-medium tabular-nums text-emerald-600">
                      {formatBRL(b.amount)}
                    </span>
                  </Link>
                </li>
              ))}
              {bridges.length > 3 && (
                <li className="px-1 text-xs text-slate-500">
                  + {bridges.length - 3} outra{bridges.length - 3 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
            <Link
              href={`/perfis/${profileId}/pontes`}
              className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <EmptyStateInline
            emoji="🌉"
            title="Sem pontes este mês"
            description="Se você é sócio de empresa(s) e recebeu pró-labore ou distribuição, conecte aqui."
            ctaHref={`/perfis/${profileId}/pontes`}
            ctaLabel="Aprender sobre pontes"
          />
        )}
      </CardContent>
    </Card>
  )
}

function RecurringCard({
  profileId,
  recurring,
  recurringMonthlyTotal,
}: DiferenciaisGridProps) {
  const hasData = recurring.length > 0 && recurringMonthlyTotal > 0
  const annual = recurringMonthlyTotal * 12
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">Assinaturas recorrentes</h3>
        </div>
        {hasData ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {formatBRL(recurringMonthlyTotal)}
              <span className="ml-1 text-sm font-normal text-slate-500">/ mês</span>
            </p>
            <p className="text-xs text-slate-500">
              {formatBRL(annual)} ao ano · {recurring.length} detectadas
            </p>
            <ul className="space-y-1 border-t border-slate-100 pt-2 text-sm">
              {recurring.slice(0, 5).map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700">{r.name}</span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {formatBRL(r.monthlyAmount)}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={`/perfis/${profileId}/insights`}
              className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              Ver lista completa <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <EmptyStateInline
            emoji="🔁"
            title="Nenhuma assinatura detectada"
            description="Importe alguns extratos e a IA identifica Netflix, Spotify, iFood Club e outras assinaturas que você paga todo mês."
            ctaHref={`/perfis/${profileId}/importar`}
            ctaLabel="Importar extrato"
          />
        )}
      </CardContent>
    </Card>
  )
}

function CreditCardsCard({
  profileId,
  creditCards,
  creditCardsTotalDue,
}: DiferenciaisGridProps) {
  const hasData = creditCards.length > 0
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">Cartões de crédito</h3>
        </div>
        {hasData ? (
          <>
            {creditCardsTotalDue > 0 ? (
              <>
                <p className="text-2xl font-bold tabular-nums text-rose-600">
                  −{formatBRL(creditCardsTotalDue)}
                </p>
                <p className="text-xs text-slate-500">
                  Próximas faturas · {creditCards.length} cartão
                  {creditCards.length === 1 ? '' : 'es'}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  R$ 0,00
                </p>
                <p className="text-xs text-emerald-600">
                  ✓ Sem faturas em aberto
                </p>
              </>
            )}
            <ul className="space-y-2 border-t border-slate-100 pt-2 text-sm">
              {creditCards.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700">{c.name}</span>
                    <span className="tabular-nums text-slate-500">
                      {c.usedPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all ${
                        c.usedPercent > 80
                          ? 'bg-rose-500'
                          : c.usedPercent > 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(c.usedPercent, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
              {creditCards.length > 3 && (
                <li className="text-xs text-slate-500">
                  + {creditCards.length - 3} outro
                  {creditCards.length - 3 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
            <Link
              href={`/perfis/${profileId}/cartoes`}
              className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 hover:underline"
            >
              Ver cartões <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <EmptyStateInline
            emoji="💳"
            title="Nenhum cartão cadastrado"
            description="Adicione seus cartões pra acompanhar limite usado, fatura aberta e parcelas futuras num só lugar."
            ctaHref={`/perfis/${profileId}/cartoes/novo`}
            ctaLabel="Adicionar cartão"
            ctaIcon="plus"
          />
        )}
      </CardContent>
    </Card>
  )
}

function EmptyStateInline({
  emoji,
  title,
  description,
  ctaHref,
  ctaLabel,
  ctaIcon = 'arrow',
}: {
  emoji: string
  title: string
  description: string
  ctaHref: string
  ctaLabel: string
  ctaIcon?: 'arrow' | 'plus'
}) {
  const Icon = ctaIcon === 'plus' ? Plus : ArrowRight
  return (
    <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
      <div className="mb-2 text-2xl">{emoji}</div>
      <p className="mb-1 text-xs font-semibold text-slate-900">{title}</p>
      <p className="mb-3 text-xs text-slate-600">{description}</p>
      <Link href={ctaHref}>
        <Button size="sm" variant="outline" className="text-xs">
          <Icon className="mr-1 h-3 w-3" />
          {ctaLabel}
        </Button>
      </Link>
    </div>
  )
}
