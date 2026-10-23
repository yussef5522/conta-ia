'use client'

/**
 * ⭐⭐⭐ REAL × TEÓRICO v2 — A MESA DE PERÍCIA (29/09/2026)
 *
 * **A lei do dono:** *"a tela passa a ler EXCLUSIVAMENTE o motor do Radar — o cálculo
 * próprio que ela tem hoje MORRE. Duas telas, uma verdade."* A rota devolve a mesa pronta;
 * aqui não existe uma soma sobre o ledger, nem um `saldoInicial` recalculado.
 *
 * ⛔⛔ **E o Σ do Radar VIAJA NO PAYLOAD** — a tela mostra o confronto quando não há filtro.
 * Se um dia os dois divergirem, o dono vê na hora, no lugar onde ele está trabalhando; sem
 * isso a divergência só apareceria com as duas telas abertas lado a lado.
 *
 * ⚠️⚠️ **SOBRE O VISUAL: não existe mock deste sprint.** Procurei em `docs/mocks/`, no
 * Downloads e no repo — o arquivo não chegou. Como o pedido amarra esta tela ao Radar em
 * tudo (*mesmas watchlists, mesmos degraus, mesmo componente da conta*), a régua que segui
 * foi `docs/mocks/radar-do-estoque-mock.html`, pelos MESMOS tokens (`radar-tokens.ts`).
 * ⭐ Isso é o oposto de inventar: é a tela irmã usando a paleta versionada da irmã. Se o
 * mock aprovado for outro, a pintura troca — os tokens estão num lugar só.
 *
 * ⛔ TELA NOVA NASCE COM O GUARD (a lição da lixeira, 20/09): `fetchComTimeout` + estados
 * EXPLÍCITOS + "tentar de novo". *Enquanto "ausência de dado" servir de estado, o caso não
 * previsto vira spinner eterno.*
 */

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react'
import Link from 'next/link'
import { FlaskConical, Loader2, ChevronDown, ChevronRight, Columns3, Search, X, Download, Pencil, Plus, ClipboardList } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { RADAR, FAROL, TOM_DA_AGENDA, familiaDoGrupo, MESA } from '@/components/estoque/radar-tokens'
import { ContaDePadeiro } from '@/components/estoque/radar/conta-de-padeiro'
import { BuscaItem, type ItemBusca } from '@/components/estoque/busca-item'
import { formatarQtd } from '@/lib/stock/quantidade'
import { casaBusca } from '@/lib/busca-texto'
import type { SecaoDaMesa, LinhaDaMesa, ChaveColuna } from '@/lib/stock/radar/mesa'
import { frasesDoRodape } from '@/lib/stock/radar/mesa'
import type { ChavePeriodo } from '@/lib/stock/radar/periodo'
/**
 * ⭐⭐ A RÉGUA DO FAROL É PURA E TEM UM DONO SÓ (RT5) — a tela CONSOME, nunca decide.
 *
 * ⛔ Escrever `real < teorico ? 'faltou' : …` aqui seria a **2ª régua** da variância: o Radar
 * pinta por TAMANHO (âmbar/coral) e esta tela pinta por SINAL, e as duas perguntas já são
 * diferentes de propósito — uma terceira, escrita no JSX, divergiria na 1ª borda (real nulo,
 * teórico nulo, diferença de arredondamento) e **ninguém saberia qual está certa**.
 */
import { farolDaVariancia } from '@/lib/stock/radar/farol-da-variancia'
import { DIAS_SEG_FIRST, type SeloDaAgenda } from '@/lib/stock/radar/agenda-da-contagem'
import type { UniversoDoSeletor } from '@/lib/stock/universo-do-seletor'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const hojeBR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

interface Coluna { chave: ChaveColuna; rotulo: string; ajuda: string; tipo: string; padrao: boolean }

/**
 * ⭐⭐ A AGENDA DE CADA GRUPO (RT3) — e ela chega PRONTA do servidor, selo e tudo.
 *
 * ⛔⛔ Os TIPOS são DERIVADOS das libs puras (`SeloDaAgenda`, `UniversoDoSeletor`), nunca
 * reescritos à mão: *interface escrita sobre payload é promessa, não prova* (a dívida de
 * 01/09) — campo novo no servidor ficaria **invisível pro `tsc`** e a tela não poderia usá-lo,
 * que é exatamente como o contrato da home PF esvaziou um widget em silêncio.
 */
interface AgendaDaTela {
  /**
   * ⭐ o **id** é o alvo dos quatro gestos (✎ renomear · chips · adicionar item · criar) —
   * eles resolvem por id escopado pela empresa (REGRA 8). Mandar o slug faria a rota resolver
   * por nome, a cicatriz da conta `'sicredi '`.
   */
  id: string
  slug: string
  /** ⭐ o universo da busca vem DECIDIDO do servidor (`universoDoGrupo`) — ver a rota */
  universo: UniversoDoSeletor
  todoDia: boolean
  dias: number[]
  rotuloCurto: string
  rotuloLongo: string
  ultimaTexto: string
  selo: SeloDaAgenda
}

interface Payload {
  janela: { chave: ChavePeriodo; de: string; ate: string; rotulo: string }
  secoes: SecaoDaMesa[]
  /** ⭐ 1:1 com `secoes` pelo SLUG — a tela casa por slug, nunca por posição do array */
  agenda: AgendaDaTela[]
  colunas: ChaveColuna[]
  colunasDisponiveis: Coluna[]
  placarDoRadar: { valor: number; itensContados: number }
  soma: { valor: number; absoluto: number; tom: string; itensContados: number }
  filtrado: boolean
  avisos: string[]
}

const PILULAS: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: 'ONTEM_HOJE', rotulo: 'hoje' },
  { chave: 'SETE_DIAS', rotulo: '7 dias' },
  { chave: 'MES', rotulo: 'mês' },
]

