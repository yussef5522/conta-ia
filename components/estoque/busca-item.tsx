'use client'

// ⭐⭐ BUSCA DE ITEM DO CATÁLOGO — UM componente, SETE usos (31/08/2026 · revisto 23/10).
//
// ⚠️ ELE JÁ EXISTIA, mas PRIVADO dentro do `ficha-editor.tsx`. Quando a tela de digitar
// itens do DANFE precisou da mesma coisa, o caminho fácil era copiar — e cópia de
// componente de BUSCA é exatamente onde as telas começam a discordar: uma passa a filtrar
// por escopo, a outra não; uma deixa criar item, a outra não. Este módulo já pagou isso 5×
// (o motor de transferência com 7 detectores, o `faturaNetTotal` com 6 somas). Extraído.
//
// ⚠️ O FILTRO É NO SERVIDOR, e isso é decisão consciente (27/08): com `take: 50`, filtrar
// no cliente perderia itens bons sempre que material de limpeza ocupasse as vagas.
// ⭐ E lá ele usa a `casaBusca` da casa (`filtrarPorBusca`, com a cicatriz de 08/09 escrita
// na própria rota: `contains` é case-SENSITIVE no Postgres e case-INSENSITIVE no SQLite,
// então "xis" achava 0 em prod e 1 em dev). Nada a fazer aqui — só **dizer** o vazio.
//
// ⛔⛔ **AS DUAS PROPS NOVAS SÃO OPT-IN DE PROPÓSITO (23/10).** `semDinheiro` e `emSerie`
// nascem `false` porque **o comportamento atual é o CERTO nos outros seis chamadores**: no
// editor de ficha o dono está montando receita e **precisa** ver o custo médio pra decidir, e
// ali fechar ao escolher é o fluxo (escolheu o ingrediente → vai pra quantidade). Tirar o
// dinheiro ou segurar o painel pra todos seria consertar uma tela quebrando seis.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, Check } from 'lucide-react'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'
import { posicaoFlutuante } from '@/lib/ui/posicao-flutuante'
import { urlDaBuscaDeItens } from '@/lib/stock/buscar-itens'
import type { UniversoDoSeletor } from '@/lib/stock/universo-do-seletor'

