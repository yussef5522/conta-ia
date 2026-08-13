'use client'

// Sprint PDF-no-Import (09/08/2026) — painel reusável de enriquecimento de
// contraparte por PDF (Banrisul). Extraído da tela /enriquecer-contraparte pra
// ser montado TAMBÉM inline no fluxo de import de OFX, sem duplicar lógica.
//
// PDF SÓ preenche nome/documento — nunca cria/altera valor, data, categoria ou
// saldo. Grava só após CONFIRMAR. Reusa os endpoints /enriquecer-contraparte/
// {preview,confirm} (operam em tx JÁ importadas → serve import novo E histórico).

import { useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'
import { useToast } from '@/components/ui/use-toast'

interface PreviewTx {
  txId: string
  date: string
  description: string
  amount: number
  type: string
  currentName: string | null
}
type MatchKey = 'FITID' | 'DATE_AMOUNT'
interface Preview {
  conta: { id: string; name: string; agency: string | null; accountNumber: string | null }
  header: { agencia: string | null; conta: string | null; titular: string | null }
  period: { start: string; end: string } | null
  altKeyUsed: boolean
  counts: {
    willReceive: number
    ambiguousTx: number
    outOfPeriod: number
    notApplicable: number
    noPdfLine: number
    exactByFitid: number
    exactByDateAmount: number
    ambiguousKeys: number
    pdfLines: number
    pdfWithName: number
    manualProtected: number
  }
  progress: { named: number; totalEligible: number }
  outOfPeriodMonths: Array<{ month: string; count: number }>
  exact: Array<PreviewTx & { proposedName: string; documento: string; matchKey: MatchKey }>
  ambiguous: Array<{
    documento: string
    amount: number
    candidateNames: string[]
    via: MatchKey
    txs: PreviewTx[]
  }>
}

type Step = 'UPLOAD' | 'LOADING' | 'PREVIEW' | 'DONE'
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${MESES[+m - 1] ?? m}/${y}`
}

interface Props {
  contaId: string
  /** Chamado após gravar com sucesso (inline: navega). Sem isto, mostra só o resumo. */
  onDone?: () => void
  /** Chamado ao cancelar/pular (inline: "continuar sem"). */
  onCancel?: () => void
  /** Rótulo do botão final. Default "Ver transações"/"Concluir". */
  doneLabel?: string
}

export function EnrichContrapartePanel({ contaId, onDone, onCancel, doneLabel }: Props) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('UPLOAD')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ written: number; skippedPrecedence: number } | null>(null)

  async function handleUpload(file: File) {
    setError(null)
    setStep('LOADING')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await fetch(`/api/contas-bancarias/${contaId}/enriquecer-contraparte/preview`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      const { ok, data, message } = await readJsonResponse<Preview>(resp, {
        timeoutHint: 'A leitura do PDF demorou mais que o esperado. Tente de novo.',
      })
      if (!ok || !data) {
        setError(message ?? 'Falha ao ler o PDF')
        setStep('UPLOAD')
        return
      }
      setPreview(data)
      setStep('PREVIEW')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede')
      setStep('UPLOAD')
    }
  }

  async function handleConfirm() {
    if (!preview) return
    const assignments = [
      ...preview.exact.map((e) => ({
        txId: e.txId,
        counterpartyName: e.proposedName,
        // Nível 2 casa por data+valor (documento = a data ISO); nesse caso não
        // grava documento como "documento" (não é um doc do PDF).
        counterpartyDocument: e.matchKey === 'FITID' ? e.documento ?? undefined : undefined,
        matchKey: e.matchKey,
      })),
      ...preview.ambiguous.flatMap((g) =>
        g.txs
          .filter((t) => choices[t.txId])
          .map((t) => ({
            txId: t.txId,
            counterpartyName: choices[t.txId],
            counterpartyDocument: g.via === 'FITID' ? g.documento : undefined,
            matchKey: g.via,
          })),
      ),
    ]
    if (assignments.length === 0) {
      toast({ title: 'Nada pra gravar', description: 'Nenhum nome pra atribuir.', variant: 'destructive' })
      return
    }
    setStep('LOADING')
    try {
      const resp = await fetch(`/api/contas-bancarias/${contaId}/enriquecer-contraparte/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assignments }),
      })
      const { ok, data, message } = await readJsonResponse<{ written: number; skippedPrecedence: number }>(resp)
      if (!ok || !data) {
        toast({ title: 'Erro ao gravar', description: message ?? 'Tente de novo', variant: 'destructive' })
        setStep('PREVIEW')
        return
      }
      setResult(data)
      setStep('DONE')
    } catch (err) {
      toast({
        title: 'Erro de rede',
        description: err instanceof Error ? err.message : 'Tente de novo',
        variant: 'destructive',
      })
      setStep('PREVIEW')
    }
  }

  const ambResolved = preview
    ? preview.ambiguous.flatMap((g) => g.txs).filter((t) => choices[t.txId]).length
    : 0

  return (
    <>
      {step === 'UPLOAD' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Anexe o PDF do extrato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O PDF precisa ser o <strong>extrato digital</strong> do banco (não foto/scan) e da{' '}
              <strong>mesma conta e período</strong>. Só preenche nome/documento — nada mais muda.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium">Clique pra selecionar o PDF</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {onCancel && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Continuar sem anexar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'LOADING' && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
            <p className="font-medium">Processando…</p>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Continuar sem esperar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'PREVIEW' && preview && (
        <div className="space-y-4">
          {/* Período + progresso */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">
              {preview.period ? (
                <>Este PDF cobre <strong className="tabular-nums">{fmtDate(preview.period.start)} a {fmtDate(preview.period.end)}</strong></>
              ) : (
                <span className="text-amber-700">Não consegui ler o período deste PDF — casei só pelo documento (Nível 1). Me manda o print do topo do PDF pra eu ajustar.</span>
              )}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              Progresso da conta: <strong className="text-slate-700">{preview.progress.named} de {preview.progress.totalEligible}</strong> PIX/TED com nome
            </span>
          </div>

          {/* Os 4 baldes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Vão receber nome</p>
                <p className="text-xl font-bold text-emerald-700">{preview.counts.willReceive}</p>
                {preview.counts.exactByDateAmount > 0 && (
                  <p className="text-[10px] text-slate-500">{preview.counts.exactByFitid} por documento · {preview.counts.exactByDateAmount} por data+valor</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Ambíguas · você escolhe</p>
                <p className="text-xl font-bold text-amber-700">{preview.counts.ambiguousTx}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Fora do período do PDF</p>
                <p className="text-xl font-bold text-slate-500">{preview.counts.outOfPeriod}</p>
                {preview.outOfPeriodMonths.length > 0 && (
                  <p className="text-[10px] text-slate-500">anexe: {preview.outOfPeriodMonths.map((m) => `${fmtMonth(m.month)} (${m.count})`).join(' · ')}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Não se aplica · IOF/tarifa</p>
                <p className="text-xl font-bold text-slate-400">{preview.counts.notApplicable}</p>
              </CardContent>
            </Card>
          </div>

          {/* Nada a enriquecer neste PDF → diz claramente (não lista vazia) */}
          {preview.counts.willReceive === 0 && preview.counts.ambiguousTx === 0 && (
            <div className="rounded-md border border-sky-200 bg-sky-50/60 p-3 text-sm text-sky-900">
              {preview.counts.outOfPeriod > 0 ? (
                <>Este PDF não cobre nenhuma transação sem nome. As {preview.counts.outOfPeriod} pendentes são de outro período — anexe o PDF de {preview.outOfPeriodMonths.map((m) => fmtMonth(m.month)).join(', ')}.</>
              ) : preview.counts.noPdfLine > 0 ? (
                <>Há {preview.counts.noPdfLine} transação(ões) no período mas o PDF não trouxe o nome delas (ex: PIX sem favorecido no extrato).</>
              ) : (
                <>Tudo certo — nenhuma transação sem nome neste período.</>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Exatos — {preview.exact.length} transações receberão nome
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground sticky top-0 bg-background">
                    <tr>
                      <th className="text-left py-2 w-24">Data</th>
                      <th className="text-left py-2">Transação existente (não muda)</th>
                      <th className="text-right py-2 w-28">Valor</th>
                      <th className="text-left py-2">→ Contraparte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.exact.map((e) => (
                      <tr key={e.txId} className="border-b last:border-0">
                        <td className="py-1.5">{fmtDate(e.date)}</td>
                        <td className="py-1.5 text-muted-foreground truncate max-w-[220px]">{e.description}</td>
                        <td
                          className={`py-1.5 text-right tabular-nums ${
                            e.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {formatBRL(e.amount)}
                        </td>
                        <td className="py-1.5 font-medium">
                          {e.proposedName}
                          {e.matchKey === 'DATE_AMOUNT' && (
                            <span className="text-[10px] text-sky-600 ml-1" title="Casado por data+valor (FITID do Banrisul renumera)">· data+valor</span>
                          )}
                          {e.currentName && e.currentName !== e.proposedName && (
                            <span className="text-[10px] text-amber-600 ml-1">(substitui "{e.currentName}")</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {preview.exact.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted-foreground">
                          Nenhum match exato.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {preview.ambiguous.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  Ambíguos — escolha ou pule ({ambResolved} escolhidos)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Mesma chave (documento+valor, ou data+valor no Banrisul) com nomes ou
                  transações diferentes — não dá pra saber qual é qual. Nunca preenchemos sozinhos.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {preview.ambiguous.map((g) => (
                  <div key={g.documento + g.amount} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      {g.via === 'DATE_AMOUNT' ? (
                        <>data <strong>{fmtDate(g.documento)}</strong></>
                      ) : (
                        <>doc <strong>{g.documento}</strong></>
                      )}{' '}
                      · {formatBRL(g.amount)} · {g.txs.length} transação(ões)
                    </p>
                    {g.txs.map((t) => (
                      <div key={t.txId} className="flex items-center gap-2 py-1 flex-wrap">
                        <span className="text-sm text-muted-foreground w-20">{fmtDate(t.date)}</span>
                        <select
                          value={choices[t.txId] ?? ''}
                          onChange={(e) => setChoices((p) => ({ ...p, [t.txId]: e.target.value }))}
                          className="text-sm border rounded h-8 px-1 flex-1 min-w-[200px]"
                        >
                          <option value="">— pular (não grava) —</option>
                          {g.candidateNames.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => (onCancel ? onCancel() : window.history.back())}>
              {onCancel ? 'Continuar sem' : 'Cancelar'}
            </Button>
            <Button onClick={handleConfirm}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar e gravar {preview.counts.willReceive + ambResolved} nomes
            </Button>
          </div>
        </div>
      )}

      {step === 'DONE' && result && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{result.written} nomes gravados</p>
              {result.skippedPrecedence > 0 && (
                <p className="text-sm text-muted-foreground">
                  {result.skippedPrecedence} preservados (já tinham nome manual/OFX)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nenhum valor, data, categoria ou saldo foi alterado.
              </p>
            </div>
            {onDone ? (
              <Button onClick={onDone}>{doneLabel ?? 'Concluir'}</Button>
            ) : (
              <Button onClick={() => window.location.reload()}>{doneLabel ?? 'Atualizar'}</Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
