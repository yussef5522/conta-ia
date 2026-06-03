// Sprint Dashboard PF — Página principal reescrita.
//
// 6 zonas: Hero / TopExpenses / MonthlyEvolution / Diferenciais /
// Recent / Footer.
//
// Client component (mantém compat com fetch via cookie idem Fatia 1-4).
// Fetch via Promise.all dos 6+1 endpoints existentes/novos.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Loader2, UserRound, User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { SparkPoint } from '@/lib/dashboard/types'
import type { MonthlyEvolutionPoint } from '@/lib/dashboard-pf/types'
import { PFHero } from './_components/PFHero'
import { PFTopExpenses } from './_components/PFTopExpenses'
import { MonthlyEvolutionChart } from './_components/MonthlyEvolutionChart'
import { DiferenciaisGrid } from './_components/DiferenciaisGrid'
import { RecentActivityPF } from './_components/RecentActivityPF'
import { PFFooterStrip } from './_components/PFFooterStrip'

// ===== Tipos do JSON dos endpoints existentes =====

interface ProfileData {
  profile: { id: string; name: string; cpf: string | null; type: string }
  role: string
  isSelf: boolean
  summary: {
    totalBalance: number
    accountsCount: number
    totalTransactions: number
    incomes30d: number
    expenses30d: number
    net30d: number
    topExpenseCategories: Array<{
      id: string
      name: string
      color: string | null
      total: number
    }>
    accounts: Array<{ id: string; name: string; balance: number }>
  }
}

interface SaldoPrevistoData {
  saldoAtual: number
  saldoPrevisto: number
  faturasAbertas: number
  parcelasFuturas: number
}

interface CardSummary {
  summary: {
    cardsCount: number
    totalLimit: number
    totalUsed: number
    totalDue: number
  }
  cards: Array<{
    id: string
    name: string
    brand?: string | null
    creditLimit: number
    used: number
    usedPercent: number
    invoiceOpenAmount: number
  }>
}

interface RecurringInsights {
  recurring: Array<{ name: string; monthlyAmount: number }>
  monthlyTotal: number
}

interface BridgeSummary {
  totalCount: number
  totalAmount: number
  byKind: Record<string, { count: number; amount: number }>
}

interface RecentTxJson {
  id: string
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  status?: string
  category?: { name: string; color: string | null } | null
  isInternational?: boolean
  installmentNumber?: number | null
  installmentTotal?: number | null
}

function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

function getCurrentMonthLabel(): string {
  const now = new Date()
  const labels = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return `${labels[now.getMonth()]} ${now.getFullYear()}`
}

