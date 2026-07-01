'use client'

// Sprint A-effected Fase B.4.2 — UI dos ajustes no Find & Match.
//
// 3 sub-componentes:
//   - AdjustmentMenu: dropdown adaptativo (Juros/Tarifa quando Diff>0,
//                     Desconto quando Diff<0, Arredondamento se |Diff|<=1)
//   - AdjustmentForm: form inline 3 campos (categoria + descrição + valor)
//   - EnsureAdjustmentCategoriesModal: modal opcional "criar as 4?"
//
// Decisões Yussef aplicadas:
//   - Cap 3 ajustes (#6)
//   - Categoria obrigatória (#6 herdada do CRIAR)
//   - Descrição auto "Juros — [supplier]" (#5)
//   - Valor pré-fill com Diff (#proposta)
//   - 4 categorias defaults (#3)
//   - Threshold rounding R$ 1,00 (#2)

import { useEffect, useState } from 'react'
import { Plus, Loader2, AlertCircle, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import {
  ADJUSTMENT_CATEGORY_TEMPLATES,
  applicableTemplates,
  suggestCategoryKeyForDiff,
  type AdjustmentCategoryKey,
  type AdjustmentCategoryTemplate,
} from '@/lib/conciliacao/adjustment-categories'

// ============================================================================
// Tipos compartilhados com FindAndMatchPanel
// ============================================================================

export interface PendingAdjustment {
  // identificador local pro state (não é id do banco — só pra remover)
  localId: string
  categoryId: string
  categoryName: string
  amount: number
  sign: 'EXPENSE' | 'INCOME'
  description: string
}

export interface AdjustmentCategoryStatus {
  key: AdjustmentCategoryKey
  template: AdjustmentCategoryTemplate
  exists: boolean
  existingId: string | null
  existingName: string | null
}

interface CompanyCategory {
  id: string
  name: string
  type: string
  color: string | null
  dreGroup?: string | null
}

// ============================================================================
// AdjustmentMenu — dropdown que aparece quando há diff != 0
// ============================================================================

interface AdjustmentMenuProps {
  diff: number
  empresaId: string
  categoriesStatus: AdjustmentCategoryStatus[]
  disabled?: boolean
  onPickTemplate: (template: AdjustmentCategoryTemplate, existingId: string) => void
  onPickOther: () => void
  onNeedCreate: () => void
}

export function AdjustmentMenu({
  diff,
  categoriesStatus,
  disabled,
  onPickTemplate,
  onPickOther,
  onNeedCreate,
}: AdjustmentMenuProps) {
  const applicable = applicableTemplates(diff, 1.0)
  const suggestedKey = suggestCategoryKeyForDiff(diff, 1.0)

  // Verifica se há templates aplicáveis que ainda NÃO foram criados
  const missingCount = applicable.filter((tpl) => {
    const st = categoriesStatus.find((c) => c.key === tpl.key)
    return !st?.exists
  }).length

  if (Math.abs(diff) < 0.01) return null // sem diff = nada a ajustar

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className="text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ajustar diff ({formatBRL(Math.abs(diff))})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {missingCount > 0 && (
          <>
            <DropdownMenuItem onSelect={onNeedCreate}>
              <Sparkles className="h-3.5 w-3.5 mr-2 text-amber-500" />
              <span className="text-xs">
                Criar {missingCount} categoria
                {missingCount > 1 ? 's' : ''} de ajuste necessária
                {missingCount > 1 ? 's' : ''}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {applicable.map((tpl) => {
          const st = categoriesStatus.find((c) => c.key === tpl.key)
          const isSuggested = tpl.key === suggestedKey
          if (!st?.exists) {
            return (
              <DropdownMenuItem key={tpl.key} disabled className="opacity-50">
                <span className="text-xs">
                  {tpl.name} (categoria não criada)
                </span>
              </DropdownMenuItem>
            )
          }
          return (
            <DropdownMenuItem
              key={tpl.key}
              onSelect={() => onPickTemplate(tpl, st.existingId!)}
            >
              <span className="text-xs flex-1">{tpl.name}</span>
              {isSuggested && (
                <span className="text-[10px] text-emerald-600 ml-2">sugerido</span>
              )}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onPickOther}>
          <span className="text-xs">+ Outro ajuste (escolher categoria…)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ============================================================================
// AdjustmentForm — form inline (categoria + descrição + valor)
// ============================================================================

interface AdjustmentFormProps {
  empresaId: string
  preset: {
    categoryId: string
    categoryName: string
    sign: 'EXPENSE' | 'INCOME'
    description: string
    amount: number
  } | null // null = modo "Outro ajuste" (sem preset, user escolhe categoria)
  onSave: (adj: Omit<PendingAdjustment, 'localId'>) => void
  onCancel: () => void
  diff: number // pra alertar se valor digitado for "muito maior" que diff
}

export function AdjustmentForm({
  empresaId,
  preset,
  onSave,
  onCancel,
  diff,
}: AdjustmentFormProps) {
  const { toast } = useToast()
  const [allCategories, setAllCategories] = useState<CompanyCategory[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [categoryId, setCategoryId] = useState(preset?.categoryId ?? '')
  const [description, setDescription] = useState(preset?.description ?? '')
  const [amountStr, setAmountStr] = useState(
    preset ? preset.amount.toFixed(2) : Math.abs(diff).toFixed(2),
  )

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/categorias?soAtivas=true`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.categorias) {
          setAllCategories(d.categorias as CompanyCategory[])
        }
      })
      .finally(() => setLoadingCats(false))
  }, [empresaId])

  // Sign deduzido pela categoria selecionada
  const selectedCat = allCategories.find((c) => c.id === categoryId)
  const sign: 'EXPENSE' | 'INCOME' =
    preset?.sign ??
    (selectedCat?.type === 'INCOME' ? 'INCOME' : 'EXPENSE')

  function handleSave() {
    const amount = parseFloat(amountStr.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Valor inválido',
        description: 'Digite um valor positivo.',
      })
      return
    }
    if (!categoryId) {
      toast({
        variant: 'destructive',
        title: 'Categoria obrigatória',
      })
      return
    }
    if (!description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descrição obrigatória',
      })
      return
    }
    onSave({
      categoryId,
      categoryName: selectedCat?.name ?? preset?.categoryName ?? 'Categoria',
      amount,
      sign,
      description: description.trim(),
    })
  }

  // Sanity check visual: ajuste muito maior que Diff é suspeito
  const amount = parseFloat(amountStr.replace(',', '.')) || 0
  const ratio = Math.abs(diff) > 0 ? amount / Math.abs(diff) : 0
  const showWarning = ratio > 10

  // Lista de categorias filtrada pelo sign quando preset existe
  const filteredCategories = preset
    ? allCategories.filter((c) =>
        preset.sign === 'INCOME' ? c.type === 'INCOME' : c.type === 'EXPENSE',
      )
    : allCategories

  return (
    <div className="rounded border border-blue-200 bg-blue-50/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-900">
          + Novo ajuste {preset && `· ${preset.categoryName}`}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Categoria (sem preset) ou só leitura (com preset) */}
      {!preset && (
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Categoria *
          </label>
          {loadingCats ? (
            <p className="text-xs text-muted-foreground py-1">Carregando…</p>
          ) : (
            <CategoryCombobox
              value={categoryId || null}
              categorias={filteredCategories.map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color,
                type: c.type,
                dreGroup: c.dreGroup ?? null,
              }))}
              onChange={(v) => setCategoryId(v ?? '')}
              placeholder="Selecione…"
              allowClear={false}
              className="h-8 w-full justify-between border-input text-sm"
              ariaLabel="Categoria do ajuste"
            />
          )}
        </div>
      )}

      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
          Descrição *
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-8 text-sm"
          maxLength={200}
        />
      </div>

      <div>
        <label className="text-[10px] uppercase font-semibold text-muted-foreground">
          Valor {sign === 'INCOME' ? '(receita)' : '(despesa)'} *
        </label>
        <Input
          value={amountStr}
          onChange={(e) =>
            setAmountStr(e.target.value.replace(/[^\d,.-]/g, ''))
          }
          inputMode="decimal"
          className="h-8 text-sm tabular-nums"
        />
        {showWarning && (
          <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Valor {ratio.toFixed(0)}× maior que a diferença ({formatBRL(Math.abs(diff))}).
            Verifique se é mesmo este ajuste.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!categoryId || !description.trim() || amount <= 0}
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
        >
          Salvar ajuste
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// EnsureAdjustmentCategoriesModal — "Vamos criar as 4 categorias?"
// ============================================================================

interface EnsureModalProps {
  empresaId: string
  status: AdjustmentCategoryStatus[]
  onCreated: () => void
  onClose: () => void
}

export function EnsureAdjustmentCategoriesModal({
  empresaId,
  status,
  onCreated,
  onClose,
}: EnsureModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const missing = status.filter((s) => !s.exists)

  async function create() {
    setSubmitting(true)
    try {
      const res = await fetch(
        '/api/conciliacao/adjustment-categories/create-defaults',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresaId,
            keys: missing.map((s) => s.key),
          }),
        },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const createdN = body.result.filter(
        (r: { status: string }) => r.status === 'created',
      ).length
      toast({
        title: `${createdN} categoria${createdN === 1 ? '' : 's'} criada${createdN === 1 ? '' : 's'}`,
        description: 'Pronto pra ajustar conciliações.',
      })
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar categorias de ajuste</DialogTitle>
          <DialogDescription>
            Vamos criar as {missing.length} categoria{missing.length > 1 ? 's' : ''} faltante
            {missing.length > 1 ? 's' : ''} pra você poder ajustar conciliações com juros,
            descontos e arredondamentos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 my-3">
          {missing.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-3 text-sm border rounded p-2"
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: s.template.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.template.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.template.description}
                </p>
              </div>
              <span className="text-[10px] uppercase text-muted-foreground">
                {s.template.type === 'INCOME' ? 'Receita' : 'Despesa'}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Agora não
          </Button>
          <Button onClick={create} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Criando…
              </>
            ) : (
              `Criar ${missing.length} categoria${missing.length > 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Helper: descrição auto-gerada
// ============================================================================

export function buildAdjustmentDescription(
  template: AdjustmentCategoryTemplate,
  ofxDescription: string,
): string {
  // "Juros — [supplier]" genérico (decisão Yussef #5).
  // Extrai 1ª parte da OFX antes de " - " (típico "FORNECEDOR X - Pagamento")
  const supplier = ofxDescription.split(' - ')[0].trim().slice(0, 60)
  const prefix =
    template.key === 'JUROS_MULTAS_BANCARIAS'
      ? 'Juros'
      : template.key === 'TARIFAS_BANCARIAS'
        ? 'Tarifa'
        : template.key === 'DESCONTOS_OBTIDOS'
          ? 'Desconto'
          : 'Arredondamento'
  return `${prefix} — ${supplier}`
}
