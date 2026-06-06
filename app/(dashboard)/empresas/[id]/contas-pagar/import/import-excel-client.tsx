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
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { ConfidenceSignal } from '@/components/pendentes/ConfidenceSignal'
import { uploadWithProgress } from '@/lib/excel-import/upload-with-progress'
import { errorInfo } from '@/lib/excel-import/error-codes'
import { detectExcelType } from '@/lib/excel-import/magic-bytes'

interface Props {
  empresaId: string
  empresaNome: string
}

type Step = 'UPLOAD' | 'DETECT' | 'REVIEW' | 'CONFIRMED'

// Sprint Reimport-DedupByData
interface ReimportInfo {
  scenario: 'NEVER_IMPORTED' | 'ALL_DELETED' | 'PARTIAL' | 'ALL_ALIVE'
  aliveCount: number
  totalImported: number
  reactivated: boolean
}

interface UploadResponse {
  batchId: string
  fileName?: string
  totalRows: number
  // Sprint 5.0.2.3 — quando duplicate=true, backend retorna shape mínimo
  // (sem re-parsear). Campos abaixo são opcionais e UI degrada graciosamente.
  duplicate?: boolean
  filteredCount?: number
  headers?: string[]
  totalSheets?: number
  sheetName?: string
  mapping?: {
    fields: Record<string, string | null>
    confidence: number
    reasoning: string
  }
  // Sprint Reimport-DedupByData: presente quando re-upload de planilha que
  // já foi enviada antes (mesmo fileHash). UI mostra banner explicativo.
  reimportInfo?: ReimportInfo | null
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

interface SkippedRowDetail {
  rowId: string
  rowIndex: number
  favorecido: string | null
  favorecidoConfidence: number | null
  valor: number
  vencimento: string | null
  descricao: string | null
  motivo: string
  motivoHumano: string
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
  skippedBreakdown?: {
    duplicate: number
    needsReview: number
    excluded: number
    noFavorecido: number
  }
  // Sprint Import-Transparência: lista detalhada de pendências pra UI mostrar
  // ações por linha (Importar mesmo / Editar / Excluir) sem deixar nada sumir.
  skippedRows?: SkippedRowDetail[]
  totalAmount: number
}

type UploadPhase =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing' // upload terminou, servidor processando
  | 'retrying'
  | 'error'

// Sprint CSV-Encoding: diagnóstico do CSV quando upload falha pra ler
interface CsvDiagnosticoUI {
  encoding: string
  bomDetected: boolean
  replacementCharsCount: number
  separator: string
  separatorLabel: string
  headers: string[]
  dataLineCount: number
  filteredBlankCount: number
  previewRows: string[][]
  mapping: {
    favorecido: string | null
    valor: string | null
    vencimento: string | null
    confidence: number
  }
  warnings: string[]
}

interface UploadError {
  code: string
  // Opcional: serverMessage técnico (mantido pra debug, não exibido cru)
  serverMessage?: string
  // Sprint CSV-Encoding: diagnóstico estruturado do CSV (quando aplicável)
  diagnostico?: CsvDiagnosticoUI
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
  // Sprint 5.0.2.3 — UX do upload (progress bar real + retry visual)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<UploadError | null>(null)

