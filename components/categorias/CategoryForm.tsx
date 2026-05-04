'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Loader2,
  X,
  Pencil,
  Trash2,
  Power,
  PauseCircle,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { sugerir, type CategoryType } from '@/lib/categories/sugerir'
import {
  canHardDelete,
  getHardDeleteDisabledReason,
} from '@/lib/categories/delete-rules'
import {
  DRE_COLOR_BG,
  getDreColorClass,
  getDreLabel,
} from '@/lib/categories/dre-colors'
import { formatBRL } from '@/lib/format/money'
import type { CategoryNode } from '@/lib/categories/buildTree'

export type FormMode = 'view' | 'create' | 'edit'

interface Estatisticas {
  transactionCount: number
  totalAmount12m: number
  lastUsedAt: string | null
}

interface Props {
  empresaId: string
  mode: FormMode
  selected: CategoryNode | null
  // Lista achatada de candidatas a parent (excluindo self e descendentes em modo edit).
  parentCandidates: CategoryNode[]
  onModeChange: (mode: FormMode) => void
  onSaved: () => void
  onDeactivated: () => void
}

const TYPE_OPTIONS: { value: CategoryType; label: string; color: string }[] = [
  { value: 'INCOME', label: 'Receita', color: 'border-emerald-500 text-emerald-700' },
  { value: 'EXPENSE', label: 'Despesa', color: 'border-orange-500 text-orange-700' },
  { value: 'TRANSFER', label: 'Transferência', color: 'border-slate-500 text-slate-700' },
]

const TYPE_LABEL: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  TRANSFER: 'Transferência',
}

const TYPE_BADGE_VARIANT: Record<string, 'success' | 'destructive' | 'secondary'> = {
  INCOME: 'success',
  EXPENSE: 'destructive',
  TRANSFER: 'secondary',
}

const REGIMES = [
  { value: 'SIMPLES_NACIONAL_I', label: 'Simples I' },
  { value: 'SIMPLES_NACIONAL_II', label: 'Simples II' },
  { value: 'SIMPLES_NACIONAL_III', label: 'Simples III' },
  { value: 'SIMPLES_NACIONAL_IV', label: 'Simples IV' },
  { value: 'SIMPLES_NACIONAL_V', label: 'Simples V' },
  { value: 'MEI', label: 'MEI' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
] as const

const TODOS_REGIMES = REGIMES.map((r) => r.value) as string[]

const DRE_GROUPS_OPTIONS = Object.keys(DRE_COLOR_BG)

const CURATED_ICONS = [
  'home', 'users', 'calendar', 'megaphone', 'file-text',
  'zap', 'dollar-sign', 'briefcase', 'package', 'truck',
  'smartphone', 'wrench',
]

const CURATED_COLORS = [
  '#10b981', '#86efac', '#bbf7d0',
  '#ef4444', '#dc2626',
  '#f97316', '#fb923c', '#fdba74',
  '#3b82f6',
  '#7c3aed', '#c084fc',
  '#f59e0b', '#94a3b8',
]

interface FormState {
  nome: string
  tipo: CategoryType
  ehSubcategoria: boolean
  parentId: string | null
  dreGroup: string | null
  code: string | null
  description: string | null
  color: string
  icon: string | null
  visibleInRegimes: string[]
}

function parseRegimes(json: string | null | undefined): string[] {
  if (!json) return TODOS_REGIMES
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : TODOS_REGIMES
  } catch {
    return TODOS_REGIMES
  }
}

function emptyState(): FormState {
  return {
    nome: '',
    tipo: 'EXPENSE',
    ehSubcategoria: false,
    parentId: null,
    dreGroup: null,
    code: null,
    description: null,
    color: '#fb923c',
    icon: 'file-text',
    visibleInRegimes: TODOS_REGIMES,
  }
}

function fromNode(n: CategoryNode): FormState {
  return {
    nome: n.name,
    tipo: n.type as CategoryType,
    ehSubcategoria: n.parentId !== null,
    parentId: n.parentId,
    dreGroup: n.dreGroup,
    code: n.code,
    description: n.description,
    color: n.color,
    icon: n.icon,
    visibleInRegimes: parseRegimes(n.visibleInRegimes),
  }
}

