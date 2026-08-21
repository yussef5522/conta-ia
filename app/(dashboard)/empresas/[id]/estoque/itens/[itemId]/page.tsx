'use client'

// ESTOQUE FASE 1 — FICHA do produto. Cabeçalho + gráfico de preço no tempo + histórico
// de compras (cada ENTRADA_NF, lida do ledger). Preparada pra crescer (consumo/produção).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Loader2, ArrowLeft, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { NomeEditavel } from '@/components/estoque/nome-editavel'

interface Compra { movimentoId: string; data: string; tipo: string; estorno: boolean; fornecedor: string | null; nNF: string | null; quantidade: number; custoUnitario: number; custoTotal: number }
interface Ficha {
  item: { id: string; nome: string; unidadeControle: string; categoriaLabel: string; ativo: boolean }
  saldo: number; custoMedio: number | null; valor: number
  compras: Compra[]; precoTempo: { data: string; preco: number }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtDia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export default function FichaItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = use(params)
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/itens/${itemId}`).then((r) => r.json()).then((j) => setFicha(j.ficha ?? null)).catch(() => setFicha(null))
  }, [id, itemId])

  if (ficha === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!ficha) return <div className="p-6 text-sm text-slate-500">Item não encontrado.</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <a href={`/empresas/${id}/estoque/posicao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição</a>

      {/* cabeçalho */}
      <div>
        <div className="flex items-center gap-3">
          <Package className="h-7 w-7 shrink-0 text-[#185FA5]" />
          <div className="min-w-0">
            <div className="text-xl"><NomeEditavel companyId={id} itemId={itemId} nome={ficha.item.nome} className="text-xl font-semibold" onSalvo={(n) => setFicha({ ...ficha, item: { ...ficha.item, nome: n } })} /></div>
            <p className="text-sm text-slate-500">{ficha.item.categoriaLabel} · controle em {ficha.item.unidadeControle}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Saldo atual</p><p className="text-lg font-semibold tabular-nums text-slate-900">{num(ficha.saldo)} {ficha.item.unidadeControle}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Custo médio</p><p className="text-lg font-semibold tabular-nums text-slate-900">{ficha.custoMedio != null ? brl(ficha.custoMedio) : '—'}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Valor em estoque</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(ficha.valor)}</p></CardContent></Card>
        </div>
      </div>

      {/* gráfico de preço no tempo (2+ compras) */}
      {ficha.precoTempo.length >= 2 && (
        <Card><CardContent className="p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="h-4 w-4" /> Preço unitário no tempo</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ficha.precoTempo} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={50} tickFormatter={(v) => brl(v)} />
                <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(l) => fmtDia(String(l))} />
                <Line type="monotone" dataKey="preco" stroke="#185FA5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      )}

      {/* histórico de compras */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Histórico de compras</h2>
        {ficha.compras.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-slate-500">Nenhuma compra ainda. Aparece aqui a cada recebimento confirmado.</CardContent></Card>
        ) : (
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Data</th><th className="p-3 font-medium">Fornecedor</th><th className="p-3 font-medium">Nota</th>
                <th className="p-3 text-right font-medium">Qtd</th><th className="p-3 text-right font-medium">Preço un.</th><th className="p-3 text-right font-medium">Total</th>
              </tr></thead>
              <tbody>
                {ficha.compras.map((c) => (
                  <tr key={c.movimentoId} className={`border-b border-slate-50 last:border-0 ${c.estorno ? 'bg-rose-50/40' : ''}`}>
                    <td className="p-3 tabular-nums text-slate-700">{fmtDia(c.data)}</td>
                    <td className="p-3 text-slate-700">{c.fornecedor ?? '—'}{c.estorno && <span className="ml-1 text-xs font-semibold text-rose-600">(estorno)</span>}</td>
                    <td className="p-3 text-slate-400">{c.nNF ? `nº ${c.nNF}` : '—'}</td>
                    <td className="p-3 text-right tabular-nums text-slate-700">{num(c.quantidade)} {ficha.item.unidadeControle}</td>
                    <td className="p-3 text-right tabular-nums text-slate-700">{brl(c.custoUnitario)}</td>
                    <td className={`p-3 text-right font-medium tabular-nums ${c.estorno ? 'text-rose-600' : 'text-slate-900'}`}>{brl(c.custoTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  )
}

