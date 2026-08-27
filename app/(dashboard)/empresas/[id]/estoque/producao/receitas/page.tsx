'use client'

// ESTOQUE — RECEITAS DE PRODUÇÃO (27/08). A CASA DA COZINHA: só INTERMEDIÁRIOS.
//
// Padrão dos líderes: sub-recipe/prep vive SEPARADA do menu item. São perguntas de pessoas
// diferentes — o dono quer margem do xis, a cozinha quer o rendimento do beef. A lista mista
// de fichas atendia mal os dois; foi tirada da sidebar.
//
// Produto FINAL não aparece aqui: ele se edita dentro do próprio produto, no cardápio.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ChefHat, Loader2, Plus, Factory, ChevronRight, ArrowLeft } from 'lucide-react'

interface Ficha {
  id: string; nomeProduzido: string; unidadeProduzido: string; tipoProduto: string
  versaoAtual: number; ativo: boolean; custoLote: number | null; custoADefinir: boolean
  componentes: { itemId: string; nome: string }[]; validadeDias: number | null; loteBase: number
  unidadeLoteBase: string
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))

export default function ReceitasProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fichas, setFichas] = useState<Ficha[] | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json())
      .then((j) => setFichas((j.fichas ?? []).filter((f: Ficha) => f.tipoProduto === 'INTERMEDIARIO')))
      .catch(() => setFichas(null))
  }, [id])

  const produzir = async (fichaId: string) => {
    setBusy(true)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichaId, escalaReceitas: 1, dataProducao: hoje }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
    } finally { setBusy(false) }
  }

  if (fichas === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (fichas === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar as receitas.</div>

  return (
    <div className="space-y-3">
      <a href={`/empresas/${id}/estoque/producao`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Produção</a>

      <div className="flex flex-wrap items-center gap-2.5">
        <ChefHat className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Receitas de produção</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">O que a cozinha produz em lote (gessado, beef, porções) — rendimento medido a cada produção</p>
        <a href={`/empresas/${id}/estoque/producao/receitas/nova`}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
          <Plus className="h-3.5 w-3.5" /> Nova receita
        </a>
      </div>

      {fichas.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ChefHat className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma receita de produção ainda.</p>
          <p className="max-w-md text-xs text-slate-500">
            Receita de produção é o que se faz em LOTE e vira estoque (gessado, beef, porção de carne).
            O produto que você VENDE se monta no <a href={`/empresas/${id}/estoque/cardapio`} className="text-[#185FA5] underline">Cardápio</a>.
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {fichas.map((f) => (
            <Card key={f.id}><CardContent className="flex flex-wrap items-center gap-3 p-3">
              <a href={`/empresas/${id}/estoque/producao/receitas/${f.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{f.nomeProduzido}</p>
                <p className="text-[11px] text-slate-400">
                  lote de {f.loteBase} {f.unidadeLoteBase} · {f.componentes.length} componente(s) · v{f.versaoAtual}
                  {f.validadeDias != null && ` · validade ${f.validadeDias}d`}
                </p>
              </a>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Custo do lote</p>
                {f.custoADefinir
                  ? <p className="text-sm font-medium text-amber-600">a definir</p>
                  : <p className="text-sm font-semibold tabular-nums text-slate-800">{brl(f.custoLote)}</p>}
              </div>
              <button onClick={() => produzir(f.id)} disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <Factory className="h-3.5 w-3.5" /> produzir
              </button>
              <a href={`/empresas/${id}/estoque/producao/receitas/${f.id}`} className="text-slate-300 hover:text-slate-500"><ChevronRight className="h-4 w-4" /></a>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}
