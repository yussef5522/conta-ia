'use client'

// ESTOQUE — EDITOR DE FICHA. **UM editor, DOIS MUNDOS** (REGRA 4).
//
// ⭐ PRODUTO FINAL (casa do dono, aberto pelo cardápio) = **PLATE COST**, o padrão do
// MarketMan: 1 ficha = 1 PORÇÃO VENDIDA. O corpo é COMPONENTES, com custo e margem AO VIVO
// no topo. Não pergunta "rende quanto" nem validade — isso é de quem produz em lote.
//
// ⭐ INTERMEDIÁRIO (casa da cozinha, aberto por Produção → Receitas) = SUB-RECEITA: rende em
// lote, tem validade, e o rendimento é MEDIDO na conclusão (por isso o custo por unidade lá
// é "a apurar" até a 1ª produção).
//
// ⚠️ O PREFILL NÃO MORA MAIS AQUI (28/08). Nome e preço do PDV vinham como valor inicial de
// `useState` e o modal **abria vazio** no fluxo real, duas vezes. A decisão virou função
// PURA (`lib/stock/cardapio/valores-iniciais.ts`), testada pelo caminho de verdade; este
// componente só ecoa o que ela devolve. Enquanto a regra morava no `useState`, "abre vazio"
// não tinha como virar teste vermelho.
//
// ⚠️ "Livro de receitas" (o Cookbook do MarketMan) é COLAPSADO e OPCIONAL: serve pra equipe
// montar sempre igual, e **nunca** é exigido pro custo sair.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Plus, Trash2, Search, Save, AlertTriangle, ChevronDown, ChevronRight, BookOpen, ExternalLink } from 'lucide-react'
import { BuscaItem, type ItemBusca } from './busca-item'
import { valoresIniciaisDaFicha, paraCampo, faixaMargem, type LinhaParaFicha } from '@/lib/stock/cardapio/valores-iniciais'
import { camposDaCopia } from '@/lib/stock/producao/duplicar-ficha'
import { montaNaVenda, ehTipoDeFicha, TIPO_INTERMEDIARIO, type TipoFicha } from '@/lib/stock/tipos-ficha'
import { sanitizarQtd, valorQtd, textoQtd, descreverQtd, validarQtd } from '@/lib/stock/quantidade'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'

// ⚠️ `qtdTexto` é a FONTE DA VERDADE do campo, não um número (28/08). O input era
// `value={numero}` e digitar "0,050" era impossível: a vírgula virava 0 e sumia da tela.
// O que o dono digita fica TEXTO enquanto ele digita; o número é derivado.
interface Comp { itemId: string; nome: string; unidade: string; qtdTexto: string; custoMedio: number | null; unidadeControle: string; categoria?: string; fichaIdComponente?: string | null }
interface Setor { id: string; nome: string; ativo: boolean }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const parseNum = (s: string) => { const t = (s ?? '').trim().replace(',', '.'); const n = Number(t); return t === '' || !Number.isFinite(n) ? null : n }

const CORES_MARGEM = { ruim: 'text-rose-600', atencao: 'text-amber-600', boa: 'text-emerald-600', indefinida: 'text-slate-400' } as const

