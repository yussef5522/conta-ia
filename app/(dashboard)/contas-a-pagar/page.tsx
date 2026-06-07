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
import { EditarContaDialog } from '@/components/contas-pagar/EditarContaDialog'
import { MarcarPagaDialog } from '@/components/contas-pagar/MarcarPagaDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
// Sprint 5.0.3.0b — Power features
import { SavedViewTabs } from '@/components/contas-pagar/SavedViewTabs'
import { BulkActionsBar } from '@/components/contas-pagar/BulkActionsBar'
import { MarkPaidBulkDialog } from '@/components/contas-pagar/MarkPaidBulkDialog'
import { ExportButton } from '@/components/contas-pagar/ExportButton'
import { PrintButton } from '@/components/contas-pagar/PrintButton'
// Sprint 5.0.3.0c (c2) — Density + Columns
import { DensityToggle } from '@/components/contas-pagar/DensityToggle'
import {
  ColumnsButton,
  type ColumnDef as ColumnVisibilityDef,
} from '@/components/contas-pagar/ColumnsButton'
import { useTablePreferences } from '@/lib/contas-pagar/use-table-preferences'
// Sprint 5.0.3.0c (c3) — Edit Inline
import {
  useEditCell,
  type EditableField,
} from '@/lib/contas-pagar/use-edit-cell'
import type { CategoryOption } from '@/components/contas-pagar/cells/CategoryComboboxCell'
// Sprint 5.0.3.0c (c4) — Aging Dashboard
import { AgingDashboard } from '@/components/contas-pagar/AgingDashboard'
import {
  periodFromBucket,
  type AgingResult,
  type AgingBucketId,
} from '@/lib/contas-pagar/aging'
// Sprint 5.0.3.0c (c5) — Saved Views CRUD UI
import {
  useSavedViews,
  type CustomSavedView,
} from '@/lib/contas-pagar/use-saved-views'
import { NewViewModal } from '@/components/contas-pagar/NewViewModal'
import { RenameViewDialog } from '@/components/contas-pagar/RenameViewDialog'
import { useSavedView } from '@/lib/contas-pagar/use-saved-view'
import {
  isValidSavedViewId,
  getSavedView,
  type SavedViewId,
  type PayableFilterStateExt,
} from '@/lib/contas-pagar/saved-views'

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

