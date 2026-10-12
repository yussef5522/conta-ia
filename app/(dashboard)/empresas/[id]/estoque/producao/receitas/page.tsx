'use client'

// ESTOQUE — RECEITAS DE PRODUÇÃO (27/08). A CASA DA COZINHA: só INTERMEDIÁRIOS.
//
// Padrão dos líderes: sub-recipe/prep vive SEPARADA do menu item. São perguntas de pessoas
// diferentes — o dono quer margem do xis, a cozinha quer o rendimento do beef. A lista mista
// de fichas atendia mal os dois; foi tirada da sidebar.
//
// Produto FINAL não aparece aqui: ele se edita dentro do próprio produto, no cardápio.
//
// ⭐⭐ BUSCA + PRINCIPAIS + ROUPA v4 (12/10/2026, ordem do dono): 44 receitas e ele caçando
// uma por uma na rolagem. A ESTRELA fixa as que importam em cima — marca DELE, não categoria
// automática (carnes/queijos/legumes foi DESCARTADA no chat: quem decide o que importa é ele).
//
// ⛔⛔ **A DECISÃO DO QUE DESENHAR NÃO MORA AQUI** — ela é `montarListaDeReceitas`, lib PURA.
// Sem jsdom no projeto, regra dentro de componente é regra que ninguém prova (a cicatriz do
// prefill do cardápio). A tela ECOA: filtra nada, ordena nada, conta nada.

import { useEffect, useState, useCallback, useMemo, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ChefHat, Loader2, Plus, Factory, ChevronRight, ArrowLeft, Copy, Scale, Search, X, Star } from 'lucide-react'
import { ehReceitaDeProducao } from '@/lib/stock/producao/tipo-receita'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { ExcluirReceita } from '@/components/estoque/excluir-receita'
import { LogoDaReceita } from '@/components/estoque/logo-da-receita'
import { montarListaDeReceitas, type ChipDaLista } from '@/lib/stock/producao/lista-de-receitas'
import { trechosDaBusca } from '@/lib/busca-texto'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

interface Ficha {
  id: string; nomeProduzido: string; unidadeProduzido: string; tipoProduto: string
  versaoAtual: number; ativo: boolean; custoLote: number | null; custoADefinir: boolean
  componentes: { itemId: string; nome: string }[]; validadeDias: number | null; loteBase: number
  unidadeLoteBase: string
  /** ⭐ a estrela do dono — vem do servidor, nunca derivada na tela */
  principal: boolean
}

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))

/**
 * ⭐ O NOME com o trecho que casou em destaque — e o destaque vem da porta da casa
 * (`trechosDaBusca`), que resolve acento e caixa. ⚠️ Ele é COSMÉTICO: quem decide se a linha
 * aparece é a lib; palavra que o destaque não localizar só deixa de ser pintada.
 */
function NomeComDestaque({ nome, busca }: { nome: string; busca: string }) {
  if (busca.trim() === '') return <>{nome}</>
  return (
    <>
      {trechosDaBusca(nome, busca).map((t, i) =>
        t.casa
          ? <mark key={i} className="rounded px-0.5" style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>{t.texto}</mark>
          : <span key={i}>{t.texto}</span>,
      )}
    </>
  )
}

