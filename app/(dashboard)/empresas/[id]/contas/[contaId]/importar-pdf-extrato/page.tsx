// Sprint PDF Extrato Bancário (24/06/2026) — tela de conferência.
//
// Fluxo:
//  1. Upload PDF → POST /preview → recebe linhas extraídas + dedup + totais
//  2. UI mostra banner verde/âmbar + tabela editável
//  3. User: edita linhas, adiciona manualmente, remove (desmarcar)
//  4. Confirma → POST /confirm → cria Transactions

'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Pencil,
  X,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface PreviewLine {
  index: number
  date: string
  description: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  balanceAfter: number | null
  needsReview: boolean
  note: string | null
  isDuplicate: boolean
  duplicateReason: 'DUPLICATE_CONTENT' | null
  contentHash: string
}

interface PreviewResponse {
  conta: {
    id: string
    name: string
    bankName: string | null
    balance: number
    ledgerBal: number | null
  }
  extraction: {
    openingBalance: number | null
    closingBalance: number | null
    periodStart: string | null
    periodEnd: string | null
    detectedBank: string | null
    scanQuality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'
    notes: string[]
  }
  totals: {
    matches: boolean
    insufficient: boolean
    totalEntradas: number
    totalSaidas: number
    saldoCalculado: number | null
    saldoDeclarado: number | null
    diferenca: number | null
    message: string
  }
  lines: PreviewLine[]
  counts: { total: number; novas: number; duplicatas: number; precisaRevisar: number }
  metrics: { durationMs: number; model: string; inputTokens: number; outputTokens: number }
}

interface EditableLine extends PreviewLine {
  selected: boolean
  isEditing: boolean
  /** true se foi adicionada manualmente pelo usuário (não veio do PDF) */
  isManuallyAdded: boolean
}

type ImportStep = 'UPLOAD' | 'PREVIEW' | 'IMPORTING' | 'DONE'

