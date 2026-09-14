'use client'

// ⭐⭐⭐ O SELETOR DE DESTINO — UM SÓ, PROS DOIS RELATÓRIOS (14/09/2026).
//
// **O dono, preso na revisão de complementos:** *"o 'definir ficha' me EXPULSA da tela.
// A referência é a NOSSA tela de PRODUTOS, que está certa: clico no destino → seletor abre
// ALI (lista das fichas do cardápio com busca) → escolho → sigo na mesma tela."*
//
// ⛔ **A EXPULSÃO ERA LITERAL:** o "definir" da revisão era um `<a href>` pro cardápio.
// O dono perdia o dia, a lista e o fio — e ele ia repetir esse gesto ~80 vezes num dia de
// import. É a mesma família da "porta sem maçaneta", do avesso: o gesto existe, mas o
// caminho de volta não.
//
// ⭐ **FONTE ÚNICA (o pedido literal):** este componente serve a tela de Vendas E a revisão,
// nos dois relatórios. Dois seletores divergiriam no primeiro destino novo — e aí o dono
// veria opções diferentes pra mesma pergunta em duas telas do mesmo módulo.
//
// ⚠️ TRÊS CAMINHOS, e o terceiro é o único que sai da tela **com volta**:
//   1. ficha que já existe  → 2 toques, sem sair
//   2. ficha SIMPLES (item do estoque ×1) → 2 toques, sem sair — é o caso `FRUKI LATA` comum
//   3. receita COMPOSTA (combo lata+fritas) → editor completo, porque receita de verdade
//      precisa do editor — **mas com `?voltar=`**. Ida com volta não é expulsão.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, Link2, Plus, ChefHat } from 'lucide-react'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'
import { filtrarPorBusca } from '@/lib/busca-texto'

export interface OpcaoDeDestinoDTO {
  tipo: 'FICHA' | 'REVENDA'
  id: string
  nome: string
  detalhe: string | null
}

export type EscolhaDeDestino =
  | { tipo: 'FICHA'; fichaId: string }
  | { tipo: 'REVENDA'; itemId: string }

