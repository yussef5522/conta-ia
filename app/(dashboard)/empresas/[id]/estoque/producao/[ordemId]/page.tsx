'use client'

// ESTOQUE FASE 2 item 2.1 — detalhe da ORDEM: stepper + SEPARAÇÃO pré-preenchida da ficha.
// O dono ajusta o que REALMENTE tirou da câmara → confirma → SEPARACAO_SAIDA (vai pro armazém
// virtual em-produção). Sobra volta (devolver). Conclusão "quantos saíram?" é 2.2.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Factory, Printer, AlertTriangle, Check, Undo2, X, Tag, TrendingUp } from 'lucide-react'

interface Linha { itemId: string; nome: string; unidade: string; unidadeControle: string; qtdPlanejada: number; qtdSeparada: number; saldoDisponivel: number; custoMedio: number | null }
interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; estado: string; dataProducao: string; setorNome: string | null; versaoFicha: number; fichaId: string }
interface Conclusao { id: string; qtdGerada: number; colaboradorNome: string | null; rendimento: number; custoLoteReal: number; custoUnitarioReal: number | null; validadeAte: string | null; parcial: boolean; criadoEm: string }
interface Colaborador { id: string; nome: string }

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
  const [conclusoes, setConclusoes] = useState<Conclusao[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [rendimentoMedio, setRendimentoMedio] = useState<number | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}`).then((r) => r.json()).then((j) => {
    if (!j.ordem) { setOrdem(null); return }
    setOrdem(j.ordem); setLinhas(j.linhas ?? [])
    setConclusoes(j.conclusoes ?? []); setColaboradores(j.colaboradores ?? []); setRendimentoMedio(j.rendimentoMedio ?? null)
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

  // aviso LEVE se o separado destoa do planejado da escala (não trava — o rendimento vai
  // contra o REAL). TEM que ficar ANTES do early-return (Regra dos Hooks: nº de hooks fixo).
  const escalaAviso = useMemo(() => {
    if (ordem?.estado !== 'PLANEJADA') return null
    const razoes = linhas.filter((l) => l.qtdPlanejada > 0).map((l) => parseNum(sep[l.itemId]) / l.qtdPlanejada)
    if (!razoes.length) return null
    const media = razoes.reduce((a, b) => a + b, 0) / razoes.length
    if (media < 0.9 || media > 1.1) return { media }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, sep, ordem])

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

      {/* aviso leve: separado ≠ escala planejada (não trava) */}
      {escalaAviso && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-700 print:hidden">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Você está separando ~{escalaAviso.media.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}× a receita, mas a ordem foi criada com escala {ordem.escalaReceitas}×. Tudo bem — o rendimento na conclusão vai contra o que você separou de verdade, não contra a escala.</span>
        </div>
      )}

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      {/* ações */}
      {!encerrada && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {planejada && <button onClick={confirmarSeparacao} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar separação</button>}
          {separada && <button onClick={() => acao({ acao: 'iniciar' })} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />} Iniciar produção</button>}
          <button onClick={() => { if (confirm('Cancelar a ordem? Os insumos separados voltam pro estoque.')) acao({ acao: 'cancelar' }) }} disabled={busy} className="text-sm text-rose-500 hover:text-rose-700">Cancelar ordem</button>
        </div>
      )}

      {/* conclusão ("quantos saíram?") */}
      {emProducao && <ConclusaoForm id={id} ordemId={ordemId} linhas={linhas} colaboradores={colaboradores} rendimentoMedio={rendimentoMedio} unidadeProduzido={ordem.unidadeProduzido} onConcluida={carregar} />}

      {/* histórico de conclusões + etiquetas */}
      {conclusoes.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Conclusões ({conclusoes.length})</h2>
          <div className="space-y-2">
            {conclusoes.map((c) => (
              <Card key={c.id}><CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{num(c.qtdGerada)} {ordem.unidadeProduzido} {c.parcial && <span className="text-[11px] font-normal text-amber-600">(parcial)</span>}</p>
                  <p className="text-xs text-slate-500">rendimento {num(c.rendimento)}/receita · custo {brl(c.custoUnitarioReal)}/un{c.colaboradorNome ? ` · ${c.colaboradorNome}` : ''}{c.validadeAte ? ` · val ${fmtDia(c.validadeAte)}` : ''}</p>
                </div>
                <a href={`/empresas/${id}/estoque/producao/conclusoes/${c.id}/etiqueta`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><Tag className="h-3.5 w-3.5" /> etiqueta</a>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConclusaoForm({ id, ordemId, linhas, colaboradores, rendimentoMedio, unidadeProduzido, onConcluida }: { id: string; ordemId: string; linhas: Linha[]; colaboradores: Colaborador[]; rendimentoMedio: number | null; unidadeProduzido: string; onConcluida: () => void }) {
  const emProd = linhas.filter((l) => l.qtdSeparada > 0)
  const [consumo, setConsumo] = useState<Record<string, string>>(Object.fromEntries(emProd.map((l) => [l.itemId, String(l.qtdSeparada)])))
  const [qtdGerada, setQtdGerada] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [parcial, setParcial] = useState(false)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

  const custoLote = useMemo(() => emProd.reduce((s, l) => s + parseNum(consumo[l.itemId]) * (l.custoMedio ?? 0), 0), [consumo, emProd])
  const qg = parseNum(qtdGerada)
  const rendimento = qg > 0 ? qg : null // rendimento por receita = qg/escala; a escala aparece após concluir
  const custoUnit = qg > 0 ? custoLote / qg : null

  const concluir = async () => {
    setErro(null)
    if (!(qg > 0)) return setErro('Diga quantos saíram.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/concluir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumo: emProd.map((l) => ({ itemId: l.itemId, qtdConsumida: parseNum(consumo[l.itemId]) })).filter((c) => c.qtdConsumida > 0), qtdGerada: qg, colaboradorId: colaboradorId || null, parcial }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui concluir.'); return }
      onConcluida()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <Card className="border-[#185FA5]/30"><CardContent className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Check className="h-4 w-4 text-[#185FA5]" /> Concluir — quantos saíram?</p>

      {/* consumo real (pré = em-produção) */}
      <div>
        <p className="mb-1 text-xs text-slate-500">Confirme o que foi consumido de verdade (sobra volta pro estoque):</p>
        <div className="divide-y divide-slate-50">
          {emProd.map((l) => (
            <div key={l.itemId} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="flex-1 text-slate-700">{l.nome}</span>
              <span className="text-[11px] text-slate-400">em produção {num(l.qtdSeparada)}</span>
              <input value={consumo[l.itemId] ?? ''} onChange={(e) => setConsumo((c) => ({ ...c, [l.itemId]: e.target.value }))} inputMode="decimal" className="w-20 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" />
              <span className="w-6 text-xs text-slate-400">{l.unidade}</span>
            </div>
          ))}
        </div>
      </div>

      {/* quantos saíram + colaborador */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Quantos saíram?
          <div className="mt-1 flex items-center gap-1"><input value={qtdGerada} onChange={(e) => setQtdGerada(e.target.value)} inputMode="decimal" placeholder="ex: 17" className="w-28 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" /><span className="text-xs text-slate-400">{unidadeProduzido}</span></div>
        </label>
        <label className="text-xs text-slate-500">Quem produziu
          <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-500"><input type="checkbox" checked={parcial} onChange={(e) => setParcial(e.target.checked)} /> produção parcial (concluo o resto depois)</label>
      </div>

      {/* prévia custo + rendimento */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-3 text-xs">
        <div><span className="text-slate-400">Custo do lote</span><p className="font-semibold tabular-nums text-slate-800">{brl(custoLote)}</p></div>
        <div><span className="text-slate-400">Custo por {unidadeProduzido}</span><p className="font-semibold tabular-nums text-slate-800">{custoUnit != null ? brl(custoUnit) : '—'}</p></div>
        <div><span className="flex items-center gap-1 text-slate-400"><TrendingUp className="h-3 w-3" /> rendimento médio</span><p className="font-semibold tabular-nums text-slate-800">{rendimentoMedio != null ? `${num(rendimentoMedio)}/receita` : 'a apurar'}</p></div>
      </div>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <button onClick={concluir} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Concluir e gerar etiqueta</button>
    </CardContent></Card>
  )
}
