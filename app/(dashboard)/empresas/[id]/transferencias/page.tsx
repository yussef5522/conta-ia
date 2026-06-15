'use client'

// Página de transferências entre contas — Sprint 0.5 Dia 4.
// Lista paginada agrupada por transferGroupId, com filtros (período + conta).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeftRight,
  ArrowRight,
  Trash2,
  Filter,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { NovaTransferenciaModal } from '@/components/transferencias/NovaTransferenciaModal'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { useDateRangeFilter } from '@/lib/hooks/use-date-range-filter'

interface Conta {
  id: string
  name: string
}

interface Transferencia {
  groupId: string
  date: string
  amount: number
  fromAccount: { id: string; name: string; bankName: string | null }
  toAccount: { id: string; name: string; bankName: string | null }
  description: string
  notes: string | null
}

// Sprint Central de Transferências
interface SugestaoSide {
  id: string
  bankAccountId: string
  bankAccountName: string
  date: string
  amount: number
  description: string
}
interface Sugestao {
  from: SugestaoSide
  to: SugestaoSide
  confidence: number
  evidences: string[]
}
interface Sozinha {
  tx: {
    id: string
    bankAccountName: string
    date: string
    type: 'CREDIT' | 'DEBIT'
    amount: number
    description: string
  }
  signals: {
    hasOwnCnpj: boolean
    hasOwnName: boolean
    hasOwnAccountName: boolean
    hasTransferKeyword: boolean
  }
  signalCount: number
}
// Sprint R1 — 4ª aba "Duplicatas detectadas" (Gap 2: órfã × pareada)
interface Duplicata {
  orphan: {
    id: string
    bankAccountName: string
    date: string
    type: 'CREDIT' | 'DEBIT'
    amount: number
    description: string
    origin: string
  }
  pairedSide: {
    id: string
    bankAccountName: string
    date: string
    amount: number
    description: string
  }
  transferGroupId: string
  deltaDays: number
  scenario: 'OFX_AFTER_MANUAL_PAIR' | 'OTHER'
}

interface Paginacao {
  total: number
  page: number
  limit: number
  totalPages: number
}

const ITEMS_PER_PAGE = 25