export function FichaEditor({ companyId, fichaId, tipoTravado, voltarPara, linha, aoSalvar, mapearNomeSuitable, mapearComplemento, duplicarDe}: {
  companyId: string
  fichaId?: string
  /** o mundo de origem trava o tipo: cardápio = PRODUTO_FINAL, produção = INTERMEDIARIO */
  tipoTravado?: TipoFicha
  /** pra onde voltar ao salvar/cancelar (default: a lista de fichas) */
  voltarPara?: string
  /** a linha do hub, quando o editor foi aberto de um produto do cardápio (dá o prefill) */
  linha?: LinhaParaFicha | null
  /** chamado depois de salvar (a tela do produto recarrega em vez de navegar) */
  aoSalvar?: () => void
; mapearNomeSuitable?: string | string[]; mapearComplemento?: string | string[]; duplicarDe?: string}) {
  const editando = !!fichaId
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const voltar = voltarPara ?? `/empresas/${companyId}/estoque/fichas`

  // ⭐ O CICLO DO COMPLEMENTO FECHA AQUI (02/09): a prateleira manda
  // `?complemento=CALABRESA`, e o vínculo nome→ficha entra na MESMA transação da criação.
  // ⚠️ Sem isto o gesto seria: cria a ficha → volta na aba → aponta à mão. Dois passos,
  // ~50 vezes, e o passo 2 é justamente o que ficou de fora nas 3 fichas órfãs de 01/09.
  // ⭐ `getAll`: o link do grupo manda um `complemento=` por grafia, e o salvar mapeia todas
  // na MESMA transação — uma ficha, uma viagem.
  const complementosDaUrl = qp?.getAll('complemento') ?? []
  const complementoDaUrl = mapearComplemento ?? (complementosDaUrl.length ? complementosDaUrl : undefined)
  // ⭐ o irmão do `?complemento=` pro mundo dos PRODUTOS (porta da tela de Vendas):
  // sem ele a ficha nascia órfã ali também — a MESMA classe das 3 órfãs de 01/09.
  const mapearDaUrl = mapearNomeSuitable ?? qp?.get('mapear') ?? undefined
  /**
   * ⭐⭐ DUPLICAR (02/09) — padrão do modelo de etiqueta: *"criar um NOVO com o conteúdo
   * deste. Nada é sobrescrito."*
   *
   * ⚠️ POR QUE ISTO EXISTE: os ~50 sabores se agrupam em FAMÍLIAS (14 variações de FILE,
   * 8 de FRANGO), onde cada variação é "a mesma porção + um acabamento diferente". Montar
   * 50 fichas do zero seria 50 montagens; duplicando, é 8 montagens + 42 ajustes de um
   * componente.
   *
   * ⛔ E A CÓPIA NUNCA NASCE MAPEADA (regra do dono): ela vem com os componentes, sem o
   * vínculo com o PDV. Herdar o mapeamento faria a ficha nova roubar as baixas da original
   * — em silêncio, porque o mapa é `@@unique(companyId, nomeSuitable)` e o upsert
   * sobrescreveria.
   */
  const duplicarDaUrl = duplicarDe ?? qp?.get('duplicarDe') ?? undefined

  // ⭐ o tipo pode vir travado pelo mundo de origem (cardápio=final, produção=intermediário,
  // prateleira de complementos=SABOR) ou pela URL; o default segue INTERMEDIÁRIO.
  const tipoDaUrl = qp?.get('tipo')
  const tipoInicial: TipoFicha =
    tipoTravado ?? (!editando && tipoDaUrl && ehTipoDeFicha(tipoDaUrl) ? tipoDaUrl : TIPO_INTERMEDIARIO)

  // ⭐ a decisão de prefill vem PRONTA da lib (pura e testada) — o componente só ecoa.
  const linhaPrefill: LinhaParaFicha | null = linha ?? (qp?.get('nome')
    ? { nome: qp.get('nome')!, nomesSuitable: [qp.get('nome')!], precoPraticado: null, precoCardapio: null, fichaId: null }
    : null)
  const ini = valoresIniciaisDaFicha(tipoInicial, editando ? null : linhaPrefill)

  const [carregando, setCarregando] = useState(editando || !!duplicarDaUrl)
  const [nomeProduzido, setNomeProduzido] = useState(ini.nome)
  const [unidadeProduzido, setUnidadeProduzido] = useState<'KG' | 'UN' | 'LT'>('UN')
  const [tipoProduto, setTipoProduto] = useState(tipoInicial)
  const [setorId, setSetorId] = useState<string>('')
  const [valorVenda, setValorVenda] = useState(ini.preco)
  const [loteBase, setLoteBase] = useState(ini.loteBase)
  const [unidadeLoteBase, setUnidadeLoteBase] = useState<'KG' | 'UN' | 'LT'>(ini.unidadeLoteBase)
  const [validadeDias, setValidadeDias] = useState('')
  const [tempoPreparoMin, setTempoPreparoMin] = useState('')
  const [modoPreparo, setModoPreparo] = useState('')
  const [comps, setComps] = useState<Comp[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [cookbookAberto, setCookbookAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // guarda o que o dono TOCOU, pra o prefill nunca sobrescrever digitação
  const tocou = useRef({ nome: false, preco: false })

  // ⚠️ DUAS perguntas diferentes (03/09) — misturá-las foi o que fez o `tipoProduto`
  // acumular papel e o sabor cair na tela da cozinha:
  //   monta   → plate cost: custo por unidade direto, sem rendimento e sem validade
  //   produtoFinal → tem PREÇO próprio e margem. **Sabor não tem preço**: quem tem é a pizza.
  const monta = montaNaVenda(tipoProduto)
  const produtoFinal = tipoProduto === 'PRODUTO_FINAL'
  // ⚠️ lista OU string: a tela do produto manda todos os apelidos do PDV
  const temNomePdv = Array.isArray(mapearDaUrl) ? mapearDaUrl.length > 0 : !!mapearDaUrl
  const temComplemento = Array.isArray(complementoDaUrl) ? complementoDaUrl.length > 0 : !!complementoDaUrl

  // ⚠️ REDE do prefill: se a linha chegar DEPOIS da montagem (fetch da tela de trás), aplica
  // aqui. Só em campo intocado — o dono manda sempre.
  useEffect(() => {
    if (editando || !linha) return
    const v = valoresIniciaisDaFicha(tipoInicial, linha)
    if (!tocou.current.nome && v.nome) setNomeProduzido((atual) => (atual.trim() === '' ? v.nome : atual))
    if (!tocou.current.preco && v.preco) setValorVenda((atual) => (atual.trim() === '' ? v.preco : atual))
  }, [editando, linha, tipoInicial])

  useEffect(() => {
    fetch(`/api/empresas/${companyId}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
    // ⚠️ EDITAR e DUPLICAR carregam a MESMA ficha pelo MESMO caminho — o que muda é o que
    // se ADOTA dela. Dois fetchs separados divergiriam no dia em que a ficha ganhar um campo.
    const origem = fichaId ?? duplicarDaUrl
    if (origem) {
      const copia = !fichaId
      fetch(`/api/empresas/${companyId}/estoque/fichas/${origem}`).then((r) => r.json()).then((j) => {
        const f = j.ficha
        if (!f) { setErro(copia ? 'A ficha que você quer duplicar não foi encontrada.' : 'Ficha não encontrada.'); return }
        // ⭐ a decisão do que a cópia herda vem PRONTA da lib pura (testada) — o componente ecoa.
        const v = copia ? camposDaCopia(f, nomeProduzido) : f
        setNomeProduzido(v.nomeProduzido)
        setUnidadeProduzido(v.unidadeProduzido); setTipoProduto(v.tipoProduto)
        setSetorId(v.setorId ?? ''); setValorVenda(paraCampo(v.valorVenda))
        setLoteBase(String(v.loteBase)); setUnidadeLoteBase(v.unidadeLoteBase)
        setValidadeDias(v.validadeDias != null ? String(v.validadeDias) : ''); setTempoPreparoMin(v.tempoPreparoMin != null ? String(v.tempoPreparoMin) : '')
        setModoPreparo(v.modoPreparo ?? '')
        if (f.modoPreparo || f.tempoPreparoMin != null) setCookbookAberto(true)
        setComps(f.componentes.map((c: { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null; unidadeControle: string }) => ({ itemId: c.itemId, nome: c.nome, unidade: c.unidade, qtdTexto: textoQtd(c.qtdPlanejada), custoMedio: c.custoMedio, unidadeControle: c.unidadeControle })))
      }).finally(() => setCarregando(false))
    }
  }, [companyId, fichaId, duplicarDaUrl])

  // ⭐ CUSTO AO VIVO. Produto final MONTA na venda → custo por unidade = Σ componentes ÷ lote
  // (que é 1). Intermediário rende em lote e o rendimento é MEDIDO → por-unidade "a apurar".
  const custo = useMemo(() => {
    const semCusto = comps.filter((c) => c.custoMedio == null).length
    const soma = (ls: Comp[]) => round2(ls.reduce((s, c) => s + (c.custoMedio ?? 0) * (valorQtd(c.qtdTexto) ?? 0), 0))
    const custoLote = semCusto > 0 ? null : soma(comps)
    const lote = parseNum(loteBase)
    const porUnidade = monta && custoLote != null && lote != null && lote > 0 ? round2(custoLote / lote) : null
    // ⭐ EMBALAGEM À PARTE — pedido do dono (01/09): "pra eu enxergar o custo de caixa
    // separado do custo de comida". ⚠️ É separação VISUAL: os dois entram no custo total
    // e na baixa igual, porque embalagem é componente como qualquer outro.
    const daEmbalagem = semCusto > 0 ? null : soma(comps.filter((c) => c.categoria === 'EMBALAGEM'))
    return { custoLote, porUnidade, custoADefinir: semCusto > 0, semCusto, daEmbalagem }
  }, [comps, loteBase, monta])

  // ⭐ duas listas, a MESMA fonte — a ordem de gravação (`comps`) não muda
  const compsComida = useMemo(() => comps.filter((c) => c.categoria !== 'EMBALAGEM'), [comps])
  const compsEmbalagem = useMemo(() => comps.filter((c) => c.categoria === 'EMBALAGEM'), [comps])

  const preco = parseNum(valorVenda)
  const margem = produtoFinal && preco != null && preco > 0 && custo.porUnidade != null
    ? round2((preco - custo.porUnidade) / preco) : null
  const corMargem = CORES_MARGEM[faixaMargem(margem)]

  const addComp = (it: ItemBusca) => {
    if (comps.some((c) => c.itemId === it.id)) return
    setComps((cs) => [...cs, { itemId: it.id, nome: it.nome, unidade: it.unidadeControle, qtdTexto: '', custoMedio: it.custoMedio, unidadeControle: it.unidadeControle, categoria: it.categoria }])
  }
  // sanitiza a DIGITAÇÃO (preserva "0," e "0,0" — os estados que o campo antigo destruía)
  const setQtd = (itemId: string, texto: string) => setComps((cs) => cs.map((c) => (c.itemId === itemId ? { ...c, qtdTexto: sanitizarQtd(texto, c.unidadeControle) } : c)))
  const rmComp = (itemId: string) => setComps((cs) => cs.filter((c) => c.itemId !== itemId))

  const salvar = async () => {
    setErro(null)
    const lb = parseNum(loteBase)
    if (!nomeProduzido.trim()) return setErro('Dê um nome ao produto.')
    if (lb == null || lb <= 0) return setErro('A receita tem que render mais que zero.')
    if (!comps.length) return setErro('Adicione ao menos um ingrediente.')
    for (const c of comps) {
      const e = validarQtd(c.qtdTexto, c.unidadeControle, c.nome)
      if (e) return setErro(e)
    }
    const vv = produtoFinal ? parseNum(valorVenda) : null
    const componentes = comps.map((c, i) => ({ itemId: c.itemId, qtdPlanejada: valorQtd(c.qtdTexto) ?? 0, unidade: c.unidade, posicao: i }))
    const body = {
      loteBase: lb, unidadeLoteBase, componentes,
      modoPreparo: modoPreparo.trim() || null,
      tempoPreparoMin: parseNum(tempoPreparoMin) ?? null,
      // ⚠️ produto final não tem validade — o campo nem aparece; mandar null é explícito.
      validadeDias: monta ? null : parseNum(validadeDias) ?? null,
    }
    setSalvando(true)
    try {
      const r = editando
        ? await fetch(`/api/empresas/${companyId}/estoque/fichas/${fichaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, nomeProduzido: nomeProduzido.trim(), setorId: setorId || null, valorVenda: vv }) })
        : await fetch(`/api/empresas/${companyId}/estoque/fichas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, nomeProduzido: nomeProduzido.trim(), unidadeProduzido, tipoProduto, setorId: setorId || null, valorVenda: vv, mapearNomeSuitable: duplicarDaUrl || !temNomePdv ? null : mapearDaUrl, mapearComplemento: duplicarDaUrl ? null : (complementoDaUrl ?? null) }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar.'); return }
      // ⭐ ITEM 5 (01/09): gravação INCOMPLETA nunca mais volta calada. Se a tela pediu o
      // vínculo com o PDV e ele não veio, o dono fica sabendo NA HORA — foi o silêncio que
      // fez ele salvar de novo e duplicar a PIZZA.
      if (!duplicarDaUrl && (temNomePdv || temComplemento) && !editando && j?.vinculadoAoPdv === false) {
        setErro(`Ficha salva, mas NÃO foi vinculada a “${[mapearDaUrl, complementoDaUrl].flat().filter(Boolean).join('”, “')}” do PDV. ` +
          'Ela existe em Fichas técnicas; vincule pelo cardápio antes de vender.')
        return
      }
      if (aoSalvar) aoSalvar()
      else window.location.href = voltar
    } catch { setErro('Falha de conexão.') } finally { setSalvando(false) }
  }

  if (carregando) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>

  const nomesPdv = linha?.nomesSuitable ?? []

  return (
    <div className="space-y-3">
      {/* ── CABEÇALHO ────────────────────────────────────────────────────────── */}
      <Card><CardContent className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="min-w-[200px] flex-1 text-[11px] text-slate-500">Produto
            <input value={nomeProduzido} onChange={(e) => { tocou.current.nome = true; setNomeProduzido(e.target.value) }}
              placeholder={tipoProduto === 'SABOR' ? 'ex: CALABRESA' : produtoFinal ? 'ex: Xis Completo' : 'ex: Beef de xis'}
              className="mt-1 block h-9 w-full rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          {produtoFinal && (
            <label className="text-[11px] text-slate-500">Preço de venda
              <input value={valorVenda} onChange={(e) => { tocou.current.preco = true; setValorVenda(e.target.value) }}
                inputMode="decimal" placeholder="a definir"
                className="mt-1 block h-9 w-28 rounded-lg border border-slate-300 px-3 text-right text-sm tabular-nums" />
            </label>
          )}
          {!monta && (
            <label className="text-[11px] text-slate-500">Unidade
              <select value={unidadeProduzido} onChange={(e) => setUnidadeProduzido(e.target.value as 'KG' | 'UN' | 'LT')} disabled={editando}
                className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm disabled:bg-slate-50"><option>UN</option><option>KG</option><option>LT</option></select>
            </label>
          )}
          <label className="text-[11px] text-slate-500">Setor
            <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="">—</option>{setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {nomesPdv.length > 0 && <span>no PDV: <b className="text-slate-500">{nomesPdv.join(' · ')}</b></span>}
          {produtoFinal && ini.precoOrigem === 'praticado' && <span>preço do que o PDV cobrou — pode editar</span>}
          {monta && <span>1 ficha = 1 unidade vendida</span>}
          {tipoProduto === 'SABOR' && <span>sabor: consome a porção pronta que a cozinha produziu</span>}
        </div>

        {/* rendimento: SÓ no mundo da produção (produto final é per-serving) */}
        {!produtoFinal && (
          <div className="flex flex-wrap items-end gap-2.5 border-t pt-2.5">
            <label className="text-[11px] text-slate-500">A receita rende
              <div className="mt-1 flex items-center gap-1">
                <input value={loteBase} onChange={(e) => setLoteBase(e.target.value)} inputMode="decimal" className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
                <select value={unidadeLoteBase} onChange={(e) => setUnidadeLoteBase(e.target.value as 'KG' | 'UN' | 'LT')} className="h-9 rounded-lg border border-slate-300 px-2 text-sm"><option>KG</option><option>UN</option><option>LT</option></select>
              </div>
            </label>
            <label className="text-[11px] text-slate-500">Validade (dias)
              <input value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} inputMode="numeric" placeholder="p/ etiqueta"
                className="mt-1 block h-9 w-24 rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
            </label>
            <p className="pb-2 text-[11px] text-slate-400">o rendimento real é medido na produção</p>
          </div>
        )}
      </CardContent></Card>

      {/* ── COMPONENTES: o coração, com custo e margem AO VIVO no topo ───────── */}
      <Card><CardContent className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Ingredientes</p>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{produtoFinal ? 'Custo por unidade' : 'Custo do lote'}</p>
              {custo.custoADefinir
                ? <p className="text-sm font-semibold text-amber-600">a definir</p>
                : <p className="text-lg font-semibold tabular-nums text-slate-900">{brl(produtoFinal ? custo.porUnidade : custo.custoLote)}</p>}
            </div>
            {produtoFinal && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Margem</p>
                <p className={`text-lg font-semibold tabular-nums ${corMargem}`}>{margem != null ? `${Math.round(margem * 100)}%` : 'a definir'}</p>
              </div>
            )}
          </div>
        </div>

        {custo.custoADefinir && (
          <p className="flex items-center gap-1 text-[11px] text-amber-600">
            <AlertTriangle className="h-3 w-3" /> {custo.semCusto} ingrediente(s) sem custo — o custo fica "a definir" até a 1ª nota (nunca chutamos).
          </p>
        )}

        <BuscaItem companyId={companyId} jaAdicionados={comps.map((c) => c.itemId)} onEscolher={addComp}
          placeholder="buscar ingrediente (ou criar um que nunca veio em nota)…" />

        {comps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
            Busque e adicione os ingredientes {produtoFinal ? 'de UMA unidade vendida' : 'do lote'}.
          </p>
        ) : (
          <div className="space-y-2">
            {/* ⭐ DUAS SEÇÕES, UMA LISTA (01/09): embalagem separada só pra o dono enxergar
                o custo de caixa por produto. ⚠️ É separação VISUAL — na baixa e no custo
                total, embalagem é componente como qualquer outro. */}
            <SecaoComps titulo={compsEmbalagem.length ? 'Ingredientes' : null} lista={compsComida}
              companyId={companyId} setQtd={setQtd} rmComp={rmComp} />
            {compsEmbalagem.length > 0 && (
              <SecaoComps
                titulo="Embalagem"
                subtitulo={custo.daEmbalagem != null ? `${brl(custo.daEmbalagem)} por ${produtoFinal ? 'unidade' : 'lote'}` : null}
                lista={compsEmbalagem} companyId={companyId} setQtd={setQtd} rmComp={rmComp} />
            )}
          </div>
        )}
      </CardContent></Card>

      {/* ── LIVRO DE RECEITAS (opcional) — o Cookbook: pra equipe montar sempre igual ── */}
      <Card>
        <button type="button" onClick={() => setCookbookAberto((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50">
          {cookbookAberto ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <BookOpen className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Livro de receitas</span>
          <span className="text-[11px] text-slate-400">opcional — pra equipe montar sempre igual</span>
        </button>
        {cookbookAberto && (
          <CardContent className="space-y-2.5 border-t p-3 pt-3">
            <label className="block text-[11px] text-slate-500">Tempo de preparo (min)
              <input value={tempoPreparoMin} onChange={(e) => setTempoPreparoMin(e.target.value)} inputMode="numeric" placeholder="opcional"
                className="mt-1 block h-9 w-28 rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
            </label>
            <label className="block text-[11px] text-slate-500">Modo de preparo
              <textarea value={modoPreparo} onChange={(e) => setModoPreparo(e.target.value)} rows={4}
                placeholder="ex: pão na chapa 40s cada lado · beef 3 min · monta na ordem: pão, maionese, carne, queijo, salada"
                className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
            </label>
            <p className="text-[11px] text-slate-400">Nada aqui entra no custo — é a instrução da cozinha.</p>
          </CardContent>
        )}
      </Card>

      {erro && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {/* ── RODAPÉ ───────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-white/95 py-2.5 backdrop-blur">
        <button onClick={salvar} disabled={salvando}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-60">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editando ? 'Salvar receita' : produtoFinal ? 'Criar ficha' : 'Criar receita'}
        </button>
        {editando && <span className="hidden text-[11px] text-slate-400 sm:inline">mudar ingrediente ou quantidade cria uma versão nova</span>}
        <a href={voltar} className="ml-auto text-xs text-slate-500 hover:text-slate-700">cancelar</a>
      </div>
    </div>
  )
}

// ⭐ BUSCA DE INGREDIENTE — por default só o que É ingrediente.
// A tela oferecia DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA como componente de lanche:
// pedia o catálogo inteiro. O servidor filtra (escopo=receita) e ordena intermediário/
// matéria-prima primeiro. O toggle "tudo" cobre o caso raro (embalagem no custo do delivery).

/**
 * ⭐ UMA SEÇÃO DE COMPONENTES — a linha é a MESMA nas duas (ingredientes e embalagem).
 *
 * ⚠️ Extraído em 01/09 pra separar embalagem VISUALMENTE sem duplicar a linha. Duas cópias
 * do mesmo campo de quantidade seria onde as duas seções começariam a divergir — e o campo
 * de quantidade é justamente o que já teve o bug do `value={numero}` (28/08).
 */
function SecaoComps({ titulo, subtitulo, lista, companyId, setQtd, rmComp }: {
  titulo: string | null
  subtitulo?: string | null
  lista: Comp[]
  companyId: string
  setQtd: (itemId: string, texto: string) => void
  rmComp: (itemId: string) => void
}) {
  if (lista.length === 0) return null
  return (
    <div>
      {titulo && (
        <div className="mb-0.5 flex items-baseline gap-2 border-b border-slate-100 pb-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{titulo}</span>
          {subtitulo && <span className="text-[11px] tabular-nums text-slate-500">{subtitulo}</span>}
        </div>
      )}
      <div className="divide-y divide-slate-50">
        {lista.map((c) => {
          const qtd = valorQtd(c.qtdTexto)
          const emGramas = descreverQtd(qtd, c.unidadeControle)
          return (
            <div key={c.itemId} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-slate-800">
                  {c.nome}
                  {(c.categoria === 'INTERMEDIARIO' || c.categoria === 'PRODUTO_FINAL') && (
                    <a href={`/empresas/${companyId}/estoque/producao/receitas`} target="_blank" rel="noreferrer"
                      className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700 hover:bg-violet-100">
                      produzido <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {c.categoria === 'EMBALAGEM' && (
                    <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">embalagem</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400">
                  {c.custoMedio != null ? `${brl(c.custoMedio)}/${c.unidadeControle}` : 'sem custo ainda'}
                </p>
              </div>
              {/* ⭐ o campo é TEXTO: "0,050" sobrevive letra a letra. inputMode decimal
                  abre o teclado numérico com vírgula no celular, que é onde ele monta. */}
              <input value={c.qtdTexto} onChange={(e) => setQtd(c.itemId, e.target.value)}
                inputMode="decimal" placeholder={c.unidadeControle === 'UN' ? '1' : '0,000'}
                aria-label={`Quantidade de ${c.nome} em ${c.unidadeControle}`}
                className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
              <span className="w-16 text-[11px] text-slate-400">
                {c.unidade}
                {/* confirmação visual: 0,05 e 0,005 são parecidos e 10× diferentes */}
                {emGramas && <span className="block text-[10px] text-slate-400">= {emGramas}</span>}
              </span>
              <span className="w-20 text-right text-[13px] tabular-nums text-slate-600">
                {c.custoMedio != null && qtd != null ? brl(round2(c.custoMedio * qtd)) : <span className="text-amber-500">—</span>}
              </span>
              <button onClick={() => rmComp(c.itemId)} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
