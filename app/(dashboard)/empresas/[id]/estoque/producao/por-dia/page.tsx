'use client'

/**
 * ⭐⭐⭐ RELATÓRIO DE PRODUÇÃO POR DIA — VISUAL MERCURY/STRIPE (04/10/2026).
 *
 * **Pedido do dono:** *"Mercury = calma editorial, Stripe = tabela financeira. Texto principal
 * ESCURO de verdade, nada de cinza lavado; números em fonte TABULAR à direita; linhas separadas
 * com respiro; eficiência em pílula; QUEM com avatar; TOTAL DO DIA no rodapé. Clicar na linha
 * expande «o que saiu do estoque pra esta ordem»."*
 *
 * ⛔⛔ **ZERO CONTA NOVA — a ordem foi literal: *"só vestir a tela que já existe"*.** Todo número
 * vem de `relatorioPorDia` (que traduz `lotesDaJanela` + a eficiência CONGELADA do juiz P8) e o
 * bloco que abre vem de `consumoDaOrdem` — o MESMO leitor que a tela de eficiência da ordem usa.
 * ⚠️ É por isso que o **TOTAL DO DIA** desenha `d.produzido`/`d.separadoReais`/`d.eficienciaMedia`
 * do SERVIDOR em vez de somar as linhas aqui: Σ na tela seria a segunda derivação, e o rodapé
 * passaria a poder dizer um número que as linhas acima não somam.
 *
 * ⭐ **TOKENS NUM LUGAR SÓ, e ESCOPADOS:** o `[data-tela='producao-por-dia']` do `globals.css`
 * declara `--prod-*` com os valores do RADAR (uma paleta) **e um espelho escuro**. Escopado
 * porque o dark global é sprint próprio (decisão de 20/09: `darkMode:['class']` e ninguém liga a
 * classe) — pintar app-wide aqui mudaria 107 arquivos sem ninguém pedir.
 *
 * ⚠️ Esta tela SAI do `density-normal` de propósito (o dono especificou o respiro dela: ~13px e
 * divisória de 1px). O CSS global segue intocado — aqui só não se consome, como a Mesa v2.
 */

import { Fragment, useCallback, useEffect, useMemo, useState, use } from 'react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { casaBusca } from '@/lib/busca-texto'
import { formatBRL } from '@/lib/format/money'
import { formatarDuracao } from '@/lib/format/duracao'
import { formatarQtd } from '@/lib/stock/quantidade'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { AvatarPessoa } from '@/components/estoque/avatar-pessoa'
import { faixaDoSelo } from '@/lib/stock/producao/eficiencia-da-ordem'
import { BarChart3, ChevronRight, Eye, EyeOff, Loader2, Search, X } from 'lucide-react'

/**
 * ⚠️⚠️ **DERIVADO DA LIB, não reescrito à mão.** A 1ª versão declarou
 * `{ porUnidade: Record<string, number>; frase: string }` — e a forma real é
 * `{ porUnidade: {unidade,qtd}[]; total; unidade; mista; texto }`. O `tsc` ficou **VERDE**
 * porque interface de tela não tem vínculo com o tipo do servidor; quem pegou foi o TESTE.
 * É a dívida registrada em 01/09: *interface escrita à mão sobre payload é promessa, não prova*.
 */
import type { Quantidade } from '@/lib/stock/producao/desempenho'
// ⭐ a frase do pedido tem DONO: "pedido 0" leria como "pedi zero" (achado na prova em prod)
import { textoDoPedido } from '@/lib/stock/producao/relatorio-por-dia'

interface Linha {
  ordemId: string; dia: string; tarefa: string; unidade: string
  pedido: number | null; produzido: number; pctDoPedido: number | null
  seloDoPedido: 'OK' | 'BAIXO' | 'ALTO' | 'SEM_META'
  eficiencia: number | null; separadoReais: number | null
  minutos: number | null; relampago: boolean
  setor: string | null; quemConcluiu: string | null
}
interface Dia {
  dia: string; lotes: number; pedido: Quantidade; produzido: Quantidade; semPedido: number
  eficienciaMedia: number | null; lotesComEficiencia: number; separadoReais: number
  minutos: number | null; semTempo: number; relampagos: number
  setores: string[]; encerrouAs: string | null
}
interface PorReceita {
  tarefa: string; unidade: string; lotes: number; pedido: Quantidade; produzido: Quantidade
  semPedido: number; pctMedio: number | null; eficienciaMedia: number | null
  separadoReais: number; minutosPorLote: number | null; semTempo: number; relampagos: number
}
/** uma receita que produziu no período — o que o SELETOR oferece */
interface ReceitaDoPeriodo { itemId: string; tarefa: string; lotes: number; oculta: boolean }
interface Payload {
  linhas: Linha[]; dias: Dia[]; porReceita: PorReceita[]; vazio: boolean
  /** ⭐ a lista COMPLETA (antes de esconder) + quantas estão sendo escondidas DESTA vista */
  receitasDoPeriodo: ReceitaDoPeriodo[]; ocultasNoPeriodo: number
  periodo: { de: string; ate: string }
  filtros: { tarefas: string[]; setores: string[]; pessoas: string[] }
}

