// Sprint PF Fatia 3 — Preview EDITÁVEL com IA categorizada.
// TELA CRÍTICA — diferencial vs Mobills/Organizze.

'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Sparkles,
  CreditCard as CardIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CategoryCombobox } from '@/components/transacoes/category-combobox'
import { createCategoryForPF } from '@/lib/transacoes/on-create-category'

interface PreviewLine {
  index: number
  fitid: string
  date: string
  rawAmount: number
  type: 'CREDIT' | 'DEBIT'
  description: string
  isInstallment: boolean
  installmentNumber?: number
  installmentTotal?: number
  specialKind: string | null
  isInternational: boolean
  shouldSkipImport: boolean
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  confidence: number
  layer: string
  reasoning: string
  manualDupTxId?: string
  manualDupDescription?: string
}

interface PreviewResponse {
  importId: string
  statementType: string
  org?: string
  // Sprint Fatia 3.5 — só PDF preenche
  scanQuality?: string
  detectedBank?: string | null
  declaredTotal?: number | null
  extractedSum?: number | null
  confidence?: number
  detectedCardLast4?: string | null
  warnings?: string[]
  totalLines: number
  toImport: number
  parcelasDetected: number
  invoicePaymentsSkipped: number
  encargosDetected: number
  possibleDups: number
  lines: PreviewLine[]
}

interface CategoryMini {
  id: string
  name: string
  type: 'INCOME' | 'EXPENSE'
  color?: string | null
}

function formatBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}
function confidenceBadge(c: number) {
  if (c >= 0.85) return 'bg-emerald-50 text-emerald-700'
  if (c >= 0.65) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

export default function PreviewImportPage({
  params,
}: {
  params: Promise<{ id: string; importId: string }>
}) {
  const { id, importId } = use(params)
  const router = useRouter()
  const search = useSearchParams()
  const isPdf = search.get('source') === 'pdf'
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [categories, setCategories] = useState<CategoryMini[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'low_conf' | 'dups'>('all')
  const [decisions, setDecisions] = useState<Map<string, { skip: boolean; categoryId: string | null }>>(new Map())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isPdf) {
      // PDF: carrega do sessionStorage SEM re-chamar Vision
      const cached = sessionStorage.getItem(`pdf-preview:${importId}`)
      if (!cached) {
        setError('Sessão de PDF expirou. Faça o upload novamente.')
        setLoading(false)
        return
      }
      try {
        const parsed = JSON.parse(cached) as PreviewResponse
        setData(parsed)
        const init = new Map<string, { skip: boolean; categoryId: string | null }>()
        for (const l of parsed.lines) {
          init.set(l.fitid, {
            skip: l.shouldSkipImport,
            categoryId: l.suggestedCategoryId,
          })
        }
        setDecisions(init)
      } catch {
        setError('Cache PDF corrompido')
      }
      fetch(`/api/perfis/${id}/categorias`)
        .then((r) => r.json())
        .then((d) => setCategories(d.categories ?? []))
      setLoading(false)
      return
    }

    // Lê preview do sessionStorage (precisa rerodar parser no backend)
    const rawContent = sessionStorage.getItem(`ofx-content:${importId}`)
    if (!rawContent) {
      setError('Sessão de import expirou. Faça o upload de novo.')
      setLoading(false)
      return
    }
    // Já temos o importId — re-fetch o preview chamando preview com mesmo
    // arquivo (idempotente do lado nosso pq cria PersonalOfxImport novo;
    // pra MVP, vamos guardar o preview no localStorage também).
    const cached = sessionStorage.getItem(`ofx-preview:${importId}`)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as PreviewResponse
        setData(parsed)
        // Inicializa decisões com suggested
        const init = new Map<string, { skip: boolean; categoryId: string | null }>()
        for (const l of parsed.lines) {
          init.set(l.fitid, {
            skip: l.shouldSkipImport,
            categoryId: l.suggestedCategoryId,
          })
        }
        setDecisions(init)
      } catch {
        setError('Cache de preview corrompido')
      }
    } else {
      // 1ª vez: chama preview de novo com mesmo arquivo
      const form = new FormData()
      const blob = new Blob([rawContent], { type: 'application/x-ofx' })
      form.append('file', blob, 'reimport.ofx')
      // Precisa do creditCardId — vou pegar via initial fetch da fila do BD
      fetch(`/api/perfis/${id}/ofx-import/historico`)
        .then((r) => r.json())
        .then((d) => {
          const imp = (d.imports as Array<{ id: string; creditCardId: string }>)
            .find((i) => i.id === importId)
          if (!imp) throw new Error('Import não encontrado')
          // Replace na sessionStorage e atualiza data via fetch preview
          form.append('creditCardId', imp.creditCardId)
          return fetch(`/api/perfis/${id}/ofx-import/preview`, {
            method: 'POST',
            body: form,
          })
        })
        .then((r) => r.json())
        .then((d: PreviewResponse) => {
          sessionStorage.setItem(`ofx-preview:${importId}`, JSON.stringify(d))
          setData(d)
          const init = new Map<string, { skip: boolean; categoryId: string | null }>()
          for (const l of d.lines) {
            init.set(l.fitid, {
              skip: l.shouldSkipImport,
              categoryId: l.suggestedCategoryId,
            })
          }
          setDecisions(init)
        })
        .catch(() => setError('Falha ao carregar preview'))
        .finally(() => setLoading(false))
      return
    }
    // Categorias do perfil
    fetch(`/api/perfis/${id}/categorias`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
    setLoading(false)
  }, [id, importId])

  useEffect(() => {
    // Sempre busca categorias quando data carrega
    if (data) {
      fetch(`/api/perfis/${id}/categorias`)
        .then((r) => r.json())
        .then((d) => setCategories(d.categories ?? []))
    }
  }, [id, data])

  const filteredLines = useMemo(() => {
    if (!data) return []
    if (filter === 'low_conf') return data.lines.filter((l) => l.confidence < 0.65 && !l.shouldSkipImport)
    if (filter === 'dups') return data.lines.filter((l) => l.manualDupTxId)
    return data.lines
  }, [data, filter])

  const totalToImport = useMemo(() => {
    return [...decisions.values()].filter((d) => !d.skip).length
  }, [decisions])

  async function handleConfirm() {
    if (!data) return
    setSubmitting(true)
    setError(null)
    try {
      // PDF tem confirm próprio (não precisa rawContent — lê do cache SHA256)
      if (isPdf) {
        const r = await fetch(`/api/perfis/${id}/pdf-import/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            importId,
            decisions: data.lines.map((l) => {
              const d = decisions.get(l.fitid)
              return {
                fitid: l.fitid,
                skip: d?.skip ?? l.shouldSkipImport,
                categoryId: d?.categoryId ?? null,
              }
            }),
          }),
        })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          setError(d.erro ?? 'Falha ao confirmar')
          return
        }
        sessionStorage.removeItem(`pdf-preview:${importId}`)
        router.push(`/perfis/${id}/cartoes`)
        return
      }

      const rawContent = sessionStorage.getItem(`ofx-content:${importId}`)
      if (!rawContent) {
        setError('Sessão expirou — re-upload necessário')
        return
      }
      const r = await fetch(`/api/perfis/${id}/ofx-import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importId,
          rawContent,
          decisions: data.lines.map((l) => {
            const d = decisions.get(l.fitid)
            return {
              fitid: l.fitid,
              skip: d?.skip ?? l.shouldSkipImport,
              categoryId: d?.categoryId ?? null,
            }
          }),
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha ao confirmar')
        return
      }
      // Cleanup
      sessionStorage.removeItem(`ofx-content:${importId}`)
      sessionStorage.removeItem(`ofx-preview:${importId}`)
      router.push(`/perfis/${id}/cartoes`)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-600 mb-4">{error ?? 'Sem dados'}</p>
        <Button asChild variant="outline">
          <Link href={`/perfis/${id}/importar`}>Voltar pra upload</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <Link
        href={`/perfis/${id}/importar`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900">Revise a categorização da IA</h1>
          <p className="text-sm text-zinc-600">
            {data.org && (
              <>
                <CardIcon className="inline h-3 w-3 mr-1" />
                {data.org}
                {' · '}
              </>
            )}
            {data.totalLines} transações detectadas
          </p>
        </div>
      </div>

      {/* Banner quality PDF (só PDF) */}
      {isPdf && data.confidence !== undefined && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            data.confidence >= 0.85
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : data.confidence >= 0.65
                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                : 'bg-red-50 border border-red-200 text-red-900'
          }`}
        >
          <div className="font-semibold">
            {data.confidence >= 0.85
              ? `✅ Qualidade da extração: ${(data.confidence * 100).toFixed(0)}% — leitura confiável`
              : data.confidence >= 0.65
                ? `⚠️ Qualidade: ${(data.confidence * 100).toFixed(0)}% — revise valores antes de confirmar`
                : `🚨 Qualidade baixa: ${(data.confidence * 100).toFixed(0)}% — recomendamos revisar CADA linha`}
          </div>
          {(data.detectedBank || data.declaredTotal != null) && (
            <div className="text-xs mt-1 opacity-80">
              {data.detectedBank && <>Banco: <strong>{data.detectedBank}</strong> · </>}
              {data.detectedCardLast4 && <>Cartão ****{data.detectedCardLast4} · </>}
              {data.declaredTotal != null && (
                <>Total declarado: <strong>R$ {data.declaredTotal.toFixed(2)}</strong></>
              )}
            </div>
          )}
          {data.warnings && data.warnings.length > 0 && (
            <ul className="mt-2 text-xs space-y-1 list-disc list-inside opacity-90">
              {data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pílulas de resumo */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium">
          {totalToImport} pra importar
        </span>
        {data.parcelasDetected > 0 && (
          <span className="rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-xs font-medium">
            📦 {data.parcelasDetected} parcelas
          </span>
        )}
        {data.invoicePaymentsSkipped > 0 && (
          <span className="rounded-full bg-zinc-100 text-zinc-700 px-3 py-1 text-xs font-medium">
            💳 {data.invoicePaymentsSkipped} pagamento(s) — não importar
          </span>
        )}
        {data.encargosDetected > 0 && (
          <span className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium">
            ⚠️ {data.encargosDetected} encargos
          </span>
        )}
        {data.possibleDups > 0 && (
          <span className="rounded-full bg-red-50 text-red-700 px-3 py-1 text-xs font-medium">
            ⚠️ {data.possibleDups} possível dup
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-md ${
            filter === 'all' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          Todas ({data.totalLines})
        </button>
        <button
          type="button"
          onClick={() => setFilter('low_conf')}
          className={`text-xs px-3 py-1.5 rounded-md ${
            filter === 'low_conf' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          Baixa confiança
        </button>
        <button
          type="button"
          onClick={() => setFilter('dups')}
          className={`text-xs px-3 py-1.5 rounded-md ${
            filter === 'dups' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          Possíveis dup
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-3 py-2 w-10">Imp.</th>
                <th className="text-left px-3 py-2 w-20">Data</th>
                <th className="text-left px-3 py-2">Descrição</th>
                <th className="text-left px-3 py-2 w-60">Categoria (IA)</th>
                <th className="text-right px-3 py-2 w-24">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((l) => {
                const d = decisions.get(l.fitid) ?? {
                  skip: l.shouldSkipImport,
                  categoryId: l.suggestedCategoryId,
                }
                const skipped = d.skip
                return (
                  <tr
                    key={l.fitid}
                    className={`border-b last:border-0 ${skipped ? 'opacity-40' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={!skipped}
                        onCheckedChange={(v) => {
                          const n = new Map(decisions)
                          n.set(l.fitid, { ...d, skip: !(v === true) })
                          setDecisions(n)
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600">{formatDate(l.date)}</td>
                    <td className="px-3 py-2">
                      <div className="text-zinc-900 truncate max-w-[300px]" title={l.description}>
                        {l.description}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {l.isInstallment && (
                          <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            📦 {l.installmentNumber}/{l.installmentTotal}
                          </span>
                        )}
                        {l.specialKind === 'INVOICE_PAYMENT' && (
                          <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                            💳 Pagamento
                          </span>
                        )}
                        {l.isInternational && (
                          <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            🌐 Intl
                          </span>
                        )}
                        {l.manualDupTxId && (
                          <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700" title={l.manualDupDescription}>
                            ⚠️ Possível dup
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Sprint Category-Combobox PF Batch (30/06/2026): trocado
                            Select por CategoryCombobox. PRESERVA mapeamento por
                            fitid — só o componente visual mudou. */}
                        <CategoryCombobox
                          value={d.categoryId ?? null}
                          categorias={categories
                            .filter((c) =>
                              (l.type === 'CREDIT' && c.type === 'INCOME') ||
                              (l.type === 'DEBIT' && c.type === 'EXPENSE'),
                            )
                            .map((c) => ({
                              id: c.id,
                              name: c.name,
                              color: c.color ?? null,
                              type: c.type,
                              dreGroup: null,
                            }))}
                          onChange={(v) => {
                            const n = new Map(decisions)
                            n.set(l.fitid, { ...d, categoryId: v ?? null })
                            setDecisions(n)
                          }}
                          onCreate={async (name) => {
                            const cat = await createCategoryForPF(
                              id,
                              name,
                              l.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
                            )
                            if (cat) setCategories((prev) => [...prev, {
                              id: cat.id,
                              name: cat.name,
                              type: (cat.type as 'INCOME' | 'EXPENSE') ?? (l.type === 'CREDIT' ? 'INCOME' : 'EXPENSE'),
                              color: cat.color ?? null,
                            }])
                            return cat
                          }}
                          placeholder="—"
                          className="h-8 flex-1 justify-between border-input text-xs"
                          ariaLabel={`Categoria de ${l.description}`}
                        />
                        {l.confidence > 0 && (
                          <span
                            className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${confidenceBadge(l.confidence)}`}
                            title={l.reasoning}
                          >
                            {(l.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${l.type === 'CREDIT' ? 'text-emerald-700' : 'text-zinc-900'}`}>
                      {l.type === 'CREDIT' ? '+ ' : ''}{formatBRL(l.rawAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Confirm */}
      <div className="mt-4 sticky bottom-4 z-10">
        <Card className="bg-white shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-zinc-900">
                Pronto pra importar {totalToImport} transações
              </div>
              <div className="text-xs text-zinc-500">
                As que você desmarcou ficam fora. Você pode reverter depois.
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-700">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                {error}
              </div>
            )}
            <Button
              onClick={handleConfirm}
              disabled={submitting || totalToImport === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar e importar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