/**
 * ⭐⭐⭐ O FAROL HONESTO DA VARIÂNCIA — RT5 (22/10/2026)
 *
 * **faltou = CORAL** (é PERDA) · **sobrou = ÂMBAR** (dado torto pra conferir, não boa notícia) ·
 * **bateu = VERDE** · **falta contar = neutro COM A AÇÃO** (*"conta SEX"*).
 *
 * ⛔⛔ **A régua é a de `farolDaVariancia`, e ela tinha ZERO chamadores até hoje** — estava em
 * prod e inalcançável (a *"porta sem maçaneta"*). Ligar aqui é o que fecha a RT5.
 *
 * ⚠️⚠️ **DIVERGÊNCIA DECLARADA do Radar, aprovada pelo dono:** lá o semáforo é por TAMANHO
 * (falta pequena em âmbar) porque a pergunta é *"onde vaza MAIS dinheiro?"*; aqui **faltou é
 * faltou**. Pintar falta pequena de âmbar nesta tela faria o olho aprender que âmbar significa
 * duas coisas, e aí **nenhuma das duas se lê**. O `TOM` do Radar segue intocado.
 *
 * ⚠️ `l.teorico` é `number | null` (janela sem ponto de partida) e a régua pura exige `number`
 * — sem teórico **não existe variância pra julgar**, então é o mesmo neutro-com-ação. ⛔ Cair no
 * `?? 0` ali diria *"faltou tudo"* num item que ninguém mediu.
 */
function Pilula({ l, contaEm }: { l: LinhaDaMesa; contaEm: string }) {
  const farol = l.teorico == null
    ? { papel: 'neutro' as const, texto: `conta ${contaEm}` }
    : farolDaVariancia({
        real: l.real,
        teorico: l.teorico,
        formatarQtd: (valor) => formatarQtd(valor, l.unidade),
        contaEm,
      })
  const tom = FAROL[farol.papel]
  return (
    // ⭐ v2: a pílula cresceu (4px 10px · 12,5px) — é o veredito, o que o olho procura
    <span className="inline-flex items-center rounded-full font-bold"
      style={{ background: tom.bg, color: tom.cor, padding: `${MESA.pilulaPy} ${MESA.pilulaPx}`, fontSize: MESA.pilulaFs }}>
      {farol.texto}
    </span>
  )
}

/**
 * ⚠️ célula de quantidade: o sinal é o do ledger, e o zero fica APAGADO (não é notícia).
 *
 * ⭐ v2 — **HIERARQUIA POR PAPEL** (ordem do dono): `forte` é o que DECIDE (teórico e real)
 * e vai em peso 500; o contexto (início/entrou/produzido/vendeu) fica em peso normal, pra
 * o olho ir direto no que importa em vez de varrer oito números do mesmo tamanho.
 */
function Qtd({ v, un, forte }: { v: number | null; un: string; forte?: boolean }) {
  if (v == null) return <span style={{ color: RADAR.mudo }}>—</span>
  const zero = Math.abs(v) < 0.0000005
  return (
    <span className="tabular-nums"
      style={{ color: zero ? RADAR.mudo : undefined, fontWeight: forte ? MESA.pesoForte : MESA.pesoContexto }}>
      {formatarQtd(v, un)}
    </span>
  )
}

