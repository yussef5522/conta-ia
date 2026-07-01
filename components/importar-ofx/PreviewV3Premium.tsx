// Sprint OFX V3 Premium (27/06/2026) — preview com seletor de tipo + IA explica.
//
// Recebe o MESMO payload do preview V2 (não muda o motor), mas renderiza com
// seletor de tipo por linha + sugestão da IA + selo de confiança.
//
// Filosofia: IA SUGERE, user SEMPRE confirma/troca antes de entrar.

'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, X } from 'lucide-react'
import { LedgerBalBanner } from './LedgerBalBanner'
import { AIConfidencePill } from '@/components/import-shared/AIConfidencePill'
import { TransactionKindSelect } from '@/components/import-shared/TransactionKindSelect'
import type { V2PreviewPayload, V2NovaGenuinaItem } from '@/lib/ofx/preview-v2'
import type { OfxLineKind, AiSuggestion, OfxLineMark } from '@/lib/ofx-v3/types'
import { suggestLineKind } from '@/lib/ofx-v3/suggest-line-kind'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { findLoanInstallmentForTransaction } from '@/lib/loans/match-contract-in-description'
import { extractOwnSignals, type OwnEntityRefs } from '@/lib/transfers/own-entity-signals'
import { detectTransferKeyword } from '@/lib/ofx-v3/transfer-keyword'

interface CategoryOption {
  id: string
  name: string
  type: string
}

interface CardOption {
  id: string
  name: string
  lastDigits: string | null
}

interface LoanOption {
  id: string
  lender: string
  contractNumber: string | null
  /** Próximas parcelas OPEN pra escolher */
  pendingInstallments: Array<{ number: number; dueDate: string; payment: number }>
}

interface CategorySuggestion {
  dedupHash: string
  categoryId: string | null
  categoryName?: string | null
  confidence?: number
  rulePattern?: string | null
}

interface Props {
  payload: V2PreviewPayload | null
  categories: CategoryOption[]
  cards: CardOption[]
  loans: LoanOption[]
  categorySuggestions: CategorySuggestion[]
  /** Sprint OFX V3 R7 — referência da empresa pra detector single-side de TRANSFER */
  ownEntityRefs?: OwnEntityRefs
  onConfirmar: (decisions: V3Decisions) => Promise<void>
  onCancelar: () => void
  loading?: boolean
}

export interface V3Decisions {
  /** Map<ofxIndex, { kind, params, categoryOverride? }> */
  marks: Map<number, { kind: OfxLineKind; params: OfxLineMark['params'] }>
  /** dedupHash → categoryId (formato compatível com /confirm legado) */
  categoryOverrides: Array<{ dedupHash: string; categoryId: string }>
}

interface LineState {
  ofxIndex: number
  kind: OfxLineKind
  categoryId: string | null
  cardId: string | null
  loanId: string | null
  installmentNumber: number | null
}