export function SeletorDeDestino({
  empresaId, relatorio, nomePdv, jaTemDestino, hrefEditor, onEscolher, ocupado,
}: {
  empresaId: string
  relatorio: 'PRODUTOS' | 'COMPLEMENTOS'
  /** o nome do PDV — vai carregado pro editor e é o nome da ficha simples */
  nomePdv: string
  jaTemDestino: boolean
  /** ida-com-volta: o editor completo, já com `?voltar=` montado por quem chama */
  hrefEditor: string
  onEscolher: (e: EscolhaDeDestino) => void | Promise<void>
  ocupado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [opcoes, setOpcoes] = useState<{ fichas: OpcaoDeDestinoDTO[]; itens: OpcaoDeDestinoDTO[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [modoItem, setModoItem] = useState(false)
  const [criando, setCriando] = useState(false)
  const ref = useDismissivel<HTMLDivElement>(aberto, () => setAberto(false))
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto || opcoes) return
    let vivo = true
    void (async () => {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/vendas/destinos?relatorio=${relatorio}`)
      const j = await r.json().catch(() => null)
      if (!vivo) return
      // ⛔ ERRO NUNCA VIRA LISTA VAZIA: "nenhuma ficha" é uma afirmação, e quando a carga
      // falha o sistema NÃO SABE (a lição da tela da equipe, 09/09).
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui carregar os destinos.'); return }
      setOpcoes({ fichas: j.destinos.fichas, itens: j.destinos.itens })
    })()
    return () => { vivo = false }
  }, [aberto, opcoes, empresaId, relatorio])

  useEffect(() => { if (aberto) campo.current?.focus() }, [aberto])

  const lista = useMemo(() => {
    if (!opcoes) return []
    // ⚠️ a busca é a da casa (`filtrarPorBusca`): casa por palavra em qualquer ordem, sem
    // caixa e sem acento — o nome vem da NOTA e o dono digita do jeito dele (08/09).
    return filtrarPorBusca(modoItem ? opcoes.itens : opcoes.fichas, busca, (o) => o.nome)
  }, [opcoes, busca, modoItem])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={ocupado}
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        title={jaTemDestino ? 'trocar o destino' : 'definir o destino'}
      >
        {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
        {jaTemDestino ? 'trocar' : 'definir'}
      </button>

      {aberto && (
        <div className="absolute right-0 z-30 mt-1 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-300 bg-white p-2 shadow-xl">
          <p className="px-1 pb-1.5 text-[11px] text-slate-500">
            pra onde <b className="text-slate-700">{nomePdv}</b> baixa?
          </p>

          {/* ⭐ as duas abas do seletor: receita pronta × item do estoque (ficha simples) */}
          <div className="mb-1.5 flex gap-1">
            {([[false, 'receitas'], [true, 'item do estoque']] as const).map(([v, r]) => (
              <button
                key={r} type="button" onClick={() => { setModoItem(v); setBusca('') }}
                className={`h-7 flex-1 rounded-lg border px-2 text-[11px] font-medium ${modoItem === v ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={campo} value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder={modoItem ? 'buscar item do estoque…' : 'buscar receita…'}
              className="h-8 w-full rounded-lg border border-slate-300 pl-7 pr-2 text-xs"
            />
          </div>

          {erro && <p className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{erro}</p>}

          {/* ⚠️ o mini-form da ficha simples é UMA LINHA: o nome já vem do PDV, só falta o
              item. Pedir o nome de novo seria pedir o que a tela já sabe. */}
          {modoItem && (
            <>
              <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                cria a receita <b>{nomePdv}</b> baixando <b>1 unidade</b> do item que você escolher.
              </p>
              {/* ⚠️⚠️ ESTE GESTO JÁ EXISTIA no `<select>` da tela de produtos ("+ criar item
                  de revenda") e veio junto de propósito: unificar o seletor **não pode
                  tirar capacidade** de quem já tinha. É o caso da bebida que nunca veio por
                  nota (09/09) — o item nasce com saldo ZERO e entra na fila de contagem,
                  porque saldo não se chuta. */}
              <button
                type="button" disabled={criando}
                onClick={async () => {
                  setCriando(true); setErro(null)
                  try {
                    const r = await fetch(`/api/empresas/${empresaId}/estoque/itens`, {
                      method: 'POST', headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ nome: nomePdv, unidadeControle: 'UN', categoria: 'REVENDA' }),
                    })
                    const j = await r.json().catch(() => null)
                    if (!r.ok || !j?.item?.id) { setErro(j?.erro ?? 'Não consegui criar o item.'); return }
                    setAberto(false)
                    await onEscolher({ tipo: 'REVENDA', itemId: j.item.id })
                  } finally { setCriando(false) }
                }}
                className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
              >
                {criando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                não existe: criar “{nomePdv}” no estoque
              </button>
            </>
          )}

          <div className="mt-1.5 max-h-56 overflow-auto">
            {!opcoes && !erro && (
              <p className="flex items-center gap-1.5 px-1 py-3 text-[11px] text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> carregando…</p>
            )}
            {opcoes && lista.length === 0 && (
              <p className="px-1 py-3 text-[11px] text-slate-500">
                {busca.trim() ? `Nada com “${busca}”.` : modoItem ? 'Nenhum item de revenda no estoque.' : 'Nenhuma receita ainda.'}
              </p>
            )}
            {lista.map((o) => (
              <button
                key={`${o.tipo}:${o.id}`} type="button"
                onClick={() => { setAberto(false); void onEscolher(o.tipo === 'FICHA' ? { tipo: 'FICHA', fichaId: o.id } : { tipo: 'REVENDA', itemId: o.id }) }}
                className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-violet-50"
              >
                <span className="block text-[12px] font-medium text-slate-800">{o.nome}</span>
                {o.detalhe && <span className="block text-[11px] text-slate-500">{o.detalhe}</span>}
              </button>
            ))}
          </div>

          {/* ⭐⭐ IDA COM VOLTA — o único caminho que sai da tela, e ele volta pro MESMO dia
              com a linha já vinculada. Receita de verdade (lata + porção de fritas) precisa
              do editor; o que não pode é ir e não voltar. */}
          <a
            href={hrefEditor}
            className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChefHat className="h-3.5 w-3.5 text-slate-500" />
            é um combo? montar a receita
            <Plus className="ml-auto h-3 w-3 text-slate-400" />
          </a>
        </div>
      )}
    </div>
  )
}