export default function RealVsTeoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = use(params)
  const [estado, setEstado] = useState<Estado>('CARREGANDO')
  const [erro, setErro] = useState<string | null>(null)
  const [dados, setDados] = useState<Payload | null>(null)

  const [periodo, setPeriodo] = useState<ChavePeriodo>('SETE_DIAS')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [itens, setItens] = useState<string[]>([])
  const [buscaChip, setBuscaChip] = useState('')
  const [abrirColunas, setAbrirColunas] = useState(false)
  const [abrirProdutos, setAbrirProdutos] = useState(false)
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null)
  const [colunas, setColunas] = useState<ChaveColuna[] | null>(null)

  /**
   * ⚠️ REGRA 9 — os hooks dos gestos nascem AQUI, no topo, nunca ao lado de onde são usados:
   * hook depois de early-return muda o número de hooks entre o estado CARREGANDO e o OK, e a
   * tela cai inteira ("Rendered more hooks…"). Mordeu 2× nesta casa (21/08 e 25/08).
   */
  const [gestoErro, setGestoErro] = useState<string | null>(null)
  /** ⭐ qual gesto está no ar — o botão vira "gravando…" em vez de aceitar dois toques */
  const [gravando, setGravando] = useState<string | null>(null)
  const [novoGrupoAberto, setNovoGrupoAberto] = useState(false)
  const [novoGrupoNome, setNovoGrupoNome] = useState('')

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO'); setErro(null)
    const qs = new URLSearchParams({ periodo })
    if (periodo === 'LIVRE' && de && ate) { qs.set('de', de); qs.set('ate', ate) }
    if (itens.length) qs.set('itens', itens.join(','))
    const r = await fetchComTimeout<Payload>(`/api/empresas/${empresaId}/estoque/real-vs-teorico?${qs}`)
    if (!r.ok || !r.data) {
      // ⛔ erro e vazio são estados DIFERENTES — "não carregou" nunca vira "nada aqui"
      setEstado("FALHOU"); setErro(r.erro ?? "Não consegui carregar a mesa.")
      return
    }
    setDados(r.data)
    setColunas((c) => c ?? r.data!.colunas)
    setEstado('OK')
  }, [empresaId, periodo, de, ate, itens])

  useEffect(() => { void carregar() }, [carregar])

  /** ⭐ a escolha de colunas grava no servidor — ela é por PESSOA, não por navegador */
  const salvarColunas = useCallback(async (novas: ChaveColuna[]) => {
    setColunas(novas)
    await fetchComTimeout(`/api/empresas/${empresaId}/estoque/real-vs-teorico`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colunas: novas }),
    })
  }, [empresaId])

  /**
   * ⭐⭐⭐ A PORTA ÚNICA DOS QUATRO GESTOS DE GRUPO — RT2/RT3 (22/10/2026)
   *
   * criar · renomear (✎) · definir agenda (chips) · adicionar item, **todos no MESMO POST**.
   * ⛔ Uma função por gesto daria quatro montadores de corpo pra a mesma rota `.strict()`, e o
   * primeiro que divergisse levaria **400 na cara do dono** — a cicatriz de 25/09, em que a
   * lista de ações da rota divergiu da lib e dois gestos ficaram mortos por dias.
   *
   * ⛔⛔ **Falha é ESTADO, nunca silêncio:** `fetchComTimeout` NUNCA lança (throw solto em
   * handler vira erro só no console), e o que o servidor disse é o que a tela mostra — o
   * genérico só entra quando não veio corpo (a régua do tradutor 422 do estoque).
   *
   * ⚠️ Teto de **60 s**, não os 12 de leitura: desistir cedo de uma GRAVAÇÃO que está
   * acontecendo é pior que esperar (a lição do confirmar da baixa, 14/09).
   */
  const gesto = useCallback(async (corpo: Record<string, unknown>, chave: string) => {
    setGravando(chave)
    setGestoErro(null)
    const r = await fetchComTimeout<{ ok: true; efeito?: string }>(
      `/api/empresas/${empresaId}/estoque/real-vs-teorico/grupos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        timeoutMs: 60_000,
      },
    )
    setGravando(null)
    if (!r.ok) {
      // ⛔ `erro: null` é abort externo (a tela saiu) — gritar ali seria ruído num componente
      //    que já não existe. Só o que tem mensagem vira aviso.
      if (r.erro) setGestoErro(r.erro)
      return false
    }
    // ⭐ o estado novo vem do que o SERVIDOR gravou, nunca do clique: afirmar o efeito a partir
    //    do próprio toque é a família do "salvo que mentia".
    await carregar()
    return true
  }, [empresaId, carregar])

  const cols = colunas ?? []
  const mostra = (c: ChaveColuna) => cols.includes(c)
  const disponiveis = dados?.colunasDisponiveis ?? []
  /**
   * ⚠️ A agenda casa por **SLUG**, nunca por índice do array: um grupo novo nasce no fim da
   * ordem e qualquer reordenação faria a tela pôr a agenda de um grupo no cabeçalho de outro.
   */
  const agendaPorSlug = useMemo(() => {
    const m = new Map<string, AgendaDaTela>()
    for (const a of dados?.agenda ?? []) m.set(a.slug, a)
    return m
  }, [dados])
  const todasAsLinhas = useMemo(() => (dados?.secoes ?? []).flatMap((s) => s.linhas), [dados])
  const chips = useMemo(
    () => todasAsLinhas.filter((l) => !buscaChip || casaBusca(l.nome, buscaChip)),
    [todasAsLinhas, buscaChip],
  )

  /**
   * ⭐⭐ O CONFRONTO COM O RADAR, NA TELA. Sem filtro os dois têm que bater; se não baterem,
   * a tela DIZ — é o guard de página vivendo onde o dono trabalha, não só no teste.
   */
  const divergiu = dados && !dados.filtrado && Math.abs(dados.soma.absoluto - dados.placarDoRadar.valor) > 0.005

  return (
    <div style={{ background: RADAR.bg, minHeight: '100%' }} className="-m-4 p-4 lg:-m-6 lg:p-6">
      {/* ── cabeçalho: uma linha, com o período à vista ───────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FlaskConical className="h-5 w-5" style={{ color: RADAR.roxo }} />
        <h1 className="text-base font-extrabold" style={{ color: RADAR.ink }}>Real × Teórico</h1>
        {dados && (
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold"
            style={{ background: RADAR.roxoBg, color: RADAR.roxo }}>
            {dados.janela.rotulo}
          </span>
        )}
        <span className="hidden text-xs lg:inline" style={{ color: RADAR.sub }}>
          a mesa lê o motor do Radar — mesma conta, mesmas listas
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href={`/empresas/${empresaId}/estoque/radar`}
            className="rounded-lg px-2.5 h-8 inline-flex items-center text-xs font-bold"
            style={{ background: '#fff', color: RADAR.roxo, boxShadow: RADAR.sombra }}>
            ver no Radar →
          </Link>
          <a href={`/api/empresas/${empresaId}/estoque/real-vs-teorico?formato=csv&periodo=${periodo}${periodo === 'LIVRE' && de && ate ? `&de=${de}&ate=${ate}` : ''}${itens.length ? `&itens=${itens.join(',')}` : ''}`}
            className="rounded-lg px-2.5 h-8 inline-flex items-center gap-1 text-xs font-bold"
            style={{ background: '#fff', color: RADAR.sub, boxShadow: RADAR.sombra }}>
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>

      {/* ── barra de filtros ───────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-[14px] p-2"
        style={{ background: '#fff', boxShadow: RADAR.sombra }}>
        {PILULAS.map((p) => (
          <button key={p.chave} onClick={() => setPeriodo(p.chave)}
            className="h-8 rounded-full px-3 text-[12.5px] font-bold transition"
            style={periodo === p.chave
              ? { background: RADAR.roxo, color: '#fff' }
              : { background: RADAR.bg, color: RADAR.sub }}>
            {p.rotulo}
          </button>
        ))}
        {/* ⭐ o calendário de intervalo — dia do BRASIL nos dois campos */}
        <div className="flex items-center gap-1 rounded-full px-2 py-1"
          style={{ background: periodo === 'LIVRE' ? RADAR.roxoBg : RADAR.bg }}>
          <input type="date" value={de} max={hojeBR}
            onChange={(e) => { setDe(e.target.value); if (e.target.value && ate) setPeriodo('LIVRE') }}
            className="h-6 bg-transparent text-[12px] font-semibold outline-none" style={{ color: RADAR.ink }} />
          <span className="text-[11px]" style={{ color: RADAR.sub }}>até</span>
          <input type="date" value={ate} max={hojeBR}
            onChange={(e) => { setAte(e.target.value); if (de && e.target.value) setPeriodo('LIVRE') }}
            className="h-6 bg-transparent text-[12px] font-semibold outline-none" style={{ color: RADAR.ink }} />
        </div>

        {/* ⭐ produtos: chips com a busca da casa (palavra em qualquer ordem, sem acento) */}
        <button onClick={() => setAbrirProdutos((v) => !v)}
          className="h-8 rounded-full px-3 text-[12.5px] font-bold inline-flex items-center gap-1"
          style={itens.length ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}>
          <Search className="h-3.5 w-3.5" />
          {itens.length ? `${itens.length} produto${itens.length > 1 ? 's' : ''}` : 'produtos'}
        </button>
        <button onClick={() => setAbrirColunas((v) => !v)}
          className="h-8 rounded-full px-3 text-[12.5px] font-bold inline-flex items-center gap-1"
          style={{ background: RADAR.bg, color: RADAR.sub }}>
          <Columns3 className="h-3.5 w-3.5" /> colunas
        </button>
        {itens.length > 0 && (
          <button onClick={() => setItens([])} className="h-8 rounded-full px-2.5 text-[12px] font-bold"
            style={{ color: RADAR.coral }}>limpar filtro</button>
        )}
      </div>

      {abrirProdutos && (
        <div className="mb-3 rounded-[14px] p-3" style={{ background: '#fff', boxShadow: RADAR.sombra }}>
          <input value={buscaChip} onChange={(e) => setBuscaChip(e.target.value)}
            placeholder="buscar produto (ex: queijo 135, coca)"
            className="mb-2 h-9 w-full max-w-[320px] rounded-lg px-3 text-[13px] outline-none"
            style={{ background: RADAR.bg, color: RADAR.ink }} />
          <div className="flex flex-wrap gap-1.5">
            {chips.map((l) => {
              const on = itens.includes(l.itemId)
              return (
                <button key={l.itemId}
                  onClick={() => setItens((xs) => (on ? xs.filter((x) => x !== l.itemId) : [...xs, l.itemId]))}
                  className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                  style={on ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}>
                  {l.nome} {on && <X className="ml-0.5 inline h-3 w-3" />}
                </button>
              )
            })}
            {/* ⛔ vazio que DIZ o recorte — "nada encontrado" faria o dono achar que o item sumiu */}
            {chips.length === 0 && (
              <p className="text-[12.5px]" style={{ color: RADAR.sub }}>
                nada com “{buscaChip}” entre os {todasAsLinhas.length} itens das suas listas do Radar.
              </p>
            )}
          </div>
        </div>
      )}

      {abrirColunas && (
        <div className="mb-3 rounded-[14px] p-3" style={{ background: '#fff', boxShadow: RADAR.sombra }}>
          <p className="mb-2 text-[11.5px] font-semibold" style={{ color: RADAR.sub }}>
            a escolha fica salva pra você nesta empresa · <b>R$ e % nascem desligados — esta tela olha quantidade</b>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {disponiveis.map((c) => {
              const on = cols.includes(c.chave)
              return (
                <button key={c.chave} title={c.ajuda}
                  onClick={() => salvarColunas(on ? cols.filter((x) => x !== c.chave) : [...cols, c.chave])}
                  className="rounded-full px-2.5 py-1 text-[12px] font-bold"
                  style={on ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}>
                  {c.rotulo}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {estado === 'CARREGANDO' && (
        <div className="flex items-center gap-2 rounded-[14px] p-6" style={{ background: '#fff', color: RADAR.sub }}>
          <Loader2 className="h-4 w-4 animate-spin" /> montando a mesa…
        </div>
      )}

      {estado === 'FALHOU' && (
        <div className="rounded-[14px] p-5" style={{ background: RADAR.coralBg }}>
          <p className="text-[13px] font-bold" style={{ color: RADAR.coral }}>{erro}</p>
          <button onClick={() => void carregar()} className="mt-2 rounded-lg px-3 py-1.5 text-[12.5px] font-bold"
            style={{ background: RADAR.coral, color: '#fff' }}>tentar de novo</button>
        </div>
      )}

      {estado === 'OK' && dados && (
        <>
          {divergiu && (
            <div className="mb-3 rounded-[14px] px-4 py-3" style={{ background: RADAR.coralBg }}>
              <p className="text-[13px] font-bold" style={{ color: RADAR.coral }}>
                ⛔ esta mesa soma {brl(dados.soma.absoluto)} e o Radar soma {brl(dados.placarDoRadar.valor)} pro mesmo
                recorte — as duas telas estão discordando, e uma delas está errada.
              </p>
            </div>
          )}
          {dados.avisos.map((a, i) => (
            <div key={i} className="mb-3 rounded-[14px] px-4 py-2.5 text-[12.5px] font-semibold"
              style={{ background: RADAR.ambarBg, color: RADAR.ambar }}>⚠️ {a}</div>
          ))}

          {/* ⛔ falha de gesto é ESTADO, nunca silêncio — e diz o que o SERVIDOR disse */}
          {gestoErro && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] px-4 py-2.5"
              style={{ background: RADAR.coralBg }}>
              <p className="text-[12.5px] font-bold" style={{ color: RADAR.coral }}>{gestoErro}</p>
              <button onClick={() => setGestoErro(null)} className="text-[11.5px] font-bold underline"
                style={{ color: RADAR.coral }}>ok</button>
            </div>
          )}

          {dados.secoes.map((s) => (
            <Secao key={s.chave} s={s} ag={agendaPorSlug.get(s.chave)} cols={cols} mostra={mostra}
              empresaId={empresaId} gravando={gravando} onGesto={gesto}
              aberta={linhaAberta} aoAbrir={(id) => setLinhaAberta((a) => (a === id ? null : id))} />
          ))}

          {/* ── RT2: criar grupo — as listas são do DONO ────────────────────── */}
          {/* ⛔ A porta é a MESMA dos outros três gestos. Grupo nasce VAZIO e com a agenda
              em branco: semear dia de contagem seria inventar a rotina dele. */}
          <div className="mt-3 rounded-[14px] px-4 py-3" style={{ background: '#fff', boxShadow: RADAR.sombra }}>
            {!novoGrupoAberto ? (
              <button onClick={() => setNovoGrupoAberto(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-bold"
                style={{ background: RADAR.bg, color: RADAR.roxo }}>
                <Plus className="h-3.5 w-3.5" /> novo grupo
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  {/* ⚠️ rótulo FIXO em cima — rótulo que some quando se digita não é rótulo (09/09) */}
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: RADAR.sub }}>
                    nome do grupo
                  </span>
                  <input autoFocus value={novoGrupoNome} onChange={(e) => setNovoGrupoNome(e.target.value)}
                    placeholder="ex: congelados"
                    className="h-9 w-full max-w-[260px] rounded-lg px-3 text-[13px] outline-none"
                    style={{ background: RADAR.bg, color: RADAR.ink }} />
                </label>
                <button
                  disabled={!novoGrupoNome.trim() || gravando === 'criar'}
                  onClick={async () => {
                    const ok = await gesto({ gesto: 'criar', nome: novoGrupoNome.trim() }, 'criar')
                    if (ok) { setNovoGrupoNome(''); setNovoGrupoAberto(false) }
                  }}
                  className="h-9 rounded-lg px-3 text-[12.5px] font-bold disabled:opacity-50"
                  style={{ background: RADAR.roxo, color: '#fff' }}>
                  {gravando === 'criar' ? 'criando…' : 'criar grupo'}
                </button>
                <button onClick={() => { setNovoGrupoAberto(false); setNovoGrupoNome('') }}
                  className="h-9 rounded-lg px-2.5 text-[12px] font-bold" style={{ color: RADAR.sub }}>
                  cancelar
                </button>
                <p className="w-full text-[11.5px]" style={{ color: RADAR.mudo }}>
                  o grupo nasce vazio e sem dia de contagem — você escolhe os itens e a agenda depois
                </p>
              </div>
            )}
          </div>

          {/* ── a reconciliação com o Radar, em LETRA MIÚDA no pé (RT1/RT6) ───── */}
          {/* ⛔ É o ÚNICO R$ que a tela soma, e ele vive AQUI de propósito: no pé do grupo o
              dinheiro competia com a quantidade justo onde o dono lê "o que falta". ⚠️ E ele
              NÃO sai da tela — ele é o confronto com o Radar; apagá-lo esconderia a
              divergência entre as duas telas, que é o que este rodapé existe pra mostrar. */}
          <div className="mt-3 rounded-[14px] px-4 py-3 text-[11.5px]"
            style={{ background: '#fff', boxShadow: RADAR.sombra, color: RADAR.sub }}>
            <b style={{ color: RADAR.ink }}>{dados.soma.itensContados}</b> item(ns) contados no período
            {dados.soma.itensContados > 0 && (
              <> · a mesa fecha em <b style={{
                color: dados.soma.tom === 'FALTOU' ? RADAR.coral : dados.soma.tom === 'SOBROU' ? RADAR.verde : RADAR.ink,
              }}>{dados.soma.tom === 'BATEU' ? 'zero' : brl(dados.soma.absoluto)}</b></>
            )}
            {!dados.filtrado && !divergiu && dados.soma.itensContados > 0 && (
              <> · <span style={{ color: RADAR.verde }}>✓ bate com o Radar</span></>
            )}
            {dados.filtrado && <> · <span style={{ color: RADAR.roxo }}>recorte filtrado — o total é só dos itens escolhidos</span></>}
          </div>
        </>
      )}
    </div>
  )
}

function Secao({ s, ag, cols, mostra, empresaId, aberta, aoAbrir, onGesto, gravando }: {
  s: SecaoDaMesa; ag?: AgendaDaTela; cols: ChaveColuna[]; mostra: (c: ChaveColuna) => boolean
  empresaId: string; aberta: string | null; aoAbrir: (id: string) => void
  onGesto: (corpo: Record<string, unknown>, chave: string) => Promise<boolean>
  gravando: string | null
}) {
  /**
   * ⚠️ REGRA 9 — os hooks vêm ANTES de qualquer `return`, e é por isso que o
   * `if (!s.linhas.length) return null` que existia aqui **não podia** continuar: além de
   * sumir com o grupo novo (RT2), ele era um early-return com hooks depois.
   */
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(s.titulo)
  const [emoji, setEmoji] = useState(s.icone)
  const [adicionando, setAdicionando] = useState(false)

  const frases = frasesDoRodape(s.total)
  const fam = familiaDoGrupo(s.chave)
  const selo = ag?.selo
  /**
   * ⭐ O *"conta SEX"* que a LINHA escreve no lugar de "falta contar" vem do SELO (RT3/RT5) —
   * é a MESMA régua que decide o badge do cabeçalho. ⛔ Derivar na linha seria a 2ª resposta
   * pra *"quando este grupo se conta?"*, e as duas divergiriam no 1º ajuste de agenda.
   */
  const contaEm = selo?.contaEm ?? 'contar'
  const chaveAgenda = ag ? `agenda:${ag.id}` : ''

  /**
   * ⛔⛔ `todoDia` e `dias` têm UMA representação só: com todo-dia ligado, `dias` vai VAZIO.
   * Guardar os dois juntos criaria duas verdades pra mesma agenda, e o rótulo (que a régua
   * pura monta) passaria a depender de qual delas o leitor olhasse primeiro.
   */
  const alternarTodoDia = () => {
    if (!ag) return
    void onGesto({ gesto: 'agenda', grupoId: ag.id, todoDia: !ag.todoDia, dias: [] }, chaveAgenda)
  }
  const alternarDia = (d: number) => {
    if (!ag) return
    const dias = ag.todoDia
      ? [d]
      : ag.dias.includes(d)
        ? ag.dias.filter((x) => x !== d)
        : [...ag.dias, d].sort((a, b) => a - b)
    void onGesto({ gesto: 'agenda', grupoId: ag.id, todoDia: false, dias }, chaveAgenda)
  }

  return (
    <section className="mb-3 overflow-hidden rounded-[16px]" style={{ background: '#fff', boxShadow: RADAR.sombra }}>
      {/* ⭐⭐ v2 — A FAIXA COLORIDA DA FAMÍLIA. Ícone e texto no tom escuro DELA, e o
          subtotal lá embaixo repete este mesmo fundo (FAMILIA é o dono único dos dois). */}
      <div className="px-4 py-2.5" style={{ background: fam.bg, color: fam.cor }}>
        <div className="flex flex-wrap items-center gap-2">
          {editando && ag ? (
            <>
              {/* ⚠️ emoji e nome num gesto só: a rota aceita os dois no MESMO `renomear`, e
                  separar daria duas gravações pra uma decisão. */}
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="emoji do grupo"
                className="h-7 w-10 rounded-lg px-1.5 text-center text-[15px] outline-none"
                style={{ background: '#fff', color: RADAR.ink }} />
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} aria-label="nome do grupo"
                className="h-7 w-full max-w-[220px] rounded-lg px-2 text-[13px] font-bold outline-none"
                style={{ background: '#fff', color: RADAR.ink }} />
              <button
                disabled={!nome.trim() || gravando === `nome:${ag.id}`}
                onClick={async () => {
                  const ok = await onGesto(
                    { gesto: 'renomear', grupoId: ag.id, nome: nome.trim(), ...(emoji.trim() ? { emoji: emoji.trim() } : {}) },
                    `nome:${ag.id}`,
                  )
                  if (ok) setEditando(false)
                }}
                className="h-7 rounded-lg px-2.5 text-[11.5px] font-bold disabled:opacity-50"
                style={{ background: fam.cor, color: '#fff' }}>
                {gravando === `nome:${ag.id}` ? 'gravando…' : 'salvar'}
              </button>
              <button onClick={() => setEditando(false)} className="h-7 px-1.5 text-[11.5px] font-bold opacity-75">
                cancelar
              </button>
            </>
          ) : (
            <>
              <span className="text-[15px]">{s.icone}</span>
              {/* ⚠️ MAIÚSCULA é CSS, nunca o dado: o nome é do dono e fica gravado como ele
                  escreveu — foi assim que "antes==depois" virou comparação de string na
                  semeadura dos três grupos de origem. */}
              <h2 className="text-[13px] font-extrabold uppercase tracking-wide">{s.titulo}</h2>
              {ag && (
                <button onClick={() => { setNome(s.titulo); setEmoji(s.icone); setEditando(true) }}
                  title="renomear o grupo" aria-label={`renomear ${s.titulo}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md opacity-75 hover:opacity-100"
                  style={{ background: '#fff' }}>
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <span className="text-[11.5px] font-semibold opacity-75">{s.linhas.length} item(ns)</span>
            </>
          )}
        </div>

        {/* ── RT3: a agenda de contagem do grupo ─────────────────────────── */}
        {ag && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* ⭐ os chips são o GESTO: tocar grava na hora (CREATE-only, porta única) */}
            <button onClick={alternarTodoDia} disabled={gravando === chaveAgenda}
              className="h-6 rounded-full px-2 text-[10.5px] font-extrabold uppercase tracking-wide disabled:opacity-50"
              style={ag.todoDia ? { background: fam.cor, color: '#fff' } : { background: '#fff', color: fam.cor }}>
              todo dia
            </button>
            {DIAS_SEG_FIRST.map((rotulo, i) => {
              const on = !ag.todoDia && ag.dias.includes(i)
              return (
                <button key={rotulo} onClick={() => alternarDia(i)} disabled={gravando === chaveAgenda}
                  className="h-6 w-8 rounded-full text-[10.5px] font-extrabold disabled:opacity-50"
                  style={on ? { background: fam.cor, color: '#fff' } : { background: '#fff', color: fam.cor, opacity: ag.todoDia ? 0.45 : 1 }}>
                  {rotulo}
                </button>
              )
            })}
            {/* ⚠️ "última: …" é FATO medido (a contagem mais recente das linhas), e `null`
                (nunca contado) é estado PRÓPRIO — a régua pura escreve a frase. */}
            <span className="text-[11px] font-semibold opacity-75">{ag.ultimaTexto}</span>
            {selo && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide"
                style={{ background: TOM_DA_AGENDA[selo.tom].bg, color: TOM_DA_AGENDA[selo.tom].cor }}>
                {selo.texto}
              </span>
            )}
            {/* ⛔⛔ ATALHO, nunca uma contagem nova: ele LEVA à tela de contagem filtrada pelo
                grupo. A contagem tem porta ÚNICA — nascer uma sessão aqui daria duas verdades
                pra "quem contou e quando". */}
            {selo?.ofereceContarAgora && (
              <Link href={`/empresas/${empresaId}/estoque/contagem?grupo=${encodeURIComponent(ag.slug)}`}
                className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10.5px] font-extrabold uppercase tracking-wide"
                style={{ background: fam.cor, color: '#fff' }}>
                <ClipboardList className="h-3 w-3" /> contar agora
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ⛔ grupo VAZIO não desaparece: ele DIZ que está vazio e oferece o "adicionar item" do
          pé. Sumir com o grupo que o dono acabou de criar é a porta sem maçaneta. */}
      {s.linhas.length === 0 && (
        <p className="px-4 py-3 text-[12.5px]" style={{ color: RADAR.sub }}>
          nenhum item neste grupo ainda — use o <b>adicionar item</b> no pé pra escolher o que você conta aqui
        </p>
      )}

      {/* ── computador: a mesa ─────────────────────────────────────────────── */}
      {/* ⚠️ sem `density-normal` de propósito: o dono especificou o respiro desta mesa
          (~13px por linha, MESA.linhaPy) e esta tela não oferece o seletor de densidade.
          O CSS global segue intocado — aqui só não se consome. */}
      <table className="hidden w-full text-[13px] lg:table">
        <thead>
          <tr style={{ color: RADAR.sub }}>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide">item</th>
            {mostra('inicio') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">início</th>}
            {mostra('entrou') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">entrou</th>}
            {mostra('produziu') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">produzido</th>}
            {mostra('vendeu') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">vendeu</th>}
            {mostra('perdeu') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">perdeu</th>}
            {mostra('outros') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">outros</th>}
            {mostra('teorico') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">teórico</th>}
            {mostra('real') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">real</th>}
            {mostra('variancia') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">variância</th>}
            {mostra('valor') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">R$</th>}
            {mostra('pct') && <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide">%</th>}
          </tr>
        </thead>
        <tbody>
          {s.linhas.map((l, i) => (
            <>
              {/* ⭐⭐ v2 — CADA PRODUTO É UMA FAIXA PRÓPRIA: divisória INTEIRA em cima e
                  embaixo + zebrado na alternada. ⛔ Sem isso a mesa vira "tudo junto" e o
                  olho não separa um item do outro. */}
              <tr key={l.itemId} onClick={() => aoAbrir(l.itemId)} className="cursor-pointer"
                style={{
                  borderTop: `1px solid ${MESA.divisoria}`,
                  borderBottom: `1px solid ${MESA.divisoria}`,
                  background: i % 2 === 0 ? MESA.zebra : '#fff',
                }}>
                <td className="px-3 text-[13px]" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}>
                  <span className="inline-flex items-center gap-1">
                    {aberta === l.itemId ? <ChevronDown className="h-3.5 w-3.5" style={{ color: RADAR.sub }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: RADAR.sub }} />}
                    {/* ⭐ v2 — o NOME é o que ancora a linha: 500 · 13,5px */}
                    <span style={{ color: RADAR.ink, fontSize: MESA.itemFs, fontWeight: MESA.pesoForte }}>{l.nome}</span>
                  </span>
                  {/* ⭐ a JANELA da linha, escrita — duas linhas podem cobrir janelas diferentes */}
                  {l.desde && <span className="ml-1.5 text-[11px]" style={{ color: RADAR.mudo }}>desde {br(l.desde)}</span>}
                </td>
                {mostra('inicio') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.inicio} un={l.unidade} /></td>}
                {mostra('entrou') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.entrou} un={l.unidade} /></td>}
                {mostra('produziu') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.produziu || l.separado} un={l.unidade} /></td>}
                {mostra('vendeu') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.vendeu} un={l.unidade} /></td>}
                {mostra('perdeu') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.perdeu} un={l.unidade} /></td>}
                {/* ⭐⭐ OUTROS — estorno, ajuste de outra contagem e lançamento RETROATIVO.
                    É a coluna que faz a horizontal fechar; sem ela o dono soma no dedo e
                    acha um furo que não existe (o caso da Coca 2L, 02/10). */}
                {mostra('outros') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Qtd v={l.outros} un={l.unidade} /></td>}
                {mostra('teorico') && (
                  <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}>
                    <Qtd v={l.teorico} un={l.unidade} forte />
                    {/* ⛔ a linha que NÃO fecha DIZ — nunca deixa o dono somar no dedo e achar
                        um furo que não é furo (achado na prova em prod: 937 × 934) */}
                    {l.naoExplicado !== 0 && (
                      <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        title="esta janela tem movimento que a conta não explica (lançamento com data fora de ordem, ou ajuste avulso no meio) — toque a linha pra ver"
                        style={{ background: RADAR.ambarBg, color: RADAR.ambar }}>
                        {l.naoExplicado > 0 ? '+' : '−'}{formatarQtd(Math.abs(l.naoExplicado), l.unidade)} s/ explicação
                      </span>
                    )}
                  </td>
                )}
                {mostra('real') && (
                  <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}>
                    {/* ⛔ sem contagem NUNCA vira número — "falta contar" é estado próprio */}
                    {l.real == null
                      ? <span className="text-[12px]" style={{ color: RADAR.mudo, fontWeight: MESA.pesoForte }}>falta contar</span>
                      : <Qtd v={l.real} un={l.unidade} forte />}
                  </td>
                )}
                {mostra('variancia') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Pilula l={l} contaEm={contaEm} /></td>}
                {mostra('valor') && (
                  <td className="px-3 text-right tabular-nums"
                    style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy, color: l.varianciaValor == null ? RADAR.mudo : l.varianciaValor < 0 ? RADAR.coral : RADAR.verde }}>
                    {l.varianciaValor == null ? '—' : brl(Math.abs(l.varianciaValor))}
                  </td>
                )}
                {mostra('pct') && (
                  <td className="px-3 text-right tabular-nums"
                    style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy, color: RADAR.sub }}>
                    {l.pct == null ? '—' : `${(l.pct * 100).toFixed(1)}%`}
                  </td>
                )}
              </tr>
              {aberta === l.itemId && l.conta && (
                <tr key={`${l.itemId}-conta`}>
                  <td colSpan={1 + cols.length} className="p-0">
                    <ContaDePadeiro conta={l.conta} unidade={l.unidade} itemId={l.itemId} empresaId={empresaId} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* ── celular: cards, sem scroll lateral (REGRA 12) ──────────────────── */}
      {/* ⭐ v2 — no celular a separação é a MESMA: faixa por produto (divisória inteira em
          cima e embaixo) + zebrado, e o cabeçalho colorido da seção é o mesmo lá em cima. */}
      <div className="lg:hidden">
        {s.linhas.map((l, i) => (
          <div key={l.itemId}
            style={{
              borderTop: `1px solid ${MESA.divisoria}`,
              borderBottom: `1px solid ${MESA.divisoria}`,
              background: i % 2 === 0 ? MESA.zebra : '#fff',
            }}>
            <button onClick={() => aoAbrir(l.itemId)} className="w-full px-4 text-left"
              style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: RADAR.ink, fontSize: MESA.itemFs, fontWeight: MESA.pesoForte }}>{l.nome}</span>
                <Pilula l={l} contaEm={contaEm} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: RADAR.sub }}>
                {mostra('inicio') && <span>início <b style={{ color: RADAR.ink }}>{formatarQtd(l.inicio, l.unidade)}</b></span>}
                {mostra('entrou') && l.entrou !== 0 && <span>entrou <b style={{ color: RADAR.ink }}>{formatarQtd(l.entrou, l.unidade)}</b></span>}
                {mostra('produziu') && (l.produziu !== 0 || l.separado !== 0) && <span>produzido <b style={{ color: RADAR.ink }}>{formatarQtd(l.produziu || l.separado, l.unidade)}</b></span>}
                {mostra('vendeu') && l.vendeu !== 0 && <span>vendeu <b style={{ color: RADAR.ink }}>{formatarQtd(l.vendeu, l.unidade)}</b></span>}
                {mostra('perdeu') && l.perdeu !== 0 && <span>perdeu <b style={{ color: RADAR.ink }}>{formatarQtd(l.perdeu, l.unidade)}</b></span>}
                {mostra('outros') && l.outros !== 0 && <span>outros <b style={{ color: RADAR.ink }}>{formatarQtd(l.outros, l.unidade)}</b></span>}
                {mostra('teorico') && <span>teórico <b style={{ color: RADAR.ink, fontWeight: MESA.pesoForte }}>{formatarQtd(l.teorico, l.unidade)}</b></span>}
                {l.naoExplicado !== 0 && <span style={{ color: RADAR.ambar }}>⚠️ {formatarQtd(Math.abs(l.naoExplicado), l.unidade)} sem explicação</span>}
                {mostra('real') && <span>real <b style={{ color: l.real == null ? RADAR.mudo : RADAR.ink, fontWeight: MESA.pesoForte }}>{l.real == null ? 'falta contar' : formatarQtd(l.real, l.unidade)}</b></span>}
                {mostra('valor') && l.varianciaValor != null && <span>R$ <b style={{ color: l.varianciaValor < 0 ? RADAR.coral : RADAR.verde }}>{brl(Math.abs(l.varianciaValor))}</b></span>}
              </div>
            </button>
            {aberta === l.itemId && l.conta && (
              <ContaDePadeiro conta={l.conta} unidade={l.unidade} itemId={l.itemId} empresaId={empresaId} />
            )}
          </div>
        ))}
      </div>

      {/* ── RT2: adicionar item — a MESMA porta de membership do Radar ────── */}
      {/* ⛔⛔ O vínculo item↔lista é `stock_radar_item`, a tabela ÚNICA desde 20/09: mexeu
          aqui, valeu no Radar e no Consumo & Compras. Uma 2ª tabela daria DUAS verdades pra
          "quais itens o dono acompanha" — ele poria o FRANGO nos CAROS por esta tela e o Radar
          não saberia.
          ⚠️ O *"tirar"* é da FATIA 2 (chega com o detalhe que expande). Por ora sai pelo ✕ do
          Radar, que já existe — e isso está DITO, não escondido. */}
      {ag && (
        <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${MESA.divisoria}` }}>
          {!adicionando ? (
            <button onClick={() => setAdicionando(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold"
              style={{ background: RADAR.bg, color: fam.cor }}>
              <Plus className="h-3.5 w-3.5" /> adicionar item
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* ⛔ `universo` vem PRONTO do servidor e é obrigatório na busca desde 16/09:
                    foi a ausência dele que pôs ficha de cardápio no seletor da compra. */}
                <BuscaItem
                  companyId={empresaId}
                  universo={ag.universo}
                  jaAdicionados={s.linhas.map((l) => l.itemId)}
                  placeholder="buscar item pra este grupo…"
                  compacto
                  onEscolher={async (it: ItemBusca) => {
                    const ok = await onGesto(
                      { gesto: 'adicionarItem', grupoId: ag.id, itemId: it.id },
                      `item:${ag.id}`,
                    )
                    if (ok) setAdicionando(false)
                  }}
                />
                <button onClick={() => setAdicionando(false)} className="h-8 px-1.5 text-[12px] font-bold"
                  style={{ color: RADAR.sub }}>cancelar</button>
                {gravando === `item:${ag.id}` && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: RADAR.sub }}>
                    <Loader2 className="h-3 w-3 animate-spin" /> gravando…
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: RADAR.mudo }}>
                vale aqui, no Radar e no Consumo &amp; Compras — é a mesma lista. pra <b>tirar</b>, use o ✕ do Radar
              </p>
            </div>
          )}
        </div>
      )}

      {/* ⛔⛔ RT6 — O RODAPÉ FALA QUANTIDADE, E O R$ SAIU DAQUI (22/10/2026).
          "faltou 140 UN · 5 sem contagem": UN≠KG (nunca soma cruzada) e o que falta contar
          fica FORA do total e é DITO. ⭐ O dinheiro do grupo não desapareceu do sistema — a
          reconciliação com o Radar continua em letra miúda no PÉ DA TELA; o que morreu é o R$
          competindo com a quantidade no lugar onde o dono lê "o que falta". */}
      <div className="px-4 py-2 text-[11.5px] font-semibold" style={{ background: fam.bg, color: fam.cor }}>
        └─ {frases.join(' · ')}
      </div>
    </section>
  )
}