export default function PerfilPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [saldoPrevisto, setSaldoPrevisto] = useState<SaldoPrevistoData | null>(null)
  const [cardSummary, setCardSummary] = useState<CardSummary | null>(null)
  const [recurring, setRecurring] = useState<RecurringInsights | null>(null)
  const [bridgesSummary, setBridgesSummary] = useState<BridgeSummary | null>(null)
  const [bridgesByCompany, setBridgesByCompany] = useState<
    Array<{ companyId: string; companyName: string; amount: number; count: number }>
  >([])
  const [evolution, setEvolution] = useState<MonthlyEvolutionPoint[]>([])
  const [recentTxs, setRecentTxs] = useState<RecentTxJson[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      try {
        // Calcula início do mês atual pra summary das pontes
        const now = new Date()
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

        const [p, sp, cs, rec, bs, evo, txs] = await Promise.all([
          fetch(`/api/perfis/${id}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/perfis/${id}/saldo-previsto`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/perfis/${id}/cartoes/dashboard-summary`).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch(`/api/perfis/${id}/insights/recorrentes`).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch(
            `/api/pontes/summary?profileId=${id}&dateFrom=${monthStart.toISOString()}`,
          ).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/perfis/${id}/evolucao-mensal?months=12`).then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch(`/api/perfis/${id}/transacoes?pageSize=20`).then((r) =>
            r.ok ? r.json() : null,
          ),
        ])

        if (cancelled) return

        if (p) setProfileData(p)
        if (sp) setSaldoPrevisto(sp)
        if (cs) setCardSummary(cs)
        if (rec) setRecurring(rec)
        if (bs) setBridgesSummary(bs)
        if (evo?.months) setEvolution(evo.months)
        if (txs?.transactions) {
          const allTxs = txs.transactions as RecentTxJson[]
          setRecentTxs(allTxs.slice(0, 20))
          setPendingCount(allTxs.filter((t) => t.status === 'PENDING').length)
        }

        // Bridges por companyId (do listBridges via /perfis/<id>/pontes pra agrupar)
        try {
          const bRes = await fetch(
            `/api/perfis/${id}/pontes?dateFrom=${monthStart.toISOString()}&pageSize=50`,
          )
          if (bRes.ok && !cancelled) {
            const bj = await bRes.json()
            const byCo = new Map<
              string,
              { companyId: string; companyName: string; amount: number; count: number }
            >()
            for (const b of bj.bridges ?? []) {
              const cur = byCo.get(b.companyId)
              if (cur) {
                cur.amount += b.amount
                cur.count++
              } else {
                byCo.set(b.companyId, {
                  companyId: b.companyId,
                  companyName: b.companyName,
                  amount: b.amount,
                  count: 1,
                })
              }
            }
            setBridgesByCompany([...byCo.values()].sort((a, b) => b.amount - a.amount))
          }
        } catch {}
      } catch {
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [id])

  // === ESTADOS DE CARREGAMENTO / ERRO / VAZIO ===

  if (loading) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </main>
    )
  }

  if (!profileData) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <UserRound className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <h2 className="mb-2 text-lg font-semibold">Perfil não encontrado</h2>
            <Link href="/perfis">
              <Button variant="outline">← Voltar pra perfis</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { profile, summary } = profileData

  // Sparklines pequenos derivados da evolução mensal (últimos 6 meses)
  const last6 = evolution.slice(-6)
  const saldoSparkline: SparkPoint[] = last6.map((p) => ({
    label: p.label,
    value: p.cumulativeBalance,
  }))
  const entradasSpark: SparkPoint[] = last6.map((p) => ({ label: p.label, value: p.income }))
  const saidasSpark: SparkPoint[] = last6.map((p) => ({ label: p.label, value: p.expense }))
  const resultadoSpark: SparkPoint[] = last6.map((p) => ({ label: p.label, value: p.net }))

  // Delta vs mês anterior
  const currMonth = evolution[evolution.length - 1]
  const prevMonth = evolution[evolution.length - 2]
  const deltaPercent = (curr: number, prev: number): number | null => {
    if (prev === 0) return null
    return ((curr - prev) / Math.abs(prev)) * 100
  }
  const entradasDelta = currMonth && prevMonth
    ? deltaPercent(currMonth.income, prevMonth.income)
    : null
  const saidasDelta = currMonth && prevMonth
    ? deltaPercent(currMonth.expense, prevMonth.expense)
    : null
  const resultadoDelta = currMonth && prevMonth
    ? deltaPercent(currMonth.net, prevMonth.net)
    : null

  // Cartões — convert pro formato esperado
  const creditCards = (cardSummary?.cards ?? []).slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    brand: c.brand,
    usedPercent: c.usedPercent ?? 0,
    invoiceOpenAmount: c.invoiceOpenAmount ?? 0,
  }))

  // Recent tx — transforma
  const recentMapped = recentTxs.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    isInternational: t.isInternational,
    installmentLabel:
      t.installmentNumber && t.installmentTotal
        ? `${t.installmentNumber}/${t.installmentTotal}`
        : null,
  }))

  return (
    <main className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
      <Link
        href="/perfis"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Voltar pra perfis
      </Link>

      {/* ZONA 1 — HERO */}
      <PFHero
        profileName={profile.name}
        cpfMasked={maskCpf(profile.cpf)}
        saldoTotal={summary.totalBalance}
        saldoSparkline={saldoSparkline}
        entradasMes={{
          value: currMonth?.income ?? summary.incomes30d,
          spark: entradasSpark,
          delta: entradasDelta,
        }}
        saidasMes={{
          value: currMonth?.expense ?? summary.expenses30d,
          spark: saidasSpark,
          delta: saidasDelta,
        }}
        resultadoMes={{
          value: currMonth?.net ?? summary.net30d,
          spark: resultadoSpark,
          delta: resultadoDelta,
        }}
        saldoPrevisto30d={saldoPrevisto?.saldoPrevisto ?? summary.totalBalance}
        cardsCount={summary.accountsCount}
        periodLabel={getCurrentMonthLabel()}
      />

      {/* ZONA 2 — TOP EXPENSES (a "bola") */}
      <PFTopExpenses
        profileId={id}
        items={summary.topExpenseCategories.map((c) => ({
          categoryId: c.id,
          name: c.name,
          color: c.color,
          total: c.total,
        }))}
        periodLabel="Últimos 30 dias"
        totalMonth={summary.expenses30d}
      />

      {/* ZONA 3 — EVOLUÇÃO MENSAL */}
      <MonthlyEvolutionChart profileId={id} months={evolution} />

      {/* ZONA 4 — DIFERENCIAIS */}
      <DiferenciaisGrid
        profileId={id}
        bridges={bridgesByCompany}
        bridgeTotalMes={bridgesSummary?.totalAmount ?? 0}
        recurring={recurring?.recurring ?? []}
        recurringMonthlyTotal={recurring?.monthlyTotal ?? 0}
        creditCards={creditCards}
        creditCardsTotalDue={cardSummary?.summary?.totalDue ?? 0}
      />

      {/* ZONA 5 — RECENT ACTIVITY */}
      <RecentActivityPF profileId={id} transactions={recentMapped} />

      {/* ZONA 6 — FOOTER */}
      <PFFooterStrip
        profileId={id}
        accounts={summary.accounts}
        pendingCount={pendingCount}
      />

      {/* Tipo do perfil — badge minimal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400"
      >
        <User className="h-3 w-3" />
        {profile.type === 'OWN' ? 'Perfil próprio' : 'Dependente'}
      </motion.div>
    </main>
  )
}
