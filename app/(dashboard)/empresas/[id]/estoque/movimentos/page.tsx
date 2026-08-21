'use client'

// ESTOQUE FASE 1 item 2 — MOVIMENTAÇÃO (o extrato do estoque). Filtros item/tipo/período,
// referência clicável (nota/conferência), estorno destacado, quem lançou, export CSV.
// Mesma família visual do resto. Mobile em cards.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeftRight, Loader2, Download, FileText } from 'lucide-react'

interface Mov {
  id: string; data: string; tipo: string; estorno: boolean; itemNome: string
  quantidade: number; custoUnitario: number; custoTotal: number
  referencia: { tipo: 'nota' | 'conferencia' | null; label: string; nfeId: string | null }; quem: string
}
interface ItemOpt { id: string; nome: string }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const TIPO_LABEL: Record<string, string> = { ENTRADA_NF: 'Entrada (nota)', ESTORNO: 'Estorno', ENTRADA_MANUAL: 'Entrada manual', PRODUCAO_CONSUMO: 'Consumo produção', PRODUCAO_GERACAO: 'Geração produção', BAIXA_VENDA: 'Baixa venda', AJUSTE_CONTAGEM: 'Ajuste contagem', PERDA: 'Perda' }
const tipoBadge = (t: string) => (t === 'ESTORNO' ? 'bg-rose-50 text-rose-700' : t === 'ENTRADA_NF' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')

export default function MovimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [movs, setMovs] = useState<Mov[] | undefined>(undefined)
  const [itens, setItens] = useState<ItemOpt[]>([])
  const [fItem, setFItem] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (fItem) p.set('itemId', fItem); if (fTipo) p.set('tipo', fTipo); if (fDe) p.set('de', fDe); if (fAte) p.set('ate', fAte)
    return p.toString()
  }, [fItem, fTipo, fDe, fAte])

  useEffect(() => {
    setMovs(undefined)
    fetch(`/api/empresas/${id}/estoque/movimentos?${qs}`).then((r) => r.json()).then((j) => { setMovs(j.movimentos ?? []); if (j.itens) setItens(j.itens) }).catch(() => setMovs([]))
  }, [id, qs])

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-7 w-7 text-[#185FA5]" />
        <div><h1 className="text-xl font-semibold text-slate-900">Movimentação de estoque</h1><p className="text-sm text-slate-500">O extrato do estoque — cada entrada, estorno e (em breve) baixa, com rastro.</p></div>
      </div>

      {/* filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">Item<select value={fItem} onChange={(e) => setFItem(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">todos</option>{itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></label>
        <label className="text-xs text-slate-500">Tipo<select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">todos</option><option value="ENTRADA_NF">Entrada (nota)</option><option value="ESTORNO">Estorno</option></select></label>
        <label className="text-xs text-slate-500">De<input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
        <label className="text-xs text-slate-500">Até<input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
        <a href={`/api/empresas/${id}/estoque/movimentos?${qs}&formato=csv`} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> CSV</a>
      </div>

      {movs === undefined ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        : movs.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhum movimento{fItem || fTipo || fDe || fAte ? ' com esse filtro' : ' ainda'}. Aparece a cada recebimento confirmado.</CardContent></Card>
        : (
          <Card><CardContent className="p-0">
            {/* desktop */}
            <table className="hidden w-full text-sm sm:table">
              <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Data</th><th className="p-3 font-medium">Tipo</th><th className="p-3 font-medium">Item</th>
                <th className="p-3 text-right font-medium">Qtd</th><th className="p-3 text-right font-medium">Custo un.</th><th className="p-3 text-right font-medium">Custo total</th>
                <th className="p-3 font-medium">Referência</th><th className="p-3 font-medium">Quem</th>
              </tr></thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id} className={`border-b border-slate-50 last:border-0 ${m.estorno ? 'bg-rose-50/40' : ''}`}>
                    <td className="p-3 tabular-nums text-slate-700">{fmtDia(m.data)}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tipoBadge(m.tipo)}`}>{TIPO_LABEL[m.tipo] ?? m.tipo}</span></td>
                    <td className="p-3 font-medium text-slate-800">{m.itemNome}</td>
                    <td className={`p-3 text-right tabular-nums ${m.quantidade < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{num(m.quantidade)}</td>
                    <td className="p-3 text-right tabular-nums text-slate-600">{brl(m.custoUnitario)}</td>
                    <td className={`p-3 text-right font-medium tabular-nums ${m.custoTotal < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{brl(m.custoTotal)}</td>
                    <td className="p-3">{m.referencia.nfeId ? <a href={`/empresas/${id}/estoque/recebimentos/${m.referencia.nfeId}`} className="inline-flex items-center gap-1 text-[#185FA5] hover:underline"><FileText className="h-3.5 w-3.5" />{m.referencia.label}</a> : <span className="text-slate-500">{m.referencia.label}</span>}</td>
                    <td className="p-3 text-slate-500">{m.quem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* mobile */}
            <div className="divide-y divide-slate-50 sm:hidden">
              {movs.map((m) => (
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
    </div>
  )
}