export default function TransferenciasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()

  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  // Sprint Central de Transferências — Abas Sugeridas + Sozinhas
  // Sprint R1 (10/06/2026) — 4ª aba Duplicatas (Gap 2: órfã × pareada)
  const [activeTab, setActiveTab] = useState<
    'pareadas' | 'sugeridas' | 'sozinhas' | 'duplicatas'
  >('pareadas')
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [sozinhas, setSozinhas] = useState<Sozinha[]>([])
  const [duplicatas, setDuplicatas] = useState<Duplicata[]>([])
  const [loadingSugestoes, setLoadingSugestoes] = useState(false)
  const [loadingSozinhas, setLoadingSozinhas] = useState(false)
  const [loadingDuplicatas, setLoadingDuplicatas] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Transferencia | null>(null)

  // Filtros
  // Sprint Filtro de Data Parte A (15/06/2026): hook compartilhado + URL sync.
  const { inicio: dataInicio, fim: dataFim, setRange: setDateRange, clear: clearDateRange } = useDateRangeFilter()
  const [contaFiltro, setContaFiltro] = useState<string>('ALL')

  async function fetchTransferencias() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      })
      // Sprint Filtro de Data Parte A: envia inicio/fim ao backend (não mais
      // filtro client-side por data — backend honra desde esta sprint).
      if (dataInicio) qs.set('inicio', dataInicio)
      if (dataFim) qs.set('fim', dataFim)
      const res = await fetch(`/api/transferencias?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setTransferencias(data.transferencias ?? [])
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchContas() {
    const res = await fetch(`/api/contas-bancarias?empresaId=${empresaId}`)
    if (res.ok) {
      const data = await res.json()
      setContas(
        (data.contas ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        })),
      )
    }
  }

  useEffect(() => {
    fetchContas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchTransferencias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dataInicio, dataFim])

  // Filtros aplicados client-side (sobre o page atual da API).
  // Filtro de CONTA cobre AMBOS os lados (origem OU destino) — data agora
  // vem pré-filtrada do backend, então o filtro client-side de data é defensivo.
  const transferenciasFiltradas = useMemo(() => {
    return transferencias.filter((t) => {
      if (dataInicio && t.date < dataInicio) return false
      if (dataFim && t.date > dataFim + 'T23:59:59Z') return false
      if (
        contaFiltro !== 'ALL' &&
        t.fromAccount.id !== contaFiltro &&
        t.toAccount.id !== contaFiltro
      )
        return false
      return true
    })
  }, [transferencias, dataInicio, dataFim, contaFiltro])

  const temFiltros = dataInicio || dataFim || contaFiltro !== 'ALL'

  function clearFiltros() {
    clearDateRange()
    setContaFiltro('ALL')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    const res = await fetch(`/api/transferencias/${target.groupId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setTransferencias((p) => p.filter((t) => t.groupId !== target.groupId))
      toast({
        variant: 'success',
        title: 'Transferência excluída',
        description: 'Saldos das contas foram revertidos.',
      })
    } else {
      const data = await res.json()
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: data.erro ?? 'Falha ao excluir',
      })
    }
    setDeleteTarget(null)
  }

  // Sprint Central de Transferências — fetches Sugeridas/Sozinhas (lazy)
  async function fetchSugestoes() {
    setLoadingSugestoes(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/transferencias/sugestoes`)
      if (res.ok) {
        const data = await res.json()
        setSugestoes(data.pairs ?? [])
      }
    } finally {
      setLoadingSugestoes(false)
    }
  }
  async function fetchSozinhas() {
    setLoadingSozinhas(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/transferencias/sozinhas`)
      if (res.ok) {
        const data = await res.json()
        setSozinhas(data.lonely ?? [])
      }
    } finally {
      setLoadingSozinhas(false)
    }
  }
  // Sprint R1 — fetch Duplicatas (lazy, igual sugeridas/sozinhas)
  async function fetchDuplicatas() {
    setLoadingDuplicatas(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/transferencias/duplicatas`)
      if (res.ok) {
        const data = await res.json()
        setDuplicatas(data.duplicatas ?? [])
      }
    } finally {
      setLoadingDuplicatas(false)
    }
  }

  async function confirmarSugestao(s: Sugestao) {
    setResolvingId(s.from.id + s.to.id)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/transferencias/sugestoes/confirmar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromTxId: s.from.id, toTxId: s.to.id }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Confirmada', description: 'Par criado como transferência interna.' })
      // Remove otimista + refresh pareadas
      setSugestoes((p) => p.filter((x) => !(x.from.id === s.from.id && x.to.id === s.to.id)))
      fetchTransferencias()
    } finally {
      setResolvingId(null)
    }
  }

  async function recusarSugestao(s: Sugestao) {
    setResolvingId(s.from.id + s.to.id)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/transferencias/sugestoes/recusar`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromTxId: s.from.id, toTxId: s.to.id }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Marcadas como "não é transferência"' })
      setSugestoes((p) => p.filter((x) => !(x.from.id === s.from.id && x.to.id === s.to.id)))
    } finally {
      setResolvingId(null)
    }
  }

  // Lazy: só busca quando a aba é aberta pela primeira vez
  useEffect(() => {
    if (activeTab === 'sugeridas' && sugestoes.length === 0 && !loadingSugestoes) {
      void fetchSugestoes()
    }
    if (activeTab === 'sozinhas' && sozinhas.length === 0 && !loadingSozinhas) {
      void fetchSozinhas()
    }
    if (activeTab === 'duplicatas' && duplicatas.length === 0 && !loadingDuplicatas) {
      void fetchDuplicatas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Transferências entre Contas"
        description={
          paginacao
            ? `${paginacao.total} transferência${paginacao.total !== 1 ? 's' : ''} no total`
            : 'Movimentação entre contas da empresa'
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}`}>← Empresa</Link>
        </Button>
        <Button onClick={() => setModalOpen(true)} disabled={contas.length < 2}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Nova Transferência
        </Button>
      </Header>

      {contas.length < 2 && !loading && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Você precisa de pelo menos 2 contas bancárias cadastradas pra criar transferências.{' '}
            <Link
              href={`/empresas/${empresaId}/contas`}
              className="underline text-primary"
            >
              Gerenciar contas →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Sprint Central de Transferências — Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="pareadas">
            Pareadas {paginacao && `(${paginacao.total})`}
          </TabsTrigger>
          <TabsTrigger value="sugeridas">
            Sugeridas {sugestoes.length > 0 && `(${sugestoes.length})`}
          </TabsTrigger>
          <TabsTrigger value="sozinhas">
            Sozinhas {sozinhas.length > 0 && `(${sozinhas.length})`}
          </TabsTrigger>
          <TabsTrigger value="duplicatas">
            Duplicatas {duplicatas.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5">
                {duplicatas.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pareadas" className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtros
            </div>
            <DateRangeFilter
              value={{ inicio: dataInicio, fim: dataFim }}
              onChange={(r) => setDateRange(r)}
              label="Período"
            />
            <div className="space-y-1">
              <Label htmlFor="contaFiltro" className="text-xs">Conta (origem ou destino)</Label>
              <Select value={contaFiltro} onValueChange={setContaFiltro}>
                <SelectTrigger id="contaFiltro" className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {temFiltros && (
              <Button variant="ghost" size="sm" onClick={clearFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : transferenciasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">
            {temFiltros
              ? 'Nenhuma transferência com esses filtros'
              : 'Nenhuma transferência ainda'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {temFiltros
              ? 'Tente ajustar ou limpar os filtros.'
              : 'Crie a primeira transferência entre contas da empresa.'}
          </p>
          {!temFiltros && (
            <Button
              onClick={() => setModalOpen(true)}
              disabled={contas.length < 2}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Criar primeira transferência
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Origem → Destino</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {transferenciasFiltradas.map((t) => (
                  <tr
                    key={t.groupId}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t.fromAccount.name}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{t.toAccount.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatBRL(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[280px]">
                      {t.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {paginacao && paginacao.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {paginacao.page} de {paginacao.totalPages} ({paginacao.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= paginacao.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
        </TabsContent>

        {/* Aba SUGERIDAS */}
        <TabsContent value="sugeridas" className="space-y-4">
          {loadingSugestoes ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando candidatas no histórico...
            </div>
          ) : sugestoes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
                <Check className="h-6 w-6 mx-auto text-emerald-600" />
                <p className="font-medium">Sem sugestões pendentes</p>
                <p className="text-xs max-w-sm mx-auto">
                  O sistema não encontrou pares de saída + entrada com sinais
                  fortes (CNPJ próprio, nome da empresa, transferência) no
                  histórico de 12 meses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sugestoes.map((s) => {
                const isBusy = resolvingId === s.from.id + s.to.id
                return (
                  <Card key={s.from.id + s.to.id} className="border-amber-200 dark:border-amber-900">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold">
                          Possível transferência
                        </span>
                        <span className="ml-auto text-xs font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                          Confiança {Math.round(s.confidence * 100)}%
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* SAÍDA */}
                        <div className="rounded border border-red-200 bg-red-50/40 dark:bg-red-950/20 p-2.5">
                          <p className="text-[10px] uppercase font-semibold tracking-wide text-red-700 dark:text-red-300">
                            ↑ Saída · {s.from.bankAccountName}
                          </p>
                          <p className="text-sm font-mono tabular-nums text-red-700 dark:text-red-300 mt-1">
                            −{formatBRL(s.from.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(s.from.date)}
                          </p>
                          <p className="text-xs font-mono break-words mt-1" title={s.from.description}>
                            {s.from.description}
                          </p>
                        </div>
                        {/* ENTRADA */}
                        <div className="rounded border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5">
                          <p className="text-[10px] uppercase font-semibold tracking-wide text-emerald-700 dark:text-emerald-300">
                            ↓ Entrada · {s.to.bankAccountName}
                          </p>
                          <p className="text-sm font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-1">
                            +{formatBRL(s.to.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(s.to.date)}
                          </p>
                          <p className="text-xs font-mono break-words mt-1" title={s.to.description}>
                            {s.to.description}
                          </p>
                        </div>
                      </div>

                      {/* Evidências */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {s.evidences.map((e) => (
                          <span key={e} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            {e}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => recusarSugestao(s)}
                          disabled={isBusy}
                        >
                          Não é transferência
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => confirmarSugestao(s)}
                          disabled={isBusy}
                        >
                          {isBusy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Confirmar como transferência
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba SOZINHAS */}
        <TabsContent value="sozinhas" className="space-y-4">
          {loadingSozinhas ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando transações com cara de transferência...
            </div>
          ) : sozinhas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
                <Check className="h-6 w-6 mx-auto text-emerald-600" />
                <p className="font-medium">Nenhuma sozinha</p>
                <p className="text-xs max-w-sm mx-auto">
                  Toda transação com cara de transferência (CNPJ próprio, nome
                  da empresa, etc) já tem par ou foi resolvida.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sozinhas.map((l) => {
                const isOut = l.tx.type === 'DEBIT'
                return (
                  <Card key={l.tx.id} className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                            <span className="font-semibold text-sm">{l.tx.bankAccountName}</span>
                            <span className="text-muted-foreground">{formatDate(l.tx.date)}</span>
                            <span className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase ${isOut ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {isOut ? 'Saída' : 'Entrada'}
                            </span>
                          </div>
                          <p className="text-sm font-mono break-words mt-1.5">
                            {l.tx.description}
                          </p>
                        </div>
                        <span className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${isOut ? 'text-red-600' : 'text-emerald-700'}`}>
                          {isOut ? '−' : '+'} {formatBRL(l.tx.amount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                        {l.signals.hasOwnCnpj && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> CNPJ próprio
                          </span>
                        )}
                        {l.signals.hasOwnName && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Nome da empresa
                          </span>
                        )}
                        {l.signals.hasOwnAccountName && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Nome de outra conta
                          </span>
                        )}
                        {l.signals.hasTransferKeyword && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Palavra de transferência
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground italic border-t pt-2 mt-1">
                        Parece transferência interna, mas o outro lado não está no banco. Importe o extrato da conta destino e o sistema casa sozinho.
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Sprint R1 — Aba DUPLICATAS (órfã × pareada). SÓ MOSTRA, não apaga */}
        <TabsContent value="duplicatas" className="space-y-4">
          {loadingDuplicatas ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procurando possíveis duplicatas de transferências pareadas...
            </div>
          ) : duplicatas.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-2">
                <Check className="h-6 w-6 mx-auto text-emerald-600" />
                <p className="font-medium">Nenhuma duplicata detectada</p>
                <p className="text-xs max-w-md mx-auto">
                  Não encontrei transação órfã (sem par) que coincida com lado
                  já pareado de outra transferência. Se reimportar um OFX e o
                  banco gerar FITID novo, o sistema avisa aqui antes de
                  inflar saldos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card className="border-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                <CardContent className="py-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Possível duplicação: <strong>{duplicatas.length}</strong>{' '}
                    transação{duplicatas.length !== 1 ? 'ões' : ''} órfã{duplicatas.length !== 1 ? 's' : ''}{' '}
                    coincide{duplicatas.length !== 1 ? 'm' : ''} com lado de
                    transferência já pareada. Revise CADA caso — o sistema NÃO
                    apaga nada sozinho.
                  </div>
                </CardContent>
              </Card>
              {duplicatas.map((d) => {
                const isOut = d.orphan.type === 'DEBIT'
                return (
                  <Card
                    key={d.orphan.id}
                    className="border-amber-300 dark:border-amber-700"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-[11px] uppercase font-semibold">
                        <span className="text-amber-700 dark:text-amber-400">
                          Possível duplicata
                        </span>
                        <span className="text-muted-foreground">
                          grupo {d.transferGroupId.slice(0, 8)} ·{' '}
                          {d.deltaDays === 0
                            ? 'mesmo dia'
                            : `Δ ${d.deltaDays}d`}
                        </span>
                      </div>

                      {/* Órfã */}
                      <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                              Tx órfã ({d.orphan.origin})
                            </div>
                            <div className="text-xs flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {d.orphan.bankAccountName}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(d.orphan.date)}
                              </span>
                              <span
                                className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase ${
                                  isOut
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {isOut ? 'Saída' : 'Entrada'}
                              </span>
                            </div>
                            <p className="text-sm font-mono break-words mt-1">
                              {d.orphan.description}
                            </p>
                          </div>
                          <span
                            className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${
                              isOut ? 'text-red-600' : 'text-emerald-700'
                            }`}
                          >
                            {isOut ? '−' : '+'} {formatBRL(d.orphan.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Lado pareado */}
                      <div className="rounded border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                              Lado pareado existente
                            </div>
                            <div className="text-xs flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">
                                {d.pairedSide.bankAccountName}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(d.pairedSide.date)}
                              </span>
                            </div>
                            <p className="text-sm font-mono break-words mt-1">
                              {d.pairedSide.description}
                            </p>
                          </div>
                          <span className="text-sm font-mono font-semibold tabular-nums shrink-0 text-slate-600">
                            {formatBRL(d.pairedSide.amount)}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground italic border-t pt-2">
                        {d.scenario === 'OFX_AFTER_MANUAL_PAIR' ? (
                          <>
                            Cenário típico: você pareou via Replace OFX antes,
                            depois reimportou o OFX do banco e ele gerou outra
                            tx. Se for o mesmo dinheiro, a órfã é cópia —
                            considere ignorá-la ou excluí-la pela tela de
                            transações.
                          </>
                        ) : (
                          <>
                            A tx órfã coincide com lado de grupo já pareado.
                            Verifique se é a mesma transferência ou movimento
                            novo coincidente.
                          </>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NovaTransferenciaModal
        empresaId={empresaId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          setModalOpen(false)
          fetchTransferencias()
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir transferência?"
        description={
          deleteTarget
            ? `Esta ação remove o par completo e reverte os saldos das contas ${deleteTarget.fromAccount.name} e ${deleteTarget.toAccount.name}. Não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
