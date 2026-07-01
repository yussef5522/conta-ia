'use client'

// Sprint A-effected Fase B — RowActions
//
// Substitui ConfidenceList. Cada OFX pendente é uma linha com 4 tabs de
// ação inline (estilo Xero), 2 colunas explícitas dentro de CASAR pra
// comparação de valor lado a lado.
//
// Decisões Yussef aplicadas:
//   - CRIAR bloqueia sem categoria selecionada (#6)
//   - IGNORAR mostra motivos + (checkbox "não me incomodar mais" fica TODO
//     na Fase C — exige design dedicado de regra IGNORE em ai_learning_rules)
//   - Trocar candidato dentro de CASAR (placeholder Fase C — modal busca)
//   - 2 colunas valor nos 2 lados + ✓bate exato / ⚠️diff X%

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  Tag,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPJ } from '@/lib/transacoes/on-create-category'

export interface OfxLine {
  id: string
  description: string
  amount: number
  date: string
  type: string
  bankAccount: { name: string; bankName: string | null } | null
}

export interface MatchSuggestion {
  candidateId: string
  score: number
  reasoning: string[]
  candidate: {
    id: string
    description: string
    amount: number
    dueDate: string
    lifecycle: string
  }
}

interface Category {
  id: string
  name: string
  type: string
  color: string | null
  dreGroup?: string | null
}

interface Props {
  ofx: OfxLine
  empresaId: string
  suggestion: MatchSuggestion | null // null = sem candidato bom
  onAction: () => void // callback após ação aplicada (refresh)
}

type Tab = 'CASAR' | 'CRIAR' | 'TRANSFERIR' | 'IGNORAR'

const MOTIVOS = [
  { id: 'TAXA_BANCO', label: 'Taxa do banco' },
  { id: 'ESTORNO', label: 'Estorno / devolução' },
  { id: 'LANCAMENTO_ERRADO', label: 'Lançamento errado do banco' },
  { id: 'OUTRO', label: 'Outro' },
] as const

