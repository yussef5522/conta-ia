'use client'

// ESTOQUE PARTE C — relatório "Perdas do período" por motivo e por item (R$). É o insumo
// do Real vs Teórico (Fase 3): variância = contagem − (venda + perda + consumo explicados).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar, type TotalItem } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { TrendingDown, Loader2, ArrowLeft, PackageMinus, Download, Layers, Hash } from 'lucide-react'
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
  const sMot = useSort<'label' | 'qtd' | 'valor'>('valor', 'desc')
  const sIt = useSort<'nome' | 'qtd' | 'valor'>('valor', 'desc')

  return (
    <div className="space-y-3">
      <a href={`/empresas/${id}/estoque/posicao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra posição</a>
      <div className="flex flex-wrap items-center gap-2.5">
        <TrendingDown className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Perdas & saídas</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">O que saiu sem ser venda — por motivo e por item. Alimenta o Real vs Teórico.</p>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => rel && baixarCsv(`perdas-${de}-a-${ate}`,
            ['Tipo', 'Motivo/Item', 'Quantidade', 'Ocorrências', 'Valor'],
            [...rel.porMotivo.map((m) => ['motivo', m.label, m.quantidade, m.n, m.valor]),
             ...rel.porItem.map((i) => ['item', i.nome, i.quantidade, i.n, i.valor])])}
            disabled={!rel || rel.totalItens === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
          <button onClick={() => setSaida(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]"><PackageMinus className="h-3.5 w-3.5" /> Registrar saída</button>
        </div>
      </div>
      {saida && <SaidaModal companyId={id} onClose={() => setSaida(false)} onSalvo={() => { setSaida(false); carregar() }} />}

      <div className="flex flex-wrap items-center gap-1.5">
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
        <span className="text-xs text-slate-400">a</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
        {rel && rel.totalItens > 0 && <span className="ml-auto text-xs tabular-nums text-slate-400">{rel.totalItens} {rel.totalItens === 1 ? 'registro' : 'registros'}</span>}
      </div>

      {rel === undefined ? <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        : rel === null ? <p className="text-sm text-slate-500">Não consegui carregar.</p>
        : rel.totalItens === 0 ? <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhuma saída registrada no período. Registre perdas/uso interno pra o Real vs Teórico fechar.</CardContent></Card>
        : (
          <>
            <StatCardGrid>
              <StatCard tone="rose" label="Perdido / usado" value={brl(rel.totalValor)} sub={`${rel.totalItens} ${rel.totalItens === 1 ? 'registro' : 'registros'}`} icon={TrendingDown} />
              <StatCard tone="amber" label="Motivos distintos" value={String(rel.porMotivo.length)} sub="tipos de saída" icon={Layers} />
              <StatCard tone="slate" label="Itens afetados" value={String(rel.porItem.length)} sub="produtos" icon={Hash} />
            </StatCardGrid>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Por motivo</h2>
              <Card><CardContent className="p-0"><table className="density-normal w-full">
                <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <SortableTh campo="label" col={sMot.col} dir={sMot.dir} onSort={sMot.alternar}>Motivo</SortableTh>
                  <SortableTh campo="qtd" col={sMot.col} dir={sMot.dir} onSort={sMot.alternar} align="right">Quantidade</SortableTh>
                  <SortableTh campo="valor" col={sMot.col} dir={sMot.dir} onSort={sMot.alternar} align="right">Valor</SortableTh>
                </tr></thead>
                <tbody>
                {sMot.ordenar(rel.porMotivo, (m, c) => (c === 'label' ? m.label : c === 'qtd' ? m.quantidade : m.valor)).map((m) => (
                  <tr key={m.motivo} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-0 text-[13px]"><span className="font-medium text-slate-800">{m.label}</span> <span className="text-[11px] text-slate-400">{m.tipo === 'PERDA' ? 'perda' : 'uso interno'}</span></td>
                    <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-500">{num(m.quantidade)} · {m.n}×</td>
                    <td className="px-3 py-0 text-[13px] text-right font-medium tabular-nums text-rose-600">{brl(m.valor)}</td>
                  </tr>
                ))}
              </tbody></table></CardContent></Card>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Por item</h2>
              <Card><CardContent className="p-0"><table className="density-normal w-full">
                <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <SortableTh campo="nome" col={sIt.col} dir={sIt.dir} onSort={sIt.alternar}>Item</SortableTh>
                  <SortableTh campo="qtd" col={sIt.col} dir={sIt.dir} onSort={sIt.alternar} align="right">Quantidade</SortableTh>
                  <SortableTh campo="valor" col={sIt.col} dir={sIt.dir} onSort={sIt.alternar} align="right">Valor</SortableTh>
                </tr></thead>
                <tbody>
                {sIt.ordenar(rel.porItem, (i, c) => (c === 'nome' ? i.nome : c === 'qtd' ? i.quantidade : i.valor)).map((i) => (
                  <tr key={i.itemId} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{i.nome}</td>
                    <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-500">{num(i.quantidade)} · {i.n}×</td>
                    <td className="px-3 py-0 text-[13px] text-right font-medium tabular-nums text-rose-600">{brl(i.valor)}</td>
                  </tr>
                ))}
              </tbody></table></CardContent></Card>
            </div>
            {/* RÉGUA — perda × uso interno (o DRE trata diferente) */}
            <TotalsBar
              itens={[
                { chave: 'perda', label: 'Perda', tone: 'rose', n: rel.porMotivo.filter((m) => m.tipo === 'PERDA').length, valor: rel.porMotivo.filter((m) => m.tipo === 'PERDA').reduce((s2, m) => s2 + m.valor, 0) },
                { chave: 'uso', label: 'Uso interno', tone: 'amber', n: rel.porMotivo.filter((m) => m.tipo !== 'PERDA').length, valor: rel.porMotivo.filter((m) => m.tipo !== 'PERDA').reduce((s2, m) => s2 + m.valor, 0) },
              ]}
              total={rel.totalValor}
              totalLabel="Saiu sem venda"
            />
          </>
        )}
    </div>
  )
}
