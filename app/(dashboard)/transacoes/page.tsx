'use client'

import { useEffect, useState, useCallback, Suspense, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, ArrowUpRight, ArrowDownRight, Filter, Search, X,
  ChevronLeft, ChevronRight, Building2, Sparkles,
  Check, EyeOff, Trash2 as TrashIcon, Download, Keyboard as KeyboardIcon,
} from 'lucide-react'
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts'
import type { ShortcutHandler } from '@/lib/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsHelp } from '@/components/transacoes/keyboard-shortcuts-help'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { parseTransacoesURLFilters } from '@/lib/transacoes/url-filters'
import { AiSourceBadge } from '@/components/transacoes/ai-source-badge'
import { InlineCategorySelect } from '@/components/transacoes/inline-category-select'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  RECONCILED: 'Conciliado',
  IGNORED: 'Ignorado',
}

const STATUS_VARIANTS: Record<string, 'outline' | 'secondary' | 'destructive'> = {
  PENDING: 'outline',
  RECONCILED: 'secondary',
  IGNORED: 'destructive',
}

interface Category { id: string; name: string; color: string; type: string }

interface ContaInfo {
  id: string
  name: string
  bankName: string | null
  balance: number
  accountType: string
  companyId: string
  company: { name: string; tradeName: string | null }
}

interface Transacao {
  id: string
  description: string
  amount: number
  type: string
  date: string
  status: string
  origin: string
  notes: string | null
  categoryId: string | null
  bankAccountId: string
  category: Category | null
  bankAccount: ContaInfo
  // Sprint 3.0.2 A4 — campos pro badge IA
  classificationSource: string | null
  aiConfidence: number | null
  classifiedByRule: { id: string; padrao: string; tipoMatch: string } | null
}

interface Paginacao { total: number; page: number; limit: number; totalPages: number }

// Wrapper com Suspense — useSearchParams (em TransacoesPageInner) exige
// boundary de Suspense no Next 15+.
export default function TransacoesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <TransacoesPageInner />
    </Suspense>
  )
}

function TransacoesPageInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // Drill-down do Cashflow Waterfall (e outros dashboards) linkam pra cá com
  // ?tipo=&inicio=&fim=. Sprint 3.0.2 — também aceita ?categoryId=&q=&importId=&conferencia=.
  // Zod-validado, fallback graceful.
  const urlFilters = parseTransacoesURLFilters({
    tipo: searchParams.get('tipo'),
    inicio: searchParams.get('inicio'),
    fim: searchParams.get('fim'),
    categoryId: searchParams.get('categoryId'),
    q: searchParams.get('q'),
    importId: searchParams.get('importId'),
    conferencia: searchParams.get('conferencia'),
  })
  const empresaIdParam = searchParams.get('empresaId')

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [contas, setContas] = useState<ContaInfo[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [contasReady, setContasReady] = useState(false)

  const now = new Date()
  const [inicio, setInicio] = useState(
    urlFilters.inicio ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
  )
  const [fim, setFim] = useState(urlFilters.fim ?? now.toISOString().split('T')[0])
  const [tipo, setTipo] = useState<string>(urlFilters.tipo ?? 'TODOS')
  const [status, setStatus] = useState('TODOS')
  const [contaFiltro, setContaFiltro] = useState('TODAS')
  const [page, setPage] = useState(1)
  // Sprint 3.0.2 — filtros novos
  const [categoryId, setCategoryId] = useState(urlFilters.categoryId ?? 'TODAS')
  const [q, setQ] = useState(urlFilters.q ?? '')
  const [qDebounced, setQDebounced] = useState(urlFilters.q ?? '')
  const [categorias, setCategorias] = useState<Category[]>([])
  // Sprint 3.0.3 B4 — filtro valor
  const [valorMin, setValorMin] = useState<string>(
    urlFilters.valorMin !== null ? String(urlFilters.valorMin) : '',
  )
  const [valorMax, setValorMax] = useState<string>(
    urlFilters.valorMax !== null ? String(urlFilters.valorMax) : '',
  )
  const [valorMinDebounced, setValorMinDebounced] = useState(valorMin)
  const [valorMaxDebounced, setValorMaxDebounced] = useState(valorMax)
  const importId = urlFilters.importId
  const conferenciaMode = urlFilters.conferencia && !!importId

  // Sprint 3.0.3 B2 — bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState<
    | { action: 'category'; targetId: string | null; targetName: string }
    | { action: 'status'; status: 'IGNORED' | 'RECONCILED'; label: string }
    | null
  >(null)

  // Carrega lista de contas para o filtro e para o botão Nova Transação
  useEffect(() => {
    async function fetchContas() {
      const res = await fetch('/api/contas-bancarias')
      if (res.ok) {
        const data = await res.json()
        setContas(data.contas)
      }
      setContasReady(true)
    }
    fetchContas()
  }, [])

  // Sprint 3.0.2 — carrega categorias da empresa (se houver empresaId no URL OU
  // se houver UMA empresa só após contas carregarem)
  useEffect(() => {
    const empId =
      empresaIdParam ??
      (contas.length > 0
        ? Array.from(new Set(contas.map((c) => c.companyId)))[0]
        : null)
    if (!empId) return
    fetch(`/api/empresas/${empId}/categorias?soAtivas=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.categorias) setCategorias(data.categorias)
      })
      .catch(() => {})
  }, [empresaIdParam, contas])

  // Sprint 3.0.2 — debounce 300ms na busca
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  // Sprint 3.0.3 B4 — debounce 400ms nos valores (mais longo: typing R$)
  useEffect(() => {
    const t = setTimeout(() => setValorMinDebounced(valorMin), 400)
    return () => clearTimeout(t)
  }, [valorMin])
  useEffect(() => {
    const t = setTimeout(() => setValorMaxDebounced(valorMax), 400)
    return () => clearTimeout(t)
  }, [valorMax])

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '50' })
      if (contaFiltro !== 'TODAS') qs.set('contaId', contaFiltro)
      if (empresaIdParam) qs.set('empresaId', empresaIdParam)
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      if (status !== 'TODOS') qs.set('status', status)
      // Sprint 3.0.2 — novos filtros
      if (categoryId !== 'TODAS') qs.set('categoryId', categoryId)
      if (qDebounced) qs.set('q', qDebounced)
      if (importId) qs.set('importId', importId)
      // Sprint 3.0.3 B4 — valor (debounced)
      if (valorMinDebounced.trim() !== '' && Number(valorMinDebounced) >= 0)
        qs.set('valorMin', String(Number(valorMinDebounced)))
      if (valorMaxDebounced.trim() !== '' && Number(valorMaxDebounced) >= 0)
        qs.set('valorMax', String(Number(valorMaxDebounced)))

      const res = await fetch(`/api/transacoes?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data.transacoes)
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }, [contaFiltro, empresaIdParam, page, inicio, fim, tipo, status, categoryId, qDebounced, importId, valorMinDebounced, valorMaxDebounced])

  useEffect(() => { fetchTransacoes() }, [fetchTransacoes])

  const entradas = transacoes.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const saidas = transacoes.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

  // Sprint 3.0.2 + 3.0.3 — limpa todos filtros novos
  function limparFiltrosNovos() {
    setCategoryId('TODAS')
    setQ('')
    setQDebounced('')
    setValorMin('')
    setValorMax('')
    setValorMinDebounced('')
    setValorMaxDebounced('')
    setPage(1)
  }

  // Sprint 3.0.3 B2 — bulk select helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = transacoes.every((t) => next.has(t.id))
      if (allSelected) {
        for (const t of transacoes) next.delete(t.id)
      } else {
        for (const t of transacoes) next.add(t.id)
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkCategoryId('')
  }

  async function executeBulkCategory(catId: string | null) {
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      const res = await fetch('/api/transacoes/lote', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, categoryId: catId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha no bulk update',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: `${data.atualizadas} transação${data.atualizadas === 1 ? '' : 'ões'} atualizada${data.atualizadas === 1 ? '' : 's'}`,
        description: data.naoEncontradas > 0 ? `${data.naoEncontradas} não encontradas` : undefined,
      })
      clearSelection()
      void fetchTransacoes()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  async function executeBulkStatus(status: 'RECONCILED' | 'IGNORED') {
    setBulkLoading(true)
    try {
      const ids = Array.from(selectedIds)
      const res = await fetch('/api/transacoes/lote/status', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, status }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha no bulk update',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: `${data.atualizadas} transação${data.atualizadas === 1 ? '' : 'ões'} marcada${data.atualizadas === 1 ? '' : 's'} como ${status === 'RECONCILED' ? 'conciliada' : 'ignorada'}${data.atualizadas === 1 ? '' : 's'}`,
        description: data.naoEncontradas > 0 ? `${data.naoEncontradas} não encontradas` : undefined,
      })
      clearSelection()
      void fetchTransacoes()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setBulkLoading(false)
      setBulkConfirm(null)
    }
  }

  const selectedCount = selectedIds.size
  const allOnPageSelected =
    transacoes.length > 0 && transacoes.every((t) => selectedIds.has(t.id))

  // Sprint 3.0.4 C1 — export CSV. Reusa os MESMOS filtros aplicados na listagem.
  // Exige empresaId (CSV é por-empresa pra evitar mistura de planos de contas).
  const [exporting, setExporting] = useState(false)
  const exportEmpresaId =
    empresaIdParam ??
    (contas.length > 0 && Array.from(new Set(contas.map((c) => c.companyId))).length === 1
      ? contas[0].companyId
      : null)

  async function exportCSV() {
    if (!exportEmpresaId) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma empresa',
        description: 'Export precisa de uma empresa específica (use ?empresaId=).',
      })
      return
    }
    setExporting(true)
    try {
      const qs = new URLSearchParams()
      if (contaFiltro !== 'TODAS') qs.set('contaId', contaFiltro)
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      if (status !== 'TODOS') qs.set('status', status)
      if (categoryId !== 'TODAS') qs.set('categoryId', categoryId)
      if (qDebounced) qs.set('q', qDebounced)
      if (importId) qs.set('importId', importId)
      if (valorMinDebounced.trim() !== '' && Number(valorMinDebounced) >= 0)
        qs.set('valorMin', String(Number(valorMinDebounced)))
      if (valorMaxDebounced.trim() !== '' && Number(valorMaxDebounced) >= 0)
        qs.set('valorMax', String(Number(valorMaxDebounced)))

      const url = `/api/empresas/${exportEmpresaId}/transacoes/export${qs.toString() ? `?${qs}` : ''}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha no export',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `transacoes-${Date.now()}.csv`
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      toast({ title: 'CSV baixado', description: filename })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede no export.' })
    } finally {
      setExporting(false)
    }
  }

  // Sprint 3.0.4 C2 — atalhos teclado
  const [helpOpen, setHelpOpen] = useState(false)
  const [cursorIndex, setCursorIndex] = useState(0)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Reseta cursor quando lista muda
  useEffect(() => {
    setCursorIndex((prev) => Math.min(prev, Math.max(0, transacoes.length - 1)))
  }, [transacoes.length])

  // Scroll suave da row em foco
  useEffect(() => {
    const el = rowRefs.current[cursorIndex]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursorIndex])

  // Marca status de UMA transação. Reusa o endpoint /lote/status com 1 ID.
  const changeStatusSingle = useCallback(
    async (txId: string, novoStatus: 'RECONCILED' | 'IGNORED') => {
      try {
        const res = await fetch('/api/transacoes/lote/status', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [txId], status: novoStatus }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast({
            variant: 'destructive',
            title: 'Falha',
            description: data.erro ?? `HTTP ${res.status}`,
          })
          return
        }
        toast({
          title: novoStatus === 'RECONCILED' ? 'Confirmada' : 'Ignorada',
        })
        void fetchTransacoes()
      } catch {
        toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
      }
    },
    [toast, fetchTransacoes],
  )

  const shortcuts = useMemo<ShortcutHandler[]>(() => {
    const current = transacoes[cursorIndex]
    return [
      // Help — funciona até dentro de inputs
      { key: '?', shift: true, safeInInputs: true, run: () => setHelpOpen((o) => !o) },
      // Esc fecha modal ou limpa busca
      {
        key: 'Escape',
        safeInInputs: true,
        run: () => {
          if (helpOpen) {
            setHelpOpen(false)
            return
          }
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        },
      },
      // Navegação
      {
        key: 'j',
        run: () => setCursorIndex((i) => Math.min(i + 1, transacoes.length - 1)),
      },
      { key: 'k', run: () => setCursorIndex((i) => Math.max(0, i - 1)) },
      { key: '/', run: () => searchRef.current?.focus() },
      // Seleção
      {
        key: ' ',
        run: () => {
          if (current) toggleSelect(current.id)
        },
      },
      { key: 'a', meta: true, run: () => toggleSelectAllPage() },
      // Ações
      {
        key: 'e',
        run: () => {
          if (!current) return
          router.push(
            `/empresas/${current.bankAccount.companyId}/contas/${current.bankAccountId}/transacoes/${current.id}/editar`,
          )
        },
      },
      {
        key: 'x',
        run: () => {
          if (current) void changeStatusSingle(current.id, 'IGNORED')
        },
      },
      {
        key: 'Enter',
        run: () => {
          if (current) void changeStatusSingle(current.id, 'RECONCILED')
        },
      },
    ]
  }, [transacoes, cursorIndex, helpOpen, router, changeStatusSingle])

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="space-y-6">
      {/* Sprint 3.0.3 B2 — Bulk toolbar fixa quando há seleção */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-20 rounded-lg border border-primary/40 bg-primary/5 backdrop-blur px-4 py-3 flex items-center gap-3 shadow-sm">
          <Checkbox
            checked={true}
            onCheckedChange={() => clearSelection()}
            aria-label="Limpar seleção"
          />
          <p className="text-sm font-semibold">
            {selectedCount} selecionada{selectedCount === 1 ? '' : 's'}
          </p>
          <div className="flex-1" />
          {/* Mudar categoria */}
          {categorias.length > 0 && (
            <Select
              value={bulkCategoryId}
              onValueChange={(v) => {
                setBulkCategoryId(v)
                const cat = categorias.find((c) => c.id === v)
                setBulkConfirm({
                  action: 'category',
                  targetId: v === '__NONE__' ? null : v,
                  targetName: v === '__NONE__' ? 'Sem categoria' : cat?.name ?? '?',
                })
              }}
            >
              <SelectTrigger className="h-8 w-48 text-sm">
                <SelectValue placeholder="Mudar categoria..." />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                <SelectItem value="__NONE__">
                  <span className="text-muted-foreground italic">Sem categoria</span>
                </SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="inline-flex items-center gap-2">
                      {c.color && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: c.color }}
                        />
                      )}
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={bulkLoading}
            onClick={() =>
              setBulkConfirm({
                action: 'status',
                status: 'RECONCILED',
                label: 'Marcar como conciliadas',
              })
            }
          >
            <Check className="h-3.5 w-3.5 mr-1" />Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkLoading}
            onClick={() =>
              setBulkConfirm({
                action: 'status',
                status: 'IGNORED',
                label: 'Marcar como ignoradas',
              })
            }
          >
            <EyeOff className="h-3.5 w-3.5 mr-1" />Ignorar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Sprint 3.0.2 — Header destacado modo Conferência */}
      {conferenciaMode && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">🤖 Conferência pós-import</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {paginacao.total} transações deste import — confira a classificação da IA e ajuste o que precisar.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/dashboard')}
          >
            Concluir e voltar
          </Button>
        </div>
      )}

      <Header
        title={conferenciaMode ? 'Conferir Transações' : 'Transações'}
        description={`${paginacao.total} lançamento${paginacao.total !== 1 ? 's' : ''} no período`}
      >
        {/* Sprint 3.0.4 C2 — atalhos teclado (ajuda) */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setHelpOpen(true)}
          title="Atalhos de teclado (?)"
        >
          <KeyboardIcon className="h-4 w-4" />
        </Button>
        {/* Sprint 3.0.4 C1 — Export CSV. Desabilita se não há empresa única identificável. */}
        <Button
          size="sm"
          variant="outline"
          onClick={exportCSV}
          disabled={exporting || !exportEmpresaId || paginacao.total === 0}
          title={
            !exportEmpresaId
              ? 'Selecione uma empresa para exportar'
              : paginacao.total === 0
                ? 'Nenhuma transação para exportar'
                : 'Exportar CSV (UTF-8, abre direto no Excel)'
          }
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exporting ? 'Exportando…' : 'Exportar'}
        </Button>
        {!contasReady ? (
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
          </Button>
        ) : contas.length === 0 ? (
          <Button size="sm" asChild>
            <Link href="/contas-bancarias">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
            </Link>
          </Button>
        ) : contas.length === 1 ? (
          <Button size="sm" asChild>
            <Link href={`/empresas/${contas[0].companyId}/contas/${contas[0].id}/transacoes/nova`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
            </Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {contas.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  className="cursor-pointer"
                  onSelect={() => router.push(`/empresas/${c.companyId}/contas/${c.id}/transacoes/nova`)}
                >
                  {c.company.tradeName ?? c.company.name} · {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Header>

      {/* Cards resumo */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Entradas no período</p>
            <p className="text-2xl font-bold text-green-600">{formatBRL(entradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Saídas no período</p>
            <p className="text-2xl font-bold text-red-600">{formatBRL(saidas)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-1 shrink-0" />

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">De</p>
              <Input type="date" className="h-8 w-36 text-sm" value={inicio} onChange={(e) => { setInicio(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Até</p>
              <Input type="date" className="h-8 w-36 text-sm" value={fim} onChange={(e) => { setFim(e.target.value); setPage(1) }} />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Conta</p>
              <Select value={contaFiltro} onValueChange={(v) => { setContaFiltro(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company.tradeName ?? c.company.name} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="CREDIT">Entradas</SelectItem>
                  <SelectItem value="DEBIT">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="RECONCILED">Conciliado</SelectItem>
                  <SelectItem value="IGNORED">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sprint 3.0.2 A1 — Filtro categoria */}
            {categorias.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Categoria</p>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1) }}>
                  <SelectTrigger className="h-8 w-52 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as categorias</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          {c.color && (
                            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                          )}
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sprint 3.0.2 A2 — Busca descrição */}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground">Buscar descrição</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchRef}
                  type="text"
                  className="h-8 pl-8 pr-7 text-sm"
                  placeholder="Ex: NETFLIX, ATACADAO... (atalho: /)"
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setPage(1) }}
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => { setQ(''); setQDebounced(''); setPage(1) }}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sprint 3.0.3 B4 — Filtro por valor */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">R$ De</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0,00"
                className="h-8 w-28 text-sm tabular-nums"
                value={valorMin}
                onChange={(e) => { setValorMin(e.target.value); setPage(1) }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">R$ Até</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="∞"
                className="h-8 w-28 text-sm tabular-nums"
                value={valorMax}
                onChange={(e) => { setValorMax(e.target.value); setPage(1) }}
              />
            </div>

            {/* Limpar todos filtros novos */}
            {(categoryId !== 'TODAS' || qDebounced || valorMin || valorMax) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limparFiltrosNovos}>
                <X className="h-3.5 w-3.5 mr-1" />Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : transacoes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowUpRight className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma transação no período</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Altere os filtros ou acesse uma conta para lançar transações.</p>
          <Button asChild>
            <Link href="/contas-bancarias">
              <Building2 className="mr-2 h-4 w-4" />Ver Contas Bancárias
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Sprint 3.0.3 B2 — selectAll header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b">
            <Checkbox
              checked={allOnPageSelected}
              onCheckedChange={toggleSelectAllPage}
              aria-label="Selecionar todas da página"
            />
            <span className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `${selectedCount} selecionada${selectedCount === 1 ? '' : 's'} (de ${paginacao.total} total)`
                : 'Selecione transações pra ações em massa'}
            </span>
          </div>
          {transacoes.map((t, i) => (
            <div
              key={t.id}
              ref={(el) => { rowRefs.current[i] = el }}
              className={`group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 ${i > 0 ? 'border-t' : ''} ${selectedIds.has(t.id) ? 'bg-primary/5' : ''} ${i === cursorIndex ? 'ring-2 ring-inset ring-primary/40' : ''}`}
              onClick={() => setCursorIndex(i)}
            >
              {/* Sprint 3.0.3 B2 — checkbox */}
              <Checkbox
                checked={selectedIds.has(t.id)}
                onCheckedChange={() => toggleSelect(t.id)}
                aria-label={`Selecionar ${t.description}`}
                onClick={(e) => e.stopPropagation()}
              />
              {/* Ícone */}
              <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
                t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>

              {/* Descrição */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {t.bankAccount?.company?.tradeName ?? t.bankAccount?.company?.name ?? 'Empresa'} / {t.bankAccount?.name ?? 'Conta'}
                  </span>
                  {/* Sprint 3.0.3 B1 — edição inline categoria (se carregadas) */}
                  {categorias.length > 0 ? (
                    <InlineCategorySelect
                      transacaoId={t.id}
                      current={
                        t.category
                          ? { id: t.category.id, name: t.category.name, color: t.category.color }
                          : null
                      }
                      categorias={categorias.map((c) => ({
                        id: c.id,
                        name: c.name,
                        color: c.color ?? null,
                      }))}
                      onUpdated={(catId, cat) => {
                        setTransacoes((prev) =>
                          prev.map((x) =>
                            x.id === t.id
                              ? {
                                  ...x,
                                  categoryId: catId,
                                  category: cat
                                    ? { id: cat.id, name: cat.name, color: cat.color ?? '', type: '' }
                                    : null,
                                }
                              : x,
                          ),
                        )
                      }}
                    />
                  ) : (
                    t.category && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.category.color }} />
                        {t.category.name}
                      </span>
                    )
                  )}
                  {/* Sprint 3.0.2 A4 — Badge IA source */}
                  {t.classificationSource && (
                    <AiSourceBadge
                      source={t.classificationSource}
                      confidence={t.aiConfidence}
                      ruleName={t.classifiedByRule?.padrao}
                      compact={false}
                    />
                  )}
                </div>
              </div>

              {/* Status */}
              <Badge variant={STATUS_VARIANTS[t.status] ?? 'outline'} className="hidden sm:inline-flex text-xs">
                {STATUS_LABELS[t.status] ?? t.status}
              </Badge>

              {/* Valor */}
              <span className={`shrink-0 font-semibold text-sm ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
              </span>

              {/* Link para conta */}
              <Link
                href={`/empresas/${t.bankAccount.companyId}/contas/${t.bankAccountId}/transacoes/${t.id}/editar`}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                Editar
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {paginacao.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {paginacao.total} transaç{paginacao.total !== 1 ? 'ões' : 'ão'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {paginacao.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= paginacao.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sprint 3.0.3 B2 — Confirm dialog bulk */}
      {bulkConfirm && (
        <ConfirmDialog
          open={!!bulkConfirm}
          onOpenChange={(o) => { if (!o) { setBulkConfirm(null); setBulkCategoryId('') } }}
          title={
            bulkConfirm.action === 'category'
              ? `Mudar categoria de ${selectedCount} transação${selectedCount === 1 ? '' : 'ões'}?`
              : `${bulkConfirm.label} (${selectedCount} transação${selectedCount === 1 ? '' : 'ões'})?`
          }
          description={
            bulkConfirm.action === 'category' ? (
              <div className="text-sm">
                <p>Nova categoria: <strong>{bulkConfirm.targetName}</strong></p>
                <p className="text-xs text-muted-foreground mt-1">
                  Source ficará MANUAL pra todas. IA confidence e regra-aplicada serão resetadas.
                </p>
              </div>
            ) : (
              <p className="text-sm">
                {bulkConfirm.status === 'IGNORED'
                  ? 'Transações ignoradas saem da fila /pendentes mas continuam no histórico.'
                  : 'Confirmar = marcar como conciliadas (revisadas).'}
              </p>
            )
          }
          confirmLabel={bulkLoading ? 'Aplicando...' : 'Confirmar'}
          variant={bulkConfirm.action === 'status' && bulkConfirm.status === 'IGNORED' ? 'destructive' : 'default'}
          onConfirm={async () => {
            if (bulkConfirm.action === 'category') {
              await executeBulkCategory(bulkConfirm.targetId)
            } else {
              await executeBulkStatus(bulkConfirm.status)
            }
          }}
        />
      )}

      {/* Sprint 3.0.4 C2 — modal de ajuda dos atalhos */}
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