export function PreviewV3Premium({
  payload,
  categories,
  cards,
  loans,
  categorySuggestions,
  ownEntityRefs,
  onConfirmar,
  onCancelar,
  loading,
}: Props) {
  if (!payload) return null

  const novas = payload.classificacao.novasGenuinas
  const suggestionByHash = useMemo(
    () => new Map(categorySuggestions.map((s) => [s.dedupHash, s])),
    [categorySuggestions],
  )

  // Refs effective: usa o que veio do endpoint OU defaults (segurança)
  const effectiveRefs: OwnEntityRefs = useMemo(
    () => ownEntityRefs ?? { cnpj: null, names: [], accountNames: [], ownerCpfs: [], ownerNames: [] },
    [ownEntityRefs],
  )

  // Sugestões IA por linha (kind + categoria + explicação)
  const aiSuggestionByIndex = useMemo(() => {
    const m = new Map<number, AiSuggestion>()
    for (const n of novas) {
      const sug = suggestionByHash.get(n.dedupHash)

      // Sprint OFX V3 R7 — FIX 1: detector single-side de TRANSFER.
      // Sinais (extraídos de lib/transfers/own-entity-signals):
      //  - CNPJ próprio na descrição (29756732000198 CACULA MIX → +0.15)
      //  - Nome da empresa (CACULA → +0.10)
      //  - Nome de outra conta da empresa (SICREDI → +0.10)
      // Soma >=0.10 + keyword PIX/TED/DOC/TRANSFER → marca transferDetected.
      // suggestLineKind decide se vira ALTA/MEDIA/AGUARDA_PAR.
      const ownSignals = extractOwnSignals(n.memo, effectiveRefs)
      const keyword = detectTransferKeyword(n.memo)
      let transferDetected: { confidence: number; hasPair: boolean; keyword: string | null } | null = null
      if (ownSignals.signalCount > 0 && keyword) {
        // base 0.60 + boost dos sinais (max 0.30) — fica entre 0.70-0.90 single-side
        const confidence = Math.min(0.90, 0.60 + ownSignals.scoreBoost)
        transferDetected = {
          confidence,
          hasPair: false, // single-side aqui — scanRetroativo pareia pós-import
          keyword,
        }
      }

      // Sprint OFX V3 R7 — FIX 2: match por contractNumber (FORTE) ou
      // valor+data±3d (MÉDIO). Lib reutilizável, idêntica regra do
      // auto-conciliacao.ts pós-import.
      const loanCandidate = findLoanInstallmentForTransaction(
        { description: n.memo, amount: n.amount, type: n.type, date: n.date },
        loans.map((l) => ({
          id: l.id,
          lender: l.lender,
          contractNumber: l.contractNumber,
          pendingInstallments: l.pendingInstallments.map((p) => ({
            number: p.number,
            dueDate: p.dueDate,
            payment: p.payment,
          })),
        })),
      )

      const ai = suggestLineKind({
        description: n.memo,
        type: n.type,
        amount: n.amount,
        predictedCategoryId: sug?.categoryId ?? null,
        predictedCategoryName: sug?.categoryName ?? null,
        predictedConfidence: sug?.confidence,
        predictedRulePattern: sug?.rulePattern ?? null,
        cardPaymentLikely: detectCardPayLikely(n.memo, n.type),
        loanInstallmentCandidate: loanCandidate
          ? {
              loanLender: loanCandidate.loanLender,
              contractNumber: loanCandidate.contractNumber,
              installmentNumber: loanCandidate.installmentNumber,
              plannedAmount: loanCandidate.plannedAmount,
              daysFromDueDate: loanCandidate.daysFromDueDate,
            }
          : null,
        transferDetected,
      })

      // Preserve loanId (lib retorna mas suggestLineKind não)
      if (loanCandidate && ai.suggestedKind === 'PAGAMENTO_EMPRESTIMO') {
        ai.suggestedLoanId = loanCandidate.loanId
      }

      m.set(n.ofxIndex, ai)
    }
    return m
  }, [novas, suggestionByHash, loans, effectiveRefs])

  // Estado inicial: aplica a sugestão da IA por linha
  const [linesState, setLinesState] = useState<Map<number, LineState>>(() => {
    const m = new Map<number, LineState>()
    for (const n of novas) {
      const ai = aiSuggestionByIndex.get(n.ofxIndex)
      m.set(n.ofxIndex, {
        ofxIndex: n.ofxIndex,
        kind: ai?.suggestedKind ?? (n.type === 'CREDIT' ? 'RECEITA' : 'DESPESA'),
        categoryId: ai?.suggestedCategoryId ?? null,
        cardId: ai?.suggestedCardId ?? null,
        loanId: null, // user escolhe (IA não sabe loanId)
        installmentNumber: ai?.suggestedInstallmentNumber ?? null,
      })
    }
    return m
  })

  function updateLine(ofxIndex: number, patch: Partial<LineState>) {
    setLinesState((prev) => {
      const next = new Map(prev)
      const cur = next.get(ofxIndex)
      if (!cur) return prev
      next.set(ofxIndex, { ...cur, ...patch })
      return next
    })
  }

  const expenseCats = categories.filter((c) => c.type === 'EXPENSE')
  const incomeCats = categories.filter((c) => c.type === 'INCOME')

  // Stats
  const stats = useMemo(() => {
    const s = { receita: 0, despesa: 0, transfer: 0, cartao: 0, emprestimo: 0, ignorar: 0 }
    linesState.forEach((l) => s[kindToKey(l.kind)]++)
    return s
  }, [linesState])

  async function handleConfirmar() {
    const marks = new Map<number, { kind: OfxLineKind; params: OfxLineMark['params'] }>()
    const overrides: Array<{ dedupHash: string; categoryId: string }> = []
    novas.forEach((n) => {
      const st = linesState.get(n.ofxIndex)
      if (!st) return
      marks.set(n.ofxIndex, {
        kind: st.kind,
        params: {
          categoryId: st.categoryId,
          cardId: st.cardId,
          loanId: st.loanId,
          installmentNumber: st.installmentNumber,
        },
      })
      // Espelhar categoria como override pra /confirm legado (assim a tx já entra com categoria)
      if (st.categoryId && (st.kind === 'RECEITA' || st.kind === 'DESPESA')) {
        overrides.push({ dedupHash: n.dedupHash, categoryId: st.categoryId })
      }
    })
    await onConfirmar({ marks, categoryOverrides: overrides })
  }

  return (
    <div className="space-y-5">
      {/* Banner premium V3 */}
      <Card className="border-2 border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20">
        <CardContent className="py-3 flex items-start gap-3">
          <div className="bg-blue-600 text-white rounded-full p-2 flex-shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Tela de revisão premium — IA sugere, você confirma cada linha
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Cada transação tem um <strong>tipo</strong> (Receita, Despesa, Transferência, Pgto cartão, Pgto empréstimo, Ignorar)
              e um <strong>selo de confiança</strong> da IA. Edite à vontade — só entra no sistema quando você clicar Confirmar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Banner LEDGERBAL existente */}
      {payload.ledgerBalCheck && (
        <LedgerBalBanner check={payload.ledgerBalCheck} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
        <Stat label="Receita" value={stats.receita} tone="emerald" />
        <Stat label="Despesa" value={stats.despesa} tone="red" />
        <Stat label="Transferência" value={stats.transfer} tone="blue" />
        <Stat label="Pgto cartão" value={stats.cartao} tone="indigo" />
        <Stat label="Pgto empréstimo" value={stats.emprestimo} tone="purple" />
        <Stat label="Ignorar" value={stats.ignorar} tone="slate" />
      </div>

      {/* Tabela editável */}
      <Card className="rounded-xl border-border/60">
        <CardContent className="pt-4">
          {novas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nada de novo nesse OFX (tudo já estava no sistema).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b text-[10px] uppercase text-muted-foreground tracking-wider">
                  <tr>
                    <th className="text-left py-2 w-20">Data</th>
                    <th className="text-left py-2 min-w-[180px]">Descrição</th>
                    <th className="text-right py-2 w-24">Valor</th>
                    <th className="text-left py-2 w-32">Tipo</th>
                    <th className="text-left py-2 min-w-[160px]">Detalhe</th>
                    <th className="text-left py-2 w-44">IA</th>
                    <th className="text-right py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {novas.map((n) => {
                    const st = linesState.get(n.ofxIndex)!
                    const ai = aiSuggestionByIndex.get(n.ofxIndex)
                    return (
                      <PreviewRow
                        key={n.ofxIndex}
                        nova={n}
                        state={st}
                        ai={ai}
                        cards={cards}
                        loans={loans}
                        expenseCats={expenseCats}
                        incomeCats={incomeCats}
                        onUpdate={(patch) => updateLine(n.ofxIndex, patch)}
                        onRemove={() => updateLine(n.ofxIndex, { kind: 'IGNORAR' })}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancelar} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleConfirmar} disabled={loading || novas.length === 0}>
          {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Confirmar e importar {novas.length} transações
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// Linha do preview (memoizada por ofxIndex)
// =============================================================================
function PreviewRow({
  nova,
  state,
  ai,
  cards,
  loans,
  expenseCats,
  incomeCats,
  onUpdate,
  onRemove,
}: {
  nova: V2NovaGenuinaItem
  state: LineState
  ai: AiSuggestion | undefined
  cards: CardOption[]
  loans: LoanOption[]
  expenseCats: CategoryOption[]
  incomeCats: CategoryOption[]
  onUpdate: (patch: Partial<LineState>) => void
  onRemove: () => void
}) {
  const isIgnored = state.kind === 'IGNORAR'
  const cats = state.kind === 'RECEITA' ? incomeCats : expenseCats
  const selectedLoan = state.loanId ? loans.find((l) => l.id === state.loanId) : null

  return (
    <tr className={`border-b last:border-0 ${isIgnored ? 'opacity-50' : ''}`}>
      <td className="py-2 pr-2 text-muted-foreground">{fmtDateBR(nova.date)}</td>
      <td className="py-2 pr-2">
        <span className={nova.type === 'CREDIT' ? 'text-emerald-700 dark:text-emerald-400' : ''}>
          {nova.memo}
        </span>
      </td>
      <td className="py-2 pr-2 text-right tabular-nums font-medium">
        {nova.type === 'CREDIT' ? '+ ' : '− '}
        {fmtBRL(nova.amount)}
      </td>
      <td className="py-2 pr-2">
        <TransactionKindSelect
          value={state.kind}
          type={nova.type}
          onChange={(kind) => onUpdate({ kind })}
        />
      </td>
      <td className="py-2 pr-2">
        {state.kind === 'RECEITA' || state.kind === 'DESPESA' ? (
          <CategoryCombobox
            value={state.categoryId}
            categorias={cats.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            }))}
            onChange={(v) => onUpdate({ categoryId: v ?? null })}
            placeholder="— escolher categoria —"
            className={`h-8 w-full justify-between text-xs ${
              state.categoryId === null ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/20' : 'border-border'
            }`}
            ariaLabel="Categoria da linha"
          />
        ) : state.kind === 'PAGAMENTO_CARTAO' ? (
          <select
            value={state.cardId ?? ''}
            onChange={(e) => onUpdate({ cardId: e.target.value || null })}
            className={`text-xs border rounded h-8 px-1 w-full bg-background ${
              state.cardId === null ? 'border-amber-400' : 'border-border'
            }`}
          >
            <option value="">— escolher cartão —</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.lastDigits ? ` •••• ${c.lastDigits}` : ''}
              </option>
            ))}
          </select>
        ) : state.kind === 'PAGAMENTO_EMPRESTIMO' ? (
          <div className="space-y-1">
            <select
              value={state.loanId ?? ''}
              onChange={(e) => onUpdate({ loanId: e.target.value || null, installmentNumber: null })}
              className={`text-xs border rounded h-8 px-1 w-full bg-background ${
                state.loanId === null ? 'border-amber-400' : 'border-border'
              }`}
            >
              <option value="">— escolher empréstimo —</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lender}{l.contractNumber ? ` ${l.contractNumber}` : ''}
                </option>
              ))}
            </select>
            {selectedLoan && selectedLoan.pendingInstallments.length > 0 && (
              <select
                value={state.installmentNumber ?? ''}
                onChange={(e) =>
                  onUpdate({
                    installmentNumber: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className={`text-[11px] border rounded h-7 px-1 w-full bg-background ${
                  state.installmentNumber === null ? 'border-amber-400' : 'border-border'
                }`}
              >
                <option value="">— parcela —</option>
                {selectedLoan.pendingInstallments.slice(0, 12).map((p) => (
                  <option key={p.number} value={p.number}>
                    #{p.number} · {fmtDateBR(p.dueDate)} · {fmtBRL(p.payment)}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : state.kind === 'TRANSFER' ? (
          <span className="text-[11px] text-muted-foreground italic">
            Aguarda par do outro banco
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">— não importa —</span>
        )}
      </td>
      <td className="py-2 pr-2">
        {ai && (
          <div className="space-y-0.5">
            <AIConfidencePill confidence={ai.confidence} />
            <p className="text-[10px] text-muted-foreground line-clamp-2">{ai.reason}</p>
          </div>
        )}
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={onRemove}
          title="Marcar como Ignorar"
          className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-red-600 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

// =============================================================================
// Stat card pequeno
// =============================================================================
function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'emerald' | 'red' | 'blue' | 'indigo' | 'purple' | 'slate'
}) {
  const colorClass = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    red:     'text-red-700 dark:text-red-400',
    blue:    'text-blue-700 dark:text-blue-400',
    indigo:  'text-indigo-700 dark:text-indigo-400',
    purple:  'text-purple-700 dark:text-purple-400',
    slate:   'text-slate-700 dark:text-slate-400',
  }[tone]
  return (
    <div className="rounded-lg border border-border bg-card py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${colorClass}`}>{value}</p>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================
function kindToKey(k: OfxLineKind): 'receita' | 'despesa' | 'transfer' | 'cartao' | 'emprestimo' | 'ignorar' {
  switch (k) {
    case 'RECEITA':              return 'receita'
    case 'DESPESA':              return 'despesa'
    case 'TRANSFER':             return 'transfer'
    case 'PAGAMENTO_CARTAO':     return 'cartao'
    case 'PAGAMENTO_EMPRESTIMO': return 'emprestimo'
    case 'IGNORAR':              return 'ignorar'
  }
}

function detectCardPayLikely(memo: string, type: 'CREDIT' | 'DEBIT'): boolean {
  if (type !== 'DEBIT') return false
  const s = (memo || '').toLowerCase()
  return /pagamento\s+(cartao|cartão|cart[aã]o)/i.test(s)
    || /liquida[cç][aã]o.*cart(ao|ão|oes|ões)/i.test(s)
    || /pagto\s+cart/i.test(s)
    || /\b(boleto)\b.*cart(ao|ão|oes|ões)/i.test(s)
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateBR(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
