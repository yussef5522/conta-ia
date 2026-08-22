'use client'

// ESTOQUE PARTE C — relatório "Perdas do período" por motivo e por item (R$). É o insumo
// do Real vs Teórico (Fase 3): variância = contagem − (venda + perda + consumo explicados).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingDown, Loader2, ArrowLeft, PackageMinus } from 'lucide-react'
import { SaidaModal } from '@/components/estoque/saida-modal'

interface Rel { de: string; ate: string; totalValor: number; totalItens: number; porMotivo: { motivo: string; label: string; tipo: string; quantidade: number; valor: number; n: number }[]; porItem: { itemId: string; nome: string; quantidade: number; valor: number; n: number }[] }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function PerdasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hoje = new Date().toISOString().slice(0, 10)
  const inicioMes = hoje.slice(0, 8) + '01'
  const [de, setDe] = useState(inicioMes)
  const [ate, setAte] = useState(hoje)
  const [rel, setRel] = useState<Rel | null | undefined>(undefined)
  const [saida, setSaida] = useState(false)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/perdas?de=${de}&ate=${ate}`).then((r) => r.json()).then((j) => setRel(j.relatorio ?? null)).catch(() => setRel(null))
  useEffect(() => { carregar() }, [id, de, ate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/posicao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição</a>
      <div className="flex items-center gap-3">
        <TrendingDown className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Perdas & saídas</h1><p className="text-sm text-slate-500">O que saiu sem ser venda — por motivo e por item. Alimenta o Real vs Teórico.</p></div>
        <button onClick={() => setSaida(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]"><PackageMinus className="h-4 w-4" /> Registrar saída</button>
      </div>
      {saida && <SaidaModal companyId={id} onClose={() => setSaida(false)} onSalvo={() => { setSaida(false); carregar() }} />}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
        <label className="text-xs text-slate-500">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
      </div>

      {rel === undefined ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        : rel === null ? <p className="text-sm text-slate-500">Não consegui carregar.</p>
        : rel.totalItens === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhuma saída registrada no período. Registre perdas/uso interno pra o Real vs Teórico fechar.</CardContent></Card>
        : (
          <>
            <Card><CardContent className="grid grid-cols-2 gap-4 p-4 text-sm">
              <div><p className="text-xs text-slate-500">Total perdido/usado</p><p className="text-lg font-semibold text-rose-600">{brl(rel.totalValor)}</p></div>
              <div><p className="text-xs text-slate-500">Registros</p><p className="text-lg font-semibold text-slate-900">{rel.totalItens}</p></div>
            </CardContent></Card>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Por motivo</h2>
              <Card><CardContent className="p-0"><table className="w-full text-sm"><tbody>
                {rel.porMotivo.map((m) => (
                  <tr key={m.motivo} className="border-b border-slate-50 last:border-0">
                    <td className="p-3"><span className="font-medium text-slate-800">{m.label}</span> <span className="text-[11px] text-slate-400">{m.tipo === 'PERDA' ? 'perda' : 'uso interno'}</span></td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{num(m.quantidade)} · {m.n}×</td>
                    <td className="p-3 text-right font-medium tabular-nums text-rose-600">{brl(m.valor)}</td>
                  </tr>
                ))}
              </tbody></table></CardContent></Card>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Por item</h2>
              <Card><CardContent className="p-0"><table className="w-full text-sm"><tbody>
                {rel.porItem.map((i) => (
                  <tr key={i.itemId} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium text-slate-800">{i.nome}</td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{num(i.quantidade)} · {i.n}×</td>
                    <td className="p-3 text-right font-medium tabular-nums text-rose-600">{brl(i.valor)}</td>
                  </tr>
                ))}
              </tbody></table></CardContent></Card>
            </div>
          </>
        )}
    </div>
  )
}
