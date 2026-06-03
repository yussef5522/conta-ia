// Sprint PF FATIA 1 — Dashboard do perfil PF.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ListPlus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  UserRound,
  User,
  CreditCard as CardIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ProfileSummary {
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

interface ProfileData {
  profile: {
    id: string
    name: string
    cpf: string | null
    type: string
  }
  role: string
  isSelf: boolean
  summary: ProfileSummary
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

interface CreditSummary {
  cardsCount: number
  totalLimit: number
  totalUsed: number
  totalAvailable: number
}

export default function PerfilDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<ProfileData | null>(null)
  const [credit, setCredit] = useState<CreditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/perfis/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          setError(d.erro ?? 'Perfil não encontrado')
          return null
        }
        return r.json() as Promise<ProfileData>
      })
      .then((d) => {
        if (d) setData(d)
      })
      .finally(() => setLoading(false))
    // Sprint Fatia 2 — busca summary de cartões (não bloqueia render)
    fetch(`/api/perfis/${id}/cartoes/dashboard-summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.summary) setCredit(d.summary)
      })
      .catch(() => {
        // sem cartões = OK
      })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-zinc-600">{error ?? 'Sem dados'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/perfis">Voltar aos perfis</Link>
        </Button>
      </div>
    )
  }

  const Icon = data.profile.type === 'DEPENDENT' ? User : UserRound
  const { summary } = data
  const total = summary.topExpenseCategories.reduce((s, c) => s + c.total, 0)

  return (
    <div>
      {/* Hero */}
      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Icon className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 mb-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide">
            <UserRound className="h-3 w-3" />
            Pessoal
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">{data.profile.name}</h1>
          <p className="text-xs text-zinc-500">
            {data.profile.type === 'DEPENDENT' ? 'Dependente' : data.isSelf ? 'Titular (eu)' : 'Titular'}
            {data.profile.cpf && ` · CPF ****${data.profile.cpf.slice(-2)}`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/perfis/${id}/transacoes`}>
            <ListPlus className="h-4 w-4 mr-1" />
            Nova transação
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
          <CardContent className="p-4">
            <div className="text-emerald-100 text-xs font-medium mb-1">Saldo total</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatBRL(summary.totalBalance)}
            </div>
            <div className="text-xs text-emerald-200 mt-1">
              {summary.accountsCount} {summary.accountsCount === 1 ? 'conta' : 'contas'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-zinc-500 text-xs font-medium">Entradas 30d</div>
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700">
              {formatBRL(summary.incomes30d)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-zinc-500 text-xs font-medium">Saídas 30d</div>
              <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
            </div>
            <div className="text-2xl font-bold tabular-nums text-red-700">
              {formatBRL(summary.expenses30d)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-zinc-500 text-xs font-medium">Resultado 30d</div>
              {summary.net30d >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              )}
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${
                summary.net30d >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatBRL(summary.net30d)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Fatia 2 — Card cartões (só mostra se tiver ao menos 1) */}
      {credit && credit.cardsCount > 0 && (
        <Card className="mb-4 border-emerald-200/60">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CardIcon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-zinc-900">
                    Cartões ({credit.cardsCount})
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Limite consolidado e fatura prevista
                  </p>
                </div>
              </div>
              <Link
                href={`/perfis/${id}/cartoes`}
                className="text-xs text-emerald-700 font-medium hover:underline"
              >
                Ver cartões →
              </Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-xs text-zinc-500">Limite total</div>
                <div className="text-lg font-bold tabular-nums">
                  {formatBRL(credit.totalLimit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Usado</div>
                <div className="text-lg font-bold tabular-nums text-red-700">
                  {formatBRL(credit.totalUsed)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Disponível</div>
                <div className="text-lg font-bold tabular-nums text-emerald-700">
                  {formatBRL(credit.totalAvailable)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atalho rápido pra criar 1º cartão se ainda não tem */}
      {credit && credit.cardsCount === 0 && (
        <Card className="mb-4 border-dashed">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CardIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-900">
                Adicione seu cartão de crédito
              </p>
              <p className="text-xs text-zinc-500">
                Controle fatura, parcelamento e limite disponível
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/perfis/${id}/cartoes/novo`}>+ Cartão</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contas + Top categorias */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-zinc-700" />
                <h2 className="font-semibold text-zinc-900">Contas</h2>
              </div>
              <Link
                href={`/perfis/${id}/contas`}
                className="text-xs text-emerald-700 font-medium hover:underline"
              >
                Gerenciar →
              </Link>
            </div>
            {summary.accounts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-zinc-500 mb-3">
                  Nenhuma conta cadastrada
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/perfis/${id}/contas`}>+ Adicionar conta</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0"
                  >
                    <span className="text-sm text-zinc-800">{a.name}</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        a.balance >= 0 ? 'text-zinc-900' : 'text-red-700'
                      }`}
                    >
                      {formatBRL(a.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold text-zinc-900 mb-3">Top despesas (30d)</h2>
            {summary.topExpenseCategories.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center">
                Sem despesas no período
              </p>
            ) : (
              <div className="space-y-2">
                {summary.topExpenseCategories.map((c) => {
                  const pct = total > 0 ? (c.total / total) * 100 : 0
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-zinc-700">{c.name}</span>
                        <span className="font-semibold tabular-nums text-zinc-900">
                          {formatBRL(c.total)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: c.color ?? '#10b981',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