  // ─── Sprint 5.0.2.3 — Upload robusto: XHR + progress + retry + erros humanos ─
  async function handleUpload() {
    if (!file || busy) return
    setBusy(true)
    setUploadError(null)
    setUploadProgress(0)

    try {
      // Validação cliente (rápida — feedback instantâneo)
      setUploadPhase('validating')
      if (file.size > 10 * 1024 * 1024) {
        setUploadError({ code: 'FILE_TOO_LARGE' })
        setUploadPhase('error')
        return
      }
      // Sprint CSV Import (30/05/2026): aceita .csv também
      const isCsv = /\.csv$/i.test(file.name)
      const isExcel = /\.xlsx?$/i.test(file.name)
      if (!isCsv && !isExcel) {
        setUploadError({ code: 'FILE_TYPE_INVALID' })
        setUploadPhase('error')
        return
      }
      // Magic bytes só pra Excel — CSV é texto puro, valida no servidor
      if (isExcel) {
        const head = await file.slice(0, 8).arrayBuffer()
        if (detectExcelType(head) === 'INVALID') {
          setUploadError({ code: 'FILE_CORRUPTED' })
          setUploadPhase('error')
          return
        }
      }

      // Upload com XHR + progress + retry automático em network errors
      setUploadPhase('uploading')
      const result = await uploadWithProgress<UploadResponse>({
        url: `/api/empresas/${empresaId}/contas-pagar/import/upload`,
        file,
        onProgress: (p) => setUploadProgress(p.percent),
        onProcessing: () => setUploadPhase('processing'),
        onRetry: () => setUploadPhase('retrying'),
        timeoutMs: 90_000,
        maxRetries: 1,
      })

      if (!result.ok || !result.data) {
        // Sprint CSV-Encoding: extrai diagnostico se backend embarcou (CSV_NO_DATA / EMPTY_FILE / PARSE_FAILED)
        const data = (result.data as Record<string, unknown> | null) ?? {}
        const diag = data.diagnostico as CsvDiagnosticoUI | undefined
        setUploadError({
          code: result.errorCode ?? 'INTERNAL_ERROR',
          serverMessage: result.errorMessage,
          diagnostico: diag,
        })
        setUploadPhase('error')
        return
      }

      setUpload(result.data)
      setStep('DETECT')
      setUploadPhase('idle')
      toast({
        title: 'Upload OK',
        description: `${result.data.totalRows} linhas válidas (${result.data.filteredCount} filtradas)`,
      })
    } catch (err) {
      console.error('[UPLOAD] unexpected error:', err)
      setUploadError({ code: 'INTERNAL_ERROR' })
      setUploadPhase('error')
    } finally {
      setBusy(false)
    }
  }

