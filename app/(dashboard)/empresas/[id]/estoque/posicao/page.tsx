'use client'

// ESTOQUE FASE 1 — POSIÇÃO nível líder (a tela de trabalho diária). Cards de valor por
// categoria + total · busca + filtro por categoria · colunas com tendência de custo e
// badge de idade da última entrada · ordenação · linha → ficha · renomear inline ·
// agrupamento colapsável · mobile em cards. Mesma família visual de Vendas.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Boxes, Loader2, AlertTriangle, Search, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight, Download, PackageMinus, TrendingDown } from 'lucide-react'
import { NomeEditavel } from '@/components/estoque/nome-editavel'
import { SaidaModal } from '@/components/estoque/saida-modal'
import { StatusBar, StatusDot, STATUS_BORDA } from '@/components/estoque/status-bar'
import type { StatusEstoqueResult } from '@/lib/stock/status-estoque'

interface PosItem {
  itemId: string; nome: string; categoria: string; categoriaLabel: string; unidadeControle: string
  saldo: number; custoMedio: number | null; valor: number; negativo: boolean
  ultimaEntrada: string | null; ultimaEntradaDias: number | null; custoTendencia: 'subiu' | 'desceu' | 'igual' | null
  estoqueMin: number | null; estoqueMax: number | null; status: StatusEstoqueResult
}
interface Posicao { itens: PosItem[]; valorTotal: number; porCategoria: { categoria: string; label: string; valor: number; itens: number }[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
type Ordem = 'valor' | 'nome' | 'idade'

function IdadeBadge({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-xs text-slate-400">—</span>
  const txt = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `${dias} dias`
  const cor = dias > 14 ? 'bg-rose-50 text-rose-700' : dias > 7 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cor}`}>{txt}</span>
}
function Tendencia({ t }: { t: PosItem['custoTendencia'] }) {
  if (t === 'subiu') return <ArrowUp className="inline h-3.5 w-3.5 text-rose-500" />
  if (t === 'desceu') return <ArrowDown className="inline h-3.5 w-3.5 text-emerald-500" />
  if (t === 'igual') return <Minus className="inline h-3 w-3 text-slate-300" />
  return null
}

export default function PosicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Posicao | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<Ordem>('valor')
  const [agrupar, setAgrupar] = useState(false)
  const [soAbaixo, setSoAbaixo] = useState(false)
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const [saida, setSaida] = useState<{ id: string; nome: string; unidadeControle: string; custoMedio: number | null } | 'novo' | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/posicao`).then((r) => r.json()).then((j) => setData(j.posicao ?? null)).catch(() => setData(null))
  }, [id])

  const filtrados = useMemo(() => {
    if (!data) return []
    let its = data.itens
    if (catFiltro) its = its.filter((i) => i.categoria === catFiltro)
    if (soAbaixo) its = its.filter((i) => i.status.status === 'ABAIXO')
    if (busca.trim()) its = its.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()))
    const cmp: Record<Ordem, (a: PosItem, b: PosItem) => number> = {
      valor: (a, b) => b.valor - a.valor,
      nome: (a, b) => a.nome.localeCompare(b.nome),
      idade: (a, b) => (b.ultimaEntradaDias ?? -1) - (a.ultimaEntradaDias ?? -1),
    }
    return [...its].sort(cmp[ordem])
  }, [data, catFiltro, busca, ordem, soAbaixo])

  const nAbaixo = useMemo(() => (data?.itens.filter((i) => i.status.status === 'ABAIXO').length ?? 0), [data])

  const grupos = useMemo(() => {
    const m = new Map<string, PosItem[]>()
    for (const i of filtrados) { const a = m.get(i.categoriaLabel) ?? []; a.push(i); m.set(i.categoriaLabel, a) }
    return [...m.entries()]
  }, [filtrados])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a posição.</div>

  const renomeado = (itemId: string, n: string) => setData({ ...data, itens: data.itens.map((i) => (i.itemId === itemId ? { ...i, nome: n } : i)) })

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Posição de estoque</h1><p className="text-sm text-slate-500">Saldo derivado dos movimentos. Clique num item pra ver a ficha.</p></div>
        <a href={`/empresas/${id}/estoque/perdas`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><TrendingDown className="h-4 w-4" /> Perdas</a>
        <button onClick={() => setSaida('novo')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><PackageMinus className="h-4 w-4" /> Registrar saída</button>
        {data.itens.length > 0 && <a href={`/api/empresas/${id}/estoque/posicao?formato=csv`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> CSV</a>}
      </div>
      {saida && <SaidaModal companyId={id} itemInicial={saida === 'novo' ? undefined : { id: saida.id, nome: saida.nome, unidadeControle: saida.unidadeControle, custoMedio: saida.custoMedio }} onClose={() => setSaida(null)} onSalvo={() => { setSaida(null); location.reload() }} />}

      {data.itens.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Boxes className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">O estoque está zerado — e é assim que começa.</p>
          <p className="max-w-md text-xs text-slate-500">Confirme o primeiro recebimento na fila e os itens aparecem aqui com saldo e valor.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* cards de valor por categoria + total */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCatFiltro(null)} className={`rounded-xl border px-4 py-3 text-left transition ${!catFiltro ? 'border-[#185FA5] bg-[#185FA5]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <p className="text-xs text-slate-500">Total</p><p className="text-base font-semibold tabular-nums text-slate-900">{brl(data.valorTotal)}</p>
            </button>
            {data.porCategoria.map((c) => (
              <button key={c.categoria} onClick={() => setCatFiltro(catFiltro === c.categoria ? null : c.categoria)} className={`rounded-xl border px-4 py-3 text-left transition ${catFiltro === c.categoria ? 'border-[#185FA5] bg-[#185FA5]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <p className="text-xs text-slate-500">{c.label}</p><p className="text-base font-semibold tabular-nums text-slate-900">{brl(c.valor)}</p><p className="text-[11px] text-slate-400">{c.itens} {c.itens === 1 ? 'item' : 'itens'}</p>
              </button>
            ))}
          </div>

          {/* busca + ordenação + agrupar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </div>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-600">
              <option value="valor">Maior valor</option><option value="nome">Nome</option><option value="idade">Mais antigo</option>
            </select>
            <button onClick={() => setAgrupar((v) => !v)} className={`rounded-lg border px-3 py-2 text-sm ${agrupar ? 'border-[#185FA5] bg-[#185FA5]/5 text-[#185FA5]' : 'border-slate-300 text-slate-600'}`}>Agrupar</button>
            {nAbaixo > 0 && <button onClick={() => setSoAbaixo((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${soAbaixo ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600'}`}><AlertTriangle className="h-3.5 w-3.5" /> {nAbaixo} abaixo do mín.</button>}
          </div>

          {/* lista */}
          {filtrados.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-slate-500">Nenhum item com esse filtro.</CardContent></Card>
          ) : agrupar ? (
            <div className="space-y-3">
              {grupos.map(([label, its]) => {
                const col = colapsadas.has(label)
                return (
                  <div key={label}>
                    <button onClick={() => setColapsadas((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })} className="flex w-full items-center gap-2 py-2 text-sm font-semibold text-slate-700">
                      {col ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {label} <span className="text-xs font-normal text-slate-400">({its.length} · {brl(its.reduce((s, i) => s + i.valor, 0))})</span>
                    </button>
                    {!col && <ListaItens itens={its} id={id} onRenomear={renomeado} />}
                  </div>
                )
              })}
            </div>
          ) : (
            <ListaItens itens={filtrados} id={id} onRenomear={renomeado} />
          )}
        </>
      )}
    </div>
  )
}

