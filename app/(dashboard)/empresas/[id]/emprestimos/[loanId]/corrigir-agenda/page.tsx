// Sprint Empréstimo Débito Parcial (03/08/2026) — PASSO 4 (tela) + 5 (rótulo POS).
// Corrige a agenda com parcela+taxa reais do carnê. Mostra a VALIDAÇÃO e o
// antes/depois ANTES de gravar. Confirmação obrigatória. Preserva reconciliações
// (bloqueia se não der). Nada grava sozinho.

'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Wrench, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'

interface Row { number: number; dueDate: string; openingBalance: number; interest: number; amortization: number; correcao: number; payment: number; closingBalance: number; status?: string; isEstimate: boolean }
interface Recon { number: number; realPayment: number; antes: { interest: number; amortization: number; correcao: number }; depois: { interest: number; amortization: number; correcao: number } | null; preserved: boolean }
interface Preview {
  loan: { contractNumber: string | null; lender: string; interestRateMonthly: number; rateType: string | null; amortizationSystem: string; base: number }
  antes: Row[]; depois: Row[]
  validation: { ok: boolean; errors: string[] }
  reconciled: Recon[]; reconciledCount: number
  blocked: boolean; blockReason: string | null
}
const fmtD = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}` }

export default function CorrigirAgendaPage() {
  const { id: empresaId, loanId } = useParams<{ id: string; loanId: string }>()
  const { toast } = useToast()
  const [sistema, setSistema] = useState<'SAC' | 'PRICE'>('SAC')
  const [parcela, setParcela] = useState('')
  const [financiado, setFinanciado] = useState('')
  const [taxa, setTaxa] = useState('') // % a.m.
  const [tipo, setTipo] = useState<'PRE' | 'POS'>('POS')
  const [carencia, setCarencia] = useState('')
  const [carenciaTipo, setCarenciaTipo] = useState<'JUROS' | 'JUROS_CAPITALIZADOS'>('JUROS_CAPITALIZADOS')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pv, setPv] = useState<Preview | null>(null)
  const [done, setDone] = useState(false)

  const parseNum = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

  function buildBody(extra: Record<string, unknown> = {}) {
    const t = parseNum(taxa) / 100
    const gm = parseNum(carencia)
    return {
      system: sistema,
      rateMonthly: t,
      isPostFixed: tipo === 'POS',
      ...(sistema === 'PRICE' ? { parcela: parseNum(parcela) } : { financedAmount: parseNum(financiado) }),
      ...(gm > 0 ? { graceMonths: Math.round(gm), graceType: carenciaTipo } : {}),
      ...extra,
    }
  }

  const gerarPreview = useCallback(async () => {
    const t = parseNum(taxa) / 100
    const val = sistema === 'PRICE' ? parseNum(parcela) : parseNum(financiado)
    if (!(val > 0) || !(t >= 0)) { toast({ variant: 'destructive', title: 'Preencha', description: sistema === 'PRICE' ? 'Informe parcela e taxa.' : 'Informe valor financiado e taxa.' }); return }
    setLoading(true); setPv(null)
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}/corrigir-agenda/preview`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildBody()),
    })
    const { ok, data, message } = await readJsonResponse<Preview>(resp)
    if (!ok || !data) toast({ variant: 'destructive', title: 'Erro', description: message ?? 'Falha ao gerar preview' })
    else setPv(data)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sistema, parcela, financiado, taxa, tipo, carencia, carenciaTipo, empresaId, loanId, toast])

  async function confirmar() {
    if (!pv || !pv.validation.ok || pv.blocked) return
    setSaving(true)
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/${loanId}/corrigir-agenda/confirm`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildBody({ confirm: true })),
    })
    const { ok, data, message } = await readJsonResponse<{ ok: boolean }>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Não gravei', description: message ?? 'Erro ao gravar' }); setSaving(false); return }
    setDone(true); setSaving(false)
  }

  const posFixado = tipo === 'POS'
  const isSac = sistema === 'SAC'

  return (
    <div className="space-y-6">
      <Header title="Corrigir agenda do empréstimo" description="Informe a parcela e a taxa REAIS do carnê. O sistema regenera, valida e mostra antes/depois. Nada grava sem sua confirmação.">
        <Link href={`/empresas/${empresaId}/emprestimos/${loanId}`} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao empréstimo</Link>
      </Header>

      {done ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <p className="text-lg font-semibold">Agenda corrigida</p>
          <p className="text-sm text-muted-foreground">Reconciliações preservadas. Nenhum valor, data ou saldo de transação foi alterado.</p>
          <Link href={`/empresas/${empresaId}/emprestimos/${loanId}`}><Button>Ver empréstimo</Button></Link>
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" />Valores do carnê</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button type="button" variant={isSac ? 'default' : 'outline'} size="sm" onClick={() => setSistema('SAC')}>SAC (amortização constante)</Button>
                <Button type="button" variant={!isSac ? 'default' : 'outline'} size="sm" onClick={() => setSistema('PRICE')}>PRICE (parcela fixa)</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {isSac ? (
                  <div>
                    <label className="text-xs text-muted-foreground">Valor financiado (R$) — com IOF e tarifas</label>
                    <Input value={financiado} onChange={(e) => setFinanciado(e.target.value)} placeholder="150.000,00" inputMode="decimal" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">A amortização = financiado ÷ nº de parcelas.</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground">Valor real da parcela (R$)</label>
                    <Input value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="4.166,66" inputMode="decimal" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">Taxa real mensal (%)</label>
                  <Input value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="0,49" inputMode="decimal" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Indexação</label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" variant={tipo === 'PRE' ? 'default' : 'outline'} size="sm" onClick={() => setTipo('PRE')}>Pré</Button>
                    <Button type="button" variant={tipo === 'POS' ? 'default' : 'outline'} size="sm" onClick={() => setTipo('POS')}>Pós (SELIC/CDI)</Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Carência (meses)</label>
                  <Input value={carencia} onChange={(e) => setCarencia(e.target.value)} placeholder="12" inputMode="numeric" />
                </div>
                {parseNum(carencia) > 0 && (
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground">Tipo de carência</label>
                    <div className="flex gap-2 mt-1">
                      <Button type="button" variant={carenciaTipo === 'JUROS' ? 'default' : 'outline'} size="sm" onClick={() => setCarenciaTipo('JUROS')}>Só juros (saldo constante)</Button>
                      <Button type="button" variant={carenciaTipo === 'JUROS_CAPITALIZADOS' ? 'default' : 'outline'} size="sm" onClick={() => setCarenciaTipo('JUROS_CAPITALIZADOS')}>Juros capitalizados (saldo cresce)</Button>
                    </div>
                  </div>
                )}
              </div>
              {posFixado && (
                <div className="rounded-md bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800">
                  <strong>Pós-fixado é estimativa.</strong> O valor real de cada parcela vem do banco a cada mês (SELIC/CDI). Os números abaixo projetam o futuro; a parcela já paga usa sempre o valor REAL debitado, não a estimativa.
                </div>
              )}
              <Button onClick={gerarPreview} disabled={loading}>{loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Gerar preview</Button>
            </CardContent>
          </Card>

          {pv && (
            <>
              {/* Validação */}
              <Card className={pv.validation.ok ? 'border-emerald-300' : 'border-red-300'}>
                <CardContent className="py-4">
                  {pv.validation.ok ? (
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" />A agenda fecha: Σ amortizações = saldo, saldo final = 0, cada parcela payment = juros + amortização, sem balão.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><XCircle className="h-5 w-5" />A agenda NÃO fecha — não dá pra gravar:</p>
                      <ul className="list-disc pl-8 text-sm text-red-700">{pv.validation.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reconciliações */}
              {pv.reconciledCount > 0 && (
                <Card className={pv.blocked ? 'border-red-300' : 'border-amber-200'}>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" />{pv.reconciledCount} parcela(s) reconciliada(s) — vínculo com a transação bancária</CardTitle></CardHeader>
                  <CardContent>
                    {pv.blocked ? (
                      <p className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{pv.blockReason}</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">O vínculo é preservado. O split (juros/amortização) é recalculado com o valor REAL debitado sobre a amortização nova:</p>
                        <table className="w-full text-sm">
                          <thead className="text-xs text-muted-foreground border-b"><tr><th className="text-left py-1">Parcela</th><th className="text-right py-1">Real debitado</th><th className="text-right py-1">Juros antes→depois</th><th className="text-right py-1">Amort antes→depois</th></tr></thead>
                          <tbody>{pv.reconciled.map((r) => (
                            <tr key={r.number} className="border-b last:border-0">
                              <td className="py-1">#{r.number}</td>
                              <td className="py-1 text-right tabular-nums">{formatBRL(r.realPayment)}</td>
                              <td className="py-1 text-right tabular-nums">{formatBRL(r.antes.interest + r.antes.correcao)} → <strong>{r.depois ? formatBRL(r.depois.interest + r.depois.correcao) : '—'}</strong></td>
                              <td className="py-1 text-right tabular-nums">{formatBRL(r.antes.amortization)} → <strong>{r.depois ? formatBRL(r.depois.amortization) : '—'}</strong></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Antes / Depois lado a lado */}
              <div className="grid gap-4 lg:grid-cols-2">
                <ScheduleTable title="ANTES (atual)" rows={pv.antes} />
                <ScheduleTable title="DEPOIS (corrigida)" rows={pv.depois} highlight />
              </div>

              <div className="flex justify-end gap-2">
                <Link href={`/empresas/${empresaId}/emprestimos/${loanId}`}><Button variant="outline">Cancelar</Button></Link>
                <Button onClick={confirmar} disabled={saving || !pv.validation.ok || pv.blocked}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar e gravar a agenda corrigida
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ScheduleTable({ title, rows, highlight }: { title: string; rows: Row[]; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-emerald-200' : undefined}>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b sticky top-0 bg-background"><tr><th className="text-left py-1">#</th><th className="text-right py-1">Saldo</th><th className="text-right py-1">Juros</th><th className="text-right py-1">Amort</th><th className="text-right py-1">Parcela</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.number} className="border-b last:border-0">
                <td className="py-1">#{r.number}{r.isEstimate ? <span className="ml-1 text-[9px] text-sky-600">est</span> : null}{r.status === 'PAID' ? <span className="ml-1 text-[9px] text-emerald-600">pg</span> : null}</td>
                <td className="py-1 text-right tabular-nums">{formatBRL(r.openingBalance)}</td>
                <td className="py-1 text-right tabular-nums">{formatBRL(r.interest)}</td>
                <td className="py-1 text-right tabular-nums">{formatBRL(r.amortization)}</td>
                <td className="py-1 text-right tabular-nums">{formatBRL(r.payment)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
