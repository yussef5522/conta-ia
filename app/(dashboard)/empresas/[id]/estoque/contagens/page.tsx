'use client'

// ESTOQUE FASE 3 PARTE 2 — SESSÕES de contagem: retomar a parcial (1 aberta por vez),
// histórico e a INICIAL destacada. Padrão de densidade do estoque.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Loader2, Play, ArrowRight, Download, ListChecks, AlertTriangle } from 'lucide-react'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'

interface Resumo {
  id: string; tipo: string; status: string
  iniciadaEm: string; finalizadaEm: string | null
  criadoPorNome: string | null
  itensContados: number; itensComDivergencia: number; valorDivergencia: number
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmt = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Campo = 'iniciadaEm' | 'tipo' | 'quem' | 'itens' | 'divergencias' | 'ajuste' | 'status'
const STATUS_CHIP: Record<string, string> = {
  ABERTA: 'bg-sky-100 text-sky-700', FINALIZADA: 'bg-emerald-100 text-emerald-700', CANCELADA: 'bg-slate-100 text-slate-500',
}

export default function ContagensPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cs, setCs] = useState<Resumo[] | null | undefined>(undefined)
  const { col, dir, alternar, ordenar } = useSort<Campo>('iniciadaEm', 'desc')

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/contagens`).then((r) => r.json()).then((j) => setCs(j.contagens ?? null)).catch(() => setCs(null))
  }, [id])

  if (cs === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!cs) return <div className="p-6 text-sm text-slate-500">Não consegui carregar as contagens.</div>

  const aberta = cs.find((c) => c.status === 'ABERTA')
  const lista = ordenar(cs, (c, k) => (
    k === 'iniciadaEm' ? c.iniciadaEm : k === 'tipo' ? c.tipo : k === 'quem' ? (c.criadoPorNome ?? '')
      : k === 'itens' ? c.itensContados : k === 'divergencias' ? c.itensComDivergencia
        : k === 'ajuste' ? c.valorDivergencia : c.status
  ))
  const finalizadas = cs.filter((c) => c.status === 'FINALIZADA')
  const ajusteTotal = cs.reduce((s2, c) => s2 + c.valorDivergencia, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <ClipboardList className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Sessões de contagem</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">Uma sessão aberta por vez · a parcial fica esperando você voltar</p>
        <button onClick={() => baixarCsv(`contagens-${hojeArquivo()}`,
          ['Início', 'Fim', 'Tipo', 'Quem', 'Itens contados', 'Com divergência', 'Ajuste (R$)', 'Status'],
          lista.map((c) => [fmt(c.iniciadaEm), fmt(c.finalizadaEm), c.tipo, c.criadoPorNome ?? '', c.itensContados, c.itensComDivergencia, c.valorDivergencia, c.status]))}
          disabled={cs.length === 0}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
        <a href={`/empresas/${id}/estoque/contagem`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
          {aberta ? <><ArrowRight className="h-3.5 w-3.5" /> Continuar contagem</> : <><Play className="h-3.5 w-3.5" /> Nova contagem</>}
        </a>
      </div>

      {cs.length > 0 && (
        <StatCardGrid>
          <StatCard tone="sky" label="Sessões" value={String(cs.length)} sub={`${finalizadas.length} finalizadas`} icon={ClipboardList} />
          <StatCard tone="slate" label="Itens contados" value={String(cs.reduce((s2, c) => s2 + c.itensContados, 0))} sub="no histórico" icon={ListChecks} />
          <StatCard tone={ajusteTotal < 0 ? 'rose' : 'emerald'} label="Ajuste acumulado" value={brl(ajusteTotal)} sub={`${cs.reduce((s2, c) => s2 + c.itensComDivergencia, 0)} divergências`} icon={AlertTriangle} />
        </StatCardGrid>
      )}

      {cs.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma contagem ainda.</p>
          <p className="max-w-md text-xs text-slate-500">A primeira é a INICIAL — o ponto-zero do estoque, contado item a item.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="density-normal hidden w-full sm:table">
            <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <SortableTh campo="iniciadaEm" col={col} dir={dir} onSort={alternar}>Início</SortableTh>
              <SortableTh campo="tipo" col={col} dir={dir} onSort={alternar}>Tipo</SortableTh>
              <SortableTh campo="quem" col={col} dir={dir} onSort={alternar}>Quem</SortableTh>
              <SortableTh campo="itens" col={col} dir={dir} onSort={alternar} align="right">Itens</SortableTh>
              <SortableTh campo="divergencias" col={col} dir={dir} onSort={alternar} align="right">Divergências</SortableTh>
              <SortableTh campo="ajuste" col={col} dir={dir} onSort={alternar} align="right">Ajuste</SortableTh>
              <SortableTh campo="status" col={col} dir={dir} onSort={alternar}>Status</SortableTh>
              <th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-0 text-[13px] tabular-nums text-slate-700">{fmt(c.iniciadaEm)}</td>
                  <td className="px-3 py-0">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${c.tipo === 'INICIAL' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{c.tipo === 'INICIAL' ? 'inicial' : 'rotina'}</span>
                  </td>
                  <td className="px-3 py-0 text-[13px] text-slate-500">{c.criadoPorNome ?? '—'}</td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">{c.itensContados}</td>
                  <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${c.itensComDivergencia > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{c.itensComDivergencia || '—'}</td>
                  <td className={`whitespace-nowrap px-3 py-0 text-right text-[13px] font-medium tabular-nums ${Math.abs(c.valorDivergencia) < 0.005 ? 'text-slate-300' : c.valorDivergencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {Math.abs(c.valorDivergencia) < 0.005 ? '—' : brl(c.valorDivergencia)}
                  </td>
                  <td className="px-3 py-0"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[c.status] ?? 'bg-slate-100 text-slate-500'}`}>{c.status.toLowerCase()}</span></td>
                  <td className="px-3 py-0 text-right">
                    {c.status === 'ABERTA' && <a href={`/empresas/${id}/estoque/contagem`} className="text-xs font-medium text-[#185FA5] hover:underline">continuar</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile: cards */}
          <div className="divide-y divide-slate-50 sm:hidden">
            {lista.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-slate-800">{fmt(c.iniciadaEm)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{c.criadoPorNome ?? 'sem registro'} · {c.itensContados} itens</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIP[c.status] ?? 'bg-slate-100'}`}>{c.status.toLowerCase()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${c.tipo === 'INICIAL' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{c.tipo === 'INICIAL' ? 'inicial' : 'rotina'}</span>
                  {Math.abs(c.valorDivergencia) >= 0.005 && <span className={`text-sm font-semibold tabular-nums ${c.valorDivergencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{brl(c.valorDivergencia)}</span>}
                </div>
                {c.status === 'ABERTA' && <a href={`/empresas/${id}/estoque/contagem`} className="mt-3 flex h-11 items-center justify-center rounded-lg bg-[#185FA5] text-sm font-semibold text-white">Continuar contagem</a>}
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {cs.length > 0 && (
        <TotalsBar
          itens={[
            { chave: 'falta', label: 'Faltou', tone: 'rose', n: cs.filter((c) => c.valorDivergencia < 0).length, valor: cs.filter((c) => c.valorDivergencia < 0).reduce((s2, c) => s2 + c.valorDivergencia, 0) },
            { chave: 'sobra', label: 'Sobrou', tone: 'emerald', n: cs.filter((c) => c.valorDivergencia > 0).length, valor: cs.filter((c) => c.valorDivergencia > 0).reduce((s2, c) => s2 + c.valorDivergencia, 0) },
          ]}
          total={ajusteTotal}
          totalLabel="Ajuste líquido"
        />
      )}
    </div>
  )
}
