'use client'

// ESTOQUE FASE 1 item 2 — MOVIMENTAÇÃO (o extrato do estoque). Filtros item/tipo/período,
// referência clicável (nota/conferência), estorno destacado, quem lançou, export CSV.
// Mesma família visual do resto. Mobile em cards.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TotalsBar, type TotalItem } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { ArrowLeftRight, Loader2, Download, FileText } from 'lucide-react'

interface Mov {
  id: string; data: string; tipo: string; estorno: boolean; itemNome: string
  quantidade: number; custoUnitario: number; custoTotal: number
  referencia: { tipo: 'nota' | 'conferencia' | null; label: string; nfeId: string | null }; quem: string
}
interface ItemOpt { id: string; nome: string }
type Campo = 'data' | 'tipo' | 'item' | 'qtd' | 'total'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const TIPO_LABEL: Record<string, string> = { ENTRADA_NF: 'Entrada (nota)', ESTORNO: 'Estorno', ENTRADA_MANUAL: 'Entrada manual', PRODUCAO_CONSUMO: 'Consumo produção', PRODUCAO_GERACAO: 'Geração produção', BAIXA_VENDA: 'Baixa venda', AJUSTE_CONTAGEM: 'Ajuste contagem', PERDA: 'Perda', USO_INTERNO: 'Uso interno' }
const tipoBadge = (t: string) => (t === 'ESTORNO' ? 'bg-rose-50 text-rose-700' : t === 'ENTRADA_NF' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')

export default function MovimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [movs, setMovs] = useState<Mov[] | undefined>(undefined)
  const [itens, setItens] = useState<ItemOpt[]>([])
  const [fItem, setFItem] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const { col, dir, alternar, ordenar } = useSort<Campo>('data', 'desc')

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (fItem) p.set('itemId', fItem); if (fTipo) p.set('tipo', fTipo); if (fDe) p.set('de', fDe); if (fAte) p.set('ate', fAte)
    return p.toString()
  }, [fItem, fTipo, fDe, fAte])

  useEffect(() => {
    setMovs(undefined)
    fetch(`/api/empresas/${id}/estoque/movimentos?${qs}`).then((r) => r.json()).then((j) => { setMovs(j.movimentos ?? []); if (j.itens) setItens(j.itens) }).catch(() => setMovs([]))
  }, [id, qs])

  // ordenação é do que ESTÁ NA TELA (o CSV do servidor traz até 5.000 linhas — outra coisa)
  const lista = useMemo(() => ordenar(movs ?? [], (m, c) => (
    c === 'data' ? m.data : c === 'tipo' ? m.tipo : c === 'item' ? m.itemNome
      : c === 'qtd' ? m.quantidade : m.custoTotal
  )), [movs, ordenar])

  const entradas = (movs ?? []).filter((m) => m.custoTotal > 0).reduce((s2, m) => s2 + m.custoTotal, 0)
  const saidas = (movs ?? []).filter((m) => m.custoTotal < 0).reduce((s2, m) => s2 + m.custoTotal, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <ArrowLeftRight className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Movimentação de estoque</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">O extrato do estoque — cada entrada, estorno e baixa, com rastro</p>
        <a href={`/api/empresas/${id}/estoque/movimentos?${qs}&formato=csv`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> CSV</a>
      </div>

      {/* FILTROS numa linha (anatomia oficial) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={fItem} onChange={(e) => setFItem(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs text-slate-600"><option value="">todos os itens</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select>
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs text-slate-600"><option value="">todos os tipos</option><option value="ENTRADA_NF">Entrada (nota)</option><option value="ENTRADA_MANUAL">Entrada manual</option><option value="BAIXA_VENDA">Baixa de venda</option><option value="AJUSTE_CONTAGEM">Ajuste de contagem</option><option value="PERDA">Perda</option><option value="ESTORNO">Estorno</option></select>
        <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
        <span className="text-xs text-slate-400">a</span>
        <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
        <span className="ml-auto text-xs tabular-nums text-slate-400">{lista.length} {lista.length === 1 ? 'movimento' : 'movimentos'}</span>
      </div>

      {movs === undefined ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        : movs.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhum movimento{fItem || fTipo || fDe || fAte ? ' com esse filtro' : ' ainda'}. Aparece a cada recebimento confirmado.</CardContent></Card>
        : (
          <Card><CardContent className="p-0">
            {/* desktop */}
            <table className="density-normal hidden w-full sm:table">
              <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <SortableTh campo="data" col={col} dir={dir} onSort={alternar}>Data</SortableTh>
                <SortableTh campo="tipo" col={col} dir={dir} onSort={alternar}>Tipo</SortableTh>
                <SortableTh campo="item" col={col} dir={dir} onSort={alternar}>Item</SortableTh>
                <SortableTh campo="qtd" col={col} dir={dir} onSort={alternar} align="right">Qtd</SortableTh>
                <th className="px-3 py-2 text-right font-medium">Custo un.</th>
                <SortableTh campo="total" col={col} dir={dir} onSort={alternar} align="right">Custo total</SortableTh>
                <th className="px-3 py-2 font-medium">Referência</th><th className="px-3 py-2 font-medium">Quem</th>
              </tr></thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} className={`border-b border-slate-50 last:border-0 ${m.estorno ? 'bg-rose-50/40' : ''}`}>
                    <td className="px-3 py-0 text-[13px] tabular-nums text-slate-700">{fmtDia(m.data)}</td>
                    <td className="px-3 py-0 text-[13px]"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tipoBadge(m.tipo)}`}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span></td>
                    <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{m.itemNome}</td>
                    <td className={`px-3 py-0 text-[13px] text-right tabular-nums ${m.quantidade < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{num(m.quantidade)}</td>
                    <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-600">{brl(m.custoUnitario)}</td>
                    <td className={`px-3 py-0 text-[13px] text-right font-medium tabular-nums ${m.custoTotal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{brl(m.custoTotal)}</td>
                    <td className="px-3 py-0 text-[13px]">{m.referencia.nfeId ? <a href={`/empresas/${id}/estoque/recebimentos/${m.referencia.nfeId}`} className="inline-flex items-center gap-1 text-[#185FA5] hover:underline"><FileText className="h-3.5 w-3.5" />{m.referencia.label}</a> : <span className="text-slate-500">{m.referencia.label}</span>}</td>
                    <td className="px-3 py-0 text-[13px] text-slate-500">{m.quem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* mobile */}
            <div className="divide-y divide-slate-50 sm:hidden">
              {lista.map((m) => (
                <div key={m.id} className={`p-4 ${m.estorno ? 'bg-rose-50/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{m.itemNome}</span>
                    <span className={`text-sm font-semibold tabular-nums ${m.custoTotal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{brl(m.custoTotal)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tipoBadge(m.tipo)}`}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span>
                    <span>{num(m.quantidade)} · {fmtDia(m.data)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{m.referencia.nfeId ? <a href={`/empresas/${id}/estoque/recebimentos/${m.referencia.nfeId}`} className="text-[#185FA5]">{m.referencia.label}</a> : m.referencia.label} · {m.quem}</div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}

      {/* RÉGUA — o que entrou × o que saiu no período filtrado */}
      {(movs?.length ?? 0) > 0 && (
        <TotalsBar
          itens={[
            { chave: 'entradas', label: 'Entrou', tone: 'emerald', valor: entradas },
            { chave: 'saidas', label: 'Saiu', tone: 'rose', valor: saidas },
          ]}
          total={entradas + saidas}
          totalLabel="Líquido"
        />
      )}
    </div>
  )
}
