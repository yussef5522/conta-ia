'use client'

// Sprint Categorias-PF-Nav (07/06/2026) — Modal limpo pra criar categoria
// PF. Reusado em 2 telas:
//   - /perfis/[id]/categorias (tela de gerenciar plano de contas pessoal)
//   - /perfis/[id]/transacoes (lançar despesa — opção "+ criar nova" no dropdown)
//
// Pré-seleção do `defaultType` permite o lançar despesa abrir já em "Despesa".
// onCreated recebe a categoria criada pra caller usar (auto-select no dropdown,
// insert otimista na lista, etc).

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface PersonalCategoryCreated {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color: string | null
  icon: string | null
  isDefault: boolean
  isActive: boolean
}

// Cores preset (escolhidas pra contraste em texto e seções).
const PRESET_COLORS = [
  '#10b981', // emerald (default income)
  '#ef4444', // red (default expense)
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
]

interface Props {
  open: boolean
  profileId: string
  /** Tipo pré-selecionado ao abrir. /transacoes lançando despesa abre em EXPENSE. */
  defaultType?: 'INCOME' | 'EXPENSE'
  onClose: () => void
  /** Disparado APÓS POST bem-sucedido. Caller decide o que fazer (insert
   *  otimista na lista, auto-select no dropdown, etc). Modal fecha sozinho. */
  onCreated: (cat: PersonalCategoryCreated) => void
}

export function NovaCategoriaPFModal({
  open,
  profileId,
  defaultType = 'EXPENSE',
  onClose,
  onCreated,
}: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(defaultType)
  const [color, setColor] = useState(
    defaultType === 'INCOME' ? PRESET_COLORS[0] : PRESET_COLORS[1],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setName('')
      setType(defaultType)
      setColor(defaultType === 'INCOME' ? PRESET_COLORS[0] : PRESET_COLORS[1])
      setError(null)
      setSubmitting(false)
    }
  }, [open, defaultType])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError('Nome obrigatório')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch(`/api/perfis/${profileId}/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, type, color }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        // Dedup volta como 409. Mensagem amigável já vem do server.
        setError(d.erro ?? `Falha ao criar (HTTP ${r.status})`)
        return
      }
      const data = await r.json()
      const created = data.category as PersonalCategoryCreated
      onCreated(created)
      onClose()
    } catch {
      setError('Sem conexão. Tenta de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-emerald-600" />
            Nova categoria
          </DialogTitle>
          <DialogDescription>
            Crie uma categoria pessoal pra organizar suas entradas e despesas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-pf-name">Nome *</Label>
            <Input
              id="cat-pf-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder='Ex: "Nora", "Pet", "Streaming"'
              data-testid="cat-pf-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('EXPENSE')
                  if (PRESET_COLORS.includes(color) === false) return
                  // Se cor é preset default do tipo antigo, troca pro novo default
                  setColor(PRESET_COLORS[1])
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  type === 'EXPENSE'
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                💸 Despesa
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('INCOME')
                  if (PRESET_COLORS.includes(color) === false) return
                  setColor(PRESET_COLORS[0])
                }}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  type === 'INCOME'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                }`}
              >
                💰 Receita
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="ml-1 h-7 w-12 cursor-pointer rounded p-0"
                aria-label="Cor personalizada"
              />
            </div>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30"
              data-testid="cat-pf-error"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-amber-900 dark:text-amber-100">{error}</p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || name.trim().length === 0}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              data-testid="cat-pf-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Criando…
                </>
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Criar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