// Sprint 5.0.3.2 — Feature flag pra esconder UI das tabs Saved Views.
// Backend (model SavedView, endpoints, hooks, modais) continua INTOCADO.
// Sprint 5.0.4.0 RELATÓRIOS vai reusar o componente em outra tela
// (basta flipar pra true em outro callsite, OU true aqui novamente).
const SHOW_SAVED_VIEWS_TABS_IN_CONTAS_PAGAR = false

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
  // Sprint 5.0.3.3 — Sincroniza state local com searchParams.empresaId.
  // Necessário porque WorkspaceSwitcher faz router.replace(?empresaId=X) e
  // o `useState(searchParams.get('empresaId'))` só roda no INIT. Sem este
  // effect, mudanças na URL via switcher não atualizavam o state local —
  // page continuava fetchando dados da empresa antiga ("precisava sair e voltar").
  useEffect(() => {
    const urlEmpresaId = searchParams.get('empresaId') ?? ''
    if (urlEmpresaId && urlEmpresaId !== empresaId) {
      setEmpresaId(urlEmpresaId)
      // Reseta state derivado da empresa (paginação + seleção)
      setSelection({})
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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
  // Sprint 5.0.3.0a-fix — dialogs de row actions
  const [editar, setEditar] = useState<PayableRow | null>(null)
  const [markPaid, setMarkPaid] = useState<PayableRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PayableRow | null>(null)
  // Sprint 5.0.3.0b — bulk action dialogs
  const [bulkMarkPaidOpen, setBulkMarkPaidOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const { toast } = useToast()

  // Sprint 5.0.3.0c (c2) — Table preferences (density + columns)
  const ALWAYS_VISIBLE_COLS = ['status', 'amount', 'actions']
  const ALL_COLUMNS: ColumnVisibilityDef[] = [
    { id: 'status', name: 'Status', alwaysVisible: true },
    { id: 'dueDate', name: 'Vencimento' },
    { id: 'paymentDate', name: 'Pagamento' },
    { id: 'favorecido', name: 'Favorecido' },
    { id: 'description', name: 'Descrição' },
    { id: 'category', name: 'Categoria' },
    { id: 'amount', name: 'Valor', alwaysVisible: true },
    { id: 'actions', name: 'Ações', alwaysVisible: true },
  ]
  const tablePrefs = useTablePreferences({
    storageKey: 'caixaos:contas-pagar:prefs',
    alwaysVisible: ALWAYS_VISIBLE_COLS,
    defaultColumnOrder: ALL_COLUMNS.map((c) => c.id),
  })

  // Sprint 5.0.3.0c (c3) — Edit Inline state
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
  const [cellErrors, setCellErrors] = useState<
    Record<string, Set<EditableField>>
  >({})

  const editCellApi = useEditCell({
    empresaId,
    onOptimisticUpdate: (rowId, field, value) => {
      setItems((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r
          if (field === 'description') return { ...r, description: value as string }
          if (field === 'amount') return { ...r, amount: value as number }
          if (field === 'dueDate') {
            const iso = (value as Date).toISOString()
            return { ...r, dueDate: iso }
          }
          if (field === 'categoryId') {
            const newCatId = value as string | null
            if (newCatId === null) return { ...r, category: null }
            // Se sentinel __create__, ainda não sabemos o id real — server retorna
            if (newCatId.startsWith('__create__:')) {
              const name = newCatId.replace('__create__:', '')
              return {
                ...r,
                category: { id: 'pending', name, color: '#999999' },
              }
            }
            const opt = categoryOptions.find((o) => o.id === newCatId)
            return {
              ...r,
              category: opt
                ? { id: opt.id, name: opt.name, color: '#888888' }
                : r.category,
            }
          }
          return r
        }),
      )
      // Limpa erro previo
      setCellErrors((prev) => {
        const next = { ...prev }
        if (next[rowId]) {
          const set = new Set(next[rowId])
          set.delete(field)
          if (set.size === 0) delete next[rowId]
          else next[rowId] = set
        }
        return next
      })
    },
    onRevert: (rowId, field, prevValue) => {
      setItems((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r
          if (field === 'description')
            return { ...r, description: prevValue as string }
          if (field === 'amount') return { ...r, amount: prevValue as number }
          if (field === 'dueDate') return { ...r, dueDate: prevValue as string }
          if (field === 'categoryId') {
            // Não temos snapshot completo de category aqui — recarrega
            void fetchItems()
            return r
          }
          return r
        }),
      )
      // Marca erro
      setCellErrors((prev) => {
        const next = { ...prev }
        const set = new Set(next[rowId] ?? [])
        set.add(field)
        next[rowId] = set
        return next
      })
    },
    onError: (message) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: message })
    },
  })

  // Sprint contas-pagar/no-scroll-jump (07/06/2026) — Updates OTIMISTAS pras
  // ações de linha. Evita refetch+remount da lista que joga scroll pro topo.
  //
  // updateRowOptimistic: muda só os campos da row no estado (paga/desmarcar)
  // removeRowsOptimistic: remove rows do array sem refetch (excluir/bulk)
  //
  // Padrão idêntico ao da aba 💸 Retiradas (Sprint Retirada-Despesa-PF) e do
  // FindAndMatchPanel da Conciliação.
  const updateRowOptimistic = useCallback(
    (rowId: string, partial: Partial<PayableRow>) => {
      setItems((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...partial } : r)))
    },
    [],
  )
  const removeRowsOptimistic = useCallback((rowIds: string[]) => {
    const idSet = new Set(rowIds)
    setItems((prev) => prev.filter((r) => !idSet.has(r.id)))
    // Limpa seleção se estavam selecionadas
    setSelection((prev) => {
      const next = { ...prev }
      for (const id of rowIds) delete next[id]
      return next
    })
  }, [])

  // Carrega categorias da empresa pro combobox
  useEffect(() => {
    if (!empresaId) {
      setCategoryOptions([])
      return
    }
    fetch(`/api/empresas/${empresaId}/categorias`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.categorias) {
          setCategoryOptions(
            data.categorias.map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            })),
          )
        }
      })
      .catch(() => {})
  }, [empresaId])

  // Sprint 5.0.3.0c (c4) — Aging Dashboard data
  const [aging, setAging] = useState<AgingResult | null>(null)
  const [agingLoading, setAgingLoading] = useState(false)

  const refetchAging = useCallback(() => {
    if (!empresaId) {
      setAging(null)
      return
    }
    setAgingLoading(true)
    void fetch(`/api/empresas/${empresaId}/contas-pagar/aging`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.aging) setAging(data.aging)
      })
      .catch(() => {})
      .finally(() => setAgingLoading(false))
  }, [empresaId])

  useEffect(() => {
    refetchAging()
  }, [refetchAging])

  function applyAgingFilter(bucketId: AgingBucketId) {
    const { dataDe, dataAte } = periodFromBucket(bucketId)
    setFilters({
      q: filters.q,
      status: 'PENDING',
      vencidasOnly: false, // usa período em dueDate em vez de "só vencidas"
      dataDe,
      dataAte,
    })
    setPage(1)
  }

  // Sprint 5.0.3.0c (c5) — Custom Saved Views CRUD
  const savedViewsApi = useSavedViews({
    empresaId,
    scope: 'payable',
    onError: (msg) =>
      toast({ variant: 'destructive', title: 'Falha', description: msg }),
  })

  const [newViewOpen, setNewViewOpen] = useState(false)
  const [renamingView, setRenamingView] = useState<CustomSavedView | null>(null)
  const [confirmDeleteView, setConfirmDeleteView] =
    useState<CustomSavedView | null>(null)
  const [activeCustomId, setActiveCustomId] = useState<string | null>(null)

  function handleSelectCustom(view: CustomSavedView) {
    try {
      const parsedFilters = JSON.parse(view.filters)
      setFilters({
        q: filters.q,
        dataDe: parsedFilters.dataDe ?? '',
        dataAte: parsedFilters.dataAte ?? '',
        status: parsedFilters.status ?? 'PENDING',
        vencidasOnly: parsedFilters.vencidasOnly === true,
      })
      setActiveCustomId(view.id)
      setPage(1)
    } catch {
      toast({
        variant: 'destructive',
        title: 'View corrompida',
        description: 'Filtros desta view estão inválidos.',
      })
    }
  }

  async function executeDeleteView() {
    if (!confirmDeleteView) return
    const ok = await savedViewsApi.remove(confirmDeleteView.id)
    if (ok) {
      if (activeCustomId === confirmDeleteView.id) setActiveCustomId(null)
      toast({ title: 'View excluída' })
    }
    setConfirmDeleteView(null)
  }

  // editCellAdapter pra PayableTable (formato esperado)
  const editCellAdapter = useMemo(
    () => ({
      isEditing: (rowId: string, field: EditableField) =>
        editCellApi.isEditing(rowId, field),
      isSaving: (rowId: string, field: EditableField) =>
        editCellApi.isEditing(rowId, field) &&
        editCellApi.status === 'saving',
      hasError: (rowId: string, field: EditableField) =>
        cellErrors[rowId]?.has(field) === true,
      startEdit: editCellApi.startEdit,
      save: (
        rowId: string,
        field: EditableField,
        newValue: unknown,
        prevValue: unknown,
      ) => {
        void editCellApi.save(rowId, field, newValue, prevValue)
      },
      cancel: editCellApi.cancel,
    }),
    [editCellApi, cellErrors],
  )

  // IDs selecionadas (derivado do RowSelection state do @tanstack/react-table)
  const selectedIds = useMemo(
    () => Object.keys(selection).filter((k) => selection[k]),
    [selection],
  )
  const selectedCount = selectedIds.length

  // Sprint 5.0.3.0b — Saved view derivado da URL
  const urlViewParam = searchParams.get('view')
  const { activeViewId, applyView } = useSavedView({
    currentFilters: filters as Partial<PayableFilterStateExt>,
    urlViewParam,
  })

  function handleSelectView(id: SavedViewId) {
    const next = applyView(id, new Date())
    // Mapeia PayableFilterStateExt → PayableFilterState (q preservado)
    setFilters({
      q: filters.q, // mantém busca
      dataDe: next.dataDe,
      dataAte: next.dataAte,
      status: next.status,
      vencidasOnly: next.vencidasOnly,
    })
    setPage(1)
  }

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

  // Sync URL com state (sem provocar reload). Inclui ?view= quando ativa.
  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    if (filters.q) sp.set('q', filters.q)
    if (filters.dataDe) sp.set('dataDe', filters.dataDe)
    if (filters.dataAte) sp.set('dataAte', filters.dataAte)
    if (filters.status !== 'PENDING') sp.set('status', filters.status)
    if (filters.vencidasOnly) sp.set('vencidasOnly', 'true')
    if (activeViewId) sp.set('view', activeViewId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, filters, router, activeViewId])

  // Hydrata view inicial da URL (uma vez, no mount com empresaId)
  useEffect(() => {
    if (!empresaId) return
    const v = searchParams.get('view')
    if (v && isValidSavedViewId(v)) {
      const f = getSavedView(v).buildFilters(new Date())
      setFilters({
        q: filters.q,
        dataDe: f.dataDe,
        dataAte: f.dataAte,
        status: f.status,
        vencidasOnly: f.vencidasOnly,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  // Sprint 5.0.3.0a-fix — Row actions handlers
  async function handleMarkUnpaid(row: PayableRow) {
    try {
      const res = await fetch(`/api/contas-a-pagar/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentDate: null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao desmarcar pagamento',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Conta marcada como não paga',
        description: row.description,
      })
      // Update OTIMISTA — só essa row, sem refetch
      updateRowOptimistic(row.id, { paymentDate: null, status: 'PENDING' })
      // Aging usa contagens/totais agregados; recalcula em paralelo (não bloqueia UI)
      refetchAging()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    }
  }

  async function handleDuplicate(row: PayableRow) {
    try {
      const res = await fetch(`/api/contas-a-pagar/${row.id}/duplicar`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao duplicar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Conta duplicada',
        description: 'Edite a nova conta com os detalhes finais.',
      })
      void fetchItems()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    }
  }

  async function executeDelete() {
    if (!confirmDelete) return
    try {
      const res = await fetch(`/api/contas-a-pagar/${confirmDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao excluir',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Conta excluída',
        description: confirmDelete.description,
      })
      // Remoção OTIMISTA — sem refetch da lista (preserva scroll)
      removeRowsOptimistic([confirmDelete.id])
      refetchAging()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    }
  }

  // Sprint 5.0.3.0b — Bulk actions
  async function executeBulkDelete() {
    if (selectedIds.length === 0 || !empresaId) return
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/bulk`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            transactionIds: selectedIds,
          }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao excluir em lote',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const data = await res.json()
      toast({
        title: `${data.success} contas excluídas`,
      })
      // Remoção OTIMISTA em lote — preserva scroll
      removeRowsOptimistic(selectedIds)
      refetchAging()
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    }
  }

  // Query string atual (pro ExportButton montar URL com mesmos filtros)
  const filtersQS = useMemo(() => {
    const sp = new URLSearchParams()
    if (filters.q) sp.set('q', filters.q)
    if (filters.dataDe) sp.set('dataDe', filters.dataDe)
    if (filters.dataAte) sp.set('dataAte', filters.dataAte)
    if (filters.status !== 'PENDING') sp.set('status', filters.status)
    if (filters.vencidasOnly) sp.set('vencidasOnly', 'true')
    return sp.toString()
  }, [filters])

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
        {/* Sprint 5.0.3.1 (UX #1) — Toolbar minimal: removidos DensityToggle
            e ColumnsButton. Componentes mantidos no projeto pra reuso futuro. */}
        <ExportButton
          empresaId={empresaId}
          filtersQS={filtersQS}
          disabled={!empresaId}
        />
        <PrintButton disabled={!empresaId} />
        <Button size="sm" variant="outline" asChild disabled={!empresaId}>
          <Link
            href={
              empresaId
                ? `/empresas/${empresaId}/contas-pagar/import`
                : '#'
            }
            aria-label="Importar Excel"
          >
            <Upload className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Importar Excel</span>
          </Link>
        </Button>
        <Button size="sm" asChild disabled={!empresaId}>
          <Link
            href={`/contas-a-pagar/nova${empresaId ? `?empresaId=${empresaId}` : ''}`}
            aria-label="Nova conta a pagar"
          >
            <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Nova conta a pagar</span>
          </Link>
        </Button>
      </Header>

      {/* Sprint 5.0.3.2 — UI das tabs Saved Views ESCONDIDA em /contas-a-pagar
          a pedido do Yussef (UX limpa, dropdown de status já cobre o caso).
          Sprint 5.0.4.0 RELATÓRIOS vai reativar o componente em outra tela —
          basta flipar a flag pra true. Todo o backend (model SavedView, 5
          endpoints CRUD, hooks, modais NewView/RenameView) continua intacto. */}
      {SHOW_SAVED_VIEWS_TABS_IN_CONTAS_PAGAR && empresaId && !loading && (
        <SavedViewTabs
          activeViewId={activeViewId}
          activeCustomId={activeCustomId}
          customViews={savedViewsApi.views}
          onSelectSystem={(id) => {
            setActiveCustomId(null)
            handleSelectView(id)
          }}
          onSelectCustom={handleSelectCustom}
          onNew={() => setNewViewOpen(true)}
          onRename={(view) => setRenamingView(view)}
          onDuplicate={async (id) => {
            const dup = await savedViewsApi.duplicate(id)
            if (dup) toast({ title: 'View duplicada' })
          }}
          onDelete={(view) => setConfirmDeleteView(view)}
        />
      )}

      {/* Sprint 5.0.3.0b — Bulk actions bar (aparece quando ≥1 selecionada) */}
      {selectedCount > 0 && (
        <BulkActionsBar
          selectedCount={selectedCount}
          onMarkPaid={() => setBulkMarkPaidOpen(true)}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setSelection({})}
        />
      )}

      {/* Sprint 5.0.3.0c (c4) — Aging Dashboard (acima dos stats) */}
      {empresaId && !loading && (
        <AgingDashboard
          result={aging}
          loading={agingLoading}
          onClickBucket={applyAgingFilter}
        />
      )}

      {/* Sprint 5.0.3.1 (Bug #4) — Dropdown empresa removido. Seletor
          global em workspace-switcher (topo do app) é o canônico. */}

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
              density={tablePrefs.effectiveDensity}
              hiddenColumns={
                // Sprint 5.0.3.0d (d3) — Em mobile, esconde colunas secundárias
                // por default. User pode reabrir via dropdown "Colunas".
                tablePrefs.isMobile
                  ? Array.from(
                      new Set([
                        ...tablePrefs.prefs.columnHidden,
                        'paymentDate',
                        'description',
                        'category',
                      ]),
                    )
                  : tablePrefs.prefs.columnHidden
              }
              columnOrder={tablePrefs.prefs.columnOrder}
              categoryOptions={categoryOptions}
              editCell={editCellAdapter}
              onColumnOrderChange={tablePrefs.setColumnOrder}
              disableDrag={tablePrefs.isMobile}
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
              onEdit={(row) => setEditar(row)}
              onMarkPaid={(row) => setMarkPaid(row)}
              onMarkUnpaid={handleMarkUnpaid}
              onDuplicate={handleDuplicate}
              onDelete={(row) => setConfirmDelete(row)}
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

      {/* Modal Efetivar (com banco) */}
      <EfetivarDialog
        open={!!efetivar}
        conta={efetivar}
        bankAccounts={bankAccounts}
        onClose={() => setEfetivar(null)}
        onDone={(paymentDateISO, bankAccountId) => {
          if (efetivar) {
            const bankAcc = bankAccounts.find((b) => b.id === bankAccountId) ?? null
            // Update OTIMISTA — sem refetch
            updateRowOptimistic(efetivar.id, {
              paymentDate: paymentDateISO,
              status: 'RECONCILED',
              bankAccount: bankAcc
                ? { id: bankAcc.id, name: bankAcc.name, bankName: bankAcc.bankName ?? null }
                : null,
            })
            refetchAging()
          }
        }}
      />

      {/* Sprint 5.0.3.0a-fix — Modal Editar */}
      <EditarContaDialog
        open={!!editar}
        conta={editar}
        onClose={() => setEditar(null)}
        onSaved={() => void fetchItems()}
      />

      {/* Sprint 5.0.3.0a-fix — Modal Marcar como paga (sem banco) */}
      <MarcarPagaDialog
        open={!!markPaid}
        conta={markPaid}
        onClose={() => setMarkPaid(null)}
        onDone={(paymentDateISO) => {
          if (markPaid) {
            // Update OTIMISTA — sem refetch
            updateRowOptimistic(markPaid.id, {
              paymentDate: paymentDateISO,
              status: 'RECONCILED',
            })
            refetchAging()
          }
        }}
      />

      {/* Sprint 5.0.3.0a-fix — Confirm Excluir */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Excluir conta a pagar"
        description={
          confirmDelete ? (
            <>
              Tem certeza que deseja excluir{' '}
              <strong>&quot;{confirmDelete.description}&quot;</strong>? Esta
              ação não pode ser desfeita.
            </>
          ) : (
            'Esta ação não pode ser desfeita.'
          )
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={executeDelete}
      />

      {/* Sprint 5.0.3.0b — Bulk mark paid */}
      <MarkPaidBulkDialog
        open={bulkMarkPaidOpen}
        count={selectedCount}
        empresaId={empresaId}
        transactionIds={selectedIds}
        onClose={() => setBulkMarkPaidOpen(false)}
        onDone={(paymentDateISO, bankAccountId) => {
          // Update OTIMISTA em lote — sem refetch (preserva scroll)
          const idSet = new Set(selectedIds)
          const bankAcc = bankAccountId
            ? bankAccounts.find((b) => b.id === bankAccountId)
            : null
          setItems((prev) =>
            prev.map((r) =>
              idSet.has(r.id)
                ? {
                    ...r,
                    paymentDate: paymentDateISO,
                    status: 'RECONCILED',
                    bankAccount: bankAcc
                      ? { id: bankAcc.id, name: bankAcc.name, bankName: bankAcc.bankName ?? null }
                      : r.bankAccount,
                  }
                : r,
            ),
          )
          setSelection({})
          refetchAging()
        }}
      />

      {/* Sprint 5.0.3.0b — Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Excluir ${selectedCount} ${selectedCount === 1 ? 'conta' : 'contas'} a pagar?`}
        description={
          <>
            Esta ação não pode ser desfeita. Contas efetivadas com banco terão
            o saldo bancário revertido automaticamente.
          </>
        }
        confirmLabel={`Excluir ${selectedCount}`}
        variant="destructive"
        onConfirm={executeBulkDelete}
      />

      {/* Sprint 5.0.3.0c (c5) — Saved Views modals */}
      <NewViewModal
        open={newViewOpen}
        currentFilters={filters as unknown as Record<string, unknown>}
        onClose={() => setNewViewOpen(false)}
        onCreate={async ({ name, icon, filters: f }) => {
          const created = await savedViewsApi.create({
            name,
            icon,
            filters: f,
            density: tablePrefs.prefs.density,
            columnOrder: JSON.stringify(tablePrefs.prefs.columnOrder),
            columnHidden: JSON.stringify(tablePrefs.prefs.columnHidden),
          })
          if (created) {
            toast({ title: 'View criada', description: created.name })
            setActiveCustomId(created.id)
          }
        }}
      />

      <RenameViewDialog
        view={renamingView}
        onClose={() => setRenamingView(null)}
        onSave={async ({ name, icon }) => {
          if (!renamingView) return
          const ok = await savedViewsApi.update(renamingView.id, { name, icon })
          if (ok) toast({ title: 'View renomeada' })
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteView}
        onOpenChange={(o) => !o && setConfirmDeleteView(null)}
        title="Excluir view?"
        description={
          confirmDeleteView ? (
            <>
              Tem certeza que deseja excluir a view{' '}
              <strong>&quot;{confirmDeleteView.name}&quot;</strong>?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={executeDeleteView}
      />
    </div>
  )
}