export function CategoryForm({
  empresaId,
  mode,
  selected,
  parentCandidates,
  onModeChange,
  onSaved,
  onDeactivated,
}: Props) {
  const { toast } = useToast()
  const [stats, setStats] = useState<Estatisticas | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [erroStats, setErroStats] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(emptyState)
  const [autoFields, setAutoFields] = useState<Set<keyof FormState>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [confirmDesativar, setConfirmDesativar] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const nomeInputRef = useRef<HTMLInputElement | null>(null)
  const successFlash = useRef<HTMLDivElement | null>(null)

  // Carrega estatísticas em modo view
  useEffect(() => {
    setStats(null)
    setErroStats(null)
    if (mode !== 'view' || !selected) return

    let cancelado = false
    async function carregar() {
      try {
        setLoadingStats(true)
        const res = await fetch(`/api/empresas/${empresaId}/categorias/${selected!.id}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.erro ?? 'Erro ao carregar estatísticas')
        }
        const data = await res.json()
        if (!cancelado) setStats(data.estatisticas ?? null)
      } catch (e) {
        if (!cancelado) setErroStats(e instanceof Error ? e.message : 'Erro inesperado')
      } finally {
        if (!cancelado) setLoadingStats(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [empresaId, selected?.id, mode])

  // Sincroniza form com selected (quando entra em modo edit ou troca seleção)
  useEffect(() => {
    if (mode === 'create') {
      setForm(emptyState())
      setAutoFields(new Set())
      setErros({})
    } else if (mode === 'edit' && selected) {
      setForm(fromNode(selected))
      setAutoFields(new Set())
      setErros({})
    }
  }, [mode, selected?.id])

  // Auto-foco no nome em modo create/edit
  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      // Pequeno delay pra esperar o dialog abrir
      const t = setTimeout(() => nomeInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [mode])

  // Auto-sugestão (debounce 300ms) baseada em nome + tipo
  const debouncedNome = useDebounce(form.nome, 300)
  useEffect(() => {
    if (mode !== 'create' && mode !== 'edit') return
    if (!debouncedNome.trim()) {
      // Limpa flag mas não muda valores
      setAutoFields(new Set())
      return
    }
    const sug = sugerir({ nome: debouncedNome, tipo: form.tipo })

    setForm((prev) => {
      const novo = { ...prev }
      const novosAuto = new Set<keyof FormState>()
      // Só preenche se está vazio OU foi auto-preenchido antes
      if (prev.dreGroup === null || autoFields.has('dreGroup')) {
        novo.dreGroup = sug.dreGroup
        novosAuto.add('dreGroup')
      }
      if (autoFields.has('color') || prev.color === '#fb923c' /* default expense */) {
        // mapeia bg-* para hex via DRE_COLOR_BG fallback
        const hex = colorClassToHex(sug.color)
        if (hex) {
          novo.color = hex
          novosAuto.add('color')
        }
      }
      if (autoFields.has('icon') || !prev.icon || prev.icon === 'file-text') {
        novo.icon = sug.icon
        novosAuto.add('icon')
      }
      setAutoFields(novosAuto)
      return novo
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNome, form.tipo])

  // Atalhos: Esc cancela, Cmd/Ctrl+Enter salva
  useEffect(() => {
    if (mode !== 'create' && mode !== 'edit') return
    const onKey = (e: KeyboardEvent) => {
      // Não captura se está dentro de outro dialog (heurística: data-state=open em [role=dialog] que não é o nosso)
      if (e.key === 'Escape') {
        e.preventDefault()
        onModeChange('view')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, form])

  const isSystemDefault = !!selected?.isSystemDefault
  const txCount = stats?.transactionCount ?? selected?.transactionCount ?? 0
  const tipoBloqueado = mode === 'edit' && txCount > 0
  const camposCriticosBloqueados = mode === 'edit' && isSystemDefault

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    // Remove flag de auto se user editou
    setAutoFields((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    // Limpa erro do campo
    setErros((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }

  function validar(): Record<string, string> {
    const novos: Record<string, string> = {}
    if (!form.nome.trim()) novos.nome = 'Nome é obrigatório'
    if (form.nome.trim().length > 80) novos.nome = 'Nome deve ter no máximo 80 caracteres'
    if (!form.dreGroup) novos.dreGroup = 'Grupo do DRE é obrigatório'
    if (form.ehSubcategoria && !form.parentId) {
      novos.parentId = 'Selecione a categoria pai'
    }
    if (form.code && form.code.length > 20) novos.code = 'Código deve ter no máximo 20 caracteres'
    if (form.description && form.description.length > 200) {
      novos.description = 'Descrição deve ter no máximo 200 caracteres'
    }
    if (form.visibleInRegimes.length === 0) {
      novos.visibleInRegimes = 'Selecione pelo menos um regime'
    }
    if (!form.color || !/^#[0-9a-fA-F]{6}$/.test(form.color)) {
      novos.color = 'Cor deve ser hex válido'
    }
    return novos
  }

  async function handleSubmit() {
    const v = validar()
    if (Object.keys(v).length > 0) {
      setErros(v)
      return
    }

    setSalvando(true)
    try {
      const payload = {
        name: form.nome.trim(),
        type: form.tipo,
        parentId: form.ehSubcategoria ? form.parentId : null,
        dreGroup: form.dreGroup,
        code: form.code?.trim() || null,
        description: form.description?.trim() || null,
        color: form.color,
        icon: form.icon,
        visibleInRegimes:
          form.visibleInRegimes.length === TODOS_REGIMES.length
            ? null
            : form.visibleInRegimes,
      }

      let res: Response
      if (mode === 'create') {
        res = await fetch(`/api/empresas/${empresaId}/categorias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/empresas/${empresaId}/categorias/${selected!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.campos) {
          setErros(data.campos)
        } else {
          toast({
            variant: 'destructive',
            title: 'Erro ao salvar',
            description: data.erro ?? 'Tente novamente.',
          })
        }
        return
      }

      toast({
        variant: 'success',
        title: mode === 'create' ? 'Categoria criada' : 'Categoria atualizada',
      })
      onSaved()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: e instanceof Error ? e.message : 'Tente novamente.',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function handleDesativar() {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/categorias/${selected!.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Erro ao desativar',
          description: data.erro ?? 'Tente novamente.',
        })
        return
      }
      toast({ variant: 'destructive', title: 'Categoria desativada' })
      onDeactivated()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: e instanceof Error ? e.message : 'Tente novamente.',
      })
    }
  }

  async function handleExcluirPermanente() {
    if (!selected) return
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/categorias/${selected.id}?hard=true`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
          description: data.erro ?? 'Tente novamente.',
        })
        // Mantém modal aberto pra user ler. ConfirmDialog não fecha em rejection.
        throw new Error(data.erro ?? 'Erro')
      }
      toast({ variant: 'destructive', title: 'Categoria excluída permanentemente' })
      onDeactivated()
    } catch (e) {
      // Re-throw pra ConfirmDialog não fechar
      throw e
    }
  }

  async function handleReativar() {
    if (!selected) return
    try {
      const res = await fetch(`/api/empresas/${empresaId}/categorias/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Erro ao reativar',
          description: data.erro ?? 'Tente novamente.',
        })
        return
      }
      toast({ variant: 'success', title: 'Categoria reativada' })
      onSaved()
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: e instanceof Error ? e.message : 'Tente novamente.',
      })
    }
  }

  // ============================================================
  // MODE: VIEW (read-only)
  // ============================================================
  if (mode === 'view') {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium">Selecione uma categoria à esquerda</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Os detalhes da categoria aparecem aqui. Use o botão "+ Nova Categoria" pra criar uma.
          </p>
        </div>
      )
    }

    const regimes = parseRegimes(selected.visibleInRegimes)
    const visibilidadeTodos = regimes.length === TODOS_REGIMES.length

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className={cn('shrink-0 mt-1 h-3 w-3 rounded-full', getDreColorClass(selected.dreGroup))}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{selected.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant={TYPE_BADGE_VARIANT[selected.type] ?? 'outline'} className="text-xs">
                {TYPE_LABEL[selected.type] ?? selected.type}
              </Badge>
              {selected.dreGroup && (
                <Badge variant="outline" className="text-xs gap-1.5">
                  <span
                    className={cn('inline-block h-2 w-2 rounded-full', getDreColorClass(selected.dreGroup))}
                    aria-hidden="true"
                  />
                  {getDreLabel(selected.dreGroup)}
                </Badge>
              )}
              {selected.code && (
                <Badge variant="outline" className="text-xs font-mono">
                  {selected.code}
                </Badge>
              )}
              <Badge variant={selected.isActive ? 'success' : 'destructive'} className="text-xs">
                {selected.isActive ? 'Ativa' : 'Inativa'}
              </Badge>
              {selected.isSystemDefault && (
                <Badge variant="outline" className="text-xs">
                  Padrão do sistema
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selected.isActive ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onModeChange('edit')}
                  aria-label="Editar categoria"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDesativar(true)}
                  aria-label="Desativar categoria"
                  className="text-amber-600 hover:text-amber-700"
                >
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                  Desativar
                </Button>
                {(() => {
                  const ctx = {
                    isSystemDefault: selected.isSystemDefault,
                    transactionCount: selected.transactionCount,
                    childrenCount: selected.children?.length ?? 0,
                  }
                  const podeExcluir = canHardDelete(ctx)
                  const motivoBloqueio = getHardDeleteDisabledReason(ctx)
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmExcluir(true)}
                      disabled={!podeExcluir}
                      aria-label="Excluir categoria permanentemente"
                      title={motivoBloqueio ?? 'Excluir permanentemente'}
                      className="text-red-600 hover:text-red-700 disabled:text-muted-foreground"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  )
                })()}
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReativar}
                aria-label="Reativar categoria"
                className="text-green-600 hover:text-green-700"
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Reativar
              </Button>
            )}
          </div>
        </div>

        {selected.description && (
          <Card>
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm">{selected.description}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cor</p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-5 w-5 rounded border"
                  style={{ backgroundColor: selected.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-mono">{selected.color}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ícone</p>
              <p className="text-sm font-mono">{selected.icon ?? '—'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-2">Visibilidade por regime</p>
            {visibilidadeTodos ? (
              <p className="text-sm text-muted-foreground">Visível em todos os regimes</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {regimes.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs">
                    {REGIMES.find((x) => x.value === r)?.label ?? r}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-2">Estatísticas de uso</p>
            {loadingStats ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : erroStats ? (
              <p className="text-sm text-destructive">{erroStats}</p>
            ) : stats ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Transações</p>
                  <p className="text-sm font-semibold tabular-nums">{stats.transactionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Movimentado (12m)</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatBRL(stats.totalAmount12m)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última usada</p>
                  <p className="text-sm font-semibold">
                    {stats.lastUsedAt
                      ? new Date(stats.lastUsedAt).toLocaleDateString('pt-BR')
                      : 'Nunca'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando...
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDesativarDialog
          open={confirmDesativar}
          onOpenChange={setConfirmDesativar}
          nome={selected.name}
          transactionCount={txCount}
          onConfirm={handleDesativar}
        />

        <ConfirmDialog
          open={confirmExcluir}
          onOpenChange={setConfirmExcluir}
          title={`Excluir "${selected.name}" permanentemente?`}
          description="Esta ação NÃO pode ser desfeita. A categoria será removida do banco de dados."
          confirmLabel="Sim, excluir permanentemente"
          cancelLabel="Cancelar"
          variant="destructive"
          onConfirm={handleExcluirPermanente}
        />
      </div>
    )
  }

  // ============================================================
  // MODE: CREATE / EDIT (form)
  // ============================================================
  const borderClass =
    mode === 'create'
      ? 'border-l-4 border-indigo-500'
      : 'border-l-4 border-amber-500'

  return (
    <div ref={successFlash} className={cn('rounded-md pl-3', borderClass)}>
      {/* Header form */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'Nova Categoria' : `Editando: ${selected?.name}`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> cancela ·{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Enter</kbd> salva
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onModeChange('view')}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        {/* Nome */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-nome">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={nomeInputRef}
            id="cat-nome"
            maxLength={80}
            value={form.nome}
            onChange={(e) => update('nome', e.target.value)}
            disabled={camposCriticosBloqueados}
            aria-invalid={!!erros.nome}
          />
          {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
          {camposCriticosBloqueados && (
            <p className="text-xs text-muted-foreground">
              Categoria do template padrão. Nome bloqueado pra preservar consistência do DRE.
            </p>
          )}
        </div>

        {/* Tipo (radio group) */}
        <div className="space-y-1.5">
          <Label>
            Tipo <span className="text-destructive">*</span>
          </Label>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Tipo da categoria"
          >
            {TYPE_OPTIONS.map((opt) => {
              const selected = form.tipo === opt.value
              const disabled = tipoBloqueado || camposCriticosBloqueados
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => update('tipo', opt.value)}
                  className={cn(
                    'rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors',
                    selected ? opt.color : 'border-muted text-muted-foreground hover:border-foreground/30',
                    disabled && 'opacity-50 cursor-not-allowed',
                  )}
                  title={
                    tipoBloqueado
                      ? `${txCount} transações vinculadas. Tipo não pode ser alterado.`
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {tipoBloqueado && (
            <p className="text-xs text-muted-foreground">
              {txCount} transações vinculadas. Tipo não pode ser alterado.
            </p>
          )}
        </div>

        {/* Subcategoria checkbox + parent */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ehSubcategoria}
              onChange={(e) => {
                const v = e.target.checked
                setForm((p) => ({ ...p, ehSubcategoria: v, parentId: v ? p.parentId : null }))
              }}
              disabled={camposCriticosBloqueados}
              className="rounded border-muted-foreground/30"
            />
            <span className="text-sm">É subcategoria de...</span>
          </label>
          {form.ehSubcategoria && (
            <Select
              value={form.parentId ?? ''}
              onValueChange={(v) => update('parentId', v || null)}
              disabled={camposCriticosBloqueados}
            >
              <SelectTrigger className="w-full" aria-invalid={!!erros.parentId}>
                <SelectValue placeholder="Selecione a categoria pai" />
              </SelectTrigger>
              <SelectContent>
                {parentCandidates.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhuma categoria disponível como pai.
                  </div>
                ) : (
                  parentCandidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('inline-block h-2 w-2 rounded-full', getDreColorClass(c.dreGroup))}
                          aria-hidden="true"
                        />
                        {'  '.repeat(c.depth)}
                        {c.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
          {erros.parentId && <p className="text-xs text-destructive">{erros.parentId}</p>}
        </div>

        {/* DRE Group */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-dregroup">
            Grupo do DRE <span className="text-destructive">*</span>{' '}
            {autoFields.has('dreGroup') && (
              <Badge variant="secondary" className="text-[10px] gap-1 ml-1">
                <Sparkles className="h-3 w-3" /> Sugerido
              </Badge>
            )}
          </Label>
          <Select
            value={form.dreGroup ?? ''}
            onValueChange={(v) => update('dreGroup', v)}
            disabled={camposCriticosBloqueados}
          >
            <SelectTrigger id="cat-dregroup" aria-invalid={!!erros.dreGroup}>
              <SelectValue placeholder="Selecione o grupo do DRE" />
            </SelectTrigger>
            <SelectContent>
              {DRE_GROUPS_OPTIONS.map((g) => (
                <SelectItem key={g} value={g}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('inline-block h-2.5 w-2.5 rounded-full', DRE_COLOR_BG[g])}
                      aria-hidden="true"
                    />
                    {getDreLabel(g)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erros.dreGroup && <p className="text-xs text-destructive">{erros.dreGroup}</p>}
        </div>

        {/* Separador */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-px bg-muted" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Personalização (opcional)
          </span>
          <div className="flex-1 h-px bg-muted" />
        </div>

        {/* Cor (paleta curada) */}
        <div className="space-y-1.5">
          <Label>
            Cor{' '}
            {autoFields.has('color') && (
              <Badge variant="secondary" className="text-[10px] gap-1 ml-1">
                <Sparkles className="h-3 w-3" /> Sugerida
              </Badge>
            )}
          </Label>
          <div className="flex flex-wrap gap-2">
            {CURATED_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => update('color', hex)}
                aria-label={`Cor ${hex}`}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all',
                  form.color === hex
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: hex }}
              />
            ))}
            <Input
              type="text"
              value={form.color}
              onChange={(e) => update('color', e.target.value)}
              className="h-7 w-24 text-xs font-mono"
              aria-label="Hex personalizado"
              placeholder="#abc123"
            />
          </div>
          {erros.color && <p className="text-xs text-destructive">{erros.color}</p>}
        </div>

        {/* Ícone */}
        <div className="space-y-1.5">
          <Label>
            Ícone{' '}
            {autoFields.has('icon') && (
              <Badge variant="secondary" className="text-[10px] gap-1 ml-1">
                <Sparkles className="h-3 w-3" /> Sugerido
              </Badge>
            )}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {CURATED_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => update('icon', ic)}
                aria-label={`Ícone ${ic}`}
                className={cn(
                  'rounded border px-2 py-1 text-xs font-mono transition-colors',
                  form.icon === ic
                    ? 'border-foreground bg-foreground/5'
                    : 'border-muted hover:border-foreground/30',
                )}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Código contábil */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-code">Código contábil</Label>
          <div className="flex gap-2">
            <Input
              id="cat-code"
              value={form.code ?? ''}
              onChange={(e) => update('code', e.target.value)}
              placeholder="ex: 5.1.01"
              maxLength={20}
              className="font-mono"
              aria-invalid={!!erros.code}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                // Gerador simples: prefixo do dreGroup + nº sequencial
                const prefix = codigoPrefixoDreGroup(form.dreGroup)
                const sequencial = String(
                  Math.floor(Math.random() * 99) + 1,
                ).padStart(2, '0')
                update('code', `${prefix}.${sequencial}`)
              }}
              aria-label="Gerar código contábil"
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Gerar
            </Button>
          </div>
          {erros.code && <p className="text-xs text-destructive">{erros.code}</p>}
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-desc">Descrição</Label>
          <Textarea
            id="cat-desc"
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Quando usar esta categoria..."
            maxLength={200}
            rows={2}
            aria-invalid={!!erros.description}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {form.description?.length ?? 0}/200
          </p>
          {erros.description && <p className="text-xs text-destructive">{erros.description}</p>}
        </div>

        {/* Separador avançado */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex-1 h-px bg-muted" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Avançado
          </span>
          <div className="flex-1 h-px bg-muted" />
        </div>

        {/* Visibilidade por regime */}
        <div className="space-y-1.5">
          <Label>Visibilidade por regime tributário</Label>
          <div className="flex flex-wrap gap-1.5">
            {REGIMES.map((r) => {
              const selected = form.visibleInRegimes.includes(r.value)
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setForm((p) => ({
                      ...p,
                      visibleInRegimes: selected
                        ? p.visibleInRegimes.filter((x) => x !== r.value)
                        : [...p.visibleInRegimes, r.value],
                    }))
                    setErros((prev) => {
                      const n = { ...prev }
                      delete n.visibleInRegimes
                      return n
                    })
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    selected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-muted text-muted-foreground hover:border-foreground/30',
                  )}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
          {erros.visibleInRegimes && (
            <p className="text-xs text-destructive">{erros.visibleInRegimes}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Categorias só aparecem em empresas com os regimes selecionados.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onModeChange('view')}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

function colorClassToHex(cls: string): string | null {
  const map: Record<string, string> = {
    'bg-emerald-500': '#10b981',
    'bg-emerald-300': '#86efac',
    'bg-emerald-200': '#bbf7d0',
    'bg-red-500': '#ef4444',
    'bg-red-600': '#dc2626',
    'bg-orange-500': '#f97316',
    'bg-orange-400': '#fb923c',
    'bg-orange-300': '#fdba74',
    'bg-blue-500': '#3b82f6',
    'bg-purple-700': '#7c3aed',
    'bg-purple-400': '#c084fc',
    'bg-amber-500': '#f59e0b',
    'bg-slate-400': '#94a3b8',
  }
  return map[cls] ?? null
}

function codigoPrefixoDreGroup(dreGroup: string | null): string {
  const map: Record<string, string> = {
    RECEITA_BRUTA: '1.1',
    RECEITAS_FINANCEIRAS: '1.3',
    OUTRAS_RECEITAS: '1.9',
    DEDUCOES: '2.0',
    CUSTO_PRODUTO_VENDIDO: '3.1',
    DESPESAS_PESSOAL: '4.0',
    DESPESAS_OPERACIONAIS: '5.0',
    DESPESAS_ADMINISTRATIVAS: '5.0',
    DESPESAS_COMERCIAIS: '6.0',
    DESPESAS_FINANCEIRAS: '8.0',
    IMPOSTOS_SOBRE_LUCRO: '9.1',
    DISTRIBUICAO_LUCROS: '4.9',
    INVESTIMENTOS: '9.2',
    TRANSFERENCIA: '0.0',
    OUTRAS_DESPESAS: '9.9',
  }
  return dreGroup ? (map[dreGroup] ?? '9.9') : '9.9'
}

// =============================================================================
// CONFIRM DESATIVAR DIALOG (interno ao CategoryForm)
// =============================================================================

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function ConfirmDesativarDialog({
  open,
  onOpenChange,
  nome,
  transactionCount,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  nome: string
  transactionCount: number
  onConfirm: () => Promise<void> | void
}) {
  const desc =
    transactionCount > 0
      ? `Esta categoria tem ${transactionCount} transaç${transactionCount === 1 ? 'ão' : 'ões'} vinculada${transactionCount === 1 ? '' : 's'}. Elas serão preservadas no histórico. A categoria some dos dropdowns mas os dados ficam intactos.`
      : 'Esta categoria nunca foi usada. Será desativada e poderá ser reativada depois.'

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Desativar "${nome}"?`}
      description={desc}
      confirmLabel="Sim, desativar"
      cancelLabel="Cancelar"
      variant="destructive"
      onConfirm={onConfirm}
    />
  )
}
