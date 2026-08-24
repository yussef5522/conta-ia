'use client'

// ESTOQUE FASE 3 — REAL vs TEÓRICO: o relatório que paga o módulo.
// "Teórico" = o que os movimentos explicam (entrou − vendeu − perdeu − consumiu).
// "Real" = o que a CONTAGEM achou. A diferença é dinheiro saindo sem registro.
//
// Honestidade da tela: item sem contagem no período aparece CINZA "sem contagem" e NÃO
// entra na variância — zero afirmaria que bateu. O relatório diz o que NÃO sabe.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Scale, Loader2, Download, AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react'

interface Linha {
  itemId: string; nome: string; categoria: string; unidadeControle: string; custoMedio: number | null
  saldoInicial: number; entradas: number; producaoGerada: number; vendas: number; perdas: number
  consumoProducao: number; estornos: number; saldoTeorico: number; saldoFinal: number
  variancia: number | null; varianciaValor: number | null; varianciaPct: number | null
  contagensNoPeriodo: number; ultimaContagemEm: string | null
}
interface Resumo {
  de: string; ate: string; avisos: string[]
  itens: number; itensContados: number; itensSemContagem: number
  varianciaNegativaValor: number; varianciaPositivaValor: number; varianciaLiquidaValor: number
  consumoValor: number; varianciaPctGeral: number | null
}
interface Relatorio { resumo: Resumo; linhas: Linha[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`)
const PISO = '2026-08-12'
const hoje = () => new Date().toISOString().slice(0, 10)

export default function RealVsTeoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [de, setDe] = useState(PISO)
  const [ate, setAte] = useState(hoje())
  const [r, setR] = useState<Relatorio | null | undefined>(undefined)
  const [soVariancia, setSoVariancia] = useState(false)

  useEffect(() => {
    setR(undefined)
    fetch(`/api/empresas/${id}/estoque/real-vs-teorico?de=${de}&ate=${ate}`)
      .then((x) => x.json()).then((j) => setR(j.relatorio ?? null)).catch(() => setR(null))
  }, [id, de, ate])

  // ranking pelo DINHEIRO: onde está vazando primeiro
  const linhas = useMemo(() => {
    if (!r) return []
    const ls = soVariancia ? r.linhas.filter((l) => l.variancia != null && Math.abs(l.variancia) > 0.0001) : r.linhas
    return [...ls].sort((a, b) => {
      const va = a.varianciaValor == null ? -1 : Math.abs(a.varianciaValor)
      const vb = b.varianciaValor == null ? -1 : Math.abs(b.varianciaValor)
      return vb - va
    })
  }, [r, soVariancia])

  if (r === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!r) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o Real vs Teórico.</div>

  const nComVar = r.linhas.filter((l) => l.variancia != null && Math.abs(l.variancia) > 0.0001).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Scale className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Real vs Teórico</h1>
        <p className="hidden min-w-[18rem] flex-1 truncate text-xs text-slate-400 lg:block">O que os movimentos explicam × o que a contagem achou — a diferença é dinheiro saindo sem registro</p>
        <div className="flex items-center gap-1.5">
          <input type="date" value={de} min={PISO} onChange={(e) => setDe(e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-xs" />
          <span className="text-xs text-slate-400">a</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-xs" />
          <a href={`/api/empresas/${id}/estoque/real-vs-teorico?de=${de}&ate=${ate}&formato=csv`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> CSV</a>
        </div>
      </div>

      {/* avisos honestos: o que o número NÃO cobre */}
      {r.resumo.avisos.map((a, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <p className="text-xs text-sky-800">{a}</p>
        </div>
      ))}

      {/* resumo */}
      <div className="-mx-1 flex items-stretch gap-2 overflow-x-auto px-1 pb-1">
        <Bloco titulo="Falta (não explicado)" valor={brl(r.resumo.varianciaNegativaValor)} cor="text-rose-600" icone={<TrendingDown className="h-3.5 w-3.5" />} />
        <Bloco titulo="Sobra" valor={brl(r.resumo.varianciaPositivaValor)} cor="text-emerald-600" icone={<TrendingUp className="h-3.5 w-3.5" />} />
        <Bloco titulo="Líquido" valor={brl(r.resumo.varianciaLiquidaValor)} cor={r.resumo.varianciaLiquidaValor < 0 ? 'text-rose-600' : 'text-slate-900'} />
        <Bloco titulo="% do consumo" valor={pct(r.resumo.varianciaPctGeral)} cor="text-slate-900" />
        <Bloco titulo="Contados" valor={`${r.resumo.itensContados}/${r.resumo.itens}`} cor="text-slate-900" />
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={() => setSoVariancia((v) => !v)} className={`h-9 rounded-lg border px-2.5 text-xs ${soVariancia ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-600'}`}>
          Só com variância{nComVar > 0 ? ` (${nComVar})` : ''}
        </button>
        <span className="ml-auto text-xs text-slate-400">consumo do período {brl(r.resumo.consumoValor)}</span>
      </div>

      {linhas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-slate-500">
          {r.resumo.itensContados === 0
            ? 'Sem contagem no período não há "real" pra comparar. Faça a contagem inicial — ela é o marco zero deste relatório.'
            : 'Nenhum item com esse filtro.'}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="density-normal hidden w-full sm:table">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Entrou</th>
              <th className="px-3 py-2 text-right font-medium">Vendeu</th>
              <th className="px-3 py-2 text-right font-medium">Perdeu</th>
              <th className="px-3 py-2 text-right font-medium">Produção</th>
              <th className="px-3 py-2 text-right font-medium">Teórico</th>
              <th className="px-3 py-2 text-right font-medium">Real</th>
              <th className="px-3 py-2 text-right font-medium">Variância</th>
              <th className="px-3 py-2 text-right font-medium">R$</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
            </tr></thead>
            <tbody>
              {linhas.map((l) => {
                const semContagem = l.variancia == null
                const falta = (l.variancia ?? 0) < -0.0001
                const sobra = (l.variancia ?? 0) > 0.0001
                return (
                  <tr key={l.itemId} className={`border-b border-slate-50 last:border-b-0 ${falta ? 'bg-rose-50/40' : sobra ? 'bg-sky-50/30' : ''}`}>
                    <td className="px-3 py-1 text-[13px] font-medium text-slate-800">{l.nome}<span className="ml-1 text-[11px] font-normal text-slate-400">{l.unidadeControle}</span></td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{l.entradas + l.producaoGerada > 0 ? num(l.entradas + l.producaoGerada) : '—'}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{l.vendas > 0 ? num(l.vendas) : '—'}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{l.perdas > 0 ? num(l.perdas) : '—'}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{l.consumoProducao > 0 ? num(l.consumoProducao) : '—'}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-700">{num(l.saldoTeorico)}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums">
                      {semContagem ? <span className="text-xs text-slate-300">sem contagem</span> : <b className="text-slate-900">{num(l.saldoFinal)}</b>}
                    </td>
                    <td className={`px-3 py-1 text-right text-[13px] font-semibold tabular-nums ${falta ? 'text-rose-600' : sobra ? 'text-sky-600' : 'text-slate-300'}`}>
                      {semContagem ? '—' : Math.abs(l.variancia!) < 0.0001 ? 'bate' : `${l.variancia! > 0 ? '+' : ''}${num(l.variancia!)}`}
                    </td>
                    <td className={`px-3 py-1 text-right text-[13px] font-semibold tabular-nums ${falta ? 'text-rose-600' : sobra ? 'text-sky-600' : 'text-slate-300'}`}>
                      {semContagem || Math.abs(l.varianciaValor ?? 0) < 0.005 ? '—' : brl(l.varianciaValor!)}
                    </td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{pct(l.varianciaPct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* mobile: cards */}
          <div className="divide-y divide-slate-50 sm:hidden">
            {linhas.map((l) => {
              const semContagem = l.variancia == null
              const falta = (l.variancia ?? 0) < -0.0001
              return (
                <div key={l.itemId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{l.nome}</p>
                    {semContagem
                      ? <span className="shrink-0 text-xs text-slate-300">sem contagem</span>
                      : <span className={`shrink-0 text-sm font-semibold tabular-nums ${falta ? 'text-rose-600' : 'text-sky-600'}`}>{Math.abs(l.variancia!) < 0.0001 ? 'bate' : brl(l.varianciaValor!)}</span>}
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-slate-500">
                    teórico {num(l.saldoTeorico)} · real {semContagem ? '—' : num(l.saldoFinal)} {l.unidadeControle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    entrou {num(l.entradas + l.producaoGerada)} · vendeu {num(l.vendas)} · perdeu {num(l.perdas)} · produção {num(l.consumoProducao)}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent></Card>
      )}

      {/* leitura do sinal — o dono não decora o que + e − querem dizer */}
      {nComVar > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 font-medium text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> falta</span>
          <span>perda não registrada, porção maior que a ficha, ou saída sem lançamento</span>
          <span className="inline-flex items-center gap-1 font-medium text-sky-600">sobra</span>
          <span>venda lançada que não saiu, porção menor que a ficha, ou entrada a mais do que a nota dizia</span>
        </div>
      )}
    </div>
  )
}

function Bloco({ titulo, valor, cor, icone }: { titulo: string; valor: string; cor: string; icone?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-0.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{icone}{titulo}</span>
      <span className={`text-[15px] font-bold tabular-nums leading-none ${cor}`}>{valor}</span>
    </div>
  )
}
