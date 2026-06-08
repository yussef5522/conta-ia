'use client'

// Sprint 5.0.3.0a — Tabela densa pra /contas-a-pagar.
//
// Usa @tanstack/react-table v8 (headless) — colunas + sort + selection.
// Sprint 5.0.3.0b adicionará: bulk actions (selection já está pronto),
// saved views (column order/hidden state).
// Sprint 5.0.3.0c: edit inline, column reorder/hide via drag.
//
// Layout: tarja lateral colorida (cor = payableVisualStatus), 12 colunas,
// linha hover, click → modal detalhe (placeholder), click no menu ⋯ → actions.

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type VisibilityState,
  type ColumnOrderState,
  type Header,
} from '@tanstack/react-table'
import type { DensityLevel } from '@/lib/contas-pagar/use-table-preferences'
// Sprint 5.0.3.0d (d1) — Column reorder drag
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
// Sprint 5.0.3.0c (c3) — Edit inline
import { EditableCell } from './cells/EditableCell'
import {
  CategoryComboboxCell,
  type CategoryOption,
} from './cells/CategoryComboboxCell'
import type { EditableField } from '@/lib/contas-pagar/use-edit-cell'
import {
  ArrowUpDown,
  MoreHorizontal,
  Check,
  Pencil,
  RotateCcw,
  Copy,
  Trash2,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBRL } from '@/lib/format/money'
import {
  payableVisualStatus,
  payableStatusLabel,
  PAYABLE_STATUS_COLOR,
  type PayableVisualStatus,
} from './payable-status'

export interface PayableRow {
  id: string
  description: string
  amount: number
  dueDate: string | null
  paymentDate: string | null
  status: string
  notes: string | null
  category: { id: string; name: string; color: string } | null
  supplier: {
    id: string
    razaoSocial: string
    nomeFantasia: string | null
  } | null
  employee: { id: string; nome: string } | null
  bankAccount: { id: string; name: string; bankName: string | null } | null
}

