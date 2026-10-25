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
  Clock,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { reportClientError } from '@/lib/dev/report-client-error'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PayableSkeleton } from '@/components/contas-pagar/PayableSkeleton'
import { PayableEmptyState } from '@/components/contas-pagar/PayableEmptyState'
import { mesCorrente, rotuloDoMes } from '@/lib/periodo/mes-corrente'
/**
 * ⚠️⚠️ 26/09 — a frase *"as já conciliadas estão em Movimentações →"* MORREU (decisão do
 * dono: *"legenda de construção; quem precisar de conciliadas acha em Movimentações
 * sozinho"*), e com ela `NOTA_CONCILIADAS`/`hrefMovimentacoes` ficaram **sem chamador** —
 * removidos da lib, porque constante órfã é o que alguém religa por descuido.
 *
 * ⭐ **O que segura a promessa continua de pé:** os RÓTULOS honestos (`Pagas (sem
 * conciliar)`, `Em aberto e pagas sem vínculo`) seguem no dropdown de status. *A ressalva
 * fica; o que saiu foi a legenda permanente.*
 */
import { ROTULO_PAGAS } from '@/lib/contas-pagar/rotulos'
import { ehFaixaLegada, type FaixaLegada } from '@/lib/contas-pagar/faixa-legada'
import type {
  EscopoEmAberto,
  MedidaDoTempo,
} from '@/lib/contas-pagar/rotulo-do-tempo'
import {
  avisoDoTeto,
  type SelecaoDoFiltro,
} from '@/lib/contas-pagar/selecao-do-filtro'
import { CartoesDoTempo } from '@/components/contas-pagar/CartoesDoTempo'
import { reguaDoCaixaNaSelecao } from '@/lib/contas-pagar/regua-do-caixa-na-selecao'
import { formatBRL } from '@/lib/format/money'
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
import { fetchJson } from '@/lib/http/fetch-json'
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
  /** ⭐ 26/09 — o 4º card, entre A PAGAR e VENCIDAS */
  totalVenceHoje: number
  countVenceHoje: number
  /** ⭐ 26/09 — a divisão honesta das pagas, na linha pequena do cartão */
  countPagasConciliadas: number
  countPagasSemVinculo: number
  totalVencido: number
  countVencido: number
  /**
   * ⚠️ `totalAVencer3d`/`countAVencer3d` MORRERAM aqui em 26/09 — o card deles foi removido
   * em 13/09 e os campos ficaram no tipo, sem ninguém desenhar. **Campo que ninguém usa é
   * o que alguém religa por descuido** (a lição do `?extratoId=` sem chamador, 10/09).
   */
}

interface Paginacao {
  total: number
  /**
   * ⭐⭐ O VALOR do filtro inteiro, ao lado da contagem (23/10, item 1 do dono).
   *
   * ⛔ **Agregado do SERVIDOR, nunca soma da página:** a lista pagina em 50, e somar as
   * carregadas faria o cabeçalho dizer R$ 52 mil num filtro de R$ 97 mil — *o número que o
   * dono usa pra decidir se paga*, errado por construção.
   *
   * ⚠️ `null` = **não medido**, nunca zero (zero afirmaria filtro sem dinheiro).
   */
  totalValor: number | null
  page: number
  limit: number
  totalPages: number
}

const EMPTY_KPIS: KPIs = {
  totalPagas: 0,
  countPagas: 0,
  totalPendente: 0,
  countPendente: 0,
  totalVenceHoje: 0,
  countVenceHoje: 0,
  countPagasConciliadas: 0,
  countPagasSemVinculo: 0,
  totalVencido: 0,
  countVencido: 0,
}

/**
 * ⭐ A faixa que veio da URL — **validada pelo dono da pergunta**, nunca castada.
 *
 * ⛔ `as FaixaLegada` deixaria `?faixa=xpto` virar um filtro que o servidor recusa (400) ou,
 * pior, uma lista vazia com cara de *"não tem conta nenhuma"*. Valor desconhecido cai em
 * `undefined` = a lista inteira, que é o default honesto.
 */
