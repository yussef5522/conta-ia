// Sprint CDB/Royalties (02/08/2026) — reclassifica aplicação/resgate automático
// do CDB como transferência (fora do DRE). Preview obrigatório + confirmação.
// Não muda valor, data nem saldo — só a categoria (natureza).

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertTriangle, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'

interface Item { txId: string; nature: string; description: string; amount: number; type: string; date: string; targetCategory: string | null; targetCategoryId: string | null; targetActive: boolean; alreadyCategorized: boolean }
interface Preview {
  counts: Record<string, number>
  totals: { despesaAntes: number; despesaDepois: number; receitaAntes: number; receitaDepois: number; aplicacaoSum: number; resgateSum: number }
  items: Item[]
  targetCategoriesMissing: string[]
}
const fmtD = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}` }

export default function CdbReclassPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<{ written: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const resp = await fetch(`/api/empresas/${params.id}/cdb-reclass/preview`, { credentials: 'include' })
    const { ok, data, message } = await readJsonResponse<Preview>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Erro', description: message ?? 'Falha ao carregar preview' }) }
    else setPreview(data)
    setLoading(false)
  }, [params.id, toast])

  useEffect(() => { void load() }, [load])

  // Aplicação/resgate = transferência (fora do DRE). Só esses reclassificamos aqui
  // por padrão; IOF/REND o plano já trata como financeiro (informativo).
  const reclassIItems = (preview?.items ?? []).filter(
    (i) => (i.nature === 'APLICACAO' || i.nature === 'RESGATE') && i.targetCategoryId && !i.alreadyCategorized,
  )

  async function confirmar() {
    if (reclassIItems.length === 0) return
    setSubmitting(true)
    const resp = await fetch(`/api/empresas/${params.id}/cdb-reclass/confirm`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignments: reclassIItems.map((i) => ({ txId: i.txId, categoryId: i.targetCategoryId })) }),
    })
    const { ok, data, message } = await readJsonResponse<{ written: number }>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Erro ao gravar', description: message ?? 'Tente de novo' }); setSubmitting(false); return }
    setDone(data)
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <Header title="Reclassificar aplicação automática (CDB)" description="O banco varre o saldo pro CDB e devolve. Aplicação/resgate são TRANSFERÊNCIA — não são despesa/receita. Reclassificar tira do DRE. Não muda valor, data nem saldo.">
        <Link href={`/empresas/${params.id}/pendentes`} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      </Header>

      {loading ? (
        <Card><CardContent className="py-16 text-center"><Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" /></CardContent></Card>
      ) : done ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <p className="text-lg font-semibold">{done.written} reclassificadas como transferência</p>
          <p className="text-sm text-muted-foreground">Saíram do DRE. Nenhum valor, data ou saldo foi alterado.</p>
          <Link href={`/empresas/${params.id}/relatorios/dre-gerencial`}><Button>Ver DRE</Button></Link>
        </CardContent></Card>
      ) : preview ? (
        <>
          {preview.targetCategoriesMissing.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Faltam categorias no plano: {preview.targetCategoriesMissing.join(', ')}.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Aplicações</p><p className="text-xl font-bold text-amber-700">{preview.counts.APLICACAO ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Resgates</p><p className="text-xl font-bold text-amber-700">{preview.counts.RESGATE ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">IOF (fica no DRE)</p><p className="text-xl font-bold text-slate-500">{preview.counts.IOF ?? 0}</p></CardContent></Card>
            <Card><CardContent className="py-3"><p className="text-xs text-muted-foreground">Rendimento (fica no DRE)</p><p className="text-xl font-bold text-slate-500">{preview.counts.REND ?? 0}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PiggyBank className="h-4 w-4" />Movimentação de julho — antes → depois</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  <tr><td className="py-2">Despesa (saídas)</td><td className="py-2 text-right tabular-nums text-muted-foreground line-through">{formatBRL(preview.totals.despesaAntes)}</td><td className="py-2 text-right tabular-nums font-bold text-red-700">{formatBRL(preview.totals.despesaDepois)}</td></tr>
                  <tr><td className="py-2">Receita (entradas)</td><td className="py-2 text-right tabular-nums text-muted-foreground line-through">{formatBRL(preview.totals.receitaAntes)}</td><td className="py-2 text-right tabular-nums font-bold text-emerald-700">{formatBRL(preview.totals.receitaDepois)}</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">Tira {formatBRL(preview.totals.aplicacaoSum)} de aplicação da despesa e {formatBRL(preview.totals.resgateSum)} de resgate da receita.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{reclassIItems.length} transações → transferência (fora do DRE)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground sticky top-0 bg-background"><tr><th className="text-left py-2 w-16">Dia</th><th className="text-left py-2">Descrição</th><th className="text-right py-2 w-28">Valor</th><th className="text-left py-2">→ Categoria</th></tr></thead>
                  <tbody>
                    {reclassIItems.map((i) => (
                      <tr key={i.txId} className="border-b last:border-0">
                        <td className="py-1.5">{fmtD(i.date)}</td>
                        <td className="py-1.5 text-muted-foreground">{i.description}</td>
                        <td className={`py-1.5 text-right tabular-nums ${i.type === 'CREDIT' ? 'text-emerald-700' : 'text-red-700'}`}>{formatBRL(i.amount)}</td>
                        <td className="py-1.5">{i.targetCategory}</td>
                      </tr>
                    ))}
                    {reclassIItems.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Nada pra reclassificar (ou já classificado).</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={confirmar} disabled={submitting || reclassIItems.length === 0}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar e reclassificar {reclassIItems.length}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