function ListaItens({ itens, id, onRenomear }: { itens: PosItem[]; id: string; onRenomear: (itemId: string, n: string) => void }) {
  return (
    <Card><CardContent className="p-0">
      {/* desktop: tabela */}
      <table className="hidden w-full text-sm sm:table">
        <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
          <th className="p-3 font-medium">Item</th><th className="p-3 font-medium">Categoria</th>
          <th className="p-3 text-right font-medium">Saldo</th><th className="p-3 font-medium">Faixa (mín–máx)</th>
          <th className="p-3 text-right font-medium">Custo médio</th>
          <th className="p-3 text-right font-medium">Valor</th><th className="p-3 text-right font-medium">Última entrada</th>
        </tr></thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.itemId} className={`border-b border-l-2 border-slate-50 last:border-b-0 hover:bg-slate-50 ${STATUS_BORDA[i.status.cor]}`}>
              <td className="p-3"><NomeEditavel companyId={id} itemId={i.itemId} nome={i.nome} comLink onSalvo={(n) => onRenomear(i.itemId, n)} /></td>
              <td className="p-3 text-slate-500">{i.categoriaLabel}</td>
              <td className={`p-3 text-right tabular-nums ${i.negativo ? 'font-semibold text-rose-600' : 'text-slate-800'}`}>{i.negativo && <AlertTriangle className="mr-1 inline h-3 w-3" />}{num(i.saldo)} {i.unidadeControle}</td>
              <td className="w-36 p-3">
                {i.estoqueMin == null ? <span className="text-xs text-slate-300">—</span> : (<>
                  <StatusBar status={i.status} />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 tabular-nums"><span>{num(i.estoqueMin)}</span><span>{i.estoqueMax != null ? num(i.estoqueMax) : ''}</span></div>
                </>)}
              </td>
              <td className="p-3 text-right tabular-nums text-slate-600">{i.custoMedio != null ? brl(i.custoMedio) : '—'} <Tendencia t={i.custoTendencia} /></td>
              <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(i.valor)}</td>
              <td className="p-3 text-right"><IdadeBadge dias={i.ultimaEntradaDias} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* mobile: cards */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {itens.map((i) => (
          <div key={i.itemId} className={`border-l-2 p-4 ${STATUS_BORDA[i.status.cor]}`}>
            <div className="flex items-start justify-between gap-2">
              <NomeEditavel companyId={id} itemId={i.itemId} nome={i.nome} comLink onSalvo={(n) => onRenomear(i.itemId, n)} />
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(i.valor)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span className={i.negativo ? 'font-semibold text-rose-600' : ''}>{num(i.saldo)} {i.unidadeControle} · {i.custoMedio != null ? brl(i.custoMedio) : '—'} <Tendencia t={i.custoTendencia} /></span>
              <IdadeBadge dias={i.ultimaEntradaDias} />
            </div>
            {i.estoqueMin != null && (
              <div className="mt-2 flex items-center gap-2">
                <StatusBar status={i.status} className="flex-1" />
                <StatusDot status={i.status} />
              </div>
            )}
          </div>
        ))}
      </div>
    </CardContent></Card>
  )
}
