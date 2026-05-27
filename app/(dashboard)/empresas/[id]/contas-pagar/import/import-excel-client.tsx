'use client'

// Sprint 5.0.2.0 — UI multi-step do importador Excel.
//
// Steps:
//   1. UPLOAD   — drag-drop / file picker
//   2. DETECT   — botão "Analisar com IA" (estatísticas + breakdown)
//   3. REVIEW   — tabela editável com ConfidenceSignal por linha
//   4. CONFIRMED — sucesso + CTA "Ir pro dashboard"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  X,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { ConfidenceSignal } from '@/components/pendentes/ConfidenceSignal'

interface Props {
  empresaId: string
  empresaNome: string
}

type Step = 'UPLOAD' | 'DETECT' | 'REVIEW' | 'CONFIRMED'

interface UploadResponse {
  batchId: string
  fileName: string
  totalRows: number
  filteredCount: number
  headers: string[]
  totalSheets: number
  sheetName: string
  mapping: {
    fields: Record<string, string | null>
    confidence: number
    reasoning: string
  }
}

interface DetectBreakdown {
  favorecidos: { supplier: number; employee: number; orgao_publico: number }
  matched: { supplier: number; employee: number }
  categories: { matched: number; proposed_new: number }
  duplicates: number
}

interface DetectResponse {
  batchId: string
  rows: number
  breakdown: DetectBreakdown
}

interface ReviewRow {
  id: string
  rowIndex: number
  rawFavorecido: string | null
  rawDescricao: string | null
  rawCentroCusto: string | null
  valor: number
  vencimento: string | null
  pagamento: string | null
  paymentStatus: 'PAID' | 'PENDING'
  favorecidoType: string | null
  favorecidoConfidence: number | null
  categoryConfidence: number | null
  matchedSupplierId: string | null
  matchedEmployeeId: string | null
  matchedCategoryName: string | null
  proposedCategoryName: string | null
  duplicateOf: string | null
  userDecision: string
}

interface ConfirmResponse {
  batchId: string
  transactionsCreated: number
  paid: number
  pending: number
  suppliersCreated: number
  employeesCreated: number
  categoriesCreated: number
  skipped: number
  totalAmount: number
}

