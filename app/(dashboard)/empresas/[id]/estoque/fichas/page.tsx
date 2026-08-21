'use client'

// ESTOQUE FASE 2 item 2.0 — lista de FICHAS técnicas. Item produzido, tipo, versão, custo
// teórico (ou "a definir"), rendimento ("a apurar" até a 1ª produção), margem (produto final).
// Sem ordem de produção ainda — 2.0 é o cadastro. Link pra nova ficha e pros cadastros.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Loader2, Plus, Settings, ChevronRight } from 'lucide-react'

interface Ficha {
  id: string; nomeProduzido: string; unidadeProduzido: string; tipoProduto: string; versaoAtual: number
  custoLote: number | null; custoPorUnidade: number | null; custoADefinir: boolean; rendimentoMedio: number | null
  valorVenda: number | null; margem: number | null
}
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const pct = (n: number | null) => (n == null ? null : `${Math.round(n * 100)}%`)

export default function FichasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fichas, setFichas] = useState<Ficha[] | null | undefined>(undefined)

  useEffect(() => { fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json()).then((j) => setFichas(j.fichas ?? [])).catch(() => setFichas(null)) }, [id])

  if (fichas === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (fichas === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar as fichas.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Fichas técnicas</h1><p className="text-sm text-slate-500">A receita de cada produto: componentes, lote base e custo. A produção (em breve) usa isto.</p></div>
        <a href={`/empresas/${id}/estoque/producao/cadastros`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Settings className="h-4 w-4" /> Setores e colaboradores</a>
        <a href={`/empresas/${id}/estoque/fichas/nova`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]"><Plus className="h-4 w-4" /> Nova ficha</a>
      </div>

      {fichas.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma ficha ainda.</p>
          <p className="max-w-md text-xs text-slate-500">Crie a receita de um produto (ex: carne de panela) com os insumos que já estão no estoque. Depois a produção separa, produz e etiqueta a partir dela.</p>
          <a href={`/empresas/${id}/estoque/fichas/nova`} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#185FA5] px-4 py-2 text-sm font-medium text-[#185FA5]"><Plus className="h-4 w-4" /> Criar a primeira ficha</a>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {fichas.map((f) => (
            <a key={f.id} href={`/empresas/${id}/estoque/fichas/${f.id}`} className="block">
              <Card className="transition hover:border-[#185FA5] hover:shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{f.nomeProduzido}</p>
                  <p className="text-xs text-slate-500">{f.tipoProduto === 'PRODUTO_FINAL' ? 'Produto final' : 'Intermediário'} · v{f.versaoAtual} · rende em {f.unidadeProduzido}</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[11px] text-slate-400">Custo do lote</p>
                    {f.custoADefinir ? <p className="text-sm font-semibold text-amber-600">a definir</p> : <p className="text-sm font-semibold tabular-nums text-slate-900">{brl(f.custoLote)}</p>}
                  </div>
                  {f.tipoProduto === 'PRODUTO_FINAL' && (
                    <div className="hidden sm:block">
                      <p className="text-[11px] text-slate-400">Margem</p>
                      <p className={`text-sm font-semibold tabular-nums ${f.margem == null ? 'text-slate-400' : f.margem < 0.15 ? 'text-rose-600' : 'text-emerald-600'}`}>{pct(f.margem) ?? 'a definir'}</p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </CardContent></Card>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