interface Props {
  rows: PayableRow[]
  onRowClick?: (row: PayableRow) => void
  /** Efetivar pagamento COM banco (atualiza saldo) — Sprint 4.0.1.a */
  onEfetivar?: (row: PayableRow) => void
  /** Edit modal — Sprint 5.0.3.0a-fix */
  onEdit?: (row: PayableRow) => void
  /** Marcar como paga (sem banco) — Sprint 5.0.3.0a-fix */
  onMarkPaid?: (row: PayableRow) => void
  /** Marcar como NÃO paga (PATCH paymentDate=null) — Sprint 5.0.3.0a-fix */
  onMarkUnpaid?: (row: PayableRow) => void
  /** Duplicar (POST cria nova com dueDate+1mês) — Sprint 5.0.3.0a-fix */
  onDuplicate?: (row: PayableRow) => void
  /** Excluir (com ConfirmDialog no parent) — Sprint 5.0.3.0a-fix */
  onDelete?: (row: PayableRow) => void
  selection: RowSelectionState
  onSelectionChange: (s: RowSelectionState) => void
  // Sprint 5.0.3.0c (c2) — Density + column visibility/order
  /** Density level — aplica classe CSS no <table>. Default 'normal'. */
  density?: DensityLevel
  /** IDs das colunas escondidas (passa pra VisibilityState do @tanstack/react-table). */
  hiddenColumns?: string[]
  /** Ordem das colunas (passa pra ColumnOrderState). Default = ordem natural. */
  columnOrder?: string[]
  /** Callback de reorder via drag — Sprint 5.0.3.0d (d1). */
  onColumnOrderChange?: (newOrder: string[]) => void
  /** True desabilita drag (mobile). */
  disableDrag?: boolean
  // Sprint 5.0.3.0c (c3) — Edit Inline
  /** Categorias disponíveis pro combobox de edit. */
  categoryOptions?: CategoryOption[]
  /** API do hook useEditCell — passada pelos cell renderers. */
  editCell?: {
    isEditing: (rowId: string, field: EditableField) => boolean
    isSaving: (rowId: string, field: EditableField) => boolean
    hasError: (rowId: string, field: EditableField) => boolean
    startEdit: (rowId: string, field: EditableField) => void
    save: (
      rowId: string,
      field: EditableField,
      newValue: unknown,
      prevValue: unknown,
    ) => void
    cancel: () => void
  }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function favorecidoLabel(row: PayableRow): string {
  return (
    row.supplier?.nomeFantasia ??
    row.supplier?.razaoSocial ??
    row.employee?.nome ??
    '—'
  )
}

function statusBadge(s: PayableVisualStatus) {
  const c = PAYABLE_STATUS_COLOR[s]
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase tracking-wide border-0 ${c.badgeBg} ${c.badgeText}`}
    >
      {payableStatusLabel(s)}
    </Badge>
  )
}

export function PayableTable({
  rows,
  onRowClick,
  onEfetivar,
  onEdit,
  onMarkPaid,
  onMarkUnpaid,
  onDuplicate,
  onDelete,
  selection,
  onSelectionChange,
  density = 'normal',
  hiddenColumns = [],
  columnOrder = [],
  categoryOptions = [],
  editCell,
  onColumnOrderChange,
  disableDrag = false,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'dueDate', desc: false },
  ])

  // Sprint 5.0.3.0c (c2) — Visibility state derivado de hiddenColumns
  const columnVisibility: VisibilityState = Object.fromEntries(
    hiddenColumns.map((id) => [id, false]),
  )

  const columns: ColumnDef<PayableRow>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Selecionar todas"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Selecionar linha"
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (row) =>
        payableVisualStatus({
          status: row.status,
          dueDate: row.dueDate,
          paymentDate: row.paymentDate,
        }),
      cell: ({ getValue }) => statusBadge(getValue() as PayableVisualStatus),
    },
    {
      id: 'dueDate',
      header: 'Vencimento',
      accessorKey: 'dueDate',
      cell: ({ row }) => {
        const r = row.original
        if (editCell) {
          return (
            <EditableCell
              type="date"
              value={r.dueDate ?? ''}
              isEditing={editCell.isEditing(r.id, 'dueDate')}
              isSaving={editCell.isSaving(r.id, 'dueDate')}
              hasError={editCell.hasError(r.id, 'dueDate')}
              onStartEdit={() => editCell.startEdit(r.id, 'dueDate')}
              onSave={(v) =>
                editCell.save(r.id, 'dueDate', v, r.dueDate)
              }
              onCancel={editCell.cancel}
              aria={`Editar vencimento de ${favorecidoLabel(r)}`}
            />
          )
        }
        return (
          <span className="text-xs tabular-nums">
            {formatDate(r.dueDate)}
          </span>
        )
      },
    },
    {
      id: 'paymentDate',
      header: 'Pagamento',
      accessorKey: 'paymentDate',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDate(row.original.paymentDate)}
        </span>
      ),
    },
    {
      id: 'favorecido',
      header: 'Favorecido',
      accessorFn: (row) => favorecidoLabel(row),
      cell: ({ getValue }) => (
        <span className="max-w-[200px] truncate inline-block">
          {getValue() as string}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'Descrição',
      accessorKey: 'description',
      cell: ({ row }) => {
        const r = row.original
        if (editCell) {
          return (
            <span className="max-w-[250px] truncate inline-block text-muted-foreground">
              <EditableCell
                type="text"
                value={r.description}
                isEditing={editCell.isEditing(r.id, 'description')}
                isSaving={editCell.isSaving(r.id, 'description')}
                hasError={editCell.hasError(r.id, 'description')}
                onStartEdit={() => editCell.startEdit(r.id, 'description')}
                onSave={(v) =>
                  editCell.save(r.id, 'description', v, r.description)
                }
                onCancel={editCell.cancel}
                aria={`Editar descrição de ${favorecidoLabel(r)}`}
              />
            </span>
          )
        }
        return (
          <span className="max-w-[250px] truncate inline-block text-muted-foreground">
            {r.description}
          </span>
        )
      },
    },
    {
      id: 'category',
      header: 'Categoria',
      accessorFn: (row) => row.category?.name ?? '',
      cell: ({ row }) => {
        const r = row.original
        if (editCell) {
          return (
            <CategoryComboboxCell
              currentId={r.category?.id ?? null}
              currentName={r.category?.name ?? null}
              isEditing={editCell.isEditing(r.id, 'categoryId')}
              isSaving={editCell.isSaving(r.id, 'categoryId')}
              hasError={editCell.hasError(r.id, 'categoryId')}
              options={categoryOptions}
              onStartEdit={() => editCell.startEdit(r.id, 'categoryId')}
              onSave={(v) =>
                editCell.save(r.id, 'categoryId', v, r.category?.id ?? null)
              }
              onCancel={editCell.cancel}
            />
          )
        }
        return r.category ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: r.category.color }}
            />
            {r.category.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      id: 'amount',
      header: () => <span className="block text-right">Valor</span>,
      accessorKey: 'amount',
      cell: ({ row }) => {
        const r = row.original
        // Sprint Cor-Valor-Status (07/06/2026): cor do valor segue o mesmo
        // status visual da palavra (paid=verde, overdue=vermelho, warn=âmbar,
        // pending=neutro). Antes era hardcoded vermelho em todos os estados.
        const visualForAmount = payableVisualStatus({
          status: r.status,
          dueDate: r.dueDate,
          paymentDate: r.paymentDate,
        })
        const amountColor = PAYABLE_STATUS_COLOR[visualForAmount].amountText
        if (editCell) {
          return (
            <span className={`block text-right tabular-nums font-medium ${amountColor}`}>
              − R${' '}
              <EditableCell
                type="number"
                value={String(r.amount)}
                isEditing={editCell.isEditing(r.id, 'amount')}
                isSaving={editCell.isSaving(r.id, 'amount')}
                hasError={editCell.hasError(r.id, 'amount')}
                onStartEdit={() => editCell.startEdit(r.id, 'amount')}
                onSave={(v) =>
                  editCell.save(r.id, 'amount', v, r.amount)
                }
                onCancel={editCell.cancel}
                aria={`Editar valor de ${favorecidoLabel(r)}`}
              />
            </span>
          )
        }
        return (
          <span className={`block text-right tabular-nums font-medium ${amountColor}`}>
            − R$ {formatBRL(r.amount)}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 40,
      cell: ({ row }) => {
        const visual = payableVisualStatus({
          status: row.original.status,
          dueDate: row.original.dueDate,
          paymentDate: row.original.paymentDate,
        })
        const isPaid = visual === 'paid'
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Ações da conta"
                  aria-haspopup="menu"
                  data-testid={`row-actions-${row.original.id}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {onEdit && (
                  <DropdownMenuItem
                    onSelect={() => onEdit(row.original)}
                    data-testid="row-action-edit"
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </DropdownMenuItem>
                )}
                {!isPaid && onMarkPaid && (
                  <DropdownMenuItem
                    onSelect={() => onMarkPaid(row.original)}
                    data-testid="row-action-mark-paid"
                  >
                    <Check className="mr-2 h-3.5 w-3.5 text-emerald-600" />
                    Marcar como paga
                  </DropdownMenuItem>
                )}
                {isPaid && onMarkUnpaid && (
                  <DropdownMenuItem
                    onSelect={() => onMarkUnpaid(row.original)}
                    data-testid="row-action-mark-unpaid"
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5 text-amber-600" />
                    Marcar como não paga
                  </DropdownMenuItem>
                )}
                {!isPaid && onEfetivar && (
                  <DropdownMenuItem
                    onSelect={() => onEfetivar(row.original)}
                    data-testid="row-action-efetivar"
                  >
                    <Banknote className="mr-2 h-3.5 w-3.5 text-sky-600" />
                    Efetivar com banco…
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem
                    onSelect={() => onDuplicate(row.original)}
                    data-testid="row-action-duplicate"
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicar
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(row.original)}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30"
                      data-testid="row-action-delete"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      rowSelection: selection,
      columnVisibility,
      // Só passa columnOrder se foi customizada — senão deixa ordem natural
      ...(columnOrder.length > 0
        ? { columnOrder: columnOrder as ColumnOrderState }
        : {}),
    },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(selection) : updater
      onSelectionChange(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  })

