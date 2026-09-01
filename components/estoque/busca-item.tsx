'use client'

// ⭐⭐ BUSCA DE ITEM DO CATÁLOGO — UM componente, dois usos (31/08/2026).
//
// ⚠️ ELE JÁ EXISTIA, mas PRIVADO dentro do `ficha-editor.tsx`. Quando a tela de digitar
// itens do DANFE precisou da mesma coisa, o caminho fácil era copiar — e cópia de
// componente de BUSCA é exatamente onde as telas começam a discordar: uma passa a filtrar
// por escopo, a outra não; uma deixa criar item, a outra não. Este módulo já pagou isso 5×
// (o motor de transferência com 7 detectores, o `faturaNetTotal` com 6 somas). Extraído.
//
// ⚠️ O FILTRO É NO SERVIDOR, e isso é decisão consciente (27/08): com `take: 50`, filtrar
// no cliente perderia itens bons sempre que material de limpeza ocupasse as vagas.

import { useEffect, useRef, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'

export interface ItemBusca {
  id: string
  nome: string
  unidadeControle: string
  custoMedio: number | null
  categoria: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function BuscaItem({
  companyId, jaAdicionados = [], onEscolher,
  placeholder = 'buscar no catálogo…',
  escopoInicial = 'receita',
  compacto,
}: {
  companyId: string
  /** ids já usados — aparecem esmaecidos e não repetem */
  jaAdicionados?: string[]
  onEscolher: (it: ItemBusca) => void
  placeholder?: string
  /** 'receita' = matéria-prima + produzidos + revenda · '' = catálogo inteiro */
  escopoInicial?: 'receita' | ''
  /** versão de uma linha só, pra caber dentro de uma célula de tabela */
  compacto?: boolean
}) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ItemBusca[]>([])
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [tudo, setTudo] = useState(escopoInicial === '')
  const [novaUnidade, setNovaUnidade] = useState<'KG' | 'UN' | 'LT' | 'CX'>('UN')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ⭐ clique fora + ESC fecham a lista (28/08). Antes só dava pra sair ESCOLHENDO — quem
  // desistia ficava com o dropdown pendurado, e no celular era pior.
  const caixa = useDismissivel<HTMLDivElement>(aberto, () => setAberto(false))

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const escopo = tudo ? '' : '&escopo=receita'
      fetch(`/api/empresas/${companyId}/estoque/itens?busca=${encodeURIComponent(q)}${escopo}`)
        .then((r) => r.json()).then((j) => setRes(j.itens ?? [])).catch(() => setRes([]))
    }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, companyId, tudo])

  const termo = q.trim()
  const existeExato = res.some((it) => it.nome.toLowerCase() === termo.toLowerCase())

  const criarItem = async () => {
    if (!termo || criando) return
    setCriando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: termo, unidadeControle: novaUnidade }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.item) { onEscolher(j.item); setQ(''); setAberto(false) }
    } finally { setCriando(false) }
  }

  return (
    <div className="relative" ref={caixa}>
      <div className="relative">
        <Search className={`absolute ${compacto ? 'left-2 top-2 h-3.5 w-3.5' : 'left-3 top-2.5 h-4 w-4'} text-slate-400`} />
        <input value={q} onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true) }}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-slate-300 ${compacto ? 'h-8 pl-7 pr-2 text-[13px]' : 'h-9 pl-9 pr-24 text-sm'}`} />
        {!compacto && (
          <button type="button" onClick={() => setTudo((v) => !v)}
            className={`absolute right-2 top-1.5 rounded px-1.5 py-1 text-[10px] ${tudo ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
            title={tudo ? 'mostrando o catálogo inteiro' : 'mostrando só ingredientes'}>
            {tudo ? 'tudo' : 'só ingredientes'}
          </button>
        )}
      </div>
      {aberto && (res.length > 0 || termo) && (
        <div className="absolute z-20 mt-1 max-h-72 w-full min-w-[280px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {res.map((it) => {
            const dentro = jaAdicionados.includes(it.id)
            return (
              <button key={it.id} type="button" disabled={dentro}
                onClick={() => { onEscolher(it); setQ(''); setAberto(false) }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
                <span className="text-slate-700">
                  {it.nome}
                  {(it.categoria === 'INTERMEDIARIO' || it.categoria === 'PRODUTO_FINAL') && <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">produzido</span>}
                  {it.categoria === 'REVENDA' && <span className="ml-1.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">revenda</span>}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {it.custoMedio != null ? `${brl(it.custoMedio)}/${it.unidadeControle}` : 'sem custo'}
                  <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{it.unidadeControle}</span>
                  {!dentro && <Plus className="h-3.5 w-3.5" />}
                </span>
              </button>
            )
          })}
          {/* ⭐ CRIAR SEM SAIR DA TELA: o item que não existe no catálogo nasce aqui, e o
              que já foi digitado nas outras linhas não se perde (o estado é da página). */}
          {termo && !existeExato && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-emerald-50/40 px-3 py-2">
              <span className="flex-1 text-sm text-slate-700">criar <b>“{termo}”</b> <span className="text-[11px] text-slate-400">(sem custo até a 1ª nota)</span></span>
              <select value={novaUnidade} onChange={(e) => setNovaUnidade(e.target.value as 'KG' | 'UN' | 'LT' | 'CX')}
                className="rounded-md border border-slate-300 px-1.5 py-1 text-xs">
                <option>UN</option><option>KG</option><option>LT</option><option>CX</option>
              </select>
              <button type="button" onClick={criarItem} disabled={criando}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" /> criar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
