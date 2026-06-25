// Sprint Cartao Credito PJ — tela de conferencia (IA sugere, user decide)

'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Pencil,
  X,
  Save,
  ArrowLeft,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

type LineKind = 'COMPRA_AVISTA' | 'COMPRA_PARCELADA' | 'ENCARGO_FINANCEIRO' | 'IGNORAR'

interface CategoryOption {
  id: string
  name: string
  type: string
  dreGroup: string | null
}

interface PreviewLine {
  index: number
  date: string
  description: string
  amount: number
  suggestedKind: LineKind
  installmentNumber: number | null
  installmentTotal: number | null
  cardLastDigits: string | null
  needsReview: boolean
  note: string | null
  contentHash: string
  isDuplicate: boolean
  suggestedCategoryId: string | null
  suggestedCategorySource: 'RULE' | 'KEYWORD' | 'DEFAULT' | 'NONE'
  suggestedConfidence: number
}

interface PaymentCandidate {
  id: string
  date: string
  description: string
  amount: number
  bankAccountId: string | null
  bankAccountName: string | null
  currentCategoryName: string | null
}

interface PreviewResponse {
  card: { id: string; name: string; bankName: string | null; lastDigits: string | null; creditLimit: number }
  extraction: {
    dueDate: string | null
    closingDate: string | null
    totalDeclared: number | null
    creditLimit: number | null
    availableLimit: number | null
    detectedBank: string | null
    cardLastDigitsFound: string[]
    scanQuality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN'
    notes: string[]
  }
  totals: {
    matches: boolean
    insufficient: boolean
    totalCompras: number
    totalEncargos: number
    totalIgnoradas: number
    totalCalculado: number
    totalDeclarado: number | null
    diferenca: number | null
    message: string
  }
  lines: PreviewLine[]
  categories: CategoryOption[]
  counts: { total: number; compraAvista: number; compraParcelada: number; encargo: number; ignorar: number; duplicatas: number; precisaRevisar: number }
  paymentCandidates: PaymentCandidate[]
}

interface EditableLine extends PreviewLine {
  selected: boolean
  isEditing: boolean
  isManuallyAdded: boolean
  categoryId: string | null
  kind: LineKind
}

type Step = 'UPLOAD' | 'EXTRACTING' | 'PREVIEW' | 'IMPORTING' | 'DONE'

