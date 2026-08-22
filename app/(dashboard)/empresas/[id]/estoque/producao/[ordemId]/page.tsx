'use client'

// ESTOQUE FASE 2 item 2.1 — detalhe da ORDEM: stepper + SEPARAÇÃO pré-preenchida da ficha.
// O dono ajusta o que REALMENTE tirou da câmara → confirma → SEPARACAO_SAIDA (vai pro armazém
// virtual em-produção). Sobra volta (devolver). Conclusão "quantos saíram?" é 2.2.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Factory, Printer, AlertTriangle, Check, Undo2, X } from 'lucide-react'

interface Linha { itemId: string; nome: string; unidade: string; unidadeControle: string; qtdPlanejada: number; qtdSeparada: number; saldoDisponivel: number; custoMedio: number | null }
interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; estado: string; dataProducao: string; setorNome: string | null; versaoFicha: number }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const PASSOS = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO', 'CONCLUIDA']
const PASSO_LABEL: Record<string, string> = { PLANEJADA: 'Planejada', SEPARADA: 'Separada', EM_PRODUCAO: 'Em produção', CONCLUIDA: 'Concluída' }

export default function OrdemDetalhePage({ params }: { params: Promise<{ id: string; ordemId: string }> }) {
  const { id, ordemId } = use(params)
  const [ordem, setOrdem] = useState<Ordem | null | undefined>(undefined)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [sep, setSep] = useState<Record<string, string>>({}) // qtd separada editável (PLANEJADA)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [devolver, setDevolver] = useState<Record<string, string>>({})

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}`).then((r) => r.json()).then((j) => {
    if (!j.ordem) { setOrdem(null); return }
    setOrdem(j.ordem); setLinhas(j.linhas ?? [])
    if (j.ordem.estado === 'PLANEJADA') setSep(Object.fromEntries((j.linhas ?? []).map((l: Linha) => [l.itemId, String(l.qtdPlanejada)])))
  }).catch(() => setOrdem(null))
  useEffect(() => { carregar() }, [id, ordemId]) // eslint-disable-line react-hooks/exhaustive-deps

  const acao = async (body: object) => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/acao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui.'); return false }
      setDevolver({}); carregar(); return true
    } catch { setErro('Falha de conexão.'); return false } finally { setBusy(false) }
  }

  const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const custoSeparado = useMemo(() => linhas.reduce((s, l) => { const q = ordem?.estado === 'PLANEJADA' ? parseNum(sep[l.itemId]) : l.qtdSeparada; return s + q * (l.custoMedio ?? 0) }, 0), [linhas, sep, ordem])

  if (ordem === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordem === null) return <div className="p-6 text-sm text-slate-500">Ordem não encontrada.</div>

  const planejada = ordem.estado === 'PLANEJADA'
  const separada = ordem.estado === 'SEPARADA'
  const emProducao = ordem.estado === 'EM_PRODUCAO'
  const encerrada = ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA'
  const passoAtual = PASSOS.indexOf(ordem.estado === 'CANCELADA' ? 'PLANEJADA' : ordem.estado)

  const confirmarSeparacao = () => acao({ acao: 'separar', itens: linhas.map((l) => ({ itemId: l.itemId, qtdSeparada: parseNum(sep[l.itemId]) })).filter((i) => i.qtdSeparada > 0) })

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra produção</a>

      {/* cabeçalho */}
      <div className="flex items-start gap-3">
        <Factory className="h-7 w-7 shrink-0 text-[#185FA5]" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{ordem.nomeProduzido}</h1>
          <p className="text-sm text-slate-500">{ordem.escalaReceitas}× a receita (v{ordem.versaoFicha}) · {fmtDia(ordem.dataProducao)}{ordem.setorNome ? ` · ${ordem.setorNome}` : ''}</p>
        </div>
        {ordem.estado === 'CANCELADA' && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">Cancelada</span>}
      </div>

      {/* stepper */}
      {ordem.estado !== 'CANCELADA' && (
        <div className="flex items-center gap-1 text-[11px] print:hidden">
          {PASSOS.map((p, i) => (
            <div key={p} className="flex items-center gap-1">
              <span className={`rounded-full px-2.5 py-1 font-medium ${i < passoAtual ? 'bg-emerald-50 text-emerald-700' : i === passoAtual ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-400'}`}>{PASSO_LABEL[p]}</span>
              {i < PASSOS.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      )}

      {/* separação */}
      <Card><CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-900">{planejada ? 'Separação (ajuste o que tirou da câmara)' : 'Separado'}</p>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 print:hidden"><Printer className="h-3.5 w-3.5" /> imprimir</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400">
            <th className="p-3 font-medium">Insumo</th><th className="p-3 text-right font-medium">Planejado</th>
            <th className="p-3 text-right font-medium">{planejada ? 'Separar' : 'Em produção'}</th>
            <th className="p-3 text-right font-medium">Estoque</th>
            {!planejada && !encerrada && <th className="p-3 print:hidden"></th>}
          </tr></thead>
          <tbody>
            {linhas.map((l) => {
              const sepQtd = parseNum(sep[l.itemId])
              const faltou = planejada && sepQtd > l.saldoDisponivel + 0.001
              return (
                <tr key={l.itemId} className="border-t border-slate-50">
                  <td className="p-3"><p className="font-medium text-slate-800">{l.nome}</p><p className="text-[11px] text-slate-400">{l.custoMedio != null ? `${brl(l.custoMedio)}/${l.unidadeControle}` : 'sem custo (a definir)'}</p></td>
                  <td className="p-3 text-right tabular-nums text-slate-500">{num(l.qtdPlanejada)} {l.unidade}</td>
                  <td className="p-3 text-right">
                    {planejada ? (
                      <div className="flex items-center justify-end gap-1">
                        <input value={sep[l.itemId] ?? ''} onChange={(e) => setSep((s) => ({ ...s, [l.itemId]: e.target.value }))} inputMode="decimal" className={`w-20 rounded-lg border py-1.5 px-2 text-right text-sm tabular-nums ${faltou ? 'border-rose-300 bg-rose-50' : 'border-slate-300'}`} />
                        <span className="w-6 text-xs text-slate-400">{l.unidade}</span>
                      </div>
                    ) : <span className="tabular-nums font-medium text-slate-800">{num(l.qtdSeparada)} {l.unidade}</span>}
                  </td>
                  <td className={`p-3 text-right tabular-nums ${l.saldoDisponivel < 0 ? 'text-rose-600' : 'text-slate-500'}`}>{num(l.saldoDisponivel)}</td>
                  {!planejada && !encerrada && (
                    <td className="p-3 print:hidden">
                      {l.qtdSeparada > 0 && (
                        devolver[l.itemId] !== undefined ? (
                          <div className="flex items-center gap-1">
                            <input value={devolver[l.itemId]} onChange={(e) => setDevolver((d) => ({ ...d, [l.itemId]: e.target.value }))} inputMode="decimal" placeholder="qtd" className="w-16 rounded border border-slate-300 py-1 px-1.5 text-right text-xs tabular-nums" />
                            <button disabled={busy} onClick={() => acao({ acao: 'devolver', itemId: l.itemId, qtd: parseNum(devolver[l.itemId]) })} className="rounded bg-slate-700 px-2 py-1 text-[11px] text-white disabled:opacity-50">ok</button>
                            <button onClick={() => setDevolver((d) => { const n = { ...d }; delete n[l.itemId]; return n })} className="text-slate-300"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : <button onClick={() => setDevolver((d) => ({ ...d, [l.itemId]: '' }))} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"><Undo2 className="h-3 w-3" /> devolver</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 p-4 text-sm">
          <span className="text-slate-500">Custo {planejada ? 'a separar' : 'em produção'}</span>
          <span className="font-semibold tabular-nums text-slate-900">{brl(custoSeparado)}</span>
        </div>
      </CardContent></Card>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      {/* ações */}
      {!encerrada && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {planejada && <button onClick={confirmarSeparacao} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar separação</button>}
          {separada && <button onClick={() => acao({ acao: 'iniciar' })} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />} Iniciar produção</button>}
          {emProducao && <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-4 py-2.5 text-sm text-sky-700"><AlertTriangle className="h-4 w-4" /> Conclusão ("quantos saíram?") entra no próximo passo (2.2).</div>}
          <button onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }} disabled={busy} className="text-sm text-rose-500 hover:text-rose-700">Cancelar ordem</button>
        </div>
      )}
    </div>
  )
}
