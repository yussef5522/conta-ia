'use client'

// Sprint 3.0.3 B1 — edição inline da categoria de uma transação.
// Click na badge → abre dropdown shadcn → PATCH /api/transacoes/[id]
// → toast + atualiza estado local sem recarregar a página.

import { useState } from 'react'
import { ChevronDown, Loader2, Tag } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

export interface InlineCategorySelectCategoria {
  id: string
  name: string
  color: string | null
}

interface Props {
  transacaoId: string
  current: { id: string; name: string; color: string | null } | null
  categorias: InlineCategorySelectCategoria[]
  // Callback após PATCH OK — caller atualiza array de transações local
  onUpdated: (catId: string | null, cat: InlineCategorySelectCategoria | null) => void
}

const NO_CATEGORY = '__NONE__'

export function InlineCategorySelect({
  transacaoId,
  current,
  categorias,
  onUpdated,
}: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleChange(value: string) {
    const novoId = value === NO_CATEGORY ? null : value
    if (novoId === (current?.id ?? null)) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/transacoes/${transacaoId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: novoId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao mudar categoria',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const data = await res.json().catch(() => ({}))
      const novaCat = novoId
        ? categorias.find((c) => c.id === novoId) ?? null
        : null
      onUpdated(novoId, novaCat)

      // Sprint 5.0.2.m — Vendor Memory: backend pode ter aprendido fornecedor
      // e aplicado retroativamente em outras pendentes. Mostra count no toast.
      const vm: { anchor: string | null; retroactiveCount: number } | undefined =
        data?.vendorMemory
      let description = novaCat?.name ?? 'Sem categoria'
      if (vm?.anchor && vm.retroactiveCount > 0) {
        description = `+${vm.retroactiveCount} ${vm.anchor} categorizadas automaticamente`
      } else if (vm?.anchor) {
        description = `Próximas "${vm.anchor}" serão automáticas · ${novaCat?.name ?? ''}`
      }

      toast({
        title: 'Categoria atualizada',
        description,
        duration: vm?.anchor ? 4500 : 2500,
      })
      setOpen(false)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Falha ao salvar — tente de novo.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select
      value={current?.id ?? NO_CATEGORY}
      onValueChange={handleChange}
      open={open}
      onOpenChange={setOpen}
      disabled={saving}
    >
      <SelectTrigger
        className="h-6 px-2 py-0 text-xs gap-1 bg-transparent border-dashed border-transparent hover:border-border hover:bg-muted/40 w-auto min-w-[140px] max-w-[260px]"
        onClick={(e) => e.stopPropagation()}
        aria-label="Mudar categoria"
      >
        <SelectValue>
          <span className="inline-flex items-center gap-1.5 text-xs">
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : current?.color ? (
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: current.color }}
              />
            ) : (
              <Tag className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="truncate text-muted-foreground">
              {current?.name ?? 'Sem categoria'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="max-h-[60vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectItem value={NO_CATEGORY}>
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
  )
}
