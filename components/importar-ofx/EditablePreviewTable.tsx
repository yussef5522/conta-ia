'use client'

// Sprint Import Categoria Editável (18/06/2026) — tabela do preview com:
//   - dropdown de categoria por linha (lista do plano de contas)
//   - bolinha de confiança (verde ALTA / amarelo REVISAR)
//   - abas: Novas · Revisar · Transferências · Duplicadas
//   - barra de lote (selecionar N -> aplicar categoria em massa)
//   - botão "Criar regra" (linha individual)
//
// Visual: flat, Tailwind, estilo Stripe/Mercury/Linear.
// Mantém compatibilidade com o /confirm legado — overrides + rules sobem
// no formData quando o user salva.

import { useMemo, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Sparkles, Plus, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format/money'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'

export interface CategoryOption {
  id: string
  name: string
  type: string // INCOME | EXPENSE | TRANSFER
  dreGroup: string | null
  parentId: string | null
}

export interface CategorySuggestion {
  dedupHash: string
  categoryId: string | null
  dreGroup: string | null
  categoryName: string | null
  confidence: 'ALTA' | 'REVISAR'
  source: 'RULE' | 'SETOR' | 'DEFAULT'
}

export interface PreviewLine {
  fitid: string
  dedupHash: string
  date: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

export interface TransferLine {
  dedupHash: string
  date: string
  amount: number
  memo: string
  pareadoCom: string // accountName do outro lado
}

interface Props {
  novas: PreviewLine[]
  transferencias: TransferLine[]
  duplicadas: number
  suggestions: CategorySuggestion[]
  categories: CategoryOption[]
  /** Mapa overrides controlado pelo pai (dedupHash -> categoryId | null) */
  overrides: Record<string, string | null>
  setOverrides: (o: Record<string, string | null>) => void
  /** Regras criadas durante a sessão (vão pro POST do confirm) */
  newRules: Array<{ tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ'; padrao: string; categoryId: string }>
  setNewRules: (r: Array<{ tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ'; padrao: string; categoryId: string }>) => void
}

type Tab = 'novas' | 'revisar' | 'transferencias' | 'duplicadas'

export function EditablePreviewTable({
  novas,
  transferencias,
  duplicadas,
  suggestions,
  categories,
  overrides,
  setOverrides,
  newRules,
  setNewRules,
}: Props) {
  const [tab, setTab] = useState<Tab>('novas')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createRuleFor, setCreateRuleFor] = useState<PreviewLine | null>(null)

  const suggestionMap = useMemo(() => {
    const m = new Map<string, CategorySuggestion>()
    for (const s of suggestions) m.set(s.dedupHash, s)
    return m
  }, [suggestions])

  function effectiveCategoryId(line: PreviewLine): string | null {
    if (line.dedupHash in overrides) return overrides[line.dedupHash]
    return suggestionMap.get(line.dedupHash)?.categoryId ?? null
  }

  function effectiveConfidence(line: PreviewLine): 'ALTA' | 'REVISAR' {
    if (line.dedupHash in overrides) return 'ALTA' // user editou -> ALTA
    return suggestionMap.get(line.dedupHash)?.confidence ?? 'REVISAR'
  }

  const revisarLines = useMemo(
    () => novas.filter((l) => effectiveConfidence(l) === 'REVISAR'),
    [novas, overrides, suggestionMap],
  )

  const visibleLines = useMemo(() => {
    if (tab === 'novas') return novas
    if (tab === 'revisar') return revisarLines
    return []
  }, [tab, novas, revisarLines])

  function toggleSelected(hash: string) {
    const next = new Set(selected)
    if (next.has(hash)) next.delete(hash)
    else next.add(hash)
    setSelected(next)
  }

  function selectAllVisible() {
    setSelected(new Set(visibleLines.map((l) => l.dedupHash)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function applyBulkCategory(categoryId: string) {
    const next = { ...overrides }
    for (const hash of selected) next[hash] = categoryId
    setOverrides(next)
    clearSelection()
  }

  function applySingleCategory(hash: string, categoryId: string | null) {
    setOverrides({ ...overrides, [hash]: categoryId })
  }

  function handleCreateRule(matchType: 'CONTAINS' | 'CNPJ', padrao: string, categoryId: string) {
    const tipoMatch = matchType === 'CNPJ' ? 'CNPJ' : 'CONTAINS'
    // Adiciona à lista de regras a persistir no confirm
    setNewRules([...newRules, { tipoMatch, padrao, categoryId }])
    // Aplica nas linhas restantes que casam
    const padraoUpper = padrao.toUpperCase()
    const next = { ...overrides }
    for (const l of novas) {
      if (l.memo.toUpperCase().includes(padraoUpper)) {
        next[l.dedupHash] = categoryId
      }
    }
    setOverrides(next)
    setCreateRuleFor(null)
  }

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <TabBtn
          active={tab === 'novas'}
          onClick={() => setTab('novas')}
          count={novas.length}
        >
          Novas
        </TabBtn>
        <TabBtn
          active={tab === 'revisar'}
          onClick={() => setTab('revisar')}
          count={revisarLines.length}
          warn
        >
          Revisar
        </TabBtn>
        <TabBtn
          active={tab === 'transferencias'}
          onClick={() => setTab('transferencias')}
          count={transferencias.length}
        >
          Transferências
        </TabBtn>
        <TabBtn
          active={tab === 'duplicadas'}
          onClick={() => setTab('duplicadas')}
          count={duplicadas}
        >
          Já no sistema
        </TabBtn>
      </div>

      {/* Barra de lote */}
      {selected.size > 0 && tab !== 'transferencias' && tab !== 'duplicadas' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium">{selected.size} selecionada(s)</span>
          <span className="text-slate-500">→</span>
          <CategoryCombobox
            value={null}
            categorias={categories.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
              dreGroup: c.dreGroup,
            }))}
            onChange={(v) => {
              if (v) applyBulkCategory(v)
            }}
            placeholder="Aplicar categoria em massa…"
            allowClear={false}
            className="h-9 w-64 justify-between border-input"
            ariaLabel="Aplicar categoria em massa"
          />
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpar
          </Button>
        </div>
      )}

      {/* Tabs Novas / Revisar */}
      {(tab === 'novas' || tab === 'revisar') && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {visibleLines.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {tab === 'revisar' ? '🎉 Nada pra revisar — todas têm categoria com confiança alta.' : 'Nenhuma transação nova.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === visibleLines.length && visibleLines.length > 0}
                      onChange={(e) => (e.target.checked ? selectAllVisible() : clearSelection())}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line) => {
                  const catId = effectiveCategoryId(line)
                  const conf = effectiveConfidence(line)
                  const isSel = selected.has(line.dedupHash)
                  return (
                    <tr
                      key={line.dedupHash}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${isSel ? 'bg-primary/5' : 'hover:bg-slate-50/60'}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelected(line.dedupHash)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {line.date.slice(0, 10).split('-').reverse().join('/')}
                      </td>
                      <td className="px-3 py-2 max-w-md truncate text-slate-800" title={line.memo}>
                        {line.memo}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap ${line.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {line.type === 'CREDIT' ? (
                          <ArrowUpRight className="inline h-3.5 w-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="inline h-3.5 w-3.5 mr-0.5" />
                        )}
                        {formatBRL(line.amount)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ConfidenceDot confidence={conf} />
                          <CategoryCombobox
                            value={catId}
                            categorias={categories.map((c) => ({
                              id: c.id,
                              name: c.name,
                              type: c.type,
                              dreGroup: c.dreGroup,
                            }))}
                            onChange={(v) => applySingleCategory(line.dedupHash, v)}
                            placeholder="A classificar"
                            className="h-8 w-56 justify-between border-input text-xs"
                            ariaLabel="Categoria da linha"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {catId && (
                          <button
                            onClick={() => setCreateRuleFor(line)}
                            className="text-slate-400 hover:text-primary transition-colors p-1"
                            title="Criar regra a partir desta linha"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab Transferências */}
      {tab === 'transferencias' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 px-4 py-3">
          {transferencias.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhuma transferência interna detectada neste arquivo.</div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-blue-900">
                Transferências internas detectadas — entram como <strong>TRANSFER</strong> (não recebem categoria).
              </p>
              {transferencias.map((t) => (
                <div key={t.dedupHash} className="flex items-center justify-between text-sm bg-white rounded-md border border-blue-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                    <span className="text-slate-700">{t.memo}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{formatBRL(t.amount)}</div>
                    <div className="text-xs text-slate-500">↔ {t.pareadoCom}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Duplicadas */}
      {tab === 'duplicadas' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Check className="inline h-4 w-4 text-emerald-600 mr-1" />
          {duplicadas} transações já existem no sistema (gate de identidade barrou). Nada será duplicado.
        </div>
      )}

      {/* Resumo de regras a criar */}
      {newRules.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-emerald-900">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">{newRules.length} regra(s) a criar</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-emerald-800">
            {newRules.map((r, i) => (
              <li key={i}>
                · descrição contém "<strong>{r.padrao}</strong>" → {categories.find((c) => c.id === r.categoryId)?.name ?? '(categoria)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal criar regra */}
      {createRuleFor && (
        <CreateRuleModal
          line={createRuleFor}
          categoryId={effectiveCategoryId(createRuleFor)}
          categories={categories}
          onCancel={() => setCreateRuleFor(null)}
          onSave={handleCreateRule}
        />
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  count,
  children,
  warn,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
  warn?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'text-slate-900 border-b-2 border-primary -mb-px'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
      <span
        className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
          warn && count > 0
            ? 'bg-amber-100 text-amber-700'
            : active
              ? 'bg-primary/10 text-primary'
              : 'bg-slate-100 text-slate-600'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function ConfidenceDot({ confidence }: { confidence: 'ALTA' | 'REVISAR' }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
        confidence === 'ALTA' ? 'bg-emerald-500' : 'bg-amber-500'
      }`}
      title={confidence === 'ALTA' ? 'Confiança alta' : 'Revisar'}
    />
  )
}

// Sprint Category-Combobox PJ Batch (30/06/2026): CategorySelect local
// substituído pelo CategoryCombobox único (Ramp/Mercury-grade).
// Interface pública mantida via wrappers acima (bulk/linha/regra).

function CreateRuleModal({
  line,
  categoryId,
  categories,
  onCancel,
  onSave,
}: {
  line: PreviewLine
  categoryId: string | null
  categories: CategoryOption[]
  onCancel: () => void
  onSave: (matchType: 'CONTAINS' | 'CNPJ', padrao: string, categoryId: string) => void
}) {
  const [tipo, setTipo] = useState<'CONTAINS' | 'CNPJ'>('CONTAINS')
  // Pré-preenchido com primeiras palavras significativas
  const padraoSugerido = useMemo(() => {
    const palavras = line.memo
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length >= 3)
    return palavras.slice(0, 2).join(' ')
  }, [line.memo])
  const [padrao, setPadrao] = useState(padraoSugerido)
  const [catId, setCatId] = useState<string>(categoryId ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Criar regra de categoria
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          A regra será aplicada nas demais linhas deste import que casam, e também nos futuros imports.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Quando</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'CONTAINS' | 'CNPJ')}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="CONTAINS">Descrição contém</option>
              <option value="CNPJ">Favorecido CNPJ</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Padrão</label>
            <input
              type="text"
              value={padrao}
              onChange={(e) => setPadrao(e.target.value)}
              placeholder={tipo === 'CNPJ' ? '00.000.000/0001-00' : 'STONE PAGAMENTOS'}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">Linha original: "{line.memo}"</p>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block">Categoria</label>
            <CategoryCombobox
              value={catId || null}
              categorias={categories.map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                dreGroup: c.dreGroup,
              }))}
              onChange={(v) => setCatId(v ?? '')}
              placeholder="Escolha…"
              allowClear={false}
              className="h-9 w-full justify-between border-input"
              ariaLabel="Categoria da regra"
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button
            size="sm"
            onClick={() => padrao.trim() && catId && onSave(tipo, padrao.trim(), catId)}
            disabled={!padrao.trim() || !catId}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar regra
          </Button>
        </div>
      </div>
    </div>
  )
}