export default function ImportarPdfExtratoPage() {
  const params = useParams<{ id: string; contaId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>('UPLOAD')
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [editableLines, setEditableLines] = useState<EditableLine[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)
  const [progressLabel, setProgressLabel] = useState<string>('')
  const [result, setResult] = useState<{ inseridas: number; duplicadas: number; total: number } | null>(null)

  // ──────────────────────────────────────────────────────────────
  // Step 1: Upload + chama Claude Vision
  // ──────────────────────────────────────────────────────────────
  async function handleUpload(selectedFile: File) {
    setFile(selectedFile)
    setExtractError(null)
    setStep('IMPORTING')
    setProgressLabel('Lendo PDF com IA…')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const resp = await fetch(
        `/api/contas-bancarias/${params.contaId}/importar-pdf-extrato/preview`,
        { method: 'POST', body: formData, credentials: 'include' },
      )
      const json = await resp.json()
      if (!resp.ok) {
        setExtractError(json.erro || 'Erro na extração')
        setStep('UPLOAD')
        return
      }
      const data = json as PreviewResponse
      setPreviewData(data)
      setEditableLines(
        data.lines.map((l) => ({
          ...l,
          selected: !l.isDuplicate, // Duplicatas começam desmarcadas
          isEditing: false,
          isManuallyAdded: false,
        })),
      )
      setStep('PREVIEW')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Erro de rede')
      setStep('UPLOAD')
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Step 2: ações da tela de conferência
  // ──────────────────────────────────────────────────────────────
  function toggleSelect(idx: number) {
    setEditableLines((prev) =>
      prev.map((l) => (l.index === idx ? { ...l, selected: !l.selected } : l)),
    )
  }
  function selectAll(value: boolean) {
    setEditableLines((prev) => prev.map((l) => ({ ...l, selected: value })))
  }
  function toggleEdit(idx: number) {
    setEditableLines((prev) =>
      prev.map((l) => (l.index === idx ? { ...l, isEditing: !l.isEditing } : l)),
    )
  }
  function updateLine(idx: number, patch: Partial<EditableLine>) {
    setEditableLines((prev) =>
      prev.map((l) => (l.index === idx ? { ...l, ...patch } : l)),
    )
  }
  function addManualLine() {
    const nextIndex =
      (editableLines.length > 0 ? Math.max(...editableLines.map((l) => l.index)) : -1) + 1
    setEditableLines((prev) => [
      ...prev,
      {
        index: nextIndex,
        date: new Date().toISOString().slice(0, 10),
        description: '',
        amount: 0,
        type: 'DEBIT',
        balanceAfter: null,
        needsReview: false,
        note: null,
        isDuplicate: false,
        duplicateReason: null,
        contentHash: '',
        selected: true,
        isEditing: true,
        isManuallyAdded: true,
      },
    ])
  }
  function removeLine(idx: number) {
    setEditableLines((prev) => prev.filter((l) => l.index !== idx))
  }

  // ──────────────────────────────────────────────────────────────
  // Step 3: confirmação
  // ──────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!previewData) return
    const linesToImport = editableLines
      .filter((l) => l.selected && l.description.trim() && l.amount > 0)
      .map((l) => ({
        date: l.date,
        description: l.description.trim(),
        amount: l.amount,
        type: l.type,
      }))

    if (linesToImport.length === 0) {
      toast({
        title: 'Nada pra importar',
        description: 'Marque pelo menos 1 linha válida.',
        variant: 'destructive',
      })
      return
    }

    setStep('IMPORTING')
    setProgressLabel(`Importando ${linesToImport.length} transações…`)

    try {
      const resp = await fetch(
        `/api/contas-bancarias/${params.contaId}/importar-pdf-extrato/confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fileName: file?.name ?? 'extrato.pdf',
            fileSizeBytes: file?.size ?? 0,
            detectedBank: previewData.extraction.detectedBank,
            openingBalance: previewData.extraction.openingBalance,
            closingBalance: previewData.extraction.closingBalance,
            periodStart: previewData.extraction.periodStart,
            periodEnd: previewData.extraction.periodEnd,
            totalsMatched: previewData.totals.matches,
            lines: linesToImport,
          }),
        },
      )
      const json = await resp.json()
      if (!resp.ok) {
        toast({
          title: 'Erro na importação',
          description: json.erro || 'Tente novamente',
          variant: 'destructive',
        })
        setStep('PREVIEW')
        return
      }
      setResult({
        inseridas: json.inseridas,
        duplicadas: json.duplicadas,
        total: json.total,
      })
      setStep('DONE')
    } catch (err) {
      toast({
        title: 'Erro de rede',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      })
      setStep('PREVIEW')
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  const selectedCount = editableLines.filter((l) => l.selected).length
  const entradasSelecionadas = editableLines
    .filter((l) => l.selected && l.type === 'CREDIT')
    .reduce((s, l) => s + l.amount, 0)
  const saidasSelecionadas = editableLines
    .filter((l) => l.selected && l.type === 'DEBIT')
    .reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-6">
      <Header
        title="Importar extrato (PDF)"
        description="Use quando o banco não exporta OFX. A IA lê o PDF e você confere antes de importar."
      >
        <Link
          href={`/empresas/${params.id}/contas/${params.contaId}/importar`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar pra OFX
        </Link>
      </Header>

      {step === 'UPLOAD' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Selecione o PDF do extrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suporta PDFs até 10 MB. Funciona melhor com extratos digitais
              (não foto). Recomendado pro <strong>Caixa Econômica Federal</strong>{' '}
              que não exporta OFX nativamente.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium">Clique pra selecionar PDF</p>
              <p className="text-xs text-muted-foreground mt-1">
                ou arraste o arquivo aqui
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            {extractError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{extractError}</p>
              </div>
            )}
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-800">
                <strong>OFX é sempre preferido</strong> quando disponível — é
                100% confiável. PDF é plano B e a IA pode errar; por isso a
                tela de conferência onde você revisa <strong>antes</strong> de
                importar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'IMPORTING' && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="font-medium">{progressLabel}</p>
            <p className="text-xs text-muted-foreground">
              Pode levar 30-60s pra extratos grandes
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'PREVIEW' && previewData && (
        <>
          {/* Banner de totais */}
          <Card
            className={
              previewData.totals.matches
                ? 'border-emerald-200 bg-emerald-50/40'
                : previewData.totals.insufficient
                  ? 'border-slate-200 bg-slate-50/40'
                  : 'border-amber-200 bg-amber-50/40'
            }
          >
            <CardContent className="py-4 flex items-start gap-3">
              {previewData.totals.matches ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : previewData.totals.insufficient ? (
                <FileText className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    previewData.totals.matches
                      ? 'text-emerald-800'
                      : previewData.totals.insufficient
                        ? 'text-slate-700'
                        : 'text-amber-800'
                  }`}
                >
                  {previewData.totals.matches
                    ? 'Totais conferem com o extrato'
                    : previewData.totals.insufficient
                      ? 'Conferência incompleta'
                      : 'A soma não fecha com o extrato'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewData.totals.message}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">
                  Vão importar
                </p>
                <p className="text-xl font-bold">
                  {selectedCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{editableLines.length}
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatBRL(entradasSelecionadas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="text-xl font-bold text-red-700">
                  {formatBRL(saidasSelecionadas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Duplicatas</p>
                <p className="text-xl font-bold text-amber-700">
                  {previewData.counts.duplicatas}
                </p>
              </CardContent>
            </Card>
          </div>

          {previewData.extraction.detectedBank && (
            <div className="text-xs text-muted-foreground">
              Banco detectado:{' '}
              <strong>{previewData.extraction.detectedBank}</strong> · Qualidade
              do scan: <strong>{previewData.extraction.scanQuality}</strong>
              {previewData.extraction.periodStart && (
                <>
                  {' '}
                  · Período:{' '}
                  <strong>
                    {fmtDateBR(previewData.extraction.periodStart)} →{' '}
                    {fmtDateBR(previewData.extraction.periodEnd || '')}
                  </strong>
                </>
              )}
            </div>
          )}

          {/* Tabela editável */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">Linhas extraídas</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Confira antes de importar. Duplicatas em âmbar não são
                  importadas a menos que você marque.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectAll(true)}>
                  Marcar todas
                </Button>
                <Button variant="outline" size="sm" onClick={() => selectAll(false)}>
                  Desmarcar todas
                </Button>
                <Button variant="outline" size="sm" onClick={addManualLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar linha
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 w-8"></th>
                      <th className="text-left py-2 w-28">Data</th>
                      <th className="text-left py-2">Descrição</th>
                      <th className="text-right py-2 w-32">Valor</th>
                      <th className="text-center py-2 w-24">Tipo</th>
                      <th className="text-right py-2 w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableLines.map((l) => (
                      <EditableRow
                        key={l.index}
                        line={l}
                        onToggleSelect={() => toggleSelect(l.index)}
                        onToggleEdit={() => toggleEdit(l.index)}
                        onUpdate={(patch) => updateLine(l.index, patch)}
                        onRemove={() => removeLine(l.index)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCount === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Importar {selectedCount} transações
            </Button>
          </div>
        </>
      )}

      {step === 'DONE' && result && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Importação concluída</p>
              <p className="text-sm text-muted-foreground">
                {result.inseridas} transações importadas · {result.duplicadas}{' '}
                duplicatas ignoradas
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('UPLOAD')
                  setFile(null)
                  setPreviewData(null)
                  setEditableLines([])
                  setResult(null)
                }}
              >
                Importar outro PDF
              </Button>
              <Link href={`/empresas/${params.id}/contas/${params.contaId}/transacoes`}>
                <Button>Ver transações</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Editable row
// ─────────────────────────────────────────────────────────────
function EditableRow({
  line,
  onToggleSelect,
  onToggleEdit,
  onUpdate,
  onRemove,
}: {
  line: EditableLine
  onToggleSelect: () => void
  onToggleEdit: () => void
  onUpdate: (patch: Partial<EditableLine>) => void
  onRemove: () => void
}) {
  const rowClass = !line.selected
    ? 'opacity-50'
    : line.isDuplicate
      ? 'bg-amber-50/50'
      : line.needsReview
        ? 'bg-yellow-50/40'
        : ''

  return (
    <tr className={`border-b last:border-0 ${rowClass}`}>
      <td className="py-2">
        <input
          type="checkbox"
          checked={line.selected}
          onChange={onToggleSelect}
          className="h-4 w-4"
        />
      </td>
      <td className="py-2">
        {line.isEditing ? (
          <Input
            type="date"
            value={line.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            className="h-8 text-sm"
          />
        ) : (
          <span className="text-sm">{fmtDateBR(line.date)}</span>
        )}
      </td>
      <td className="py-2 pr-2">
        {line.isEditing ? (
          <Input
            value={line.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="h-8 text-sm"
            placeholder="Descrição"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm">{line.description}</span>
            {line.isDuplicate && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                já existe
              </Badge>
            )}
            {line.needsReview && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">
                revisar
              </Badge>
            )}
            {line.isManuallyAdded && (
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                manual
              </Badge>
            )}
          </div>
        )}
      </td>
      <td className="py-2 text-right">
        {line.isEditing ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={line.amount}
            onChange={(e) => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm text-right tabular-nums"
          />
        ) : (
          <span
            className={`tabular-nums text-sm font-medium ${
              line.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {line.type === 'CREDIT' ? '+ ' : '− '}
            {formatBRL(line.amount)}
          </span>
        )}
      </td>
      <td className="py-2 text-center">
        {line.isEditing ? (
          <select
            value={line.type}
            onChange={(e) =>
              onUpdate({ type: e.target.value as 'CREDIT' | 'DEBIT' })
            }
            className="text-sm border rounded h-8 px-1"
          >
            <option value="CREDIT">Entrada</option>
            <option value="DEBIT">Saída</option>
          </select>
        ) : line.type === 'CREDIT' ? (
          <ArrowUpRight className="h-4 w-4 text-emerald-600 inline" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-600 inline" />
        )}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleEdit}
            title={line.isEditing ? 'Concluir edição' : 'Editar'}
          >
            {line.isEditing ? (
              <Save className="h-3.5 w-3.5" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:bg-red-50"
            onClick={onRemove}
            title="Remover"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function fmtDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