export function RowActions({ ofx, empresaId, suggestion, onAction }: Props) {
  // Tab inicial: CASAR se tem sugestão, senão CRIAR
  const [tab, setTab] = useState<Tab>(suggestion ? 'CASAR' : 'CRIAR')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  const tabsVisual = (
    <div className="flex border-b">
      {(['CASAR', 'CRIAR', 'TRANSFERIR', 'IGNORAR'] as Tab[]).map((t) => {
        const active = tab === t
        const isPrimary = !!suggestion && t === 'CASAR'
        return (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
            {isPrimary && t === 'CASAR' && (
              <span className="ml-1 text-emerald-600">★</span>
            )}
          </button>
        )
      })}
    </div>
  )

  // CASAR — usa POST /api/conciliacao/confirmar
  async function aplicarCasar() {
    if (!suggestion) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/conciliacao/confirmar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: ofx.id,
          candidateId: suggestion.candidateId,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao casar',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Conciliada', description: ofx.description })
      onAction()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border rounded-lg bg-card">
      {/* Linha do extrato sempre visível */}
      <div className="flex items-center gap-3 p-3 border-b bg-muted/20">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{ofx.description}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{fmt(ofx.date)}</span>
            {ofx.bankAccount && (
              <span>· {ofx.bankAccount.bankName ?? ofx.bankAccount.name}</span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 font-semibold text-base tabular-nums ${
            ofx.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {ofx.type === 'CREDIT' ? '+' : '−'} {formatBRL(ofx.amount)}
        </span>
      </div>

      {/* Tabs de ação */}
      {tabsVisual}

      {/* Conteúdo da tab ativa */}
      <div className="p-4 min-h-[120px]">
        {tab === 'CASAR' && (
          <CasarPanel
            ofx={ofx}
            suggestion={suggestion}
            fmt={fmt}
            onApply={aplicarCasar}
            submitting={submitting}
          />
        )}
        {tab === 'CRIAR' && (
          <CriarPanel
            ofx={ofx}
            empresaId={empresaId}
            onApplied={onAction}
          />
        )}
        {tab === 'TRANSFERIR' && <TransferirPanel ofx={ofx} />}
        {tab === 'IGNORAR' && (
          <IgnorarPanel
            ofx={ofx}
            onApplied={onAction}
          />
        )}
      </div>
    </div>
  )
}

// =============================================================================
// CASAR — 2 colunas com valores nos 2 lados + ✓bate / ⚠️diff
// =============================================================================
function CasarPanel({
  ofx,
  suggestion,
  fmt,
  onApply,
  submitting,
}: {
  ofx: OfxLine
  suggestion: MatchSuggestion | null
  fmt: (d: string) => string
  onApply: () => void
  submitting: boolean
}) {
  if (!suggestion) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
        Nenhuma conta a pagar/receber compatível foi encontrada.
        <br />
        Use <strong>CRIAR</strong> pra categorizar direto, ou{' '}
        <strong>IGNORAR</strong> se não é pra contabilizar.
      </div>
    )
  }

  const diff = Math.abs(ofx.amount - suggestion.candidate.amount)
  const diffPct = (diff / Math.abs(ofx.amount)) * 100
  const bate = diff < 0.01

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={
            suggestion.score >= 90
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]'
              : 'bg-amber-100 text-amber-700 border-amber-300 text-[10px]'
          }
        >
          Score {suggestion.score}/100
        </Badge>
        {suggestion.score >= 90 ? (
          <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
            Alta confiança
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
            Confirme manualmente
          </Badge>
        )}
        <span className="text-xs text-muted-foreground truncate">
          {suggestion.reasoning.slice(0, 3).join(' / ')}
        </span>
      </div>

      {/* 2 colunas com VALORES VISÍVEIS dos dois lados */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-start">
        <div className="border rounded p-3 bg-blue-50/30 border-blue-200">
          <p className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold mb-1">
            Extrato (banco)
          </p>
          <p className="text-sm font-medium truncate">{ofx.description}</p>
          <p className="text-xs text-muted-foreground">{fmt(ofx.date)}</p>
          <p className="text-base font-bold tabular-nums mt-1">
            {formatBRL(ofx.amount)}
          </p>
        </div>
        <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground mt-12" />
        <div className="border rounded p-3 bg-emerald-50/30 border-emerald-200">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
            Conta a pagar (sistema)
          </p>
          <p className="text-sm font-medium truncate">
            {suggestion.candidate.description}
          </p>
          <p className="text-xs text-muted-foreground">
            vence {fmt(suggestion.candidate.dueDate)}
          </p>
          <p className="text-base font-bold tabular-nums mt-1">
            {formatBRL(suggestion.candidate.amount)}
          </p>
        </div>
      </div>

      {/* Indicador bate / diverge */}
      <div className="flex items-center justify-center text-xs">
        {bate ? (
          <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            Valores batem exato
          </span>
        ) : (
          <span className="text-amber-700 font-medium inline-flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Diferença de {formatBRL(diff)} ({diffPct.toFixed(1)}%)
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={onApply} disabled={submitting} className="flex-1">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Conciliando...
            </>
          ) : (
            'Casar este par'
          )}
        </Button>
        <Button variant="outline" disabled title="Em breve (Fase C)">
          Trocar candidato ▾
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// CRIAR — cash coding inline (categoriza direto sem cliente)
// =============================================================================
function CriarPanel({
  ofx,
  empresaId,
  onApplied,
}: {
  ofx: OfxLine
  empresaId: string
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [categoryId, setCategoryId] = useState<string>('')
  const [notas, setNotas] = useState('')
  const [criarRegra, setCriarRegra] = useState(true) // default ON
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/categorias?soAtivas=true`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.categorias) {
          // Filtra pelo tipo da OFX: CREDIT → INCOME, DEBIT → EXPENSE
          const tipoEsperado = ofx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'
          const filtered = (d.categorias as Category[]).filter(
            (c) => c.type === tipoEsperado,
          )
          setCategories(filtered)
        }
        setLoadingCats(false)
      })
      .catch(() => setLoadingCats(false))
  }, [empresaId, ofx.type])

  async function aplicar() {
    if (!categoryId) {
      toast({
        variant: 'destructive',
        title: 'Categoria obrigatória',
        description: 'Selecione uma categoria pra continuar.',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/conciliacao/cash-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: ofx.id,
          categoryId,
          notas: notas || undefined,
          criarRegra,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao categorizar',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const cat = categories.find((c) => c.id === categoryId)
      toast({
        title: 'Categorizada',
        description: `${ofx.description} → ${cat?.name ?? 'OK'}`,
      })
      onApplied()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Categoriza direto sem conciliar com conta a pagar/receber. Útil pra venda
        avulsa (PIX maquininha) ou despesa sem cadastro prévio.
      </p>

      <div>
        <label className="text-xs font-medium block mb-1">
          Categoria <span className="text-red-500">*</span>
        </label>
        {loadingCats ? (
          <div className="text-xs text-muted-foreground py-2">
            Carregando categorias...
          </div>
        ) : (
          <CategoryCombobox
            value={categoryId || null}
            categorias={categories.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              type: c.type,
              dreGroup: c.dreGroup ?? null,
            }))}
            onChange={(v) => setCategoryId(v ?? '')}
            onCreate={async (name) => {
              const cat = await createCategoryForPJ(
                empresaId,
                name,
                ofx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
              )
              if (cat) setCategories((prev) => [...prev, { id: cat.id, name: cat.name, type: cat.type ?? (ofx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'), color: cat.color ?? null, dreGroup: cat.dreGroup ?? null }])
              return cat
            }}
            placeholder={`Selecione uma categoria (${ofx.type === 'CREDIT' ? 'Receita' : 'Despesa'})`}
            allowClear={false}
            className="h-9 w-full justify-between border-input"
            ariaLabel="Categoria"
          />
        )}
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          Notas (opcional)
        </label>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ex: venda do dia, fornecedor X, etc"
          rows={2}
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={criarRegra}
          onCheckedChange={(v) => setCriarRegra(!!v)}
          id={`regra-${ofx.id}`}
        />
        <label
          htmlFor={`regra-${ofx.id}`}
          className="text-xs cursor-pointer flex items-center gap-1"
        >
          <Zap className="h-3 w-3 text-amber-600" />
          Criar regra "
          <span className="font-medium">{ofx.description.slice(0, 35)}</span>"
          → essa categoria (próximas vêm automáticas)
        </label>
      </div>

      <Button
        onClick={aplicar}
        disabled={submitting || !categoryId}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Categorizando...
          </>
        ) : (
          <>
            <Tag className="h-4 w-4 mr-2" />
            Categorizar e marcar como tratada
          </>
        )}
      </Button>
    </div>
  )
}

// =============================================================================
// TRANSFERIR — placeholder Fase B (reusa fluxo Sprint 0.5 em Fase C)
// =============================================================================
function TransferirPanel({ ofx }: { ofx: OfxLine }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-4">
      <AlertCircle className="h-5 w-5 mx-auto mb-2" />
      Se esta tx é uma{' '}
      <strong>transferência entre suas contas</strong> (ex: PJ → conta poupança),
      use o fluxo de Transferência da página de Transações.
      <p className="text-xs mt-2">
        Integração automática vem na Fase C (reusa Sprint 0.5).
      </p>
    </div>
  )
}

// =============================================================================
// IGNORAR — marca tx como não-conciliável + motivo
// =============================================================================
function IgnorarPanel({
  ofx,
  onApplied,
}: {
  ofx: OfxLine
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState<typeof MOTIVOS[number]['id']>('TAXA_BANCO')
  const [motivoCustom, setMotivoCustom] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function aplicar() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/conciliacao/ignorar/${ofx.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo,
          motivoCustom: motivo === 'OUTRO' ? motivoCustom : undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: 'Tx ignorada',
        description: ofx.description.slice(0, 40),
      })
      onApplied()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Marca esta tx como não-conciliável. Ela sai da fila de pendentes (mas
        continua no extrato pra audit).
      </p>

      <div>
        <label className="text-xs font-medium block mb-2">Por que ignorar?</label>
        <div className="space-y-1.5">
          {MOTIVOS.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name={`motivo-${ofx.id}`}
                value={m.id}
                checked={motivo === m.id}
                onChange={() => setMotivo(m.id)}
                className="cursor-pointer"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {motivo === 'OUTRO' && (
        <Input
          value={motivoCustom}
          onChange={(e) => setMotivoCustom(e.target.value)}
          placeholder="Descreva o motivo..."
          maxLength={200}
        />
      )}

      <div className="text-xs text-muted-foreground italic flex items-start gap-1">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        Regra "Não me incomodar mais com tx similares" vem na Fase C (cria
        aprendizado em ai_learning_rules pra padrão semelhante).
      </div>

      <Button
        onClick={aplicar}
        disabled={submitting || (motivo === 'OUTRO' && !motivoCustom.trim())}
        variant="outline"
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Ignorando...
          </>
        ) : (
          'Ignorar esta tx'
        )}
      </Button>
    </div>
  )
}
