'use client'

// Sprint A-effected Fase B.1 — XeroRow
//
// Card box do Xero: linha esquerda (statement line) + card direito (4 tabs).
// Replica visual literal:
//   - Esquerda: Date | Description | Reference | Spent | Received
//   - Direita: 4 tabs (Match/Create/Transfer/Discuss) + menu "..." c/ Ignorar
//   - Fundo verde claro no card direito quando há match automático
//   - Link "Find & Match" no rodapé direito (placeholder Fase B.2)
//
// Engine reusada: confirmar (Match), cash-code (Create), ignorar (menu).
// Transfer + Discuss = placeholder pra Fase B.3.

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  Landmark,
  Loader2,
  MoreVertical,
  Tag,
  XCircle,
  Search,
} from 'lucide-react'
import { extractStatementInfo, type KindHint } from '@/lib/conciliacao/parse-ofx-description'
import { FindAndMatchPanel } from './find-and-match-panel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface OfxLine {
  id: string
  description: string
  amount: number
  date: string
  type: string
  externalId?: string | null // FITID — auditoria, exibido truncado no footer
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
}

interface Props {
  ofx: OfxLine
  empresaId: string
  suggestion: MatchSuggestion | null
  onAction: () => void
}

type Tab = 'MATCH' | 'CREATE' | 'TRANSFER' | 'DISCUSS'

const MOTIVOS = [
  { id: 'TAXA_BANCO', label: 'Taxa do banco' },
  { id: 'ESTORNO', label: 'Estorno / devolução' },
  { id: 'LANCAMENTO_ERRADO', label: 'Lançamento errado do banco' },
  { id: 'OUTRO', label: 'Outro' },
] as const

