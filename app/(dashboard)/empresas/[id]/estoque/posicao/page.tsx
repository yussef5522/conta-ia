'use client'

// ESTOQUE FASE 1 item 2 — POSIÇÃO de estoque. Nasce vazia; enche a cada recebimento
// confirmado. Saldo derivado (Σ movimentos), custo médio, valor. Card por categoria.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Boxes, Loader2, AlertTriangle } from 'lucide-react'

interface PosItem { itemId: string; nome: string; categoriaLabel: string; unidadeControle: string; saldo: number; custoMedio: number | null; valor: number; negativo: boolean }
interface Posicao { itens: PosItem[]; valorTotal: number; porCategoria: { categoria: string; label: string; valor: number; itens: number }[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function PosicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Posicao | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/posicao`).then((r) => r.json()).then((j) => setData(j.posicao ?? null)).catch(() => setData(null))
  }, [id])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a posição.</div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Boxes className="h-7 w-7 text-[#185FA5]" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Posição de estoque</h1>
          <p className="text-sm text-slate-500">Saldo derivado dos movimentos. Nasce vazio e enche a cada recebimento confirmado.</p>
        </div>
      </div>

      {data.itens.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Boxes className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">O estoque está zerado — e é assim que começa.</p>
          <p className="max-w-md text-xs text-slate-500">Confirme o primeiro recebimento na fila e os itens aparecem aqui com o saldo em kg/un/lt e o valor.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* valor total + por categoria */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-slate-500">Valor total</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(data.valorTotal)}</p></CardContent></Card>
            {data.porCategoria.slice(0, 3).map((c) => (
              <Card key={c.categoria}><CardContent className="p-4"><p className="text-xs text-slate-500">{c.label}</p><p className="text-lg font-semibold tabular-nums text-slate-900">{brl(c.valor)}</p><p className="text-[11px] text-slate-400">{c.itens} {c.itens === 1 ? 'item' : 'itens'}</p></CardContent></Card>
            ))}
          </div>

          {/* lista */}
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Item</th><th className="p-3 font-medium">Categoria</th>
                <th className="p-3 text-right font-medium">Saldo</th><th className="p-3 text-right font-medium">Custo médio</th><th className="p-3 text-right font-medium">Valor</th>
              </tr></thead>
              <tbody>
                {data.itens.map((i) => (
                  <tr key={i.itemId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">
                      <a href={`/empresas/${id}/estoque/itens/${i.itemId}`} className="text-[#185FA5] hover:underline">{i.nome}</a>
                    </td>
                    <td className="p-3 text-slate-500">{i.categoriaLabel}</td>
                    <td className={`p-3 text-right tabular-nums ${i.negativo ? 'font-semibold text-rose-600' : 'text-slate-800'}`}>
                      {i.negativo && <AlertTriangle className="mr-1 inline h-3 w-3" />}{num(i.saldo)} {i.unidadeControle}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{i.custoMedio != null ? brl(i.custoMedio) : '—'}</td>
                    <td className="p-3 text-right font-medium tabular-nums text-slate-900">{brl(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