const KIND_LABEL: Record<LineKind, { label: string; color: string }> = {
  COMPRA_AVISTA: { label: 'À vista', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPRA_PARCELADA: { label: 'Parcelada', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  ENCARGO_FINANCEIRO: { label: 'Encargo', color: 'bg-red-50 text-red-700 border-red-200' },
  IGNORAR: { label: 'Ignorar', color: 'bg-slate-50 text-slate-500 border-slate-200' },
}

export default function ImportarFaturaPage() {
  const params = useParams<{ id: string; cardId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('UPLOAD')
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [editableLines, setEditableLines] = useState<EditableLine[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)
  const [reclassPaymentTxId, setReclassPaymentTxId] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ inseridas: number; duplicadas: number; reclassificadaTxId: string | null } | null>(null)

  async function handleUpload(selectedFile: File) {
    setFile(selectedFile)
    setExtractError(null)
    setStep('EXTRACTING')

    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/importar-fatura/preview`,
        { method: 'POST', body: fd, credentials: 'include' },
      )
      const json = await resp.json()
      if (!resp.ok) {
        setExtractError(json.erro || 'Erro na extração da fatura')
        setStep('UPLOAD')
        return
      }
      const data = json as PreviewResponse
      setPreviewData(data)
      setEditableLines(
        data.lines.map((l) => ({
          ...l,
          selected: l.suggestedKind !== 'IGNORAR' && !l.isDuplicate,
          isEditing: false,
          isManuallyAdded: false,
          categoryId: l.suggestedCategoryId,
          kind: l.suggestedKind,
        })),
      )
      setStep('PREVIEW')
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Erro de rede')
      setStep('UPLOAD')
    }
  }

  function toggleSelect(idx: number) {
    setEditableLines((prev) => prev.map((l) => (l.index === idx ? { ...l, selected: !l.selected } : l)))
  }
  function selectAll(value: boolean) {
    setEditableLines((prev) => prev.map((l) => ({ ...l, selected: value })))
  }
  function toggleEdit(idx: number) {
    setEditableLines((prev) => prev.map((l) => (l.index === idx ? { ...l, isEditing: !l.isEditing } : l)))
  }
  function updateLine(idx: number, patch: Partial<EditableLine>) {
    setEditableLines((prev) => prev.map((l) => (l.index === idx ? { ...l, ...patch } : l)))
  }
  function addManualLine() {
    if (!previewData) return
    const nextIndex = (editableLines.length > 0 ? Math.max(...editableLines.map((l) => l.index)) : -1) + 1
    setEditableLines((prev) => [
      ...prev,
      {
        index: nextIndex,
        date: new Date().toISOString().slice(0, 10),
        description: '',
        amount: 0,
        suggestedKind: 'COMPRA_AVISTA',
        installmentNumber: null,
        installmentTotal: null,
        cardLastDigits: null,
        needsReview: false,
        note: null,
        contentHash: '',
        isDuplicate: false,
        suggestedCategoryId: null,
        suggestedCategorySource: 'NONE',
        suggestedConfidence: 0,
        selected: true,
        isEditing: true,
        isManuallyAdded: true,
        categoryId: null,
        kind: 'COMPRA_AVISTA',
      },
    ])
  }
  function removeLine(idx: number) {
    setEditableLines((prev) => prev.filter((l) => l.index !== idx))
  }

  const selectedLines = editableLines.filter((l) => l.selected && l.kind !== 'IGNORAR')
  const totalCompras = selectedLines.filter((l) => l.kind === 'COMPRA_AVISTA' || l.kind === 'COMPRA_PARCELADA').reduce((s, l) => s + l.amount, 0)
  const totalEncargos = selectedLines.filter((l) => l.kind === 'ENCARGO_FINANCEIRO').reduce((s, l) => s + l.amount, 0)
  const totalConfirmar = totalCompras + totalEncargos

  async function handleConfirm() {
    if (!previewData) return
    const valid = selectedLines.filter(
      (l) => l.description.trim() && l.amount > 0 && (l.kind === 'ENCARGO_FINANCEIRO' || l.categoryId !== null),
    )
    if (valid.length === 0) {
      toast({
        title: 'Nada pra importar',
        description: 'Marque ao menos 1 linha com categoria (encargos podem ficar sem).',
        variant: 'destructive',
      })
      return
    }
    // Avisar se há linhas selecionadas sem categoria
    const semCat = selectedLines.filter((l) => l.kind !== 'ENCARGO_FINANCEIRO' && l.categoryId === null)
    if (semCat.length > 0) {
      toast({
        title: 'Linhas sem categoria',
        description: `${semCat.length} compra(s) sem categoria foram puladas. Edite-as antes de importar.`,
        variant: 'destructive',
      })
      return
    }

    setStep('IMPORTING')
    try {
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/importar-fatura/confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fileName: file?.name ?? 'fatura.pdf',
            fileSizeBytes: file?.size ?? 0,
            dueDate: previewData.extraction.dueDate,
            closingDate: previewData.extraction.closingDate,
            totalDeclared: previewData.extraction.totalDeclared,
            detectedBank: previewData.extraction.detectedBank,
            lines: valid.map((l) => ({
              date: l.date,
              description: l.description.trim(),
              amount: l.amount,
              kind: l.kind,
              categoryId: l.categoryId,
              installmentNumber: l.installmentNumber ?? undefined,
              installmentTotal: l.installmentTotal ?? undefined,
              cardLastDigits: l.cardLastDigits,
            })),
            reclassificarPagamentoTxId: reclassPaymentTxId,
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
      setImportResult({
        inseridas: json.inseridas,
        duplicadas: json.duplicadas,
        reclassificadaTxId: json.reclassificadaTxId,
      })
      setStep('DONE')
    } catch (err) {
      toast({
        title: 'Erro de rede',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      })
      setStep('PREVIEW')
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Importar fatura PDF"
        description="A IA SUGERE classificação. Você revisa, edita e confirma antes de qualquer coisa entrar."
      >
        <Link
          href={`/empresas/${params.id}/cartoes/${params.cardId}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </Header>

      {step === 'UPLOAD' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Selecione o PDF da fatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Até 10 MB. Funciona com Caixa, Banrisul, Sicredi, Itaú e outros bancos BR.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium">Clique pra selecionar PDF</p>
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
                <strong>Regra de ouro:</strong> a IA SUGERE classificação de cada linha. Você revisa
                tudo na tela seguinte e SÓ ENTRA O QUE VOCÊ CONFIRMAR. PDF é traiçoeiro — a tela de
                conferência é a sua rede de segurança.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'EXTRACTING' && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="font-medium">IA lendo a fatura…</p>
            <p className="text-xs text-muted-foreground">
              Pode levar 30-60s. Vamos extrair cada linha + sugerir tipo e categoria.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 'IMPORTING' && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="font-medium">Importando…</p>
          </CardContent>
        </Card>
      )}

      {step === 'PREVIEW' && previewData && (
        <>
          {/* Banner totais */}
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
                <p className="text-sm font-medium">
                  {previewData.totals.matches
                    ? 'Soma confere com o total da fatura'
                    : previewData.totals.insufficient
                      ? 'Conferência incompleta'
                      : 'A soma não fecha com a fatura'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewData.totals.message}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold tabular-nums">{previewData.counts.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">À vista</p>
                <p className="text-lg font-bold text-blue-700 tabular-nums">{previewData.counts.compraAvista}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Parceladas</p>
                <p className="text-lg font-bold text-sky-700 tabular-nums">{previewData.counts.compraParcelada}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Encargos</p>
                <p className="text-lg font-bold text-red-700 tabular-nums">{previewData.counts.encargo}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Ignorar</p>
                <p className="text-lg font-bold text-slate-500 tabular-nums">{previewData.counts.ignorar}</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-xs text-muted-foreground">
            {previewData.extraction.detectedBank && (
              <>
                Banco: <strong>{previewData.extraction.detectedBank}</strong> ·{' '}
              </>
            )}
            Scan: <strong>{previewData.extraction.scanQuality}</strong>
            {previewData.extraction.dueDate && (
              <>
                {' '}· Vencimento: <strong>{fmtDateBR(previewData.extraction.dueDate)}</strong>
              </>
            )}
            {previewData.extraction.cardLastDigitsFound.length > 1 && (
              <>
                {' '}· Cartões na fatura:{' '}
                <strong>{previewData.extraction.cardLastDigitsFound.join(', ')}</strong>
              </>
            )}
          </div>

          {/* Candidatos de pagamento já importado como despesa */}
          {previewData.paymentCandidates.length > 0 && (
            <Card className="border-indigo-200 bg-indigo-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-indigo-600" />
                  Achei possível pagamento desta fatura na conta bancária
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-indigo-900">
                  Essas transações têm valor próximo do total da fatura e descrição de pagamento.
                  Se marcar uma, ela será reclassificada como <strong>transferência banco → cartão</strong>{' '}
                  (em vez de despesa) — pra não contar 2x no DRE.
                </p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="reclass"
                      checked={reclassPaymentTxId === null}
                      onChange={() => setReclassPaymentTxId(null)}
                    />
                    <span>Nenhuma — não reclassificar</span>
                  </label>
                  {previewData.paymentCandidates.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reclass"
                        checked={reclassPaymentTxId === c.id}
                        onChange={() => setReclassPaymentTxId(c.id)}
                      />
                      <span>
                        {fmtDateBR(c.date)} · {c.description} · <strong>{formatBRL(c.amount)}</strong> ·{' '}
                        {c.bankAccountName ?? 'Conta'}{' '}
                        {c.currentCategoryName && (
                          <span className="text-muted-foreground">(hoje: {c.currentCategoryName})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela editável */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">Linhas extraídas — IA sugeriu, você decide</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Edite tipo / categoria / valor / descrição. Marque o que vai entrar.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectAll(true)}>Marcar todas</Button>
                <Button variant="outline" size="sm" onClick={() => selectAll(false)}>Desmarcar</Button>
                <Button variant="outline" size="sm" onClick={addManualLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 w-6"></th>
                      <th className="text-left py-2 w-24">Data</th>
                      <th className="text-left py-2 min-w-[200px]">Descrição</th>
                      <th className="text-left py-2 w-32">Tipo (sugerido)</th>
                      <th className="text-left py-2 w-44">Categoria</th>
                      <th className="text-right py-2 w-28">Valor</th>
                      <th className="text-right py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableLines.map((l) => (
                      <EditableRow
                        key={l.index}
                        line={l}
                        categories={previewData.categories}
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

          {/* Resumo do que vai entrar */}
          <Card className="bg-slate-50/50">
            <CardContent className="py-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Compras</p>
                <p className="font-semibold tabular-nums">{formatBRL(totalCompras)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Encargos</p>
                <p className="font-semibold tabular-nums">{formatBRL(totalEncargos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total a importar</p>
                <p className="font-semibold tabular-nums text-primary">{formatBRL(totalConfirmar)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Botões finais */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>Cancelar tudo</Button>
            <Button onClick={handleConfirm} disabled={selectedLines.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar e importar {selectedLines.length} {reclassPaymentTxId ? '+ reclassificar pagamento' : ''}
            </Button>
          </div>
        </>
      )}

      {step === 'DONE' && importResult && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Fatura importada</p>
              <p className="text-sm text-muted-foreground">
                {importResult.inseridas} compras criadas · {importResult.duplicadas} duplicatas ignoradas
                {importResult.reclassificadaTxId && (
                  <>
                    {' '}· 1 pagamento reclassificado como transferência
                  </>
                )}
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
                  setImportResult(null)
                  setReclassPaymentTxId(null)
                }}
              >
                Importar outra fatura
              </Button>
              <Link href={`/empresas/${params.id}/cartoes/${params.cardId}`}>
                <Button>Ver cartão</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Linha editável
// ──────────────────────────────────────────────────────────────
function EditableRow({
  line,
  categories,
  onToggleSelect,
  onToggleEdit,
  onUpdate,
  onRemove,
}: {
  line: EditableLine
  categories: CategoryOption[]
  onToggleSelect: () => void
  onToggleEdit: () => void
  onUpdate: (patch: Partial<EditableLine>) => void
  onRemove: () => void
}) {
  const isIgnored = line.kind === 'IGNORAR'
  const rowClass = !line.selected || isIgnored
    ? 'opacity-50'
    : line.isDuplicate
      ? 'bg-amber-50/50'
      : line.needsReview
        ? 'bg-yellow-50/40'
        : ''

  return (
    <tr className={`border-b last:border-0 ${rowClass}`}>
      <td className="py-2">
        <input type="checkbox" checked={line.selected} onChange={onToggleSelect} disabled={isIgnored} className="h-4 w-4" />
      </td>
      <td className="py-2 pr-2">
        {line.isEditing ? (
          <Input
            type="date"
            value={line.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            className="h-8 text-xs"
          />
        ) : (
          <span>{fmtDateBR(line.date)}</span>
        )}
      </td>
      <td className="py-2 pr-2">
        {line.isEditing ? (
          <Input
            value={line.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="h-8 text-xs"
            placeholder="Descrição"
          />
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{line.description}</span>
            {line.installmentNumber && line.installmentTotal && (
              <Badge variant="outline" className="text-[9px] bg-sky-50 text-sky-700 border-sky-200 py-0">
                {line.installmentNumber}/{line.installmentTotal}
              </Badge>
            )}
            {line.cardLastDigits && (
              <Badge variant="outline" className="text-[9px] bg-slate-50 text-slate-600 border-slate-200 py-0">
                {line.cardLastDigits}
              </Badge>
            )}
            {line.isDuplicate && (
              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 py-0">
                duplicata
              </Badge>
            )}
            {line.needsReview && (
              <Badge variant="outline" className="text-[9px] bg-yellow-50 text-yellow-700 border-yellow-200 py-0">
                revisar
              </Badge>
            )}
            {line.isManuallyAdded && (
              <Badge variant="outline" className="text-[9px] bg-sky-50 text-sky-700 border-sky-200 py-0">
                manual
              </Badge>
            )}
          </div>
        )}
      </td>
      <td className="py-2 pr-2">
        <select
          value={line.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as LineKind, selected: e.target.value !== 'IGNORAR' })}
          className="text-xs border rounded h-8 px-1 w-full"
        >
          <option value="COMPRA_AVISTA">À vista</option>
          <option value="COMPRA_PARCELADA">Parcelada</option>
          <option value="ENCARGO_FINANCEIRO">Encargo</option>
          <option value="IGNORAR">Ignorar</option>
        </select>
      </td>
      <td className="py-2 pr-2">
        {isIgnored ? (
          <span className="text-[10px] text-muted-foreground">—</span>
        ) : (
          <select
            value={line.categoryId ?? ''}
            onChange={(e) => onUpdate({ categoryId: e.target.value || null })}
            className="text-xs border rounded h-8 px-1 w-full"
          >
            <option value="">— escolher —</option>
            {categories
              .filter((c) => c.type === 'EXPENSE')
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
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
            className="h-8 text-xs text-right tabular-nums"
          />
        ) : (
          <span className="tabular-nums font-medium">{formatBRL(line.amount)}</span>
        )}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleEdit}>
            {line.isEditing ? <Save className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50" onClick={onRemove}>
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