export function XeroRow({ ofx, empresaId, suggestion, onAction }: Props) {
  const hasMatch = !!suggestion
  const [tab, setTab] = useState<Tab>(hasMatch ? 'MATCH' : 'CREATE')
  const [submitting, setSubmitting] = useState(false)
  const [ignoreOpen, setIgnoreOpen] = useState(false)
  // Sprint A-effected Fase B.2 — Find & Match takeover do card direito
  const [findMode, setFindMode] = useState(false)
  const { toast } = useToast()

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  const isCredit = ofx.type === 'CREDIT'

  async function aplicarMatch() {
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
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Conciliada', description: ofx.description.slice(0, 40) })
      onAction()
    } finally {
      setSubmitting(false)
    }
  }

  // Sprint Conciliação-Visual: parse da descrição pra extrair favorecido +
  // sub-descrição + chips de tipo (PIX/TED/BOLETO/etc).
  const info = useMemo(() => extractStatementInfo(ofx.description), [ofx.description])

  // Cor de fundo do card direito:
  //   - emerald quando há match com diff zero (bate exato)
  //   - amber quando há match mas com diff > 0 (precisa ajuste — B.4)
  //   - neutro quando sem suggestion
  const matchDiff = suggestion
    ? Math.abs(ofx.amount - suggestion.candidate.amount)
    : null
  const matchBate = matchDiff !== null && matchDiff < 0.01
  const rightBg = !hasMatch
    ? 'bg-card border-border'
    : matchBate
      ? 'bg-emerald-50/40 border-emerald-200'
      : 'bg-amber-50/40 border-amber-200'

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-3 border-b last:border-b-0 py-2.5">
      {/* ============================================================== */}
      {/* LADO ESQUERDO — Statement line estilo Mercury/Linear             */}
      {/* ============================================================== */}
      <StatementLineCard
        ofx={ofx}
        info={info}
        isCredit={isCredit}
        fmtDate={fmtDate}
      />

      {/* ============================================================== */}
      {/* LADO DIREITO — Match card 4 tabs OU Find & Match (takeover B.2) */}
      {/* ============================================================== */}
      <div className={`rounded border ${findMode ? 'bg-card border-blue-300' : rightBg}`}>
        {findMode ? (
          // Find & Match toma conta do card inteiro
          <div className="p-3">
            <FindAndMatchPanel
              ofx={ofx}
              empresaId={empresaId}
              onCancel={() => setFindMode(false)}
              onReconciled={() => {
                setFindMode(false)
                onAction()
              }}
            />
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b">
              <div className="flex">
                {(['MATCH', 'CREATE', 'TRANSFER', 'DISCUSS'] as Tab[]).map((t) => {
                  const active = tab === t
                  const isAutoSuggestion = hasMatch && t === 'MATCH'
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                        active
                          ? 'border-emerald-600 text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t === 'MATCH' ? 'Match' : t === 'CREATE' ? 'Create' : t === 'TRANSFER' ? 'Transfer' : 'Discuss'}
                      {isAutoSuggestion && (
                        <span className="ml-1 text-emerald-600">✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {/* Menu "..." com IGNORAR */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-2 text-muted-foreground hover:text-foreground"
                    aria-label="Mais ações"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setIgnoreOpen(true)}>
                    <XCircle className="h-3.5 w-3.5 mr-2" />
                    Ignorar esta tx
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Conteúdo da aba ativa */}
            <div className="p-3 min-h-[110px]">
              {tab === 'MATCH' && (
                <MatchPanel
                  ofx={ofx}
                  suggestion={suggestion}
                  fmtDate={fmtDate}
                  onApply={aplicarMatch}
                  submitting={submitting}
                />
              )}
              {tab === 'CREATE' && (
                <CreatePanel
                  ofx={ofx}
                  empresaId={empresaId}
                  onApplied={onAction}
                />
              )}
              {tab === 'TRANSFER' && <TransferPanel />}
              {tab === 'DISCUSS' && <DiscussPanel />}
            </div>

            {/* Rodapé com Find & Match (ativa takeover) */}
            <div className="border-t px-3 py-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => setFindMode(true)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Search className="h-3 w-3" />
                Find &amp; Match
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal de IGNORAR (acionado pelo menu "...") */}
      {ignoreOpen && (
        <IgnoreDialog
          ofx={ofx}
          onClose={() => setIgnoreOpen(false)}
          onApplied={() => {
            setIgnoreOpen(false)
            onAction()
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// MATCH PANEL — sugestão automática com 2 colunas (banco × sistema)
// ============================================================================
function MatchPanel({
  ofx,
  suggestion,
  fmtDate,
  onApply,
  submitting,
}: {
  ofx: OfxLine
  suggestion: MatchSuggestion | null
  fmtDate: (d: string) => string
  onApply: () => void
  submitting: boolean
}) {
  if (!suggestion) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        <p className="font-medium mb-1">No matching transactions found.</p>
        <p className="text-xs">
          Use <strong className="text-blue-600">Find &amp; Match</strong> pra
          buscar manualmente, ou clique em <strong>Create</strong> pra adicionar
          uma transação nova.
        </p>
      </div>
    )
  }

  const diff = Math.abs(ofx.amount - suggestion.candidate.amount)
  const bate = diff < 0.01

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Badge
          variant="outline"
          className={
            suggestion.score >= 90
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-amber-100 text-amber-700 border-amber-300'
          }
        >
          Score {suggestion.score}
        </Badge>
        <span className="text-muted-foreground truncate">
          {suggestion.reasoning.slice(0, 3).join(' · ')}
        </span>
      </div>

      <div className="rounded border bg-card p-2.5 text-sm">
        <p className="font-medium truncate">{suggestion.candidate.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
          <span>vence {fmtDate(suggestion.candidate.dueDate)}</span>
          <span className="font-semibold text-foreground tabular-nums">
            {formatBRL(suggestion.candidate.amount)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        {bate ? (
          <span className="text-emerald-700 inline-flex items-center gap-1">
            <Check className="h-3 w-3" />
            Match exato
          </span>
        ) : (
          <span className="text-amber-700">
            Diferença de {formatBRL(diff)}
          </span>
        )}
        <Button
          size="sm"
          onClick={onApply}
          disabled={submitting}
          className={`h-7 ${
            bate
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              OK
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// CREATE PANEL — formulário inline Xero (Who/What/Why)
// ============================================================================
function CreatePanel({
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
  const [categoryId, setCategoryId] = useState<string>('')
  const [notas, setNotas] = useState('')
  const [criarRegra, setCriarRegra] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/categorias?soAtivas=true`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.categorias) {
          const tipoEsperado = ofx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'
          setCategories(
            (d.categorias as Category[]).filter((c) => c.type === tipoEsperado),
          )
        }
      })
  }, [empresaId, ofx.type])

  async function aplicar() {
    if (!categoryId) return
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
          title: 'Falha',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Criada', description: ofx.description.slice(0, 40) })
      onApplied()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Linha Who | What | Why (estilo Xero compacto) */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Categoria <span className="text-red-500">*</span>
          </label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue
                placeholder={ofx.type === 'CREDIT' ? 'Receita…' : 'Despesa…'}
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    )}
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
            Notas
          </label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={1}
            placeholder="Opcional"
            className="text-sm min-h-[2rem] resize-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <Checkbox
          checked={criarRegra}
          onCheckedChange={(v) => setCriarRegra(!!v)}
        />
        Criar regra automática pra padrões similares
      </label>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={aplicar}
          disabled={submitting || !categoryId}
          className="bg-emerald-600 hover:bg-emerald-700 h-7"
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Tag className="h-3.5 w-3.5 mr-1" />
              OK
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// TRANSFER PANEL — placeholder Fase B.3
// ============================================================================
function TransferPanel() {
  return (
    <div className="text-sm text-muted-foreground py-4 text-center">
      <p className="text-xs">
        Vai reusar fluxo de Transferências (Sprint 0.5) — implementação
        completa na Fase B.3.
      </p>
    </div>
  )
}

// ============================================================================
// DISCUSS PANEL — placeholder Fase B.3
// ============================================================================
function DiscussPanel() {
  return (
    <div className="text-sm text-muted-foreground py-4 text-center">
      <p className="text-xs">
        Anotações pendentes pra revisão depois — implementação completa na
        Fase B.3 (precisa migration de discussNotes).
      </p>
    </div>
  )
}

// ============================================================================
// IGNORE DIALOG — modal pequeno (chamado do menu "...")
// ============================================================================
function IgnoreDialog({
  ofx,
  onClose,
  onApplied,
}: {
  ofx: OfxLine
  onClose: () => void
  onApplied: () => void
}) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState<typeof MOTIVOS[number]['id']>('LANCAMENTO_ERRADO')
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
      toast({ title: 'Ignorada', description: ofx.description.slice(0, 40) })
      onApplied()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-lg border shadow-lg max-w-md w-full p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Ignorar transação</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tira esta tx da fila de pendentes. Pode ser reativada depois.
          </p>
        </div>

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
              />
              {m.label}
            </label>
          ))}
        </div>

        {motivo === 'OUTRO' && (
          <Input
            value={motivoCustom}
            onChange={(e) => setMotivoCustom(e.target.value)}
            placeholder="Descreva o motivo…"
            maxLength={200}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={aplicar}
            disabled={submitting || (motivo === 'OUTRO' && !motivoCustom.trim())}
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Ignorar'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// STATEMENT LINE CARD — lado esquerdo estilo Mercury/Linear
// Sprint Conciliação-Visual: descrição completa sem cortar, favorecido em
// destaque, chips de tipo, footer com banco + FITID.
// ============================================================================

const KIND_CHIP_CLASS: Record<KindHint, string> = {
  PIX: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  TED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
  DOC: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
  BOLETO: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900',
  PAGAMENTO: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  TARIFA: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  ESTORNO: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900',
  'ANTECIPAÇÃO':
    'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900',
}

function StatementLineCard({
  ofx,
  info,
  isCredit,
  fmtDate,
}: {
  ofx: OfxLine
  info: ReturnType<typeof extractStatementInfo>
  isCredit: boolean
  fmtDate: (d: string) => string
}) {
  const bankLabel = ofx.bankAccount
    ? ofx.bankAccount.bankName ?? ofx.bankAccount.name
    : null
  const fitidShort =
    ofx.externalId && ofx.externalId.length > 8
      ? ofx.externalId.slice(0, 8) + '…'
      : ofx.externalId ?? null

  return (
    <div className="rounded border bg-card px-3 py-2.5 space-y-1">
      {/* Header: data · chips · valor */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {fmtDate(ofx.date)}
          </span>
          {info.kindHints.map((kind) => (
            <span
              key={kind}
              className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase tracking-wide border ${KIND_CHIP_CLASS[kind]}`}
            >
              {kind}
            </span>
          ))}
          <span
            className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase tracking-wide border ${
              isCredit
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900'
            }`}
          >
            {isCredit ? 'Recebido' : 'Pago'}
          </span>
        </div>
        <span
          className={`text-sm font-semibold font-mono tabular-nums shrink-0 ${
            isCredit ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {isCredit ? '+' : '−'} {formatBRL(Math.abs(ofx.amount))}
        </span>
      </div>

      {/* Favorecido — quebra de linha completa, sem truncate */}
      <p
        className="text-sm font-medium break-words leading-snug text-foreground"
        title={ofx.description}
      >
        {info.favored || ofx.description}
      </p>

      {/* Sub-descrição (quando separador encontrado) */}
      {info.subDescription && (
        <p className="text-xs text-muted-foreground break-words leading-snug">
          {info.subDescription}
        </p>
      )}

      {/* Footer: banco · FITID */}
      {(bankLabel || fitidShort) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 pt-0.5">
          {bankLabel && (
            <span className="inline-flex items-center gap-1">
              <Landmark className="h-2.5 w-2.5" />
              {bankLabel}
            </span>
          )}
          {bankLabel && fitidShort && <span>·</span>}
          {fitidShort && (
            <span
              className="font-mono"
              title={
                ofx.externalId && ofx.externalId.length > 8
                  ? `FITID completo: ${ofx.externalId}`
                  : undefined
              }
            >
              FITID {fitidShort}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