export default function ReceitasProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [fichas, setFichas] = useState<Ficha[] | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  /** ⭐ o efeito do que aconteceu — a linha nunca sai da lista em silêncio */
  const [aviso, setAviso] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [chip, setChip] = useState<ChipDaLista>('TODAS')
  /**
   * ⭐⭐ AS RECEITAS QUE ESPERAM O RENDIMENTO DO DONO (11/10, item 4).
   *
   * ⛔⛔ **A TELA-FILA MORREU E A LISTA VIROU A FILA.** O botão *"N com o lote na unidade
   * errada"* levava a uma tela separada que listava as 37; com a auto-conversão resolvendo as
   * neutras sozinha, o que sobra é pendência de DECISÃO — e decisão de receita se resolve NA
   * FICHA, que é a linha que já está aqui. ⭐ A pendência passa a ser um chip NA LINHA, com o
   * link abrindo a ficha com o campo aceso: *a porta é a linha*.
   *
   * ⚠️ E isto **não contraria** a régua de 12/09 (*fila zerada esconde o trabalho, nunca a
   * ferramenta*): a FERRAMENTA de rever o rendimento continua existindo — ela mudou de casa
   * pro editor da ficha, onde o campo mora e onde o preview «separa hoje × separa depois»
   * mostra o efeito antes de salvar. O que morreu foi a segunda vitrine.
   *
   * ⚠️ Fail-soft: se não carregar, a lista abre sem os chips (nunca sem a lista).
   */
  const [esperam, setEsperam] = useState<Record<string, string>>({})

  const carregar = useCallback(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json())
      .then((j) => setFichas((j.fichas ?? []).filter(ehReceitaDeProducao)))
      .catch(() => setFichas(null))
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas/conversao`).then((r) => r.json())
      .then((j) => {
        const lista: { fichaId: string; porQue: string }[] = Array.isArray(j?.esperamRendimento) ? j.esperamRendimento : []
        setEsperam(Object.fromEntries(lista.map((f) => [f.fichaId, f.porQue])))
      })
      .catch(() => setEsperam({}))
  }, [id])

  /**
   * ⚠️ REGRA 9 — os hooks ficam TODOS antes de qualquer early-return. Colar o `useMemo` ao
   * lado de onde ele é consumido (depois do `if (!fichas) return`) foi o que derrubou a tela
   * de vendas em 25/08: o nº de hooks muda entre os renders e o React quebra no cliente.
   */
  const lista = useMemo(
    () => montarListaDeReceitas({ receitas: fichas ?? [], busca, chip }),
    [fichas, busca, chip],
  )

  const produzir = async (fichaId: string) => {
    setBusy(true)
    try {
      const hoje = diaEmSaoPaulo()
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichaId, escalaReceitas: 1, dataProducao: hoje }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
    } finally { setBusy(false) }
  }

  /**
   * ⭐⭐ A ESTRELA — OTIMISTA, e a reversão é a parte que importa.
   *
   * O dono pediu *"vira principal NA HORA, sem recarregar, sem modal"*. ⛔ E se a gravação
   * falhar, a estrela **volta sozinha** com um aviso curto: afirmar na tela um estado que o
   * servidor não guardou é a família do *"salvo que mentia"* — pior que o clique não responder,
   * porque o dono vai embora achando que marcou.
   *
   * ⚠️ Nenhum `carregar()` aqui: recarregar as 44 fichas pra mudar um booleano é o refetch de
   * 1,4 s que esta casa já aposentou duas vezes (10/09).
   */
  const alternarPrincipal = async (f: Ficha) => {
    const alvo = !f.principal
    const pinta = (v: boolean) => setFichas((atual) => (atual ?? []).map((x) => (x.id === f.id ? { ...x, principal: v } : x)))
    pinta(alvo)
    const r = await fetchComTimeout<{ principal: boolean }>(
      `/api/empresas/${id}/estoque/fichas/${f.id}/principal`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ principal: alvo }) },
    )
    if (!r.ok) {
      pinta(f.principal) // ⛔ volta sozinha
      setAviso(r.erro ?? 'Não consegui salvar a estrela — tente de novo.')
    }
  }

  if (fichas === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (fichas === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar as receitas.</div>

  const temRecorte = busca.trim() !== '' || chip !== 'TODAS'

  /** ⭐ o cartão v4 — logo colorido + nome forte + sublinha num fôlego só */
  const cartao = (f: Ficha) => (
    <Card key={f.id} className="overflow-hidden">
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        {/**
          * ⭐⭐ A ESTRELA. `<button>` de verdade (não um `<div>` clicável): teclado e leitor de
          * tela de graça — a régua de 16/09. `aria-pressed` diz o estado, não só a cor.
          */}
        <button
          type="button"
          onClick={() => alternarPrincipal(f)}
          aria-pressed={f.principal}
          title={f.principal ? 'tirar das principais' : 'fixar nas principais'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"
        >
          <Star
            className="h-[18px] w-[18px]"
            style={{
              color: f.principal ? 'var(--fam-ambar-mid)' : 'var(--prod-muted)',
              fill: f.principal ? 'var(--fam-ambar-mid)' : 'transparent',
            }}
          />
        </button>

        <LogoDaReceita nome={f.nomeProduzido} tamanho={38} />

        <a href={`/empresas/${id}/estoque/producao/receitas/${f.id}`} className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-slate-900">
            <NomeComDestaque nome={f.nomeProduzido} busca={busca} />
          </p>
          {/**
            * ⭐ A SUBLINHA NUM FÔLEGO SÓ: `v3 · lote 1 UN · R$ 0,97`.
            * ⚠️ O custo *"a definir"* fica **ÂMBAR aqui**, nunca cinza e nunca ausente: cinza
            * se lê como "não importa" e a ausência como "zero" — e é justamente a receita sem
            * custo fechado que precisa de um gesto do dono.
            */}
          <p className="truncate text-[11px] text-slate-400">
            v{f.versaoAtual} · lote {f.loteBase} {f.unidadeLoteBase} ·{' '}
            {f.custoADefinir
              ? <span className="font-medium" style={{ color: 'var(--fam-ambar-mid)' }}>custo a definir</span>
              : <span className="tabular-nums text-slate-600">{brl(f.custoLote)}</span>}
            {` · ${f.componentes.length} componente(s)`}
            {f.validadeDias != null && ` · validade ${f.validadeDias}d`}
          </p>
        </a>

        {/* ⭐ A FILA VIROU A LINHA: o chip leva à ficha com o campo do rendimento aceso */}
        {esperam[f.id] && (
          <a href={`/empresas/${id}/estoque/fichas/${f.id}?foco=rendimento&voltar=${encodeURIComponent(`/empresas/${id}/estoque/producao/receitas`)}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[11.5px] font-medium text-amber-900 hover:bg-amber-100"
            title={esperam[f.id]}>
            <Scale className="h-3 w-3" /> rendimento a declarar
          </a>
        )}

        <button onClick={() => produzir(f.id)} disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <Factory className="h-3.5 w-3.5" /> produzir
        </button>
        {/* ⭐ DUPLICAR — o gesto das FAMÍLIAS de sabor (14 variações de FILE, 8 de FRANGO).
            ⛔ a cópia vem com os componentes e SEM o vínculo com o PDV: herdar o
            mapeamento faria a ficha nova roubar as baixas da original, em silêncio. */}
        <a href={`/empresas/${id}/estoque/producao/receitas/nova?duplicarDe=${f.id}`}
          title="criar uma nova receita com o conteúdo desta"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
          <Copy className="h-3.5 w-3.5" /> duplicar
        </a>
        {/* ⭐ EXCLUIR à vista no card (16/09) — o servidor decide se apaga ou desativa */}
        <ExcluirReceita empresaId={id} fichaId={f.id} compacto
          aoConcluir={(r) => { setAviso(r.efeito); carregar() }} />
        <a href={`/empresas/${id}/estoque/producao/receitas/${f.id}`} className="text-slate-300 hover:text-slate-500"><ChevronRight className="h-4 w-4" /></a>
      </CardContent>
    </Card>
  )

  const CHIPS: { chave: ChipDaLista; rotulo: string; n: number }[] = [
    { chave: 'TODAS', rotulo: 'todas', n: lista.contadores.todas },
    { chave: 'PRINCIPAIS', rotulo: '⭐ principais', n: lista.contadores.principais },
    { chave: 'CUSTO_A_DEFINIR', rotulo: '⚠ custo a definir', n: lista.contadores.custoADefinir },
  ]

  return (
    /**
      * ⚠️ LEI DE LAYOUT (os números do pedido, escritos literais — a lição de 10/09: *o número
      * que está no arquivo, escrito igual*): teto de 1440, 28px de respiro lateral, 14 no
      * celular. ⛔ Nunca coluna estreita centrada no meio da tela.
      */
    <div className="mx-auto max-w-[1440px] space-y-3 px-[28px] max-[700px]:px-[14px]">
      <a href={`/empresas/${id}/estoque/producao`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> Produção</a>

      <div className="flex flex-wrap items-center gap-2.5">
        <ChefHat className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Receitas de produção</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">O que a cozinha produz em lote (gessado, beef, porções) — rendimento medido a cada produção</p>
        {/**
          * ⛔⛔ O BOTÃO DA TELA-FILA MORREU (11/10, item 4) — ver o comentário do estado
          * `esperam`. A pendência agora é um chip NA LINHA de cada receita, e o gesto abre a
          * ficha com o campo aceso. ⭐ Quando há pendência, a linha abaixo DIZ quantas são:
          * número sem porta era o que a fila fazia; porta sem número não diz o tamanho.
          */}
        {Object.keys(esperam).length > 0 && (
          <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-900">
            <Scale className="h-3.5 w-3.5" />
            {Object.keys(esperam).length} esperando o rendimento
          </span>
        )}
        <a href={`/empresas/${id}/estoque/producao/receitas/nova`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
          <Plus className="h-3.5 w-3.5" /> Nova receita
        </a>
      </div>

      {/**
        * ⭐ A BUSCA — AO VIVO, sobre o que a tela JÁ carregou (zero chamada por tecla) e pela
        * `casaBusca` dentro da lib. Sem botão: botão de buscar numa lista de 44 é um clique
        * a mais pra uma resposta que já dava pra ter.
        */}
      <div className="relative max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="buscar receita…"
          aria-label="buscar receita pelo nome"
          className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-9 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-[#185FA5] focus:outline-none"
        />
        {busca !== '' && (
          <button type="button" onClick={() => setBusca('')} aria-label="limpar a busca"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ⭐ OS CHIPS — contando o recorte da busca (clicar devolve EXATAMENTE o número) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map((c) => (
          <button key={c.chave} type="button" onClick={() => setChip(c.chave)} aria-pressed={chip === c.chave}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
              chip === c.chave
                ? 'border-[#185FA5] bg-[#185FA5]/10 text-[#185FA5]'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}>
            {c.rotulo} <span className="tabular-nums opacity-70">· {c.n}</span>
          </button>
        ))}
        {temRecorte && (
          <button type="button" onClick={() => { setBusca(''); setChip('TODAS') }}
            className="ml-1 text-[11.5px] text-slate-500 underline hover:text-slate-700">ver tudo</button>
        )}
      </div>

      {/*
        ⭐ O EFEITO, à vista e some sozinho — *"a linha nunca sai em silêncio"* (15/09).
        ⚠️ Ele DIZ qual dos dois casos aconteceu, porque o servidor pode ter decidido
        diferente do que o confirm prometeu (a cozinha produziu no meio).
      */}
      {aviso && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="ml-auto shrink-0 text-[11px] underline">ok</button>
        </div>
      )}

      {fichas.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ChefHat className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma receita de produção ainda.</p>
          <p className="max-w-md text-xs text-slate-500">
            Receita de produção é o que se faz em LOTE e vira estoque (gessado, beef, porção de carne).
            O produto que você VENDE se monta no <a href={`/empresas/${id}/estoque/cardapio`} className="text-[#185FA5] underline">Cardápio</a>.
          </p>
        </CardContent></Card>
      ) : lista.vazio ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-8 text-center">
          <Search className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-600">{lista.vazio}</p>
          <button type="button" onClick={() => { setBusca(''); setChip('TODAS') }}
            className="text-xs text-[#185FA5] underline">limpar</button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {lista.blocos.map((b) => (
            <section key={b.chave} className="space-y-2">
              {b.titulo && (
                <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {b.chave === 'PRINCIPAIS' && <Star className="h-3 w-3" style={{ color: 'var(--fam-ambar-mid)', fill: 'var(--fam-ambar-mid)' }} />}
                  {b.titulo}
                  <span className="font-normal normal-case tabular-nums text-slate-400">· {b.receitas.length}</span>
                </h2>
              )}
              {b.convite ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-[12.5px] text-slate-500">{b.convite}</p>
              ) : (
                /** ⭐ GRADE de cartões, nunca coluna estreita: 1 no celular, 2 a partir de 1100px */
                <div className="grid grid-cols-1 gap-2 min-[1100px]:grid-cols-2">
                  {b.receitas.map(cartao)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