  function resetUploadState() {
    setUploadError(null)
    setUploadPhase('idle')
    setUploadProgress(0)
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
      if (upload?.fileName) params.set('empresaNome', upload.fileName)
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  // ─── RENDER ────────────────────────────────────────────────────────

  if (step === 'CONFIRMED' && confirmResult) {
    const breakdown = confirmResult.skippedBreakdown
    const pendentesNotInUserList = confirmResult.skippedRows ?? []
    const excluidasPeloUser = breakdown?.excluded ?? 0
    const totalArquivo =
      confirmResult.transactionsCreated +
      excluidasPeloUser +
      pendentesNotInUserList.length

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Resumo honesto */}
        <div className="rounded-md border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Importação concluída</h3>
              <p className="text-xs text-muted-foreground">
                Resumo do arquivo (todas as linhas contadas)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <SummaryTile
              tone="emerald"
              label="Importadas"
              value={confirmResult.transactionsCreated}
              subtitle={`R$ ${formatBRL(confirmResult.totalAmount)} · ${confirmResult.paid} pagas · ${confirmResult.pending} a pagar`}
            />
            <SummaryTile
              tone="slate"
              label="Excluídas por você"
              value={excluidasPeloUser}
              subtitle={excluidasPeloUser === 0 ? '—' : 'marcadas na revisão'}
            />
            <SummaryTile
              tone={pendentesNotInUserList.length > 0 ? 'amber' : 'slate'}
              label="Puladas pelo sistema"
              value={pendentesNotInUserList.length}
              subtitle={
                pendentesNotInUserList.length > 0
                  ? 'precisam sua decisão ↓'
                  : 'nenhuma — limpo'
              }
            />
          </div>

          <div className="text-xs text-muted-foreground border-t pt-3">
            Total de linhas no arquivo: <strong>{totalArquivo}</strong> · novidades:{' '}
            {confirmResult.suppliersCreated} fornecedor
            {confirmResult.suppliersCreated === 1 ? '' : 'es'},{' '}
            {confirmResult.employeesCreated} funcionário
            {confirmResult.employeesCreated === 1 ? '' : 's'},{' '}
            {confirmResult.categoriesCreated} categoria
            {confirmResult.categoriesCreated === 1 ? '' : 's'}
          </div>
        </div>

        {/* Lista de pendentes (NEEDS_REVIEW + NO_FAVORECIDO + DUPLICATE) */}
        {pendentesNotInUserList.length > 0 && (
          <PendingRowsList
            empresaId={empresaId}
            batchId={confirmResult.batchId}
            initialRows={pendentesNotInUserList}
            onAllResolved={() => {
              toast({
                title: 'Tudo resolvido',
                description: 'Nenhuma linha pendente — pode seguir.',
                duration: 4000,
              })
            }}
          />
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push('/contas-a-pagar')}>
            Ver Contas a Pagar
          </Button>
          <Button onClick={goToDashboard} size="lg">
            Ir pro Dashboard
          </Button>
        </div>
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
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                        {/* Sprint Import-Transparência: badge âmbar preventivo
                            nas linhas NEEDS_REVIEW. Se user confirmar sem
                            decidir, vão cair na lista de "puladas pelo sistema"
                            do modal final — mas agora ele VÊ antes. */}
                        {r.userDecision === 'NEEDS_REVIEW' && !isExcluded && (
                          <span
                            className="text-[10px] font-semibold rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 inline-flex items-center gap-0.5"
                            title="Sistema marcou pra revisão. Confirme o favorecido (clique no checkbox) ou desmarque pra excluir — senão vai aparecer na lista de pendentes no final."
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Precisa decisão
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
    // Sprint 5.0.2.3 — guards pra caso `duplicate=true` (response mínimo do upload).
    // Se mapping/headers/etc estão ausentes, mostra info mínima sem crashar.
    const isDuplicate = upload.duplicate === true
    const filteredCount = upload.filteredCount ?? 0
    const headersCount = upload.headers?.length ?? null
    const totalSheets = upload.totalSheets ?? 1
    const mappingConfidence = upload.mapping?.confidence ?? null
    const mappingReasoning = upload.mapping?.reasoning ?? ''

    return (
      <div className="space-y-4">
        {/* Sprint Reimport-DedupByData: banner por cenário de reimport */}
        {upload.reimportInfo && (
          <ReimportBanner info={upload.reimportInfo} />
        )}
        {/* Mantém banner antigo só se backend não retornou reimportInfo */}
        {isDuplicate && !upload.reimportInfo && (
          <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            ⚠️ Esta planilha já foi enviada antes. Retomando o batch existente
            (você pode confirmar de novo — duplicatas vão ser puladas automaticamente).
          </div>
        )}
        <div className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="h-5 w-5 text-violet-600" />
            <h3 className="font-medium">{upload.fileName ?? 'Planilha'}</h3>
          </div>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground tabular-nums">{upload.totalRows}</strong> linhas válidas
              {filteredCount > 0 && ` (${filteredCount} filtradas — totais/vazias)`}
            </li>
            {headersCount !== null && (
              <li>
                <strong className="text-foreground tabular-nums">{headersCount}</strong> colunas detectadas
                {totalSheets > 1 &&
                  upload.sheetName &&
                  ` · aba "${upload.sheetName}" de ${totalSheets}`}
              </li>
            )}
            {mappingConfidence !== null && (
              <li>
                Mapeamento heurístico: confidence{' '}
                <strong>{Math.round(mappingConfidence * 100)}%</strong>
                {mappingReasoning && ` · ${mappingReasoning}`}
              </li>
            )}
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

  // STEP: UPLOAD — Sprint 5.0.2.3 com progress bar + alert inline retry
  const errInfo = uploadError ? errorInfo(uploadError.code) : null
  const phaseLabel: Record<UploadPhase, string> = {
    idle: '',
    validating: 'Validando arquivo…',
    uploading: `Enviando… ${uploadProgress}%`,
    processing: 'Servidor processando planilha…',
    retrying: 'Erro de rede, tentando de novo…',
    error: '',
  }
  const isInFlight =
    uploadPhase === 'validating' ||
    uploadPhase === 'uploading' ||
    uploadPhase === 'processing' ||
    uploadPhase === 'retrying'

  return (
    <div className="space-y-4 max-w-2xl">
      <label
        htmlFor="excel-upload"
        aria-disabled={isInFlight}
        className={`block rounded-md border-2 border-dashed bg-card transition-colors p-8 text-center ${
          isInFlight
            ? 'border-border opacity-60 cursor-not-allowed'
            : 'border-border hover:bg-muted/30 cursor-pointer'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-muted-foreground" />
          {file ? (
            <>
              <p className="text-sm font-medium" data-testid="upload-filename">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · clique pra trocar
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Arraste seu .xlsx ou .csv aqui ou clique pra escolher</p>
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={isInFlight}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            resetUploadState()
          }}
        />
      </label>

      {/* Sprint 5.0.2.3 — Progress bar real durante upload */}
      {isInFlight && (
        <div
          className="rounded-md border bg-card p-4 space-y-2"
          data-testid="upload-progress"
        >
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-muted-foreground">{phaseLabel[uploadPhase]}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{
                width: `${
                  uploadPhase === 'uploading'
                    ? uploadProgress
                    : uploadPhase === 'processing' || uploadPhase === 'retrying'
                      ? 100
                      : 5
                }%`,
              }}
              data-testid="upload-progress-bar"
            />
          </div>
          {uploadPhase === 'processing' && (
            <p className="text-xs text-muted-foreground">
              Pode levar até 30 segundos pra planilhas grandes.
            </p>
          )}
        </div>
      )}

      {/* Sprint 5.0.2.3 — Erro inline com retry humano */}
      {uploadPhase === 'error' && errInfo && (
        <div
          className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4"
          data-testid="upload-error"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
                  {errInfo.title}
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                  {uploadError?.serverMessage ?? errInfo.description}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-red-600/70 dark:text-red-400/70 mt-1.5 font-mono">
                  cód: {uploadError?.code}
                </p>
              </div>
              {/* Sprint CSV-Encoding: diagnóstico estruturado quando backend embarca */}
              {uploadError?.diagnostico && (
                <CsvDiagnosticDetail diag={uploadError.diagnostico} />
              )}
              {errInfo.retryable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUpload}
                  disabled={busy || !file}
                  data-testid="upload-retry"
                >
                  <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                  Tentar de novo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleUpload}
          disabled={busy || !file || isInFlight}
          data-testid="upload-submit"
        >
          {isInFlight ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          {isInFlight ? 'Enviando…' : 'Enviar planilha'}
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

// ============================================================================
// Sprint Import-Transparência — SummaryTile + PendingRowsList
// ============================================================================

function SummaryTile({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string
  value: number
  subtitle: string
  tone: 'emerald' | 'amber' | 'slate'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900'
        : 'border-slate-200 bg-slate-50/40 dark:bg-slate-900/20 dark:border-slate-800'
  const valueClass =
    tone === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-slate-700 dark:text-slate-300'
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}

interface PendingRowsListProps {
  empresaId: string
  batchId: string
  initialRows: SkippedRowDetail[]
  onAllResolved: () => void
}

function PendingRowsList({
  empresaId,
  batchId,
  initialRows,
  onAllResolved,
}: PendingRowsListProps) {
  const { toast } = useToast()
  const [rows, setRows] = useState<SkippedRowDetail[]>(initialRows)
  // Sprint Import-Transparência: status local por linha — pra travar buttons
  // enquanto a request rola e mostrar resultado individual.
  const [busyById, setBusyById] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    rawFavorecido: string
    valor: string
    vencimento: string
  } | null>(null)

  async function resolve(
    rowId: string,
    action: 'IMPORT' | 'IMPORT_EDITED' | 'EXCLUDE',
    overrides?: Record<string, unknown>,
  ) {
    setBusyById((p) => new Set(p).add(rowId))
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/contas-pagar/import/${batchId}/resolve-row`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowId, action, overrides }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const verb =
        action === 'EXCLUDE'
          ? 'excluída'
          : action === 'IMPORT'
            ? 'importada'
            : 'importada com edição'
      toast({ title: `Linha ${verb}` })
      setRows((p) => {
        const next = p.filter((r) => r.rowId !== rowId)
        if (next.length === 0) onAllResolved()
        return next
      })
      setEditingId(null)
      setEditForm(null)
    } finally {
      setBusyById((p) => {
        const n = new Set(p)
        n.delete(rowId)
        return n
      })
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
        <Check className="h-5 w-5 text-emerald-600" />
        <p className="text-sm">
          <strong>Tudo resolvido.</strong> Nenhuma linha pendente.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {rows.length} linha{rows.length === 1 ? '' : 's'} pulada
          {rows.length === 1 ? '' : 's'} — decida o que fazer com cada uma:
        </p>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const isBusy = busyById.has(r.rowId)
          const isEditing = editingId === r.rowId

          return (
            <div
              key={r.rowId}
              className="rounded border bg-card p-3 text-sm space-y-2"
            >
              {/* Header da linha: linha + favorecido + motivo */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                      Linha {r.rowIndex}
                    </span>
                    <span className="font-medium break-words">
                      {r.favorecido || (
                        <span className="italic text-muted-foreground">
                          (favorecido vazio)
                        </span>
                      )}
                    </span>
                    {r.favorecidoConfidence !== null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {Math.round(r.favorecidoConfidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    {r.motivoHumano}
                  </p>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <p className="text-sm font-mono font-semibold">
                    R$ {formatBRL(r.valor)}
                  </p>
                  {r.vencimento && (
                    <p className="text-[10px] text-muted-foreground">
                      vence {formatDate(r.vencimento)}
                    </p>
                  )}
                </div>
              </div>

              {r.descricao && (
                <p className="text-xs text-muted-foreground break-words border-l-2 border-muted pl-2">
                  {r.descricao}
                </p>
              )}

              {/* Form de edição (aparece quando "Editar e importar") */}
              {isEditing && editForm && (
                <div className="rounded bg-muted/30 p-2.5 space-y-2">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Corrigir antes de importar
                  </p>
                  <input
                    type="text"
                    value={editForm.rawFavorecido}
                    onChange={(e) =>
                      setEditForm({ ...editForm, rawFavorecido: e.target.value })
                    }
                    placeholder="Favorecido"
                    className="w-full px-2 py-1 text-sm rounded border bg-background"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.valor}
                      onChange={(e) =>
                        setEditForm({ ...editForm, valor: e.target.value })
                      }
                      placeholder="Valor"
                      className="px-2 py-1 text-sm rounded border bg-background tabular-nums"
                    />
                    <input
                      type="date"
                      value={editForm.vencimento}
                      onChange={(e) =>
                        setEditForm({ ...editForm, vencimento: e.target.value })
                      }
                      className="px-2 py-1 text-sm rounded border bg-background"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(null)
                        setEditForm(null)
                      }}
                      disabled={isBusy}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const overrides: Record<string, unknown> = {
                          rawFavorecido: editForm.rawFavorecido.trim(),
                          valor: Number(editForm.valor),
                        }
                        if (editForm.vencimento) {
                          overrides.vencimento = new Date(
                            editForm.vencimento,
                          ).toISOString()
                        }
                        void resolve(r.rowId, 'IMPORT_EDITED', overrides)
                      }}
                      disabled={
                        isBusy ||
                        !editForm.rawFavorecido.trim() ||
                        !editForm.valor ||
                        Number(editForm.valor) <= 0
                      }
                    >
                      {isBusy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Importar editada
                    </Button>
                  </div>
                </div>
              )}

              {/* Ações */}
              {!isEditing && (
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(r.rowId)
                      setEditForm({
                        rawFavorecido: r.favorecido ?? '',
                        valor: String(r.valor),
                        vencimento: r.vencimento
                          ? r.vencimento.split('T')[0]
                          : '',
                      })
                    }}
                    disabled={isBusy}
                  >
                    Editar e importar
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => void resolve(r.rowId, 'IMPORT')}
                    disabled={isBusy || !r.favorecido}
                    title={
                      !r.favorecido
                        ? 'Favorecido vazio — use Editar pra preencher'
                        : 'Importa com os dados originais'
                    }
                  >
                    {isBusy && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Importar mesmo assim
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void resolve(r.rowId, 'EXCLUDE')}
                    disabled={isBusy}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Sprint CSV-Encoding — CsvDiagnosticDetail
// Mostra encoding/separador/headers/preview/warnings em banner expansível.
// ============================================================================

function CsvDiagnosticDetail({ diag }: { diag: CsvDiagnosticoUI }) {
  return (
    <div className="rounded border border-red-300 dark:border-red-800 bg-white/70 dark:bg-black/20 p-3 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-red-900 dark:text-red-200 font-semibold">
        <Sparkles className="h-3.5 w-3.5" />
        Diagnóstico do arquivo
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium text-muted-foreground">Encoding:</dt>
        <dd className="font-mono">
          {diag.encoding}
          {diag.bomDetected && (
            <span className="ml-1 text-[10px] text-muted-foreground">(BOM)</span>
          )}
        </dd>
        <dt className="font-medium text-muted-foreground">Separador:</dt>
        <dd>{diag.separatorLabel}</dd>
        <dt className="font-medium text-muted-foreground">Cabeçalhos lidos:</dt>
        <dd className="break-words">
          {diag.headers.length === 0 ? (
            <span className="italic text-muted-foreground">(nenhum)</span>
          ) : (
            diag.headers.join(' | ')
          )}
        </dd>
        <dt className="font-medium text-muted-foreground">Linhas de dado:</dt>
        <dd className="tabular-nums">
          {diag.dataLineCount}
          {diag.filteredBlankCount > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              (+{diag.filteredBlankCount} em branco filtradas)
            </span>
          )}
        </dd>
        <dt className="font-medium text-muted-foreground">Mapping:</dt>
        <dd>
          <span className={diag.mapping.favorecido ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
            favorecido: {diag.mapping.favorecido ?? '—'}
          </span>
          {' · '}
          <span className={diag.mapping.valor ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
            valor: {diag.mapping.valor ?? '—'}
          </span>
          {' · '}
          <span className={diag.mapping.vencimento ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
            vencimento: {diag.mapping.vencimento ?? '—'}
          </span>
        </dd>
      </dl>

      {diag.previewRows.length > 0 && (
        <div className="border-t pt-2 mt-2">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mb-1">
            Primeiras linhas lidas
          </p>
          <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-words bg-muted/30 p-2 rounded">
            {diag.previewRows
              .map((r) => r.join(' | '))
              .join('\n')}
          </pre>
        </div>
      )}

      {diag.warnings.length > 0 && (
        <div className="border-t pt-2 mt-2 space-y-1">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">
            Avisos
          </p>
          {diag.warnings.map((w, i) => (
            <p
              key={i}
              className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1"
            >
              <span className="shrink-0">•</span>
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground border-t pt-2 mt-2">
        Esperado: colunas tipo <strong>Favorecido</strong>, <strong>Descrição</strong>,{' '}
        <strong>Valor</strong>, <strong>Vencimento</strong>. Separador{' '}
        <code>;</code> ou <code>,</code>.
      </p>
    </div>
  )
}

// ============================================================================
// Sprint Reimport-DedupByData — ReimportBanner
// 4 cenários de re-upload de planilha que já passou por aqui:
//   NEVER_IMPORTED — havia batch antigo mas zero linhas viraram tx (cancelado)
//   ALL_DELETED    — todas N foram criadas E todas foram deletadas no /CAP
//   PARTIAL        — algumas vivas, algumas excluídas
//   ALL_ALIVE      — todas as N continuam no sistema
// ============================================================================

function ReimportBanner({ info }: { info: ReimportInfo }) {
  if (info.scenario === 'ALL_DELETED') {
    return (
      <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm flex items-start gap-2">
        <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-emerald-900 dark:text-emerald-200">
          <strong>Importação liberada.</strong> Você importou esta planilha
          antes ({info.totalImported} contas) mas todas foram excluídas. Vou
          reimportar do zero — as {info.totalImported} entram normais.
        </div>
      </div>
    )
  }
  if (info.scenario === 'PARTIAL') {
    return (
      <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-amber-900 dark:text-amber-200">
          <strong>
            {info.aliveCount} de {info.totalImported}
          </strong>{' '}
          contas dessa planilha já estão no sistema (não foram excluídas). Vou
          pular essas {info.aliveCount} automaticamente — só importo as{' '}
          {info.totalImported - info.aliveCount} restantes.
        </div>
      </div>
    )
  }
  if (info.scenario === 'ALL_ALIVE') {
    return (
      <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 text-sm flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
        <div className="text-slate-900 dark:text-slate-200">
          <strong>Esta planilha já está 100% importada.</strong> As{' '}
          {info.totalImported} contas continuam no sistema. Se confirmar, todas
          vão ser puladas (dedup automático). Se quer mesmo reimportar, exclua
          antes em /contas-a-pagar.
        </div>
      </div>
    )
  }
  // NEVER_IMPORTED — batch existia mas zero linhas viraram tx; segue normal
  return null
}
