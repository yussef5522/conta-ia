'use client'

// Sprint 4.0.5.a — WorkspaceSwitcher (estilo Linear/Vercel).
// Dropdown com search, lista de empresas, criar nova, gerenciar.

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Check, ChevronsUpDown, Plus, Search, Settings } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useEmpresa } from '@/lib/contexts/empresa-context'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { currentEmpresa, currentEmpresaId, empresas, setCurrentEmpresa, loading } = useEmpresa()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return empresas
    return empresas.filter((e) =>
      `${e.tradeName ?? ''} ${e.name}`.toLowerCase().includes(term),
    )
  }, [empresas, q])

  function selectEmpresa(id: string) {
    setCurrentEmpresa(id)
    setOpen(false)
    setQ('')
  }

  const label = currentEmpresa
    ? currentEmpresa.tradeName ?? currentEmpresa.name
    : loading
      ? 'Carregando…'
      : empresas.length === 0
        ? 'Sem empresas'
        : 'Selecionar empresa'

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-zinc-100 text-sm font-medium text-zinc-900 transition-colors min-w-0 max-w-[260px]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
            {currentEmpresa ? initials(currentEmpresa.tradeName ?? currentEmpresa.name) : 'CA'}
          </span>
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px] p-0">
        {/* Search */}
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar empresa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-8 pl-7 pr-2 text-sm rounded-md bg-zinc-50 border-0 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="max-h-[280px] overflow-y-auto py-1">
          {currentEmpresa && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                Atual
              </p>
              <EmpresaRow
                empresa={currentEmpresa}
                isCurrent
                onSelect={() => selectEmpresa(currentEmpresa.id)}
                onEdit={() => {
                  setOpen(false)
                  router.push(`/empresas/${currentEmpresa.id}/editar`)
                }}
              />
              <DropdownMenuSeparator />
            </>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">
              {q ? 'Nenhuma empresa encontrada' : 'Sem outras empresas'}
            </div>
          ) : (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                {currentEmpresa ? 'Outras empresas' : 'Empresas'} ({filtered.length})
              </p>
              {filtered
                .filter((e) => e.id !== currentEmpresaId)
                .map((e) => (
                  <EmpresaRow
                    key={e.id}
                    empresa={e}
                    onSelect={() => selectEmpresa(e.id)}
                  />
                ))}
            </>
          )}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => router.push('/empresas/nova')}
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar nova empresa
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => router.push('/empresas')}
        >
          <Settings className="mr-2 h-4 w-4" />
          Gerenciar empresas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmpresaRow({
  empresa,
  isCurrent,
  onSelect,
  onEdit,
}: {
  empresa: { id: string; name: string; tradeName: string | null }
  isCurrent?: boolean
  onSelect: () => void
  onEdit?: () => void
}) {
  const label = empresa.tradeName ?? empresa.name
  return (
    <div className="flex items-center gap-2 px-2 mx-1 rounded hover:bg-zinc-100 transition-colors group">
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-2 flex-1 min-w-0 py-1.5 text-left"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-200 text-zinc-700 text-[10px] font-semibold shrink-0">
          {initials(label)}
        </span>
        <span className="truncate text-sm text-zinc-900">{label}</span>
        {isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-500 hover:text-zinc-900 px-1.5 py-1"
        >
          Editar
        </button>
      )}
    </div>
  )
}
