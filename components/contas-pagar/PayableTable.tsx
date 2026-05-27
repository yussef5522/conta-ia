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

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  onEfetivar?: (row: PayableRow) => void
  selection: RowSelectionState
  onSelectionChange: (s: RowSelectionState) => void
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
  selection,
  onSelectionChange,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'dueDate', desc: false },
  ])

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
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatDate(row.original.dueDate)}
        </span>
      ),
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
      cell: ({ row }) => (
        <span className="max-w-[250px] truncate inline-block text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Categoria',
      accessorFn: (row) => row.category?.name ?? '',
      cell: ({ row }) =>
        row.original.category ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: row.original.category.color }}
            />
            {row.original.category.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'amount',
      header: () => <span className="block text-right">Valor</span>,
      accessorKey: 'amount',
      cell: ({ row }) => (
        <span className="block text-right tabular-nums font-medium text-red-600">
          − R$ {formatBRL(row.original.amount)}
        </span>
      ),
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
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Ações"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {visual !== 'paid' && onEfetivar && (
                  <DropdownMenuItem
                    onSelect={() => onEfetivar(row.original)}
                  >
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Efetivar pagamento
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => onRowClick?.(row.original)}>
                  Ver detalhes
                </DropdownMenuItem>
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
    state: { sorting, rowSelection: selection },
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

  return (
    <div className="rounded-md border overflow-hidden bg-card">
      <table
        className="w-full text-sm"
        data-testid="payable-table"
      >
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} className="border-b bg-muted/30">
              <th className="w-1" aria-hidden="true" />
              {group.headers.map((h) => {
                const canSort = h.column.getCanSort()
                return (
                  <th
                    key={h.id}
                    className="text-left px-3 py-2 text-xs uppercase tracking-wide font-medium text-muted-foreground"
                    style={{ width: h.column.columnDef.size }}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown
                          className={`h-3 w-3 transition-opacity ${
                            h.column.getIsSorted()
                              ? 'opacity-100 text-primary'
                              : 'opacity-40'
                          }`}
                        />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
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
    </div>
  )
}
