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
import { FlaskConical, Loader2, ChevronDown, ChevronRight, Columns3, Search, X, Download } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { RADAR, TOM, FAMILIA, MESA } from '@/components/estoque/radar-tokens'
import { ContaDePadeiro } from '@/components/estoque/radar/conta-de-padeiro'
import { formatarQtd } from '@/lib/stock/quantidade'
import { casaBusca } from '@/lib/busca-texto'
import type { SecaoDaMesa, LinhaDaMesa, ChaveColuna } from '@/lib/stock/radar/mesa'
import { frasesDoRodape } from '@/lib/stock/radar/mesa'
import type { ChavePeriodo } from '@/lib/stock/radar/periodo'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const hojeBR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

type Estado = 'CARREGANDO' | 'FALHOU' | 'OK'

interface Coluna { chave: ChaveColuna; rotulo: string; ajuda: string; tipo: string; padrao: boolean }
interface Payload {
  janela: { chave: ChavePeriodo; de: string; ate: string; rotulo: string }
  secoes: SecaoDaMesa[]
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
 * ⭐ A PÍLULA DO VEREDITO — quantidade primeiro, dinheiro depois (decisão do dono, v1.3 do
 * Radar). ⛔ E os degraus são os MESMOS: o `veredito` vem decidido do servidor.
 */
function Pilula({ l }: { l: LinhaDaMesa }) {
  const tom = TOM[l.veredito] ?? { bg: RADAR.mudoBg, cor: RADAR.mudo }
  const texto = l.variancia == null
    ? 'falta contar'
    : l.veredito === 'BATEU'
      ? 'bateu'
      : `${l.variancia < 0 ? 'faltou' : 'sobrou'} ${formatarQtd(Math.abs(l.variancia), l.unidade)}`
  return (
    // ⭐ v2: a pílula cresceu (4px 10px · 12,5px) — é o veredito, o que o olho procura
    <span className="inline-flex items-center rounded-full font-bold"
      style={{ background: tom.bg, color: tom.cor, padding: `${MESA.pilulaPy} ${MESA.pilulaPx}`, fontSize: MESA.pilulaFs }}>
      {texto}
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

  const cols = colunas ?? []
  const mostra = (c: ChaveColuna) => cols.includes(c)
  const disponiveis = dados?.colunasDisponiveis ?? []
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

          {dados.secoes.map((s) => (
            <Secao key={s.chave} s={s} cols={cols} mostra={mostra} empresaId={empresaId}
              aberta={linhaAberta} aoAbrir={(id) => setLinhaAberta((a) => (a === id ? null : id))} />
          ))}

          {/* ── o resumo do rodapé ───────────────────────────────────────────── */}
          <div className="mt-3 rounded-[14px] px-4 py-3 text-[12.5px]"
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

function Secao({ s, cols, mostra, empresaId, aberta, aoAbrir }: {
  s: SecaoDaMesa; cols: ChaveColuna[]; mostra: (c: ChaveColuna) => boolean
  empresaId: string; aberta: string | null; aoAbrir: (id: string) => void
}) {
  if (!s.linhas.length) return null
  const frases = frasesDoRodape(s.total)
  const fam = FAMILIA[s.chave]
  return (
    <section className="mb-3 overflow-hidden rounded-[16px]" style={{ background: '#fff', boxShadow: RADAR.sombra }}>
      {/* ⭐⭐ v2 — A FAIXA COLORIDA DA FAMÍLIA. Ícone e texto no tom escuro DELA, e o
          subtotal lá embaixo repete este mesmo fundo (FAMILIA é o dono único dos dois). */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: fam.bg, color: fam.cor }}>
        <span className="text-[15px]">{s.icone}</span>
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide">{s.titulo}</h2>
        <span className="text-[11.5px] font-semibold opacity-75">{s.linhas.length} item(ns)</span>
      </div>

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
                {mostra('variancia') && <td className="px-3 text-right" style={{ paddingTop: MESA.linhaPy, paddingBottom: MESA.linhaPy }}><Pilula l={l} /></td>}
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
                <Pilula l={l} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: RADAR.sub }}>
                {mostra('inicio') && <span>início <b style={{ color: RADAR.ink }}>{formatarQtd(l.inicio, l.unidade)}</b></span>}
                {mostra('entrou') && l.entrou !== 0 && <span>entrou <b style={{ color: RADAR.ink }}>{formatarQtd(l.entrou, l.unidade)}</b></span>}
                {mostra('produziu') && (l.produziu !== 0 || l.separado !== 0) && <span>produzido <b style={{ color: RADAR.ink }}>{formatarQtd(l.produziu || l.separado, l.unidade)}</b></span>}
                {mostra('vendeu') && l.vendeu !== 0 && <span>vendeu <b style={{ color: RADAR.ink }}>{formatarQtd(l.vendeu, l.unidade)}</b></span>}
                {mostra('perdeu') && l.perdeu !== 0 && <span>perdeu <b style={{ color: RADAR.ink }}>{formatarQtd(l.perdeu, l.unidade)}</b></span>}
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

      {/* ⛔ o rodapé honesto: UN≠KG, e o que falta contar fica FORA e é DITO */}
      <div className="px-4 py-2 text-[11.5px] font-semibold" style={{ background: fam.bg, color: fam.cor }}>
        └─ {frases.join(' · ')}
        {s.total.faltouValor > 0 && <span className="opacity-80"> · {brl(s.total.faltouValor)}</span>}
      </div>
    </section>
  )
}