function faixaDaUrl(v: string | null): FaixaLegada | undefined {
  return v && ehFaixaLegada(v) ? v : undefined
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

  // Sprint 15 — Listener global window pra capturar QUALQUER erro JS
  // ou unhandledrejection que aconteça enquanto a tela está montada.
  // Isso pega causas que não passam pelo try/catch dos handlers (ex:
  // erro em um useEffect terceirizado, em Radix, em react-table, em
  // qualquer render).
  useEffect(() => {
    function onError(e: ErrorEvent) {
      reportClientError({
        context: 'window.onerror @/contas-a-pagar',
        error: e.error ?? e.message,
        extra: {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          type: 'error',
        },
      })
    }
    function onUnhandled(e: PromiseRejectionEvent) {
      reportClientError({
        context: 'window.unhandledrejection @/contas-a-pagar',
        error: e.reason,
        extra: { type: 'unhandledrejection' },
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  // Filtros — hydratam de URL na 1ª carga
  const [filters, setFilters] = useState<PayableFilterState>(() => ({
    q: searchParams.get('q') ?? '',
    dataDe: searchParams.get('dataDe') ?? '',
    dataAte: searchParams.get('dataAte') ?? '',
    status:
      (searchParams.get('status') as PayableFilterState['status']) ?? 'PENDING',
    // ⭐ a faixa do chip sobrevive ao F5 e é compartilhável, como o resto dos filtros.
    // ⚠️ VALIDADA pelo dono da pergunta (`ehFaixaLegada`), nunca castada cega: `?faixa=xpto`
    // tem que cair na lista inteira, não numa tela vazia ("erro disfarçado de vazio").
    faixa: faixaDaUrl(searchParams.get('faixa')),
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
  /**
   * ⭐⭐ AS MEDIDAS POR ESTADO — medidas pelo SERVIDOR, com rótulo e tudo (21/10 · 23/10).
   *
   * ⛔ A tela **ecoa**; ela não conta nem datifica nada. Contagem, total e rótulo saem do
   * MESMO `whereDoStatus` dos cartões, no MESMO instante do relógio do servidor —
   * ***um relógio só manda***. Um cliente com a hora torta escreveria a data de uma janela
   * sobre o número de outra.
   */
  const [medidasDoTempo, setMedidasDoTempo] = useState<
    Partial<Record<EscopoEmAberto, MedidaDoTempo>>
  >({})
  /**
   * ⭐ O saldo de caixa de AGORA — a régua da barra da seleção.
   *
   * ⛔ `null` é *"não consegui ler"*, **nunca zero**: falhar em ler o caixa é ausência de
   * MEDIÇÃO, não caixa vazio — e zero faria a barra dizer coral *"pagando fica −R$ X"*,
   * mandando o dono não pagar uma conta que ele pode pagar.
   */
  const [saldoCaixa, setSaldoCaixa] = useState<number | null>(null)
  /**
   * ⭐⭐ O RECORTE DE FLUXO — padrão MÊS CORRENTE (14/09), nunca "desde sempre".
   *
   * ⚠️ Ele vive na URL (`?mes=`) pra sobreviver ao F5 e ser compartilhável, como o resto
   * dos filtros da casa. ⛔ E NÃO é `EMPTY_FILTERS`: limpar os filtros volta pro mês
   * corrente, não pro começo dos tempos — *"limpar período volta pro mês corrente"*.
   */
  const [mes, setMes] = useState(searchParams.get('mes') ?? mesCorrente())
  const [paginacao, setPaginacao] = useState<Paginacao>({
    total: 0,
    // ⚠️ nasce `null`, nunca 0: antes da 1ª leitura o valor é "a apurar", não "zero"
    totalValor: null,
    page: 1,
    limit: 50,
    totalPages: 1,
  })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  /**
   * ⭐⭐⭐ O VALOR DE CADA ID QUE JÁ PASSOU PELA TELA — é isto que faz o total da barra ser
   * **o agregado do servidor por construção**, em vez da soma da página.
   *
   * ⛔⛔ A seleção atravessa páginas de propósito (o lote opera por id, nunca por página).
   * Somar só as linhas CARREGADAS fazia a barra imprimir um total que não fecha com o
   * rótulo ao lado dele — *número de dinheiro em tela sem régua é pior que ausência*. Cada
   * página carregada acumula aqui, e o "selecionar todas" traz `{id, amount}` do servidor:
   * ***a soma local É o agregado***, não uma 2ª conta.
   *
   * ⚠️ Id sem valor é **impossível por construção**: um id só entra na seleção vindo de uma
   * página carregada (que grava aqui) ou do `/ids` (que também grava). Não existe caminho
   * que selecione um id cujo valor a tela não tenha.
   */
  const [valorPorId, setValorPorId] = useState<Record<string, number>>({})
  /**
   * ⭐ O retrato do "selecionar todas" — os ids+valores do FILTRO INTEIRO, medidos pelo
   * servidor. `null` = o dono não usou o gesto nesta volta.
   */
  const [selecaoDoFiltro, setSelecaoDoFiltro] = useState<SelecaoDoFiltro | null>(null)
  const [selecionandoTodas, setSelecionandoTodas] = useState(false)
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

  /**
   * ⛔ O FETCH DO AGING SAIU JUNTO COM A TABELA (13/09) — e o payload também.
   *
   * ⚠️ **Dado que ninguém desenha é dado que alguém religa por descuido** (a lição da
   * conferência de saldo que saiu da Conciliação em 10/09). A rota `/aging` continua viva
   * e testada pro dia em que o aging voltar como opção; o que morreu foi a chamada — e
   * com ela um round-trip a cada carregamento da tela.
   */


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

  /**
   * ⭐⭐⭐ O TOTAL DA SELEÇÃO — **AGREGADO DO SERVIDOR POR CONSTRUÇÃO** (23/10, item 3 do dono).
   *
   * ⛔⛔ **A SOMA DA PÁGINA MORREU.** Ela era `items.filter(...).reduce(...)` — e como a
   * seleção atravessa páginas, a barra imprimia *"81 contas"* ao lado de um total das ~50
   * carregadas, com uma nota de texto tentando explicar o resto. **Medido em prod: escondia
   * 31 contas e R$ 44.533,81.** Agora cada valor vem de `valorPorId`, que é preenchido pela
   * própria página carregada E pelo `/ids` do servidor — ***a soma local É o agregado***.
   *
   * ⚠️ E a aritmética do verde/coral/a-apurar mora na LIB (`reguaDoCaixaNaSelecao`), não
   * aqui: os oito estados possíveis são testáveis sem tela.
   */
  const totalSelecionado = useMemo(
    () => selectedIds.reduce((acc, id) => acc + (valorPorId[id] ?? 0), 0),
    [selectedIds, valorPorId],
  )
  const regua = useMemo(
    () => reguaDoCaixaNaSelecao(selectedCount, totalSelecionado, saldoCaixa),
    [selectedCount, totalSelecionado, saldoCaixa],
  )


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

  /**
   * ⭐⭐⭐ O RECORTE TEM UM DONO SÓ — a LISTA e o "selecionar todas" mandam os MESMOS params.
   *
   * ⛔⛔ Montar a query duas vezes seria a 2ª régua do *"o que está no filtro?"*: a rota de ids
   * usa o MESMO `buildPayableListWhere` da lista, mas **só se receber os mesmos parâmetros**.
   * Divergir aqui marcaria um conjunto que a tabela não mostra — a pior divergência possível
   * numa tela de dinheiro, porque o dono confere o número e ele fecha com a coisa errada.
   *
   * ⚠️ `page`/`limit` ficam FORA de propósito: eles são da paginação da lista, e a seleção do
   * filtro não tem página.
   */
  const paramsDoFiltro = useCallback(() => {
    const qs = new URLSearchParams({ empresaId: empresaId ?? '' })
    if (qDebounced) qs.set('q', qDebounced)
    if (filters.dataDe) qs.set('dataDe', filters.dataDe)
    if (filters.dataAte) qs.set('dataAte', filters.dataAte)
    if (filters.status !== 'TODOS') qs.set('status', filters.status)
    // ⭐ o recorte dos cartões — é ele que faz o card e a lista mostrarem o MESMO
    if (filters.escopo) qs.set('escopo', filters.escopo)
    // ⚠️ LEGADO: link velho com `?faixa=` ainda recorta (a rota traduz pra `escopo`)
    if (filters.faixa) qs.set('faixa', filters.faixa)
    qs.set('mes', mes)
    if (filters.vencidasOnly) qs.set('vencidasOnly', 'true')
    return qs
  }, [
    empresaId,
    qDebounced,
    filters.dataDe,
    filters.dataAte,
    filters.status,
    filters.escopo,
    filters.faixa,
    filters.vencidasOnly,
    mes,
  ])

  const fetchItems = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = paramsDoFiltro()
      qs.set('page', String(page))
      qs.set('limit', '50')

      const { ok, data, message } = await fetchJson<{
        items: typeof items
        kpis: typeof kpis
        paginacao: typeof paginacao
        medidasDoTempo: Partial<Record<EscopoEmAberto, MedidaDoTempo>>
        saldoCaixa: number | null
      }>(`/api/contas-a-pagar?${qs}`)
      if (!ok) {
        toast({ variant: 'destructive', title: 'Erro ao carregar contas a pagar', description: message ?? 'Tenta de novo.' })
        return // não deixa lista/KPIs stale passarem por atuais
      }
      setItems(data!.items)
      setKpis(data!.kpis)
      setPaginacao(data!.paginacao)
      setMedidasDoTempo(data!.medidasDoTempo ?? {})
      /**
       * ⭐⭐ O VALOR DE CADA LINHA FICA GUARDADO POR ID, e é isso que faz o total da barra ser
       * o agregado do servidor **por construção** em vez da soma da página.
       *
       * ⛔ A seleção atravessa páginas (o lote opera por id). Sem acumular, trocar de página
       * deixaria o id selecionado e o valor dele fora da conta — foi exatamente o defeito
       * medido em prod (a barra escondia 31 contas e R$ 44.533,81).
       */
      setValorPorId((prev) => {
        const next = { ...prev }
        for (const i of data!.items) next[i.id] = i.amount
        return next
      })
      // ⚠️ `?? null` e nunca `?? 0`: payload sem o campo é "não medi", não "caixa zerado"
      setSaldoCaixa(data!.saldoCaixa ?? null)
    } finally {
      setLoading(false)
    }
    // ⚠️ `toast` fora das deps de propósito (é a referência do provider e o fetch não deve
    // re-disparar por causa dela) — a mesma forma de antes desta fatia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, page, paramsDoFiltro])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  /**
   * ⭐⭐ SELECIONAR TODAS = **O FILTRO INTEIRO**, não a página.
   *
   * ⛔ Os ids vêm do servidor pelos **MESMOS params da lista** (`paramsDoFiltro`), pela rota
   * que usa o MESMO `buildPayableListWhere` — senão o gesto marcaria um conjunto que a
   * tabela não mostra. E **SUBSTITUI** a seleção (não soma): *"todas do filtro"* é uma
   * afirmação sobre um conjunto, não um acréscimo ao que estava marcado antes.
   *
   * ⚠️ Os valores entram no `valorPorId` no MESMO gesto — é o que mantém o total verdadeiro
   * pros ids que a tela nunca carregou.
   */
  const marcarTodasDoFiltro = useCallback(async () => {
    if (!empresaId) return
    setSelecionandoTodas(true)
    try {
      const { ok, data, message } = await fetchJson<SelecaoDoFiltro>(
        `/api/contas-a-pagar/ids?${paramsDoFiltro()}`,
      )
      if (!ok || !data) {
        toast({
          variant: 'destructive',
          title: 'Não consegui marcar todas do filtro',
          description: message ?? 'Tenta de novo.',
        })
        return
      }
      setSelecaoDoFiltro(data)
      setValorPorId((prev) => {
        const next = { ...prev }
        for (const par of data.pares) next[par.id] = par.amount
        return next
      })
      const marcadas: Record<string, boolean> = {}
      for (const par of data.pares) marcadas[par.id] = true
      setSelection(marcadas)
    } finally {
      setSelecionandoTodas(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, paramsDoFiltro])

  /**
   * ⭐ O estado do checkbox do cabeçalho — quem sabe é a PÁGINA, que tem a seleção.
   *
   * ⚠️ `TODAS` só quando o retrato existe E a seleção é EXATAMENTE ele: assim desmarcar uma
   * linha depois de marcar todas volta pra `PARCIAL` na hora, em vez de seguir prometendo
   * um conjunto que já não está marcado.
   */
  const estadoDaSelecaoDoFiltro: 'NENHUMA' | 'PARCIAL' | 'TODAS' | 'CARREGANDO' =
    selecionandoTodas
      ? 'CARREGANDO'
      : selectedCount === 0
        ? 'NENHUMA'
        : selecaoDoFiltro &&
            selecaoDoFiltro.pares.length > 0 &&
            selecaoDoFiltro.pares.length === selectedCount &&
            selecaoDoFiltro.pares.every((p) => selection[p.id])
          ? 'TODAS'
          : 'PARCIAL'

  /**
   * ⭐⭐ TROCAR O FILTRO INVALIDA O RETRATO DO "TODAS", **nunca a seleção**.
   *
   * ⛔ `selecaoDoFiltro` é a resposta de *"quais são as contas DESTE filtro"* — mudou o
   * filtro, aquela resposta deixou de valer e o checkbox do cabeçalho não pode seguir
   * dizendo `TODAS`. ⛔⛔ Mas a SELEÇÃO fica: ela atravessar página e filtro é o desenho
   * (o lote opera por id), e zerá-la aqui jogaria fora o trabalho do dono.
   *
   * ⚠️ E **trocar de PÁGINA não entra nas deps** de propósito: paginar não muda o filtro.
   */
  useEffect(() => {
    setSelecaoDoFiltro(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsDoFiltro])

  // Sync URL com state (sem provocar reload). Inclui ?view= quando ativa.
  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    if (filters.q) sp.set('q', filters.q)
    if (filters.dataDe) sp.set('dataDe', filters.dataDe)
    if (filters.dataAte) sp.set('dataAte', filters.dataAte)
    if (filters.status !== 'PENDING') sp.set('status', filters.status)
    if (filters.faixa) sp.set('faixa', filters.faixa)
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
    const target = confirmDelete
    // Sprint 15 — instrumentar: cada passo dentro de try/catch dedicado
    // pra reportar exatamente em qual ponto estoura. Cada catch reporta
    // contexto + re-throw pra subir pro error boundary (que também loga).
    try {
      // ── PASSO 1: DELETE no server ──
      const res = await fetch(`/api/contas-a-pagar/${target.id}`, {
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

      // ── PASSO 2: toast de sucesso ──
      try {
        toast({
          title: 'Conta excluída',
          description: target.description,
        })
      } catch (e) {
        reportClientError({
          context: 'executeDelete:toast',
          error: e,
          extra: { targetId: target.id },
        })
        // não re-throw — toast falhar não deveria quebrar a tela
      }

      // ── PASSO 3: fechar dialog (setConfirmDelete null) ──
      try {
        setConfirmDelete(null)
      } catch (e) {
        reportClientError({
          context: 'executeDelete:setConfirmDelete(null)',
          error: e,
          extra: { targetId: target.id },
        })
      }

      // ── PASSO 4: aguardar microtask pra Radix desmontar ──
      await Promise.resolve()

      // ── PASSO 5: remover row do estado items ──
      try {
        removeRowsOptimistic([target.id])
      } catch (e) {
        reportClientError({
          context: 'executeDelete:removeRowsOptimistic',
          error: e,
          extra: { targetId: target.id },
        })
        throw e
      }

      // ── PASSO 6: refetchAging em paralelo (background) ──
      try {
      } catch (e) {
        reportClientError({
          context: 'executeDelete:refetchAging',
          error: e,
          extra: { targetId: target.id },
        })
        // não re-throw — refetch é background
      }
    } catch (e) {
      // Sprint 15 — catch geral: reporta ANTES do toast pra garantir captura
      reportClientError({
        context: 'executeDelete:outer-catch',
        error: e,
        extra: { targetId: target.id, targetDescription: target.description },
      })
      // Se for erro de rede do fetch, toast destructive
      toast({ variant: 'destructive', title: 'Erro inesperado', description: e instanceof Error ? e.message : 'Veja PM2 log' })
    }
  }

  // Sprint 5.0.3.0b — Bulk actions
  async function executeBulkDelete() {
    if (selectedIds.length === 0 || !empresaId) return
    // Sprint 14 — snapshot dos ids antes de qualquer setState
    const targetIds = [...selectedIds]
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/bulk`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            transactionIds: targetIds,
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
      // Sprint 14 — fecha bulk dialog ANTES de remover rows (mesma lógica
      // do executeDelete individual).
      setBulkDeleteOpen(false)
      await Promise.resolve()
      removeRowsOptimistic(targetIds)
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
    if (filters.escopo) sp.set('escopo', filters.escopo)
    if (filters.vencidasOnly) sp.set('vencidasOnly', 'true')
    return sp.toString()
  }, [filters])

  /**
   * ⭐⭐⭐ O NÚMERO É O FILTRO (13/09) — decisão do dono: *"card diz 34, lista mostra 34"*.
   *
   * ⛔ Antes cada preset montava o SEU recorte na mão — e nenhum batia com o do card:
   * "pagas" filtrava `status=RECONCILED` enquanto o card contava `paymentDate != null`;
   * "vencidas" usava `dueDate < now` (timestamp) enquanto o aging comparava por DIA.
   * Agora os três mandam o MESMO `escopo` que o servidor usou pra contar.
   */
  /**
   * ⭐⭐ 21/10 (fatia 1.1) — **ESTREITADO DE 4 PRESETS PRA UM, e isso NÃO perde caminho.**
   *
   * ⛔⛔ Os kinds `overdue` · `today` · `pending` **morreram porque os CARTÕES DE FAIXA fazem
   * exatamente o mesmo recorte, por construção**: `whereDaFaixa` delega a `whereDoStatus` por
   * RECURSÃO, então clicar em VENCIDAS/VENCE HOJE/as três de data manda o MESMO corte que o
   * preset mandava. Manter os três aqui seria **campo morto esperando alguém religar** — e o
   * dia em que o escopo e a faixa divergissem, a tela teria duas réguas pro mesmo número (a
   * doença de 13/09, em que o card dizia 34 e a tabela pintava 9).
   *
   * ⭐ **PAGAS fica, e é o único que não é faixa:** ele é um RECORTE DE FLUXO (o mês), não uma
   * faixa de aberto — por isso continua passando pelo escopo.
   *
   * ⚠️ `status: 'TODOS'` de propósito: quem recorta é o ESCOPO, e deixar o filtro de status
   * junto cortaria de novo por outra régua (foi assim que a lista mostrava "muito menos" do
   * que o card dizia).
   */
  function filtrarPagasDoMes() {
    setFilters({ ...EMPTY_FILTERS, status: 'TODOS', escopo: 'PAGA' })
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
        {/* ⭐⭐ A PORTA DA LIXEIRA (20/09) — e ela fica SEMPRE, não só quando há algo
            removido: *fila zerada esconde o TRABALHO, nunca a FERRAMENTA* (12/09). Foi a
            ausência dela que deixou o dono dias sem saber se tinha apagado 26 contas. */}
        <a href="/contas-a-pagar/removidas"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          contas removidas
        </a>
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

      {/* ⛔⛔⛔ A TABELA DE AGING SAIU DA TELA (13/09/2026) — decisão do dono.
          *"Meu negócio paga em DIAS, não carrego dívida de 90 dias — 100% sempre vai estar
          no 0-30. O card VENCIDAS (9 · 20.635,54) já diz tudo que preciso, e clicar nele já
          filtra."* ⭐ **Móvel que mostra sempre a mesma coisa ocupa dobra e treina o dono a
          não olhar** — a régua que tirou o card de dupla contagem zerado da Conciliação.
          ⚠️ O MOTOR FICA: `lib/contas-pagar/aging.ts` e a rota seguem vivos e testados — o
          dia em que ele vender com prazo longo, o aging volta como OPÇÃO. Saiu a VITRINE,
          não a régua. */}

      {/* Sprint 5.0.3.1 (Bug #4) — Dropdown empresa removido. Seletor
          global em workspace-switcher (topo do app) é o canônico. */}

      {/* Loading state */}
      {loading && empresaId && <PayableSkeleton />}

      {/* Conteúdo principal */}
      {empresaId && !loading && (
        <>
          {/*
            ⭐⭐⭐ 26/09 — **A TELA AGE, NÃO SE EXPLICA** (decisão do dono).
            Morreram daqui:
            · a frase *"Esta tela mostra o que está em aberto… as já conciliadas estão em
              Movimentações →"* — legenda de construção; quem precisa de conciliada acha em
              Movimentações sozinho;
            · o **seletor de mês do topo** (`NavegadorDeMes`) — a tela **sempre abre no mês
              corrente**, e quem quer outra época usa o *"Selecionar período"* de baixo, que
              já faz isso. ***Um controle por pergunta, não dois.***
            ⛔ E a RÉGUA continua igual: o mês corrente recorta as PAGAS; VENCE HOJE, A PAGAR
            e VENCIDAS mostram tudo que está em aberto. *Isso é comportamento, não legenda.*
          */}
          {/* ⭐⭐⭐ UMA FAMÍLIA SÓ (21/10, fatia 1.1) — veredito do dono: *"cards repetidos,
              mesma informação 2 vezes em 2 modelos"*. Morreram daqui os 4 cartões antigos
              (VENCE HOJE e VENCIDAS apareciam EM DOBRO com os chips, com número IDÊNTICO —
              são o MESMO corte por construção) e os 5 chips de faixa.
              ⛔ O *"A pagar"* morreu como CARTÃO porque ele é a Σ das faixas seguintes:
              mantê-lo ao lado delas seria a mesma conta contada 2× — o defeito que matou o
              *"a vencer (3d)"* em 13/09. O total em aberto segue à vista (é a Σ dos cartões).
              ⭐ O rótulo adulto (nome + data) vem MEDIDO do servidor; a tela ecoa. */}
          <CartoesDoTempo
            medidas={medidasDoTempo}
            escopoAtivo={filters.escopo}
            totalEmAberto={kpis.totalVenceHoje + kpis.totalPendente + kpis.totalVencido}
            onEscolherEscopo={(e) => {
              /**
               * ⚠️ O cartão recorta o que está EM ABERTO, então ele manda `status: 'TODOS'`
               * e **mata a faixa legada** — deixar as duas ligadas recortaria duas vezes, e
               * o cartão diria 25 com a lista mostrando 3 (a divergência de 13/09).
               *
               * ⛔⛔ E **`dataDe`/`dataAte`/`mes` SOBREVIVEM**: o `kpiBaseInput` mede os
               * cartões DENTRO do período, então resetar pra `EMPTY_FILTERS` aqui faria a
               * lista mostrar MAIS do que o cartão contou — a doença de 13/09 (o card dizia
               * 34 e a tabela pintava 9).
               */
              setFilters({
                ...filters,
                escopo: e,
                faixa: undefined,
                status: 'TODOS',
                vencidasOnly: false,
                q: '',
              })
              setPage(1)
            }}
            pagas={{
              // ⭐ o rótulo diz o RECORTE: cartão de fluxo sem o período é um número que não
              // se sabe de quando
              label: `Pagas · ${rotuloDoMes(mes)}`,
              total: kpis.totalPagas,
              contagem: kpis.countPagas,
              /**
               * ⭐⭐ 26/09 — a RESSALVA como DETALHE, dentro do cartão (decisão do dono).
               * ⛔ Ela é APENSADA à contagem, nunca substituta: deixar o detalhe tomar o
               * lugar dela abriria a porta pros dois números divergirem.
               */
              detalhe: `${kpis.countPagasConciliadas} conciliadas com o banco · ${kpis.countPagasSemVinculo} sem vínculo`,
              ativo: filters.escopo?.startsWith('PAGA') ?? false,
              onEscolher: filtrarPagasDoMes,
            }}
          />

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
                /* ⭐⭐ item 1 do dono: *"ao lado de «81 contas no filtro» entra o valor"* —
                   agregado do SERVIDOR sobre o filtro INTEIRO, nunca a soma da página. */
                totalValor={paginacao.totalValor}
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
              /* ⭐ o subtotal do cabeçalho de seção é o da FAIXA INTEIRA (o MESMO número do
                 chip), nunca a soma das linhas da página — e quando a página corta a faixa,
                 o cabeçalho DIZ. */
              totaisPorEstado={medidasDoTempo}
              /* ⭐⭐ "selecionar todas" = O FILTRO INTEIRO (item 3). O estado vem da PÁGINA,
                 que é quem tem a seleção; a tabela só desenha o checkbox. */
              selecaoDoFiltro={{
                estado: estadoDaSelecaoDoFiltro,
                marcarTodas: () => void marcarTodasDoFiltro(),
                limpar: () => setSelection({}),
              }}
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

      {/**
        * ⛔⛔⛔ **A RÉGUA DO RODAPÉ MORREU (21/10, item 2 do dono) — e o arquivo foi APAGADO.**
        *
        * **Veredito, no print de 21/10 20:22:** *"a mesma informação vive em TRÊS formas — os 4
        * cards, os 5 chips e a régua do rodapé"*. O `StickyFooter` era a TERCEIRA: ele imprimia
        * **os MESMOS quatro totais** (Vencidas · Vence hoje · A pagar · Pagas) que a família de
        * cartões mostra a dez centímetros acima, cada um clicando pro MESMO filtro.
        *
        * ⛔ **E ele disputava o lugar com a barra da seleção**, que agora é `fixed bottom-0` — os
        * dois ocupariam o mesmo rodapé, um cobrindo o outro.
        *
        * ⭐ **NADA SE PERDEU, e isso foi MEDIDO antes de apagar:** VENCIDAS, VENCE HOJE e PAGAS
        * são cartão (idênticos); *"A pagar"* é a Σ de SETE_DIAS + RESTO + DEPOIS + SEM_VENCIMENTO,
        * à vista como as próprias faixas; e o TOTAL GERAL dele somava **pagas-do-mês com dívida
        * aberta de sempre** — dois TEMPOS diferentes (a régua de 14/09), um número que ninguém
        * defende. O total em aberto continua à vista: é a Σ dos cartões de faixa.
        *
        * ⚠️ O componente foi **APAGADO, não deixado órfão** — *enquanto o arquivo existe, alguém
        * religa* (a cicatriz do `GruposSugeridos`, 23/09).
        */}

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
        /* ⭐⭐ *"Marcar 81 contas como pagas — R$ 97.313,25?"* — a confirmação DIZ o número
           E o valor. ⚠️ É o agregado (`valorPorId`), nunca a soma da página. */
        valor={totalSelecionado}
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
        }}
      />

      {/* Sprint 5.0.3.0b — Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        /* ⭐ a confirmação em lote DIZ o número E o valor — *"Excluir 81 contas — R$ …?"*
           ⚠️ zero não vira `R$ 0,00`: sem valor medido, o título sai só com a contagem. */
        title={`Excluir ${selectedCount} ${selectedCount === 1 ? 'conta' : 'contas'} a pagar${
          totalSelecionado > 0 ? ` — ${formatBRL(totalSelecionado)}` : ''
        }?`}
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

      {/**
       * ⭐⭐⭐ A BARRA DA SELEÇÃO FICA **EMBAIXO DA TELA** (21/10, fatia 1.1) — item 3 do dono:
       * *"a barra é embaixo"*, e `docs/contas-a-pagar-referencia.html` é explícita
       * (`.barra{position:fixed;left:0;right:0;bottom:0}`).
       *
       * ⛔⛔ **O DEFEITO ERA DE POSIÇÃO NO DOM, não de CSS.** Ela era `sticky bottom-0` e
       * vivia **ANTES** do conteúdo — e `sticky` só cola no fim do container que o contém,
       * então na prática ela aparecia **NO TOPO**. Por isso a cura é dupla: `fixed` (a lei da
       * referência) **e** o render no FIM do conteúdo.
       *
       * ⚠️ **O ESPAÇADOR NÃO É ENFEITE:** barra `fixed` sai do fluxo e **cobre a última
       * linha da tabela** — justamente a que o dono acabou de marcar. Os 110px são os da
       * referência (`body{padding-bottom:110px}`), e ele só existe **enquanto a barra
       * existe**.
       *
       * ⛔ **FUNÇÃO INTOCADA:** total gigante, régua do caixa e os 3 gestos (marcar pagas ·
       * excluir · limpar) são os MESMOS — mudou o LUGAR, nunca o que ela faz.
       */}
      {selectedCount > 0 && (
        <>
          <div className="h-[110px]" aria-hidden />
          <BulkActionsBar
            selectedCount={selectedCount}
            regua={regua}
            /**
             * ⛔⛔ A NOTA *"N em outra página"* MORREU: a seleção pega o FILTRO INTEIRO e o
             * valor de cada id vem do servidor junto do id, então **o total É o agregado por
             * construção** — não há mais nada "fora da página" pra nomear.
             * ⭐ O que ainda fica de fora é só o TETO DO LOTE, e ele vai NOMEADO.
             */
            aviso={selecaoDoFiltro ? avisoDoTeto(selecaoDoFiltro) : null}
            onMarkPaid={() => setBulkMarkPaidOpen(true)}
            onDelete={() => setBulkDeleteOpen(true)}
            onClear={() => setSelection({})}
          />
        </>
      )}
    </div>
  )
}