export function ImportExcelClient({ empresaId }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [step, setStep] = useState<Step>('UPLOAD')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<UploadResponse | null>(null)
  const [detect, setDetect] = useState<DetectResponse | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [confirmResult, setConfirmResult] = useState<ConfirmResponse | null>(null)

  async function handleUpload() {
    if (!file || busy) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/import/upload`,
        { method: 'POST', credentials: 'include', body: fd },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha no upload',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      setUpload(data)
      setStep('DETECT')
      toast({
        title: 'Upload OK',
        description: `${data.totalRows} linhas válidas (${data.filteredCount} filtradas)`,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDetect() {
    if (!upload || busy) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/import/${upload.batchId}/detect`,
        { method: 'POST', credentials: 'include' },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha na detecção',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      setDetect(data)
      // Busca rows pra step REVIEW
      const rowsRes = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/import/${upload.batchId}/review`,
        { credentials: 'include' },
      ).catch(() => null)
      if (rowsRes && rowsRes.ok) {
        const rowsData = await rowsRes.json()
        setRows(rowsData.rows ?? [])
      }
      setStep('REVIEW')
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  function toggleExclude(rowId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  async function handleConfirm() {
    if (!upload || busy) return
    setBusy(true)
    try {
      const overrides = Array.from(excluded).map((rowId) => ({
        rowId,
        decision: 'EXCLUDE' as const,
      }))
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/import/${upload.batchId}/confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowOverrides: overrides }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao confirmar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      setConfirmResult(data)
      setStep('CONFIRMED')
      toast({
        title: `${data.transactionsCreated} contas importadas`,
        description: `${data.paid} pagas · ${data.pending} a pagar · R$ ${formatBRL(data.totalAmount)}`,
        duration: 6000,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  function goToDashboard() {
    const params = new URLSearchParams()
    if (confirmResult) {
      params.set('imported', String(confirmResult.transactionsCreated))
      params.set('totalAmount', String(confirmResult.totalAmount))
      if (upload) params.set('empresaNome', upload.fileName)
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  // ─── RENDER ────────────────────────────────────────────────────────

  if (step === 'CONFIRMED' && confirmResult) {
    return (
      <div className="rounded-md border bg-card p-8 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-semibold">
          {confirmResult.transactionsCreated} contas importadas
        </h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          R$ {formatBRL(confirmResult.totalAmount)} ·{' '}
          {confirmResult.paid} pagas · {confirmResult.pending} a pagar
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm mb-5">
          <Stat
            label="Fornecedores"
            value={confirmResult.suppliersCreated}
            suffix={confirmResult.suppliersCreated === 1 ? 'novo' : 'novos'}
          />
          <Stat
            label="Funcionários"
            value={confirmResult.employeesCreated}
            suffix={confirmResult.employeesCreated === 1 ? 'novo' : 'novos'}
          />
          <Stat
            label="Categorias"
            value={confirmResult.categoriesCreated}
            suffix={confirmResult.categoriesCreated === 1 ? 'nova' : 'novas'}
          />
        </div>
        {confirmResult.skipped > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
            {confirmResult.skipped} linhas puladas (revisão pendente ou excluídas)
          </p>
        )}
        <Button onClick={goToDashboard} size="lg">
          Ir pro Dashboard
        </Button>
      </div>
    )
  }

  if (step === 'REVIEW' && detect) {
    const incluidas = rows.filter((r) => !excluded.has(r.id) && r.userDecision !== 'EXCLUDE')
    const totalIncluido = incluidas.reduce((s, r) => s + r.valor, 0)
    const needsReview = rows.filter((r) => r.userDecision === 'NEEDS_REVIEW').length
    const duplicates = rows.filter((r) => r.duplicateOf).length

    return (
      <div className="space-y-4">
        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Linhas válidas" value={incluidas.length} suffix={`/ ${rows.length}`} />
          <StatCard label="Total selecionado" value={`R$ ${formatBRL(totalIncluido)}`} mono />
          <StatCard label="Pagas" value={incluidas.filter((r) => r.paymentStatus === 'PAID').length} color="emerald" />
          <StatCard label="A pagar" value={incluidas.filter((r) => r.paymentStatus === 'PENDING').length} color="amber" />
        </div>

        {/* Avisos */}
        <div className="flex flex-wrap gap-3 text-xs">
          {needsReview > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {needsReview} linhas pedem revisão (confidence &lt; 0.7)
            </span>
          )}
          {duplicates > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {duplicates} possíveis duplicatas vs últimos 90 dias
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 dark:bg-violet-950/30 px-2.5 py-1 text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            {detect.breakdown.matched.supplier + detect.breakdown.matched.employee} já cadastrados
          </span>
        </div>

        {/* Tabela */}
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-medium">Incluir</th>
                <th className="text-left px-3 py-2 font-medium">Favorecido</th>
                <th className="text-left px-3 py-2 font-medium">Descrição</th>
                <th className="text-left px-3 py-2 font-medium">Categoria</th>
                <th className="text-left px-3 py-2 font-medium">Vencimento</th>
                <th className="text-left px-3 py-2 font-medium">Pagamento</th>
                <th className="text-right px-3 py-2 font-medium">Valor</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isExcluded = excluded.has(r.id) || r.userDecision === 'EXCLUDE'
                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${
                      isExcluded ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={!isExcluded}
                        onCheckedChange={() => toggleExclude(r.id)}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" title={r.rawFavorecido ?? ''}>
                      <div className="flex items-center gap-1.5">
                        <span className={isExcluded ? 'line-through' : ''}>
                          {r.rawFavorecido ?? '—'}
                        </span>
                        {r.favorecidoConfidence !== null && (
                          <ConfidenceSignal confidence={r.favorecidoConfidence} compact />
                        )}
                        {r.matchedSupplierId || r.matchedEmployeeId ? (
                          <span className="text-[10px] rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1">
                            ✓
                          </span>
                        ) : (
                          <span className="text-[10px] rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1">
                            novo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate text-muted-foreground" title={r.rawDescricao ?? ''}>
                      {r.rawDescricao ?? '—'}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">
                      <div className="flex items-center gap-1.5">
                        <span>
                          {r.matchedCategoryName ?? r.proposedCategoryName ?? '—'}
                        </span>
                        {r.categoryConfidence !== null && (
                          <ConfidenceSignal confidence={r.categoryConfidence} compact />
                        )}
                        {r.proposedCategoryName && !r.matchedCategoryName && (
                          <span className="text-[10px] rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-1">
                            nova
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.vencimento ? formatDate(r.vencimento) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.pagamento ? formatDate(r.pagamento) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      R$ {formatBRL(r.valor)}
                    </td>
                    <td className="px-3 py-2">
                      {r.paymentStatus === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          Paga
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          A pagar
                        </span>
                      )}
                      {r.duplicateOf && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          dup
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setStep('DETECT')} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={busy || incluidas.length === 0}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Confirmar import ({incluidas.length} contas)
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'DETECT' && upload) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="h-5 w-5 text-violet-600" />
            <h3 className="font-medium">{upload.fileName}</h3>
          </div>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground tabular-nums">{upload.totalRows}</strong> linhas válidas
              {upload.filteredCount > 0 && ` (${upload.filteredCount} filtradas — totais/vazias)`}
            </li>
            <li>
              <strong className="text-foreground tabular-nums">{upload.headers.length}</strong> colunas detectadas
              {upload.totalSheets > 1 &&
                ` · aba "${upload.sheetName}" de ${upload.totalSheets}`}
            </li>
            <li>
              Mapeamento heurístico: confidence{' '}
              <strong>{Math.round(upload.mapping.confidence * 100)}%</strong>
              {upload.mapping.reasoning && ` · ${upload.mapping.reasoning}`}
            </li>
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setStep('UPLOAD')} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={handleDetect} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Analisar com IA
          </Button>
        </div>
      </div>
    )
  }

  // STEP: UPLOAD
  return (
    <div className="space-y-4 max-w-2xl">
      <label
        htmlFor="excel-upload"
        className="block rounded-md border-2 border-dashed border-border bg-card hover:bg-muted/30 transition-colors p-8 cursor-pointer text-center"
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          {file ? (
            <>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · clique pra trocar
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Arraste seu .xlsx aqui ou clique pra escolher</p>
              <p className="text-xs text-muted-foreground">
                Aceita planilha do contador em qualquer formato — IA detecta as colunas
              </p>
              <p className="text-xs text-muted-foreground">Máx 10MB · 5000 linhas</p>
            </>
          )}
        </div>
        <input
          id="excel-upload"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={busy || !file}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          Enviar planilha
        </Button>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-left">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums mt-0.5">
        {value}{' '}
        {suffix && (
          <span className="text-xs font-normal text-muted-foreground">{suffix}</span>
        )}
      </p>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  color,
  mono,
}: {
  label: string
  value: string | number
  suffix?: string
  color?: 'emerald' | 'amber' | 'violet'
  mono?: boolean
}) {
  const colorClass =
    color === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : color === 'amber'
        ? 'text-amber-600 dark:text-amber-400'
        : ''
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <p className={`text-lg font-semibold mt-0.5 ${mono ? 'font-mono tabular-nums' : 'tabular-nums'} ${colorClass}`}>
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>
        )}
      </p>
    </div>
  )
}