/** o payload do bloco que abre — ⛔ a soma e o "bate" vêm do SERVIDOR, não daqui */
interface ConsumoLinha {
  itemId: string; nome: string; unidade: string
  quantidade: number; custoUnitario: number | null; custoTotal: number
}
interface Consumo {
  ordemId: string; linhas: ConsumoLinha[]; total: number
  custoLoteReal: number | null; bate: boolean | null; vazio: boolean
}

const PILULAS = [
  { chave: 'HOJE', rotulo: 'hoje', dias: 0 },
  { chave: 'SETE', rotulo: '7 dias', dias: -6 },
  { chave: 'MES', rotulo: '30 dias', dias: -29 },
] as const
type Chave = (typeof PILULAS)[number]['chave'] | 'LIVRE'

const dia = (iso: string) => iso.split('-').reverse().join('/')
/**
 * ⚠️ `null` é "não dá pra dizer", nunca "0 min" — a régua do tempo medido (13/09).
 * ⛔ E o h/min vem do `formatarDuracao`: era aqui que o float vazava (`201.83 % 60` =
 * 21.830000000000013, o "3h21.830000000000013" do print).
 */
const min = (m: number | null) => (m == null ? 'a apurar' : formatarDuracao(m))
/** ⛔ dinheiro pelo formatador da casa — `formatBRL` já traz o R$ (a cicatriz do "R$ R$") */
const brl = (n: number | null) => (n == null ? '—' : formatBRL(n))

/**
 * ⭐⭐ O SELO DA EFICIÊNCIA — a tela **só pinta**; quem decide o degrau é `faixaDoSelo`, que lê
 * as duas constantes da casa (`DESVIO_ALERTA` do P8/P3 e o `DESVIO_GRAVE` do P3).
 *
 * ⚠️⚠️ **MUDANÇA DELIBERADA vs 03/10, com o motivo escrito:** naquele dia o ACIMA era AZUL
 * (*"render acima do prometido não é prejuízo — é ficha generosa"*). O dono pediu agora
 * **VERMELHO com ⚠ nos extremos**, citando os *205% do frango frito* — e ele está certo pro
 * extremo: 205% não é generosidade da ficha, é a quantidade declarada não fechando com o
 * consumo (foi exatamente o que as 2 conclusões outlier de 27 e 29/09 mostraram). O
 * **moderado acima** (115–125%) fica ÂMBAR, não vermelho: ali ainda cabe perda de trim.
 * ⛔ O **e-mail do P8 não mudou** — ele segue alertando só o lado de baixo; o que mudou é a cor.
 */
function selo(pct: number | null) {
  const faixa = faixaDoSelo(pct == null ? null : pct * 100)
  if (faixa === 'SEM_PEDIDO') return { bg: 'var(--prod-mudo-bg)', cor: 'var(--prod-mudo)', texto: 'a apurar' }
  const n = `${Math.round(pct! * 100)}%`
  if (faixa === 'DENTRO') return { bg: 'var(--prod-verde-bg)', cor: 'var(--prod-verde)', texto: n }
  if (faixa === 'FORA') return { bg: 'var(--prod-ambar-bg)', cor: 'var(--prod-ambar)', texto: n }
  return { bg: 'var(--prod-coral-bg)', cor: 'var(--prod-coral)', texto: `⚠ ${n}` }
}

function Pilula({ pct }: { pct: number | null }) {
  const s = selo(pct)
  return (
    <span className="num inline-flex rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold" style={{ background: s.bg, color: s.cor }}>
      {s.texto}
    </span>
  )
}

