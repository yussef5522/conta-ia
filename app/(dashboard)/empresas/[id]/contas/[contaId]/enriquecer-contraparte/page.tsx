// Sprint Tela Contraparte (31/07/2026) — enriquece o nome do favorecido/pagador
// dos PIX em transações JÁ IMPORTADAS, a partir do PDF do extrato. O PDF SÓ
// preenche nome — nunca cria/altera valor, data, categoria ou saldo. Gravação
// só acontece após o usuário CONFIRMAR nesta tela.

'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'

interface PreviewTx { txId: string; date: string; description: string; amount: number; type: string; currentName: string | null }
interface Preview {
  conta: { id: string; name: string; agency: string | null; accountNumber: string | null }
  header: { agencia: string | null; conta: string | null; titular: string | null }
  counts: { exact: number; ambiguousKeys: number; ambiguousTx: number; noMatch: number; pdfLines: number; pdfWithName: number; manualProtected: number }
  exact: Array<PreviewTx & { proposedName: string }>
  ambiguous: Array<{ documento: string; amount: number; candidateNames: string[]; txs: PreviewTx[] }>
}

type Step = 'UPLOAD' | 'LOADING' | 'PREVIEW' | 'DONE'
const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

export default function EnriquecerContrapartePage() {
  const params = useParams<{ id: string; contaId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('UPLOAD')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  // escolha do usuário pros ambíguos: txId -> nome escolhido (ou '' = pular)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ written: number; skippedPrecedence: number } | null>(null)

  async function handleUpload(file: File) {
    setError(null)
    setStep('LOADING')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const resp = await fetch(`/api/contas-bancarias/${params.contaId}/enriquecer-contraparte/preview`, { method: 'POST', body: fd, credentials: 'include' })
      const { ok, data, message } = await readJsonResponse<Preview>(resp, { timeoutHint: 'A leitura do PDF demorou mais que o esperado. Tente de novo.' })
      if (!ok || !data) { setError(message ?? 'Falha ao ler o PDF'); setStep('UPLOAD'); return }
      setPreview(data)
      setStep('PREVIEW')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de rede'); setStep('UPLOAD')
    }
  }

  async function handleConfirm() {
    if (!preview) return
    const assignments = [
      ...preview.exact.map((e) => ({ txId: e.txId, counterpartyName: e.proposedName })),
      ...preview.ambiguous.flatMap((g) => g.txs.filter((t) => choices[t.txId]).map((t) => ({ txId: t.txId, counterpartyName: choices[t.txId] }))),
    ]
    if (assignments.length === 0) { toast({ title: 'Nada pra gravar', description: 'Nenhum nome pra atribuir.', variant: 'destructive' }); return }
    setStep('LOADING')
    try {
      const resp = await fetch(`/api/contas-bancarias/${params.contaId}/enriquecer-contraparte/confirm`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assignments }),
      })
      const { ok, data, message } = await readJsonResponse<{ written: number; skippedPrecedence: number }>(resp)
      if (!ok || !data) { toast({ title: 'Erro ao gravar', description: message ?? 'Tente de novo', variant: 'destructive' }); setStep('PREVIEW'); return }
      setResult(data)
      setStep('DONE')
    } catch (err) {
      toast({ title: 'Erro de rede', description: err instanceof Error ? err.message : 'Tente de novo', variant: 'destructive' }); setStep('PREVIEW')
    }
  }

  const ambResolved = preview ? preview.ambiguous.flatMap((g) => g.txs).filter((t) => choices[t.txId]).length : 0

  return (
    <div className="space-y-6">
      <Header title="Enriquecer contraparte (PDF)" description="O extrato OFX não traz o nome de quem recebeu/enviou os PIX. O PDF do mesmo período preenche os nomes — sem mexer em valor, data, categoria ou saldo.">
        <Link href={`/empresas/${params.id}/contas/${params.contaId}/transacoes`} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      </Header>

      {step === 'UPLOAD' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Anexe o PDF do extrato</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">O PDF precisa ser o <strong>extrato digital</strong> do banco (não foto/scan) e da <strong>mesma conta</strong>. Só preenche nome — nada mais muda.</p>
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium">Clique pra selecionar o PDF</p>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" /><p className="text-sm text-red-700">{error}</p></div>}
          </CardContent>
        </Card>
      )}

      {step === 'LOADING' && <Card><CardContent className="py-16 text-center space-y-3"><Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" /><p className="font-medium">Processando…</p></CardContent></Card>}

      {step === 'PREVIEW' && preview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Exatos (vão gravar)</p><p className="text-xl font-bold text-emerald-700">{preview.counts.exact}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Ambíguos (você escolhe)</p><p className="text-xl font-bold text-amber-700">{preview.counts.ambiguousTx}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Sem match no PDF</p><p className="text-xl font-bold text-slate-500">{preview.counts.noMatch}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Protegidos (manual/OFX)</p><p className="text-xl font-bold text-slate-500">{preview.counts.manualProtected}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Exatos — {preview.exact.length} transações receberão nome</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground sticky top-0 bg-background"><tr><th className="text-left py-2 w-24">Data</th><th className="text-left py-2">Transação existente (não muda)</th><th className="text-right py-2 w-28">Valor</th><th className="text-left py-2">→ Contraparte</th></tr></thead>
                  <tbody>
                    {preview.exact.map((e) => (
                      <tr key={e.txId} className="border-b last:border-0">
                        <td className="py-1.5">{fmtDate(e.date)}</td>
                        <td className="py-1.5 text-muted-foreground truncate max-w-[220px]">{e.description}</td>
                        <td className={`py-1.5 text-right tabular-nums ${e.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'}`}>{formatBRL(e.amount)}</td>
                        <td className="py-1.5 font-medium">{e.proposedName}{e.currentName && e.currentName !== e.proposedName && <span className="text-[10px] text-amber-600 ml-1">(substitui "{e.currentName}")</span>}</td>
                      </tr>
                    ))}
                    {preview.exact.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Nenhum match exato.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {preview.ambiguous.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle className="h-4 w-4 text-amber-600" />Ambíguos — escolha ou pule ({ambResolved} escolhidos)</CardTitle>
                <p className="text-xs text-muted-foreground">Mesmo documento e valor com pagadores diferentes (documento genérico 000000). Nunca preenchemos sozinhos.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {preview.ambiguous.map((g) => (
                  <div key={g.documento + g.amount} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-2">doc <strong>{g.documento}</strong> · {formatBRL(g.amount)} · {g.txs.length} transação(ões)</p>
                    {g.txs.map((t) => (
                      <div key={t.txId} className="flex items-center gap-2 py-1 flex-wrap">
                        <span className="text-sm text-muted-foreground w-20">{fmtDate(t.date)}</span>
                        <select value={choices[t.txId] ?? ''} onChange={(e) => setChoices((p) => ({ ...p, [t.txId]: e.target.value }))} className="text-sm border rounded h-8 px-1 flex-1 min-w-[200px]">
                          <option value="">— pular (não grava) —</option>
                          {g.candidateNames.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button onClick={handleConfirm}><CheckCircle2 className="h-4 w-4 mr-1" />Confirmar e gravar {preview.counts.exact + ambResolved} nomes</Button>
          </div>
        </>
      )}

      {step === 'DONE' && result && (
        <Card><CardContent className="py-12 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <div className="space-y-1"><p className="text-lg font-semibold">{result.written} nomes gravados</p>
            {result.skippedPrecedence > 0 && <p className="text-sm text-muted-foreground">{result.skippedPrecedence} preservados (já tinham nome manual/OFX)</p>}
            <p className="text-xs text-muted-foreground">Nenhum valor, data, categoria ou saldo foi alterado.</p></div>
          <Link href={`/empresas/${params.id}/contas/${params.contaId}/transacoes`}><Button>Ver transações</Button></Link>
        </CardContent></Card>
      )}
    </div>
  )
}
