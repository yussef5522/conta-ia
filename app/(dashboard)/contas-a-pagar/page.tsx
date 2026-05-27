'use client'

// Sprint 4.0.1.a — Contas a Pagar (PAYABLE).
// Sprint 5.0.3.0a — Refator world-class: 4 stats / tabela densa / footer fixo /
// filtros / skeleton / 3 empty states. Componentes extraídos pra
// components/contas-pagar/*.tsx.
//
// Próximas sub-sprints:
//   5.0.3.0b — Saved views + bulk actions + export CSV
//   5.0.3.0c — Command palette (Cmd+K) + edit inline + density toggle + aging
//   5.0.3.0d — Polish: E2E + mobile + a11y

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatsCard } from '@/components/contas-pagar/StatsCard'
import { PayableSkeleton } from '@/components/contas-pagar/PayableSkeleton'
import { PayableEmptyState } from '@/components/contas-pagar/PayableEmptyState'
import { StickyFooter } from '@/components/contas-pagar/StickyFooter'
import {
  PayableFilters,
  EMPTY_FILTERS,
  isFilterActive,
  type PayableFilterState,
} from '@/components/contas-pagar/PayableFilters'
import {
  PayableTable,
  type PayableRow,
} from '@/components/contas-pagar/PayableTable'
import {
  EfetivarDialog,
  type PayableForEfetivar,
  type BankAccountOption,
} from '@/components/contas-pagar/EfetivarDialog'

interface Empresa {
  id: string
  name: string
  tradeName: string | null
}

interface KPIs {
  totalPagas: number
  countPagas: number
  totalPendente: number
  countPendente: number
  totalAVencer3d: number
  countAVencer3d: number
  totalVencido: number
  countVencido: number
}

interface Paginacao {
  total: number
  page: number
  limit: number
  totalPages: number
}

const EMPTY_KPIS: KPIs = {
  totalPagas: 0,
  countPagas: 0,
  totalPendente: 0,
  countPendente: 0,
  totalAVencer3d: 0,
  countAVencer3d: 0,
  totalVencido: 0,
  countVencido: 0,
}

export default function ContasAPagarPage() {
  return (
    <Suspense fallback={<PayableSkeleton />}>
      <ContasAPagarInner />
    </Suspense>
  )
}

function ContasAPagarInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(
    searchParams.get('empresaId') ?? '',
  )

  // Filtros — hydratam de URL na 1ª carga
  const [filters, setFilters] = useState<PayableFilterState>(() => ({
    q: searchParams.get('q') ?? '',
    dataDe: searchParams.get('dataDe') ?? '',
    dataAte: searchParams.get('dataAte') ?? '',
    status:
      (searchParams.get('status') as PayableFilterState['status']) ?? 'PENDING',
    vencidasOnly: searchParams.get('vencidasOnly') === 'true',
  }))
  // Busca textual debounce
  const [qDebounced, setQDebounced] = useState(filters.q)
  useEffect(() => {
    const id = setTimeout(() => setQDebounced(filters.q), 300)
    return () => clearTimeout(id)
  }, [filters.q])

  const [items, setItems] = useState<PayableRow[]>([])
  const [kpis, setKpis] = useState<KPIs>(EMPTY_KPIS)
  const [paginacao, setPaginacao] = useState<Paginacao>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [efetivar, setEfetivar] = useState<PayableForEfetivar | null>(null)

  // Carrega empresas
  useEffect(() => {
    fetch('/api/empresas')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.empresas) {
          setEmpresas(data.empresas)
          if (!empresaId && data.empresas.length === 1) {
            setEmpresaId(data.empresas[0].id)
          }
        }
      })
      .catch(() => {})
  }, [empresaId])

  // Carrega contas bancárias da empresa (pra modal efetivar)
  useEffect(() => {
    if (!empresaId) return
    fetch('/api/contas-bancarias')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.contas) {
          setBankAccounts(
            data.contas.filter((c: BankAccountOption & { companyId: string }) => c.companyId === empresaId),
          )
        }
      })
      .catch(() => {})
  }, [empresaId])

  const fetchItems = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        page: String(page),
        limit: '50',
      })
      if (qDebounced) qs.set('q', qDebounced)
      if (filters.dataDe) qs.set('dataDe', filters.dataDe)
      if (filters.dataAte) qs.set('dataAte', filters.dataAte)
      if (filters.status !== 'TODOS') qs.set('status', filters.status)
      if (filters.vencidasOnly) qs.set('vencidasOnly', 'true')

      const res = await fetch(`/api/contas-a-pagar?${qs}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setKpis(data.kpis)
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }, [
    empresaId,
    page,
    qDebounced,
    filters.dataDe,
    filters.dataAte,
    filters.status,
    filters.vencidasOnly,
  ])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  // Sync URL com state (sem provocar reload)
  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    if (filters.q) sp.set('q', filters.q)
    if (filters.dataDe) sp.set('dataDe', filters.dataDe)
    if (filters.dataAte) sp.set('dataAte', filters.dataAte)
    if (filters.status !== 'PENDING') sp.set('status', filters.status)
    if (filters.vencidasOnly) sp.set('vencidasOnly', 'true')
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, filters, router])

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  function applyFilterPreset(kind: 'paid' | 'pending' | 'warn3d' | 'overdue') {
    if (kind === 'paid') {
      setFilters({ ...EMPTY_FILTERS, status: 'RECONCILED' })
    } else if (kind === 'overdue') {
      setFilters({ ...EMPTY_FILTERS, status: 'PENDING', vencidasOnly: true })
    } else if (kind === 'pending') {
      setFilters({ ...EMPTY_FILTERS, status: 'PENDING' })
    } else if (kind === 'warn3d') {
      // 3 dias à frente
      const today = new Date()
      const in3d = new Date(today.getTime() + 3 * 86400_000)
      setFilters({
        ...EMPTY_FILTERS,
        status: 'PENDING',
        dataDe: today.toISOString().slice(0, 10),
        dataAte: in3d.toISOString().slice(0, 10),
      })
    }
    setPage(1)
  }

  const empresaZerada = useMemo(
    () =>
      !loading &&
      items.length === 0 &&
      !isFilterActive(filters) &&
      kpis.countPendente === 0 &&
      kpis.countVencido === 0 &&
      kpis.countPagas === 0,
    [loading, items.length, filters, kpis],
  )

  return (
    <div className="space-y-6 pb-20">
      <Header
        title="Contas a Pagar"
        description={
          empresaId
            ? `${paginacao.total} conta${paginacao.total !== 1 ? 's' : ''} no filtro`
            : 'Selecione uma empresa pra ver as contas a pagar'
        }
      >
        <Button size="sm" variant="outline" asChild disabled={!empresaId}>
          <Link
            href={
              empresaId
                ? `/empresas/${empresaId}/contas-pagar/import`
                : '#'
            }
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar Excel
          </Link>
        </Button>
        <Button size="sm" asChild disabled={!empresaId}>
          <Link
            href={`/contas-a-pagar/nova${empresaId ? `?empresaId=${empresaId}` : ''}`}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova conta a pagar
          </Link>
        </Button>
      </Header>

      {/* Empresa selector quando há múltiplas */}
      {empresas.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Empresa:</span>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-auto min-w-[280px]">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.tradeName ?? e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && empresaId && <PayableSkeleton />}

      {/* Conteúdo principal */}
      {empresaId && !loading && (
        <>
          {/* 4 stats — Sprint 5.0.3.0a */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              variant="paid"
              label="Pagas"
              amount={kpis.totalPagas}
              count={kpis.countPagas}
              icon={CheckCircle2}
              onClick={() => applyFilterPreset('paid')}
            />
            <StatsCard
              variant="pending"
              label="A pagar pendente"
              amount={kpis.totalPendente}
              count={kpis.countPendente}
              icon={CalendarClock}
              onClick={() => applyFilterPreset('pending')}
            />
            <StatsCard
              variant="warn"
              label="A vencer (3d)"
              amount={kpis.totalAVencer3d}
              count={kpis.countAVencer3d}
              icon={Clock}
              onClick={() => applyFilterPreset('warn3d')}
            />
            <StatsCard
              variant="overdue"
              label="Vencidas"
              amount={kpis.totalVencido}
              count={kpis.countVencido}
              icon={AlertCircle}
              onClick={() => applyFilterPreset('overdue')}
            />
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="py-3">
              <PayableFilters
                value={filters}
                onChange={(f) => {
                  setFilters(f)
                  setPage(1)
                }}
                onClear={clearFilters}
                total={paginacao.total}
              />
            </CardContent>
          </Card>

          {/* Tabela / Empty states */}
          {items.length === 0 ? (
            empresaZerada ? (
              <PayableEmptyState kind="zerada" empresaId={empresaId} />
            ) : qDebounced ? (
              <PayableEmptyState
                kind="buscaVazia"
                query={qDebounced}
                onClearQuery={() => setFilters({ ...filters, q: '' })}
              />
            ) : (
              <PayableEmptyState
                kind="filtroVazio"
                onClearFilters={clearFilters}
              />
            )
          ) : (
            <PayableTable
              rows={items}
              selection={selection}
              onSelectionChange={setSelection}
              onEfetivar={(row) =>
                setEfetivar({
                  id: row.id,
                  description: row.description,
                  amount: row.amount,
                  bankAccount: row.bankAccount
                    ? { id: row.bankAccount.id }
                    : null,
                })
              }
            />
          )}

          {/* Paginação */}
          {paginacao.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {paginacao.total} {paginacao.total === 1 ? 'conta' : 'contas'}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {page} / {paginacao.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= paginacao.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer fixo com totalizadores */}
      {empresaId && !loading && (kpis.countPagas + kpis.countPendente + kpis.countAVencer3d + kpis.countVencido) > 0 && (
        <StickyFooter
          totals={{
            paid: kpis.totalPagas,
            pending: kpis.totalPendente,
            warn3d: kpis.totalAVencer3d,
            overdue: kpis.totalVencido,
          }}
          onClickFilter={applyFilterPreset}
        />
      )}

      {/* Modal Efetivar */}
      <EfetivarDialog
        open={!!efetivar}
        conta={efetivar}
        bankAccounts={bankAccounts}
        onClose={() => setEfetivar(null)}
        onDone={() => void fetchItems()}
      />
    </div>
  )
}
