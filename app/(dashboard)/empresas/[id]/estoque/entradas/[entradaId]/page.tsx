'use client'

// ESTOQUE — RECIBO da entrada manual (URL estável, mesmo espírito do recibo da
// conferência): derivado da entrada + itens, sem tabela de recibo à parte.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { PackageCheck, Loader2, ArrowLeft } from 'lucide-react'

interface Recibo {
  id: string; fornecedorNome: string; data: string; valorTotal: number
  observacao: string | null; criadoPorNome: string | null
  geraPayable: boolean; payableVenc: string | null; payableValor: number | null
  itens: { nome: string; quantidade: number; custoUnitario: number; custoTotal: number }[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export default function ReciboEntradaPage({ params }: { params: Promise<{ id: string; entradaId: string }> }) {
  const { id, entradaId } = use(params)
  const [r, setR] = useState<Recibo | null | undefined>(undefined)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/entrada-manual/${entradaId}`).then((x) => x.json()).then((j) => setR(j.recibo ?? null)).catch(() => setR(null))
  }, [id, entradaId])

  if (r === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!r) return <div className="p-6 text-sm text-slate-500">Entrada não encontrada.</div>

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <a href={`/empresas/${id}/estoque/recebimentos`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra recebimentos</a>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <PackageCheck className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-2 text-base font-semibold text-slate-900">Entrada manual registrada</h1>
        <p className="mt-0.5 text-sm text-slate-600">{r.itens.length} {r.itens.length === 1 ? 'item entrou' : 'itens entraram'} no estoque · {brl(r.valorTotal)}</p>
        <span className="mt-2 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">sem nota · manual</span>
      </div>

      <Card><CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
          <b className="text-sm text-slate-900">{r.fornecedorNome}</b>
          <span>compra em {dia(r.data)}</span>
          {r.criadoPorNome && <span>· registrada por {r.criadoPorNome}</span>}
        </div>
        <table className="density-normal w-full">
          <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">Produto</th>
            <th className="px-3 py-2 text-right font-medium">Qtd</th>
            <th className="px-3 py-2 text-right font-medium">Custo unit.</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr></thead>
          <tbody>
            {r.itens.map((i, idx) => (
              <tr key={idx} className="border-b border-slate-50 last:border-b-0">
                <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{i.nome}</td>
                <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{num(i.quantidade)}</td>
                <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{brl(i.custoUnitario)}</td>
                <td className="px-3 py-0 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(i.custoTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
          <span className="text-xs text-slate-500">{r.geraPayable ? `1 parcela de ${brl(r.payableValor ?? 0)} vencendo ${dia(r.payableVenc)}` : 'compra à vista — sem parcela a pagar'}</span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(r.valorTotal)}</span>
        </div>
      </CardContent></Card>

      {r.observacao && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{r.observacao}</p>}

      <div className="flex gap-2">
        <a href={`/empresas/${id}/estoque/posicao`} className="flex-1 rounded-xl bg-[#185FA5] py-2.5 text-center text-sm font-semibold text-white">Ver posição de estoque</a>
        <a href={`/empresas/${id}/estoque/entrada-manual`} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-center text-sm font-medium text-slate-700">Nova entrada manual</a>
      </div>
    </div>
  )
}
