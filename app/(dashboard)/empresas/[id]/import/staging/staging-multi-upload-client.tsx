'use client'

// Sprint 5.0.2.u — Multi-Statement Staging client.
//
// Steps:
//   1. UPLOAD — dropzones por conta
//   2. DETECT — clica analisar; sistema marca transferências
//   3. REVIEW — user aceita/rejeita cada par
//   4. CONFIRM — importa pra Transaction

import { useState } from 'react'
import {
  Loader2,
  Upload,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { ConfidenceSignal } from '@/components/pendentes/ConfidenceSignal'

interface Conta {
  id: string
  name: string
  bankName: string | null
}

interface Props {
  empresaId: string
  empresaCnpj: string
  contas: Conta[]
}

interface UploadedFile {
  contaId: string
  file: File
}

interface UploadResultDTO {
  fileName: string
  bankAccountId: string
  stagingId?: string
  status: 'CREATED' | 'DUPLICATE' | 'ERROR'
  totalTransactions?: number
  error?: string
}

interface DetectionSample {
  debit: { id: string; description: string; amount: number }
  credit: { id: string; description: string; amount: number }
  confidence: number
  reason: string | null
}

type Step = 'UPLOAD' | 'DETECT' | 'REVIEW' | 'CONFIRMED'

export function StagingMultiUploadClient({
  empresaId,
  contas,
}: Props) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('UPLOAD')
  const [uploaded, setUploaded] = useState<Record<string, File | null>>({})
  const [busy, setBusy] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [uploadResults, setUploadResults] = useState<UploadResultDTO[]>([])
  const [detections, setDetections] = useState<DetectionSample[]>([])
  const [rejectedPairs, setRejectedPairs] = useState<Set<string>>(new Set())

  function handleFile(contaId: string, file: File | null) {
    setUploaded((prev) => ({ ...prev, [contaId]: file }))
  }

  const filesCount = Object.values(uploaded).filter(Boolean).length

  async function handleUpload() {
    if (busy || filesCount === 0) return
    setBusy(true)
    try {
      const fd = new FormData()
      let idx = 0
      for (const conta of contas) {
        const f = uploaded[conta.id]
        if (!f) continue
        fd.append(`file_${idx}`, f)
        fd.append(`file_${idx}_bankAccountId`, conta.id)
        fd.append(`file_${idx}_name`, f.name)
        idx++
      }
      const res = await fetch(
        `/api/empresas/${empresaId}/import/staging/upload`,
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
      setBatchId(data.batchId)
      setUploadResults(data.files ?? [])
      setStep('DETECT')
      toast({ title: 'Upload concluído', description: `${idx} extratos enviados` })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDetect() {
    if (!batchId || busy) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/import/staging/${batchId}/detect`,
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
      setDetections(data.samples ?? [])
      setStep('REVIEW')
      toast({
        title: `${data.detections} transferências detectadas`,
        description:
          data.detections === 0
            ? 'Nenhum par PIX cross-account encontrado — clique Confirmar pra importar normal'
            : `Revise antes de confirmar`,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  function toggleReject(debitId: string) {
    setRejectedPairs((prev) => {
      const next = new Set(prev)
      if (next.has(debitId)) next.delete(debitId)
      else next.add(debitId)
      return next
    })
  }

  async function handleConfirm() {
    if (!batchId || busy) return
    setBusy(true)
    try {
      const transfersToKeep = detections
        .filter((d) => !rejectedPairs.has(d.debit.id))
        .map((d) => d.debit.id)
      const transfersToReject = detections
        .filter((d) => rejectedPairs.has(d.debit.id))
        .map((d) => d.debit.id)

      const res = await fetch(
        `/api/empresas/${empresaId}/import/staging/${batchId}/confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transfersToKeep, transfersToReject }),
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
      setStep('CONFIRMED')
      toast({
        title: `${data.imported} transações importadas`,
        description: `${data.transfersMarked} transferências internas marcadas`,
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro de rede' })
    } finally {
      setBusy(false)
    }
  }

  // ─── RENDER ────────────────────────────────────────────────────────

  if (step === 'CONFIRMED') {
    return (
      <div className="rounded-md border bg-card p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium">Import concluído</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          As transações foram importadas com transferências marcadas corretamente.
        </p>
        <Button
          onClick={() => {
            setStep('UPLOAD')
            setUploaded({})
            setBatchId(null)
            setUploadResults([])
            setDetections([])
            setRejectedPairs(new Set())
          }}
        >
          Novo batch
        </Button>
      </div>
    )
  }

  if (step === 'REVIEW') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-violet-500/5 border-violet-500/20 px-4 py-3">
          <p className="text-sm font-medium">
            {detections.length === 0
              ? 'Nenhuma transferência detectada'
              : `${detections.length} pares de transferência`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {detections.length === 0
              ? 'Clique "Confirmar" pra importar as transações como pendentes normais.'
              : 'Desmarque pares que NÃO são transferência interna.'}
          </p>
        </div>

        {detections.length > 0 && (
          <div className="rounded-md border divide-y">
            {detections.map((d) => {
              const aceito = !rejectedPairs.has(d.debit.id)
              return (
                <div
                  key={d.debit.id}
                  className={`px-4 py-3 ${aceito ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Checkbox
                      checked={aceito}
                      onCheckedChange={() => toggleReject(d.debit.id)}
                    />
                    <ConfidenceSignal confidence={d.confidence} />
                    <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                      R$ {formatBRL(d.debit.amount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pl-8 text-sm">
                    <div className="flex items-start gap-2 min-w-0">
                      <ArrowUpRight className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <p className="truncate" title={d.debit.description}>
                        {d.debit.description}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <p className="truncate" title={d.credit.description}>
                        {d.credit.description}
                      </p>
                    </div>
                  </div>
                  {d.reason && (
                    <p className="text-[11px] text-muted-foreground italic mt-1 pl-8">
                      {d.reason}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setStep('DETECT')} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Confirmar import
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'DETECT') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-card p-4">
          <h3 className="text-sm font-medium mb-2">Upload concluído</h3>
          <ul className="space-y-1 text-sm">
            {uploadResults.map((r) => (
              <li key={r.fileName} className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{r.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {r.status === 'CREATED' && `· ${r.totalTransactions} tx`}
                  {r.status === 'DUPLICATE' && '· duplicado (já enviado antes)'}
                  {r.status === 'ERROR' && `· erro: ${r.error}`}
                </span>
              </li>
            ))}
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
              <ArrowLeftRight className="h-4 w-4 mr-1" />
            )}
            Analisar transferências
          </Button>
        </div>
      </div>
    )
  }

  // STEP: UPLOAD
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {contas.map((conta) => {
          const f = uploaded[conta.id]
          return (
            <label
              key={conta.id}
              htmlFor={`file-${conta.id}`}
              className="block rounded-md border-2 border-dashed border-border bg-card hover:bg-muted/30 transition-colors p-4 cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <Upload className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{conta.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {conta.bankName ?? 'Banco?'}
                  </p>
                  {f ? (
                    <p className="text-xs text-emerald-600 mt-2 truncate">
                      ✓ {f.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      Clique pra escolher OFX
                    </p>
                  )}
                </div>
              </div>
              <input
                id={`file-${conta.id}`}
                type="file"
                accept=".ofx,.qfx"
                className="hidden"
                onChange={(e) =>
                  handleFile(conta.id, e.target.files?.[0] ?? null)
                }
              />
            </label>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={busy || filesCount === 0}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Upload className="h-4 w-4 mr-1" />
          )}
          Enviar {filesCount} {filesCount === 1 ? 'extrato' : 'extratos'}
        </Button>
      </div>
    </div>
  )
}