export interface ItemBusca {
  id: string
  nome: string
  unidadeControle: string
  custoMedio: number | null
  categoria: string
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐ a caixa acompanha o campo e nunca fica mais estreita que isto — foi a caixa estreita que
 * quebrou o nome do item em duas linhas no print de 23/10.
 */
const LARGURA_MINIMA = 420
/** ⚠️ altura de uma linha de resultado (py-2 + text-sm). Oito delas é o teto da lista. */
const ALTURA_DA_LINHA = 38
const RESULTADOS_VISIVEIS = 8

export function BuscaItem({
  companyId, jaAdicionados = [], onEscolher,
  placeholder = 'buscar no catálogo…',
  universo,
  compacto,
  semDinheiro,
  emSerie,
}: {
  companyId: string
  /** ids já usados — aparecem esmaecidos, com selo, e não repetem */
  jaAdicionados?: string[]
  onEscolher: (it: ItemBusca) => void
  placeholder?: string
  /**
   * ⛔⛔ O UNIVERSO DO GESTO — **obrigatório** (16/09). Sem default: a ausência dele foi
   * o que pôs ficha de cardápio no seletor da compra, e um default aqui recriaria o
   * problema com outro nome. Ver `lib/stock/universo-do-seletor.ts`.
   */
  universo: UniversoDoSeletor
  /** versão de uma linha só, pra caber dentro de uma célula de tabela */
  compacto?: boolean
  /**
   * ⛔ **RT1 — o dinheiro NÃO aparece nesta tela.** Quem liga é a tela que tem a lei (o Real ×
   * Teórico olha QUANTIDADE); nos outros o custo médio é a informação que faz o gesto
   * funcionar, então o default é mostrar.
   */
  semDinheiro?: boolean
  /**
   * ⭐ adição em SÉRIE: escolher **não fecha** o painel e o campo continua focado, pro dono
   * montar o grupo inteiro sem reabrir o seletor a cada item. O item que entrou aparece com
   * **✓ adicionado** na própria lista (via `jaAdicionados`, que vem do servidor depois do
   * recarregamento) — o feedback nasce onde o dedo clicou.
   */
  emSerie?: boolean
}) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ItemBusca[]>([])
  const [aberto, setAberto] = useState(false)
  const [criando, setCriando] = useState(false)
  const [tudo, setTudo] = useState(universo === 'CATALOGO')
  const [novaUnidade, setNovaUnidade] = useState<'KG' | 'UN' | 'LT' | 'CX'>('UN')
  const [pos, setPos] = useState<ReturnType<typeof posicaoFlutuante> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  // ⭐ clique fora + ESC fecham a lista (28/08). Antes só dava pra sair ESCOLHENDO — quem
  // desistia ficava com o dropdown pendurado, e no celular era pior.
  // ⛔⛔ O 2º ref é o PAINEL: no portal ele não é descendente daqui, então sem ele o clique
  //    num resultado contaria como "fora" e o `mousedown` fecharia o painel ANTES do `click`
  //    registrar — o item nunca seria adicionado.
  const caixa = useDismissivel<HTMLDivElement>(aberto, () => setAberto(false), painelRef)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      /**
       * ⭐ O TOGGLE "mostrar tudo" **É uma declaração de universo** (16/09): o dono está
       * dizendo, com o dedo, que quer o CATÁLOGO inteiro naquele momento. O que deixou de
       * existir é o universo **indeclarado** — aquele que ninguém escolheu.
       */
      fetch(urlDaBuscaDeItens({ empresaId: companyId, universo: tudo ? 'CATALOGO' : universo, busca: q }))
        .then((r) => r.json()).then((j) => setRes(j.itens ?? [])).catch(() => setRes([]))
    }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, companyId, tudo])

  /**
   * ⚠️ A posição é MEDIDA do campo e recalculada em scroll/resize — número fixo dentro de
   * tela que rola é o painel pousando longe do campo. Ver `lib/ui/posicao-flutuante.ts`.
   */
  useEffect(() => {
    if (!aberto) { setPos(null); return }
    const medir = () => {
      const r = campoRef.current?.getBoundingClientRect()
      if (!r) return
      setPos(posicaoFlutuante(r, { largura: window.innerWidth, altura: window.innerHeight }, { minima: LARGURA_MINIMA }))
    }
    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [aberto])

  const termo = q.trim()
  const existeExato = res.some((it) => it.nome.toLowerCase() === termo.toLowerCase())

  const escolher = (it: ItemBusca) => {
    onEscolher(it)
    if (emSerie) {
      // ⭐ segura o painel e devolve o foco: o dono apaga o termo e digita o próximo. O item
      //    que acabou de entrar continua visível na lista, agora com **✓ adicionado**.
      campoRef.current?.focus()
      return
    }
    setQ('')
    setAberto(false)
  }

  const criarItem = async () => {
    if (!termo || criando) return
    setCriando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: termo, unidadeControle: novaUnidade }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.item) { onEscolher(j.item); setQ(''); if (!emSerie) setAberto(false) }
    } finally { setCriando(false) }
  }

  return (
    <div className="relative" ref={caixa}>
      <div className="relative">
        <Search className={`absolute ${compacto ? 'left-2 top-2 h-3.5 w-3.5' : 'left-3 top-2.5 h-4 w-4'} text-slate-400`} />
        <input ref={campoRef} value={q} onFocus={() => setAberto(true)} onChange={(e) => { setQ(e.target.value); setAberto(true) }}
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

      {/*
        ⛔⛔ **PORTAL, E O MOTIVO É UM DEFEITO MEDIDO (23/10):** o card do grupo do Real ×
        Teórico é `overflow-hidden` (ele precisa disso pro `rounded-[16px]` cortar os cantos
        dos filhos), e o painel era `absolute` DENTRO dele → **recortado pela borda do card**,
        com UM resultado à vista. ⛔ `z-index` não resolve recorte por `overflow` — isso é
        regra de CSS, não preferência; e mexer no overflow do card mataria o arredondamento.
        É a MESMA cicatriz do menu do cartão ≍ (18/09), e a cura é a mesma: sair do ancestral.
      */}
      {aberto && pos && (res.length > 0 || termo) && typeof document !== 'undefined' && createPortal(
        <div
          ref={painelRef}
          role="listbox"
          className="fixed z-[60] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          style={{
            left: pos.left,
            ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
            width: pos.largura,
            maxHeight: pos.maxAltura,
          }}
        >
          {/* ⭐ a LISTA rola; o criar/vazio fica fixo embaixo — senão o gesto de criar sai da
              vista justo quando a busca não achou nada. */}
          <div className="overflow-y-auto" style={{ maxHeight: Math.min(pos.maxAltura - 8, ALTURA_DA_LINHA * RESULTADOS_VISIVEIS) }}>
            {res.map((it) => {
              const dentro = jaAdicionados.includes(it.id)
              return (
                <button key={it.id} type="button" disabled={dentro}
                  onClick={() => escolher(it)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50">
                  {/* ⭐ UMA LINHA: `min-w-0` + `truncate` é o par que faz o nome encurtar com
                      reticências em vez de quebrar — sem o `min-w-0` o flex item se recusa a
                      encolher abaixo do conteúdo e a quebra volta. */}
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={it.nome}>
                    {it.nome}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                    {(it.categoria === 'INTERMEDIARIO' || it.categoria === 'PRODUTO_FINAL') && <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">produzido</span>}
                    {it.categoria === 'REVENDA' && <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">revenda</span>}
                    {/* ⛔ RT1: com `semDinheiro` o custo não entra nem como texto — a lei é que
                        dinheiro não aparece na tela, não que ele apareça menor. */}
                    {!semDinheiro && (it.custoMedio != null ? `${brl(it.custoMedio)}/${it.unidadeControle}` : 'sem custo')}
                    <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">{it.unidadeControle}</span>
                    {/* ⭐ o item que já está no grupo DIZ por quê — antes ele só ficava
                        esmaecido, e "apagado sem motivo" se lê como defeito. */}
                    {dentro
                      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> adicionado</span>
                      : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ⛔ VAZIO HONESTO: "nada encontrado" com o TERMO. Painel que só mostra o botão de
              criar faz o dono achar que a busca nem rodou. */}
          {res.length === 0 && termo && (
            <p className="px-3 py-2 text-[12px] text-slate-500">
              nada encontrado com “{termo}”.
            </p>
          )}

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
        </div>,
        document.body,
      )}
    </div>
  )
}
