// Sprint Importar Agenda (04/08/2026) — FASE 4: tela de importação da agenda
// oficial. Anexa o PDF do banco → preview por contrato (antes/depois) → confirma.
// "Corrigir agenda" calcula por fórmula; ISTO lê o documento e é sempre exato.

'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertTriangle, FileText, Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { readJsonResponse } from '@/lib/http/safe-json'

interface MonthImpact { month: string; antes: number; depois: number; parcelas: number }
interface ContractPreview {
  contractNumber: string; matched: boolean; loanId?: string; lender?: string
  numParcelas: number; valorFinanciado: number
  saldoAntes?: number; saldoDepois?: number; pagasAntes?: number; pagasDepois?: number
  parcelasAntes?: number; parcelasDepois?: number; carenciaAntes?: number; carenciaDepois?: number | null; prazoTotalMeses?: number | null
  dreImpactByMonth?: MonthImpact[]; historicoSemVinculoCount?: number; historicoEncargos?: number
  blocked?: boolean; blockReason?: string | null
}
interface Preview {
  contracts: ContractPreview[]
  impactoDRE: { total: number; porCompetencia: Array<{ month: string; encargos: number }> }
  historicoReconstruido: { parcelas: number; encargos: number }
}
const fmtMes = (m: string) => { const [y, mo] = m.split('-'); const nomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']; return `${nomes[+mo - 1]}/${y}` }
const fmtD = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}` }

export default function ImportarAgendaPage() {
  const { id: empresaId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pv, setPv] = useState<Preview | null>(null)
  const [done, setDone] = useState<{ applied: number; saldos: string } | null>(null)

  const gerarPreview = useCallback(async () => {
    if (!file) return
    setLoading(true); setPv(null)
    const fd = new FormData(); fd.append('file', file)
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/importar-agenda/preview`, { method: 'POST', credentials: 'include', body: fd })
    const { ok, data, message } = await readJsonResponse<Preview>(resp)
    if (!ok || !data) toast({ variant: 'destructive', title: 'Erro', description: message ?? 'Falha ao ler o PDF' })
    else setPv(data)
    setLoading(false)
  }, [file, empresaId, toast])

  async function confirmar() {
    if (!file || !pv) return
    const aplicaveis = pv.contracts.filter((c) => c.matched && !c.blocked).map((c) => c.contractNumber)
    if (aplicaveis.length === 0) { toast({ variant: 'destructive', title: 'Nada a aplicar', description: 'Nenhum contrato casado e liberado.' }); return }
    setSaving(true)
    const fd = new FormData(); fd.append('file', file); fd.append('contracts', aplicaveis.join(','))
    const resp = await fetch(`/api/empresas/${empresaId}/emprestimos/importar-agenda/confirm`, { method: 'POST', credentials: 'include', body: fd })
    const { ok, data, message } = await readJsonResponse<{ applied: Array<{ contractNumber: string; saldo: number }> }>(resp)
    if (!ok || !data) { toast({ variant: 'destructive', title: 'Não gravei', description: message ?? 'Erro' }); setSaving(false); return }
    setDone({ applied: data.applied.length, saldos: data.applied.map((a) => `${a.contractNumber} → ${formatBRL(a.saldo)}`).join(' · ') })
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <Header title="Importar agenda do banco (PDF)" description="Lê o documento oficial do banco parcela por parcela. Sempre exato — sem cálculo por fórmula. Nada grava sem sua confirmação.">
        <Link href={`/empresas/${empresaId}/emprestimos`} className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      </Header>

      {done ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <p className="text-lg font-semibold">{done.applied} contrato(s) atualizado(s) com a agenda oficial</p>
          <p className="text-sm text-muted-foreground">{done.saldos}</p>
          <Link href={`/empresas/${empresaId}/emprestimos`}><Button>Ver empréstimos</Button></Link>
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Documento do banco</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Bancos suportados: <strong>Sicredi</strong> ("Relação de Títulos Cadastrados" — um arquivo pode ter vários contratos) e <strong>Caixa</strong> ("Demonstrativo de Evolução Contratual" — um contrato por arquivo, PRÉ ou PÓS-fixado). Casamos cada contrato pelo número. O PDF é apagado após a leitura.</p>
              <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPv(null) }} className="text-sm" />
              <Button onClick={gerarPreview} disabled={!file || loading}>{loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Ler documento e mostrar preview</Button>
            </CardContent>
          </Card>

          {pv && (
            <>
              {/* IMPACTO NO DRE — só o que de fato afeta o resultado (parcelas vinculadas) */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-red-900">Impacto no DRE (despesa financeira): {formatBRL(pv.impactoDRE.total)}</p>
                  <p className="text-xs text-red-800 mt-0.5">Só parcelas com transação bancária vinculada. Por competência:</p>
                  <ul className="text-xs text-red-800 mt-1 space-y-0.5">
                    {pv.impactoDRE.porCompetencia.map((c) => (
                      <li key={c.month} className="flex justify-between"><span>{fmtMes(c.month)}</span><span className="tabular-nums font-semibold">{formatBRL(c.encargos)}</span></li>
                    ))}
                    {pv.impactoDRE.porCompetencia.length === 0 && <li className="text-muted-foreground">nenhuma (nada afeta o resultado)</li>}
                  </ul>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-700">Reconstrução de histórico (NÃO afeta o DRE)</p>
                  <p className="text-xs text-slate-600 mt-0.5">{pv.historicoReconstruido.parcelas} parcelas antigas pagas SEM transação vinculada — ajustam só saldo devedor e agenda. Encargos históricos: {formatBRL(pv.historicoReconstruido.encargos)}, <strong>fora do resultado</strong> (competências fechadas de 2024/2025 não mudam).</p>
                </div>
              </div>

              {pv.contracts.map((c) => (
                <Card key={c.contractNumber} className={!c.matched ? 'border-amber-300' : c.blocked ? 'border-red-300' : 'border-emerald-200'}>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" />{c.contractNumber} {c.lender ? `· ${c.lender}` : ''}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {!c.matched ? (
                      <p className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" />Não cadastrado no sistema — cadastre o empréstimo antes de importar. (financiado {formatBRL(c.valorFinanciado)}, {c.numParcelas} parcelas)</p>
                    ) : c.blocked ? (
                      <p className="flex items-center gap-2 text-red-700"><AlertTriangle className="h-4 w-4" />{c.blockReason}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Saldo devedor</p><p className="tabular-nums">{formatBRL(c.saldoAntes ?? 0)} → <strong className="text-emerald-700">{formatBRL(c.saldoDepois ?? 0)}</strong></p></div>
                          <div className="rounded border p-2"><p className="text-[10px] text-muted-foreground">Parcelas pagas</p><p className="tabular-nums">{c.pagasAntes} → <strong>{c.pagasDepois}</strong></p></div>
                          {c.parcelasDepois != null && (
                            <div className={`rounded border p-2 ${c.parcelasAntes !== c.parcelasDepois ? 'border-amber-300 bg-amber-50' : ''}`}>
                              <p className="text-[10px] text-muted-foreground">Nº de parcelas</p>
                              <p className="tabular-nums">{c.parcelasAntes} → <strong className={c.parcelasAntes !== c.parcelasDepois ? 'text-amber-800' : ''}>{c.parcelasDepois}</strong>{c.prazoTotalMeses ? <span className="text-[10px] text-muted-foreground"> (prazo total {c.prazoTotalMeses})</span> : null}</p>
                            </div>
                          )}
                          {c.carenciaDepois != null && (
                            <div className={`rounded border p-2 ${(c.carenciaAntes ?? 0) !== c.carenciaDepois ? 'border-amber-300 bg-amber-50' : ''}`}>
                              <p className="text-[10px] text-muted-foreground">Carência</p>
                              <p className="tabular-nums">{c.carenciaAntes ?? 0} → <strong className={(c.carenciaAntes ?? 0) !== c.carenciaDepois ? 'text-amber-800' : ''}>{c.carenciaDepois}</strong> {c.carenciaDepois === 1 ? 'mês' : 'meses'}</p>
                            </div>
                          )}
                        </div>
                        {c.dreImpactByMonth && c.dreImpactByMonth.length > 0 ? (
                          <div>
                            <p className="text-xs text-muted-foreground mt-1">Encargos que entram no DRE (parcelas vinculadas), por competência:</p>
                            <table className="w-full text-xs mt-1">
                              <tbody className="divide-y">{c.dreImpactByMonth.map((m) => (
                                <tr key={m.month}><td className="py-0.5">{fmtMes(m.month)} · {m.parcelas} parcela(s)</td><td className="py-0.5 text-right tabular-nums text-muted-foreground">{formatBRL(m.antes)} →</td><td className="py-0.5 text-right tabular-nums text-red-700 font-semibold">{formatBRL(m.depois)}</td></tr>
                              ))}</tbody>
                            </table>
                            {(c.historicoSemVinculoCount ?? 0) > 0 && (
                              <p className="text-[10px] text-slate-500 mt-1">+ {c.historicoSemVinculoCount} parcela(s) antiga(s) sem vínculo ({formatBRL(c.historicoEncargos ?? 0)} de encargos) — só reconstrução de saldo, fora do DRE.</p>
                            )}
                          </div>
                        ) : (c.historicoSemVinculoCount ?? 0) > 0 ? (
                          <p className="text-[11px] text-slate-500">Nenhuma parcela vinculada — {c.historicoSemVinculoCount} pagas sem vínculo só reconstroem saldo/agenda, sem tocar o DRE.</p>
                        ) : null}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}

              <div className="flex justify-end gap-2">
                <Link href={`/empresas/${empresaId}/emprestimos`}><Button variant="outline">Cancelar</Button></Link>
                <Button onClick={confirmar} disabled={saving || !pv.contracts.some((c) => c.matched && !c.blocked)}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Confirmar e aplicar agenda oficial
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