  // Sprint 5.0.3.0d (d1) — Setup do drag column reorder
  const FIXED_COLUMNS = ['select', 'status', 'amount', 'actions']
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const draggableHeaders = useMemo(() => {
    if (disableDrag || !onColumnOrderChange) return []
    return table
      .getHeaderGroups()[0]
      ?.headers.filter((h) => !FIXED_COLUMNS.includes(h.column.id))
      .map((h) => h.column.id) ?? []
  }, [table, disableDrag, onColumnOrderChange])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onColumnOrderChange) return

    const allIds = table.getHeaderGroups()[0]?.headers.map((h) => h.column.id) ?? []
    const oldIdx = allIds.indexOf(active.id as string)
    const newIdx = allIds.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return

    // Não permite mover FIXED columns
    if (FIXED_COLUMNS.includes(active.id as string)) return
    if (FIXED_COLUMNS.includes(over.id as string)) return

    const newOrder = arrayMove(allIds, oldIdx, newIdx)
    onColumnOrderChange(newOrder)
  }

  return (
    <div className="rounded-md border overflow-hidden bg-card">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <table
          className={`w-full text-sm density-${density}`}
          data-testid="payable-table"
          data-density={density}
        >
          <thead>
            {table.getHeaderGroups().map((group) => (
              <SortableContext
                key={group.id}
                items={draggableHeaders}
                strategy={horizontalListSortingStrategy}
              >
                <tr className="border-b bg-muted/30">
                  <th className="w-1" aria-hidden="true" />
                  {group.headers.map((h) =>
                    FIXED_COLUMNS.includes(h.column.id) || disableDrag ? (
                      <FixedHeaderCell key={h.id} header={h} />
                    ) : (
                      <DraggableHeaderCell key={h.id} header={h} />
                    ),
                  )}
                </tr>
              </SortableContext>
            ))}
          </thead>
        <tbody>
          {table.getRowModel().rows.map((row, i) => {
            const visual = payableVisualStatus({
              status: row.original.status,
              dueDate: row.original.dueDate,
              paymentDate: row.original.paymentDate,
            })
            const stripeColor = PAYABLE_STATUS_COLOR[visual].stripe
            return (
              <tr
                key={row.id}
                className={`group border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                  row.getIsSelected() ? 'bg-primary/5' : ''
                } ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                onClick={() => onRowClick?.(row.original)}
                data-testid={`payable-row-${row.original.id}`}
              >
                {/* Tarja lateral */}
                <td className={`w-1 p-0 ${stripeColor}`} aria-hidden="true" />
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </DndContext>
    </div>
  )
}

// ─── Sprint 5.0.3.0d (d1) — Header cells ───────────────────────────────

interface HeaderCellProps {
  header: Header<PayableRow, unknown>
}

/** Header cell FIXO (não-draggable) — Status/Valor/Ações/Select. */
function FixedHeaderCell({ header }: HeaderCellProps) {
  const canSort = header.column.getCanSort()
  return (
    <th
      className="text-left px-3 py-2 text-xs uppercase tracking-wide font-medium text-muted-foreground"
      style={{ width: header.column.columnDef.size }}
    >
      {canSort ? (
        <button
          type="button"
          onClick={header.column.getToggleSortingHandler()}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          <ArrowUpDown
            className={`h-3 w-3 transition-opacity ${
              header.column.getIsSorted()
                ? 'opacity-100 text-primary'
                : 'opacity-40'
            }`}
          />
        </button>
      ) : (
        flexRender(header.column.columnDef.header, header.getContext())
      )}
    </th>
  )
}

/** Header cell DRAGGABLE — coluna pode ser reordenada via @dnd-kit. */
function DraggableHeaderCell({ header }: HeaderCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: header.column.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : undefined,
    width: header.column.columnDef.size,
    position: 'relative',
  }

  const canSort = header.column.getCanSort()

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="text-left px-3 py-2 text-xs uppercase tracking-wide font-medium text-muted-foreground group/header"
      data-testid={`th-${header.column.id}`}
    >
      <div className="flex items-center gap-1">
        {/* Drag handle aparece no hover do header */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab active:cursor-grabbing -ml-1 p-0.5 text-muted-foreground/60 hover:text-foreground"
          aria-label={`Mover coluna ${header.column.id}`}
          data-testid={`drag-handle-${header.column.id}`}
          tabIndex={0}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {canSort ? (
          <button
            type="button"
            onClick={header.column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors flex-1"
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            <ArrowUpDown
              className={`h-3 w-3 transition-opacity ${
                header.column.getIsSorted()
                  ? 'opacity-100 text-primary'
                  : 'opacity-40'
              }`}
            />
          </button>
        ) : (
          <span className="flex-1">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        )}
      </div>
    </th>
  )
}