/** o cabeçalho de coluna — o único lugar onde maiúscula com tracking é bem-vinda */
function Th({ children, dir = 'right' }: { children: React.ReactNode; dir?: 'left' | 'right' }) {
  return (
    <th
      className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide ${dir === 'left' ? 'text-left' : 'text-right'}`}
      style={{ color: 'var(--prod-muted)' }}
    >
      {children}
    </th>
  )
}

/**
 * ⭐⭐ "O QUE SAIU DO ESTOQUE PRA ESTA ORDEM" — o bloco que a linha abre (padrão Stripe).
 *
 * ⛔ **Ele NÃO busca nada.** Recebe o estado já carregado por prop e desenha. É deliberado: um
 * `useEffect` que busca dentro de componente que nasce a cada render é a bomba do laço de
 * 20 req/s de 14/09 — aqui a busca é do GESTO (o toque que abre), nunca de dependência.
 *
 * ⚠️ E a soma do rodapé é a **do servidor** (`total`), com o `bate` já resolvido lá: a tela não
 * tem como *"achar que bate"*. Recalcular aqui seria a fonte paralela que a ordem proíbe.
 */
function BlocoDoConsumo({ estado, href }: { estado: Consumo | null | 'carregando'; href: string }) {
  if (estado === 'carregando') {
    return (
      <p className="flex items-center gap-2 px-3 py-3 text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> lendo o que saiu do estoque…
      </p>
    )
  }
  if (estado === null) {
    return (
      <p className="px-3 py-3 text-[12.5px]" style={{ color: 'var(--prod-ambar)' }}>
        Não consegui carregar o que saiu do estoque desta ordem. Toque de novo pra tentar.
      </p>
    )
  }
  return (
    <div className="px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
        O que saiu do estoque pra esta ordem
      </p>

      {/* ⚠️ ordem sem consumo lançado NÃO é "R$ 0,00" — é ordem que ainda não consumiu nada */}
      {estado.vazio ? (
        <p className="text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
          Nenhum consumo lançado nesta ordem.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr>
                <Th dir="left">produto</Th>
                <Th>quantidade</Th>
                <Th>custo médio</Th>
                <Th>total</Th>
              </tr>
            </thead>
            <tbody>
              {estado.linhas.map((c) => (
                <tr key={c.itemId} style={{ borderTop: '1px solid var(--prod-line)' }}>
                  <td className="px-3 py-2 text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>{c.nome}</td>
                  {/* ⛔ a quantidade na unidade DO ITEM, pelo formatador da casa (KG<1 vira grama) */}
                  <td className="num px-3 py-2 text-right text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
                    {formatarQtd(c.quantidade, c.unidade)}
                  </td>
                  <td className="num px-3 py-2 text-right text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>{brl(c.custoUnitario)}</td>
                  <td className="num px-3 py-2 text-right text-[12.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>{brl(c.custoTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ borderTop: '1px solid var(--prod-line-strong)', paddingTop: 8 }}>
        <p className="num text-[12.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
          {estado.linhas.length} {estado.linhas.length === 1 ? 'produto' : 'produtos'} · {brl(estado.total)}
          {/* ⭐ o ✓ sai do `bate` do SERVIDOR, conferido contra o custoLoteReal da conclusão */}
          {estado.bate === true && <span className="ml-1" style={{ color: 'var(--prod-verde)' }}>✓</span>}
        </p>
        {estado.bate === false && (
          <p className="num text-[12px]" style={{ color: 'var(--prod-ambar)' }}>
            difere do «saiu do estoque» da ordem ({brl(estado.custoLoteReal)}) — vale conferir
          </p>
        )}
        <a href={href} className="ml-auto text-[12.5px] font-medium underline" style={{ color: 'var(--prod-accent)' }}>
          abrir a ordem →
        </a>
      </div>
    </div>
  )
}

export default function RelatorioPorDiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hojeBR = diaEmSaoPaulo()
  const [chave, setChave] = useState<Chave>('SETE')
  const [de, setDe] = useState(somarDias(hojeBR, -6))
  const [ate, setAte] = useState(hojeBR)
  const [tarefa, setTarefa] = useState<string | null>(null)
  const [setor, setSetor] = useState<string | null>(null)
  const [quem, setQuem] = useState<string | null>(null)
  const [abrirTarefas, setAbrirTarefas] = useState(false)
  const [buscaTarefa, setBuscaTarefa] = useState('')
  const [data, setData] = useState<Payload | null | undefined>(undefined)
  /**
   * ⚠️ **O estado NÃO PERSISTE, por pedido do dono** (*"abre fechada"*) — e várias podem estar
   * abertas ao mesmo tempo, então é um mapa, não um id só.
   */
  const [abertas, setAbertas] = useState<Record<string, boolean>>({})
  const [consumo, setConsumo] = useState<Record<string, Consumo | null | 'carregando'>>({})
  /** o painel "o que eu vejo" — a escolha mora em TABELA, isto é só a gaveta aberta */
  const [abrirReceitas, setAbrirReceitas] = useState(false)
  const [buscaReceita, setBuscaReceita] = useState('')
  const [salvandoPref, setSalvandoPref] = useState(false)
  const [erroPref, setErroPref] = useState<string | null>(null)

  const aplicarPilula = (c: typeof PILULAS[number]) => {
    setChave(c.chave)
    setDe(somarDias(hojeBR, c.dias))
    setAte(hojeBR)
  }

  const carregar = useCallback(() => {
    const q = new URLSearchParams({ de, ate })
    if (tarefa) q.set('tarefa', tarefa)
    if (setor) q.set('setor', setor)
    if (quem) q.set('quem', quem)
    setData(undefined)
    return fetchComTimeout<Payload>(`/api/empresas/${id}/estoque/producao/relatorio-por-dia?${q}`)
      .then((r) => setData(r.ok ? r.data! : null))
      .catch(() => setData(null))
  }, [id, de, ate, tarefa, setor, quem])

  useEffect(() => { void carregar() }, [carregar])

  /**
   * ⭐ O TOGGLE — busca **sob demanda**, e só na 1ª abertura (o resultado fica em cache no
   * estado). ⛔ Carregar o consumo das 364 ordens junto do relatório é como o badge virou
   * 1,3 s em 11/09.
   * ⚠️ Falha anterior é re-tentada: `null` em cache voltaria a mostrar o erro pra sempre.
   */
  const alternar = useCallback((ordemId: string) => {
    setAbertas((a) => ({ ...a, [ordemId]: !a[ordemId] }))
    setConsumo((c) => {
      if (c[ordemId] && c[ordemId] !== null) return c
      void fetchComTimeout<Consumo>(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/consumo`)
        .then((r) => setConsumo((p) => ({ ...p, [ordemId]: r.ok ? r.data! : null })))
        .catch(() => setConsumo((p) => ({ ...p, [ordemId]: null })))
      return { ...c, [ordemId]: 'carregando' }
    })
  }, [id])

  /**
   * ⭐⭐ SALVA A ESCOLHA e RECARREGA — nessa ordem, e as duas coisas importam.
   *
   * ⛔ Manda **DELTA**, nunca a lista inteira: o painel só conhece as receitas do período
   * ABERTO, e substituir apagaria em silêncio o que o dono escondeu num período que não está
   * na tela (ver o PUT da rota).
   * ⛔ E recarrega porque os TOTAIS mudam — esconder só no desenho deixaria o subtotal somando
   * lote que a tela não mostra, e o guard `Σ(linhas) == total` pararia de fechar.
   * ⚠️ Falha NUNCA é silenciosa: o painel diz que não salvou (senão o dono clica, vê a tela
   * mudar pelo reload que não aconteceu, e acha que gravou).
   */
  const salvarPref = useCallback(async (delta: { ocultar?: string[]; mostrar?: string[] }) => {
    setSalvandoPref(true); setErroPref(null)
    const r = await fetchComTimeout<{ ocultas: string[] }>(
      `/api/empresas/${id}/estoque/producao/relatorio-por-dia`,
      { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(delta) },
    ).catch(() => ({ ok: false } as { ok: boolean }))
    setSalvandoPref(false)
    if (!r.ok) { setErroPref('Não consegui salvar a escolha — tente de novo.'); return }
    await carregar()
  }, [id, carregar])

  /** ⭐ a busca da casa: palavra em qualquer ordem, sem caixa e sem acento (08/09) */
  const tarefasFiltradas = useMemo(
    // ⚠️ `casaBusca(texto, termo)` — o NOME da receita é o palheiro, o digitado é a agulha.
    // Invertido, ele procuraria o nome da receita DENTRO do que o dono digitou (sempre falso).
    () => (data?.filtros.tarefas ?? []).filter((t) => casaBusca(t, buscaTarefa)),
    [data?.filtros.tarefas, buscaTarefa],
  )

  /** ⚠️ a MESMA `casaBusca` dos chips de receita — uma régua de busca, não duas */
  const receitasFiltradas = useMemo(
    () => (data?.receitasDoPeriodo ?? []).filter((r) => casaBusca(r.tarefa, buscaReceita)),
    [data?.receitasDoPeriodo, buscaReceita],
  )

  const linhasPorDia = useMemo(() => {
    const m = new Map<string, Linha[]>()
    for (const l of data?.linhas ?? []) m.set(l.dia, [...(m.get(l.dia) ?? []), l])
    return m
  }, [data?.linhas])

  const ordemHref = (ordemId: string) => `/empresas/${id}/estoque/producao/${ordemId}`
  /**
   * ⭐ O SUFIXO DA HONESTIDADE — *"se houver ocultas, o total ganha «(das visíveis)»"*.
   * ⚠️ Sem ele o dono compararia o total de hoje com o de ontem sem saber que a régua mudou.
   */
  const ocultas = data?.ocultasNoPeriodo ?? 0
  const suf = ocultas > 0 ? ' (das visíveis)' : ''

  return (
    <div
      data-tela="producao-por-dia"
      style={{ background: 'var(--prod-bg)' }}
      className="-mx-4 -my-6 min-h-screen px-4 py-6 lg:-mx-6 lg:px-6"
    >
      {/* ── cabeçalho ───────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BarChart3 className="h-5 w-5 shrink-0" style={{ color: 'var(--prod-accent)' }} />
        <h1 className="text-[15px] font-semibold" style={{ color: 'var(--prod-primary)' }}>Produção por dia</h1>
        <p className="hidden flex-1 truncate text-[12px] lg:block" style={{ color: 'var(--prod-muted)' }}>
          pedido · o que saiu do estoque · produzido · eficiência · tempo — toque na linha pra ver os produtos
        </p>
      </div>

      {/* ── filtros ─────────────────────────────────────────────────────────── */}
      <div
        className="mb-4 flex flex-wrap items-center gap-1.5 rounded-[14px] p-2"
        style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}
      >
        {PILULAS.map((p) => (
          <button
            key={p.chave}
            onClick={() => aplicarPilula(p)}
            className="h-8 rounded-full px-3 text-[12.5px] font-semibold"
            style={chave === p.chave
              ? { background: 'var(--prod-accent)', color: '#fff' }
              : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
          >
            {p.rotulo}
          </button>
        ))}
        {/* ⭐ período LIVRE — *"escolho dia 25 do mês passado"* (o calendário do Real×Teórico) */}
        <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: chave === 'LIVRE' ? 'var(--prod-surface-2)' : 'var(--prod-surface-1)' }}>
          <input
            type="date" value={de} max={hojeBR}
            onChange={(e) => { setDe(e.target.value); setChave('LIVRE') }}
            className="num h-6 bg-transparent text-[12px] font-medium outline-none" style={{ color: 'var(--prod-primary)' }}
          />
          <span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>até</span>
          <input
            type="date" value={ate} max={hojeBR}
            onChange={(e) => { setAte(e.target.value); setChave('LIVRE') }}
            className="num h-6 bg-transparent text-[12px] font-medium outline-none" style={{ color: 'var(--prod-primary)' }}
          />
        </div>

        {/* receita (chips com busca) */}
        <button
          onClick={() => setAbrirTarefas((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold"
          style={tarefa
            ? { background: 'var(--prod-accent)', color: '#fff' }
            : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
        >
          <Search className="h-3.5 w-3.5" /> {tarefa ?? 'receita'}
        </button>
        {/**
          * ⭐⭐ "RECEITAS (N)" — a escolha do dono sobre o que ele VÊ (pedido de 04/10).
          * ⚠️ O botão fica ACESO quando há oculta: *tela que filtra tem que PARECER que filtra*
          * — senão o dono procura um preparo que ele mesmo escondeu semanas atrás.
          */}
        {(data?.receitasDoPeriodo.length ?? 0) > 0 && (
          <button
            onClick={() => setAbrirReceitas((v) => !v)}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold"
            style={(data?.ocultasNoPeriodo ?? 0) > 0
              ? { background: 'var(--prod-accent)', color: '#fff' }
              : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
          >
            <Eye className="h-3.5 w-3.5" />
            receitas ({data!.receitasDoPeriodo.length - data!.ocultasNoPeriodo})
          </button>
        )}
        {/**
          * ⚠️ setor e pessoa saem da PRÓPRIA lista do período (a rota devolve). Oferecer um
          * setor que não produziu nada ali é oferecer um filtro que devolve vazio.
          */}
        {(data?.filtros.setores.length ?? 0) > 0 && (
          <select
            value={setor ?? ''} onChange={(e) => setSetor(e.target.value || null)}
            className="h-8 rounded-full px-3 text-[12.5px] font-semibold outline-none"
            style={setor
              ? { background: 'var(--prod-accent)', color: '#fff' }
              : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
          >
            <option value="">setor</option>
            {data!.filtros.setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(data?.filtros.pessoas.length ?? 0) > 0 && (
          <select
            value={quem ?? ''} onChange={(e) => setQuem(e.target.value || null)}
            className="h-8 rounded-full px-3 text-[12.5px] font-semibold outline-none"
            style={quem
              ? { background: 'var(--prod-accent)', color: '#fff' }
              : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
          >
            <option value="">quem concluiu</option>
            {data!.filtros.pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {(tarefa || setor || quem) && (
          <button
            onClick={() => { setTarefa(null); setSetor(null); setQuem(null) }}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px]"
            style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
          >
            <X className="h-3.5 w-3.5" /> limpar
          </button>
        )}
      </div>

      {abrirTarefas && (
        <div className="mb-4 rounded-[14px] p-2.5" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          <input
            value={buscaTarefa} onChange={(e) => setBuscaTarefa(e.target.value)}
            placeholder="buscar receita… (ex: coxao porcao)"
            className="mb-2 h-8 w-full rounded-lg px-2.5 text-[12.5px] outline-none"
            style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
          />
          <div className="flex flex-wrap gap-1.5">
            {tarefasFiltradas.map((t) => (
              <button
                key={t}
                onClick={() => { setTarefa(t === tarefa ? null : t); setAbrirTarefas(false) }}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                style={t === tarefa
                  ? { background: 'var(--prod-accent)', color: '#fff' }
                  : { background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
              >
                {t}
              </button>
            ))}
            {!tarefasFiltradas.length && (
              <p className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                nada com «{buscaTarefa}» entre as {data?.filtros.tarefas.length ?? 0} receitas que produziram neste período
              </p>
            )}
          </div>
        </div>
      )}


      {/**
        * ⭐⭐ O PAINEL "O QUE EU VEJO" — lista completa do período, busca e marcar/desmarcar.
        *
        * ⛔ A lista vem de `receitasDoPeriodo` (a COMPLETA, antes de esconder). Derivá-la das
        * linhas desenhadas tiraria a receita oculta do próprio painel que existe pra
        * desocultá-la — *esconder o gesto de desfazer é como escolha reversível vira permanente*.
        * ⚠️ Ordenada por LOTES (a rota devolve assim): o preparo miúdo que ele quer esconder cai
        * no fim sozinho, e o que mais produziu fica à mão.
        */}
      {abrirReceitas && data && data.receitasDoPeriodo.length > 0 && (
        <div className="mb-4 rounded-[14px] p-2.5" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
              o que aparece no relatório · {data.receitasDoPeriodo.length - data.ocultasNoPeriodo} de {data.receitasDoPeriodo.length}
            </p>
            {/* ⚠️ "todas/nenhuma" age SÓ sobre o que está na tela — só se decide sobre o que se vê */}
            <button
              disabled={salvandoPref}
              onClick={() => void salvarPref({ mostrar: data.receitasDoPeriodo.map((r) => r.itemId) })}
              className="h-7 rounded-full px-2.5 text-[12px] font-medium disabled:opacity-40"
              style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
            >
              todas
            </button>
            <button
              disabled={salvandoPref}
              onClick={() => void salvarPref({ ocultar: data.receitasDoPeriodo.map((r) => r.itemId) })}
              className="h-7 rounded-full px-2.5 text-[12px] font-medium disabled:opacity-40"
              style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
            >
              nenhuma
            </button>
          </div>

          <input
            value={buscaReceita} onChange={(e) => setBuscaReceita(e.target.value)}
            placeholder="buscar receita… (ex: tomate picado)"
            className="mb-2 h-8 w-full rounded-lg px-2.5 text-[12.5px] outline-none"
            style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }}
          />

          <div className="flex flex-wrap gap-1.5">
            {receitasFiltradas.map((r) => (
              <button
                key={r.itemId}
                disabled={salvandoPref}
                onClick={() => void salvarPref(r.oculta ? { mostrar: [r.itemId] } : { ocultar: [r.itemId] })}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium disabled:opacity-40"
                style={r.oculta
                  ? { background: 'transparent', color: 'var(--prod-muted)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }
                  : { background: 'var(--prod-surface-2)', color: 'var(--prod-primary)' }}
                title={r.oculta ? 'está oculta — toque pra mostrar' : 'aparece — toque pra esconder'}
              >
                {r.oculta ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {r.tarefa}
                <span className="num" style={{ color: 'var(--prod-muted)' }}>{r.lotes}</span>
              </button>
            ))}
            {!receitasFiltradas.length && (
              <p className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                nada com «{buscaReceita}» entre as {data.receitasDoPeriodo.length} receitas do período
              </p>
            )}
          </div>

          {/* ⛔ falha de gravação NUNCA em silêncio: o dono clicou e precisa saber se pegou */}
          {erroPref && <p className="mt-2 text-[12px]" style={{ color: 'var(--prod-ambar)' }}>{erroPref}</p>}
        </div>
      )}

      {data === undefined && (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--prod-muted)' }}>
          <Loader2 className="h-4 w-4 animate-spin" /> lendo a produção…
        </p>
      )}
      {/* ⛔ erro e vazio NUNCA juntos: sem a carga, o sistema não SABE se está vazio (09/09) */}
      {data === null && (
        <div className="rounded-[14px] p-4" style={{ background: 'var(--prod-ambar-bg)' }}>
          <p className="text-[13px]" style={{ color: 'var(--prod-ambar)' }}>Não consegui carregar o relatório.</p>
          <button onClick={() => void carregar()} className="mt-1 text-[12px] underline" style={{ color: 'var(--prod-ambar)' }}>
            tentar de novo
          </button>
        </div>
      )}
      {/* ⚠️ o vazio DIZ o recorte — "sem produção" seco faria o dono achar que o dado sumiu */}
      {data && data.vazio && (
        <div className="rounded-[14px] p-6 text-center" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          <p className="text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>Sem produção neste recorte.</p>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--prod-muted)' }}>
            {dia(data.periodo.de)} a {dia(data.periodo.ate)}
            {tarefa ? ` · receita «${tarefa}»` : ''}{setor ? ` · setor ${setor}` : ''}{quem ? ` · concluído por ${quem}` : ''}
          </p>
        </div>
      )}

      {data && !data.vazio && (
        <>
          {/* ── por receita no período ─────────────────────────────────────── */}
          <div className="mb-4 rounded-[14px] p-3" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>
              por receita · {dia(data.periodo.de)} a {dia(data.periodo.ate)}{suf}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <Th dir="left">receita</Th>
                    <Th>lotes</Th><Th>pedido</Th><Th>produzido</Th>
                    <Th>% do pedido</Th><Th>eficiência</Th><Th>tempo/lote</Th><Th>saiu do estoque</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.porReceita.map((r) => (
                    <tr key={r.tarefa} style={{ borderTop: '1px solid var(--prod-line)' }} className="hover:bg-[var(--prod-surface-1)]">
                      <td className="px-3 py-[13px] text-[13.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                        {r.tarefa}
                        {/* ⚠️ "sem pedido" em MUTED — informação de ordem antiga não grita */}
                        {r.semPedido > 0 && (
                          <span className="ml-1.5 text-[11.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>
                            ({r.semPedido} sem pedido)
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{r.lotes}</td>
                      {/* ⛔ a frase vem do servidor (`somarQuantidades`): UN e KG nunca viram um número só */}
                      <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{textoDoPedido(r.pedido, r.semPedido, r.lotes)}</td>
                      <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>{r.produzido.texto}</td>
                      <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
                        {r.pctMedio == null ? 'sem pedido' : `${Math.round(r.pctMedio)}%`}
                      </td>
                      <td className="px-3 py-[13px] text-right"><Pilula pct={r.eficienciaMedia} /></td>
                      <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
                        {min(r.minutosPorLote)}
                        {r.semTempo > 0 && <span className="ml-1 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>({r.semTempo} sem tempo)</span>}
                      </td>
                      <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{brl(r.separadoReais)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── dia por dia ────────────────────────────────────────────────── */}
          {data.dias.map((d) => (
            <div key={d.dia} className="mb-4 rounded-[14px] p-3" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
              {/**
                * ⭐⭐ CABEÇALHO DO DIA (Mercury): data GRANDE e ESCURA, subtítulo com o contexto,
                * e os 3 cartões de resumo em fundo surface SUAVE, SEM borda — o pedido do dono.
                */}
              <div className="mb-3">
                <p className="num text-[22px] font-medium leading-tight" style={{ color: 'var(--prod-primary)' }}>{dia(d.dia)}</p>
                <p className="mt-0.5 text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                  {d.lotes} {d.lotes === 1 ? 'ordem' : 'ordens'}
                  {d.setores.length > 0 && ` · ${d.setores.join(', ')}`}
                  {d.encerrouAs && ` · encerrou às ${d.encerrouAs}`}
                  {d.semPedido > 0 && (
                    <span style={{ color: 'var(--prod-muted)' }}> · {d.semPedido} sem pedido</span>
                  )}
                </p>

                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {/* ⛔ os 3 cartões leem o subtotal DO SERVIDOR — nenhuma Σ nasce aqui */}
                  <div className="rounded-xl px-3 py-2" style={{ background: 'var(--prod-surface-1)' }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>produzido</p>
                    <p className="num mt-0.5 text-[15px] font-medium" style={{ color: 'var(--prod-primary)' }}>{d.produzido.texto}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ background: 'var(--prod-surface-1)' }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>saiu do estoque</p>
                    <p className="num mt-0.5 text-[15px] font-medium" style={{ color: 'var(--prod-primary)' }}>{brl(d.separadoReais)}</p>
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ background: 'var(--prod-surface-1)' }}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-muted)' }}>eficiência</p>
                    <div className="mt-0.5"><Pilula pct={d.eficienciaMedia} /></div>
                    {d.lotesComEficiencia > 0 && d.lotesComEficiencia < d.lotes && (
                      <p className="num mt-0.5 text-[10.5px]" style={{ color: 'var(--prod-muted)' }}>de {d.lotesComEficiencia} de {d.lotes}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── DESKTOP: tabela ─── */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr>
                      <Th dir="left">receita</Th>
                      <Th>pedido</Th><Th>produzido</Th><Th>eficiência</Th><Th>tempo</Th><Th>saiu do estoque</Th>
                      <Th dir="left">quem</Th>
                      <Th> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(linhasPorDia.get(d.dia) ?? []).map((l) => (
                      <Fragment key={l.ordemId}>
                        <tr
                          onClick={() => alternar(l.ordemId)}
                          className="cursor-pointer hover:bg-[var(--prod-surface-1)]"
                          style={{ borderTop: '1px solid var(--prod-line)' }}
                          aria-expanded={!!abertas[l.ordemId]}
                        >
                          <td className="px-3 py-[13px] text-[13.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>{l.tarefa}</td>
                          <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: l.pedido == null ? 'var(--prod-muted)' : 'var(--prod-secondary)' }}>
                            {l.pedido == null ? 'sem pedido' : formatarQtd(l.pedido, l.unidade)}
                          </td>
                          <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>{formatarQtd(l.produzido, l.unidade)}</td>
                          <td className="px-3 py-[13px] text-right"><Pilula pct={l.eficiencia} /></td>
                          <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>
                            {l.relampago ? 'retroativo' : min(l.minutos)}
                          </td>
                          <td className="num px-3 py-[13px] text-right text-[13px]" style={{ color: 'var(--prod-secondary)' }}>{brl(l.separadoReais)}</td>
                          <td className="px-3 py-[13px]"><AvatarPessoa nome={l.quemConcluiu} /></td>
                          <td className="px-3 py-[13px] text-right">
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${abertas[l.ordemId] ? 'rotate-90' : ''}`}
                              style={{ color: 'var(--prod-muted)' }}
                            />
                          </td>
                        </tr>
                        {abertas[l.ordemId] && (
                          <tr style={{ background: 'var(--prod-surface-1)' }}>
                            <td colSpan={8} className="p-0">
                              <BlocoDoConsumo estado={consumo[l.ordemId] ?? 'carregando'} href={ordemHref(l.ordemId)} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}

                    {/**
                      * ⭐⭐ TOTAL DO DIA — borda superior MAIS FORTE e números em peso 500.
                      * ⛔ Ele desenha o subtotal **do servidor**, nunca uma Σ das linhas daqui: o
                      * guard de sempre (*"a tela não soma"*) continua valendo, e é ele que garante
                      * que o rodapé não possa divergir das linhas de cima.
                      */}
                    <tr style={{ borderTop: '2px solid var(--prod-line-strong)' }}>
                      <td className="px-3 py-[13px] text-[12.5px] font-medium uppercase tracking-wide" style={{ color: 'var(--prod-secondary)' }}>
                        total do dia{suf}
                      </td>
                      <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-secondary)' }}>
                        {textoDoPedido(d.pedido, d.semPedido, d.lotes)}
                      </td>
                      <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>{d.produzido.texto}</td>
                      <td className="px-3 py-[13px] text-right"><Pilula pct={d.eficienciaMedia} /></td>
                      <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-secondary)' }}>
                        {min(d.minutos)}
                        {d.semTempo > 0 && <span className="ml-1 text-[11.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>({d.semTempo} sem tempo)</span>}
                      </td>
                      <td className="num px-3 py-[13px] text-right text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>{brl(d.separadoReais)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
                {d.relampagos > 0 && (
                  <p className="px-3 pt-2 text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {d.relampagos} registro(s) retroativo(s) — contam na produção, fora do tempo.
                  </p>
                )}
              </div>

              {/**
                * ─── CELULAR: cartões empilhados (REGRA 12) ───
                * ⚠️ Composição própria, MESMOS dados e MESMO gesto: tocar abre os produtos igual.
                * ⛔ *"nada de scroll lateral"* — é por isso que aqui não existe tabela.
                */}
              <div className="space-y-2 lg:hidden">
                {(linhasPorDia.get(d.dia) ?? []).map((l) => (
                  <div key={l.ordemId} className="rounded-xl" style={{ background: 'var(--prod-surface-1)' }}>
                    <button
                      onClick={() => alternar(l.ordemId)}
                      className="w-full px-3 py-2.5 text-left"
                      aria-expanded={!!abertas[l.ordemId]}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>{l.tarefa}</span>
                        <Pilula pct={l.eficiencia} />
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform ${abertas[l.ordemId] ? 'rotate-90' : ''}`}
                          style={{ color: 'var(--prod-muted)' }}
                        />
                      </div>
                      <p className="num mt-1 text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
                        {l.pedido == null
                          ? <span style={{ color: 'var(--prod-muted)' }}>sem pedido</span>
                          : `pedido ${formatarQtd(l.pedido, l.unidade)}`} · produziu {formatarQtd(l.produzido, l.unidade)}
                      </p>
                      <p className="num text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>
                        {brl(l.separadoReais)} · {l.relampago ? 'retroativo' : min(l.minutos)}
                      </p>
                      <div className="mt-1"><AvatarPessoa nome={l.quemConcluiu} /></div>
                    </button>
                    {abertas[l.ordemId] && (
                      <div style={{ background: 'var(--prod-surface)', borderTop: '1px solid var(--prod-line)' }} className="rounded-b-xl">
                        <BlocoDoConsumo estado={consumo[l.ordemId] ?? 'carregando'} href={ordemHref(l.ordemId)} />
                      </div>
                    )}
                  </div>
                ))}

                {/* TOTAL DO DIA no celular — mesmo subtotal do servidor, destacado */}
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--prod-surface-2)', borderTop: '2px solid var(--prod-line-strong)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--prod-secondary)' }}>total do dia{suf}</p>
                  <p className="num mt-0.5 text-[13px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    {d.produzido.texto} · {brl(d.separadoReais)}
                  </p>
                  <p className="num text-[12px]" style={{ color: 'var(--prod-secondary)' }}>
                    pedido {textoDoPedido(d.pedido, d.semPedido, d.lotes)} · {min(d.minutos)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/**
            * ⭐⭐ O RODAPÉ HONESTO — *"a tela diz que está filtrando"* (pedido do dono).
            *
            * ⛔ Ele conta `ocultasNoPeriodo`, **não** o tamanho da preferência: o dono pode ter
            * 10 escondidas e só 3 terem produzido no recorte, e dizer "10 ocultas" seria a tela
            * afirmando um filtro que ela não está aplicando.
            * ⚠️ E some quando não há nenhuma — móvel zerado treina o dono a não olhar (a lição
            * do card de dupla contagem da Conciliação).
            */}
          {ocultas > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
              <p className="text-[12px]" style={{ color: 'var(--prod-muted)' }}>
                {ocultas} {ocultas === 1 ? 'receita oculta' : 'receitas ocultas'} neste período
                {' — '}
                {data.receitasDoPeriodo.filter((r) => r.oculta).map((r) => r.tarefa).join(', ')}
              </p>
              <button
                disabled={salvandoPref}
                onClick={() => void salvarPref({ mostrar: data.receitasDoPeriodo.filter((r) => r.oculta).map((r) => r.itemId) })}
                className="text-[12px] font-medium underline disabled:opacity-40"
                style={{ color: 'var(--prod-accent)' }}
              >
                mostrar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
