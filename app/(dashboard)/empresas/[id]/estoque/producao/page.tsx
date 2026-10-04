'use client'

// ESTOQUE FASE 2 item 2.1 — home da PRODUÇÃO: lista de ordens (por estado) + nova ordem
// (escolhe a ficha + escala do lote base + data + setor). A conclusão ("quantos saíram?")
// é 2.2. Sem sugestão por min/max ainda (2.4).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
// ⚠️ "×" SAIU DA TELA (01/09, decisão do dono): *"a pessoa fala em porções e em kg, nunca
// em '×'"*. O `escalaReceitas` continua no banco e no motor — só não aparece mais.
import { eficienciaMedia } from '@/lib/stock/producao/previsao-rendimento'
import { escalaDoPedido } from '@/lib/stock/producao/escala-da-ordem'
import { avisosDaEscala } from '@/lib/stock/producao/escala-do-pedido'
import { listaDoQueVaiSeparar } from '@/lib/stock/producao/lista-da-separacao'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { Factory, Loader2, Plus, ChevronRight, ClipboardList, Settings, TrendingDown, UtensilsCrossed, Download, PlayCircle, CheckCircle2, Users, UserPlus, Radio, BarChart3, ArrowRight, CalendarDays, Beef, Wheat, Scissors, ChefHat, Flame, Gauge, Clock } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { formatarDuracao } from '@/lib/format/duracao'
import { AvatarPessoa } from '@/components/estoque/avatar-pessoa'
import { caraDaReceita, type IconeDaReceita } from '@/lib/stock/producao/cara-da-receita'
import { faixaDoSelo } from '@/lib/stock/producao/eficiencia-da-ordem'
import type { Quantidade } from '@/lib/stock/producao/desempenho'
import { ehReceitaDeProducao } from '@/lib/stock/producao/tipo-receita'

interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; loteBase: number; estado: string; dataProducao: string; setorNome: string | null }
interface Sugestao { fichaId: string; itemProduzidoId: string; nome: string; unidade: string; saldo: number; estoqueMin: number; estoqueMax: number | null; faltam: number; escalaSugerida: number | null; rendimentoMedio: number | null }
interface FichaOpt { id: string; nomeProduzido: string; unidadeProduzido: string; loteBase: number; unidadeLoteBase: string; rendimentoMedio: number | null; rendimentoLotes: number; tipoProduto: string; componentes?: { itemId: string; nome: string; unidade: string; qtdPlanejada: number; custoMedio: number | null }[] }
interface Setor { id: string; nome: string; ativo: boolean }
interface Painel { emAberto: number; valorEmProducao: number; concluidasNoPeriodo: number; valorProduzidoNoPeriodo: number; rendimentoPeriodo: number | null; lotesNaMedia: number; faixaRendimento: string; abertasDeOntem: number }
type Aberta = Ordem & { deOntem?: boolean }
/** ⭐ o que a rota passou a mandar pro mock v3 (quem/começou/pedido) */
interface Contexto { pedido: number | null; pedidoOrigem: 'DECLARADO' | 'DERIVADO' | null; quem: string[]; comecouEm: string | null }
interface PedidoFeito { pedido: number | null; origem: 'DECLARADO' | 'DERIVADO' | null }
interface Conclusao { id: string; ordemId: string; qtdGerada: number; custoUnitarioReal: number | null; custoLoteReal: number; colaboradorNome: string | null; rendimento: number; criadoEm: string; pct: number | null; faixa: string; motivo: string | null; selo: 'FICHA' | 'SEM_DADO' }

// ⭐ PALETA APROVADA NO MOCKUP (01/09/2026). Cor SÓ com significado — status, desvio,
// dinheiro parado. Texto sobre fundo colorido usa o tom escuro da MESMA família, nunca
// preto puro. Flat: sem sombra, sem gradiente, pesos 400/500.
const C = {
  fundo: '#F5F4EF', card: '#FFFFFF', borda: 'rgba(0,0,0,0.08)',
  primario: '#534AB7', primarioTexto: '#EEEDFE',
  ambarBg: '#FAEEDA', ambarTx: '#633806', ambarAc: '#854F0B',
  verdeBg: '#EAF3DE', verdeTx: '#27500A', verdeAc: '#3B6D11',
  azulBg: '#E6F1FB', azulTx: '#0C447C',
  coralBg: '#FAECE7', coralTx: '#993C1D',
  cinzaBg: '#F1EFE8', cinzaTx: '#5F5E5A',
  vermelhoBg: '#FCEBEB', vermelhoTx: '#791F1F',
  txt2: '#5F5E5A', txt3: '#888780',
  // ⭐ ESCALA TIPOGRÁFICA aprovada em mockup (01/09). REGRA: no máximo DUAS coisas em
  // peso 500 escuro por linha (o nome e o custo). O resto desce um degrau por vez —
  // é o que faz a linha ter hierarquia em vez de virar um bloco cinza uniforme.
  // ⚠️ Mobile usa os MESMOS tamanhos: encolher texto em tela pequena é onde a leitura morre.
  nomeTx: '#2C2C2A', qtdTx: '#444441', tituloTx: '#444441',
}
const T = {
  nome: 'text-[15px]', custo: 'text-[14px]', qtd: 'text-[14px]',
  quem: 'text-[13px]', hora: 'text-[13px]', pill: 'text-[12px]',
  cardNum: 'text-[25px]', cardRot: 'text-[12px]', titulo: 'text-[14px]',
}
const PILL: Record<string, { bg: string; tx: string }> = {
  PLANEJADA: { bg: C.cinzaBg, tx: C.cinzaTx },
  SEPARADA: { bg: C.azulBg, tx: C.azulTx },
  EM_PRODUCAO: { bg: C.ambarBg, tx: C.ambarTx },
  CONCLUIDA: { bg: C.verdeBg, tx: C.verdeTx },
  CANCELADA: { bg: C.vermelhoBg, tx: C.vermelhoTx },
}
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const ESTADO: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: 'Planejada', cls: 'bg-slate-100 text-slate-600' },
  SEPARADA: { label: 'Separada', cls: 'bg-amber-50 text-amber-700' },
  EM_PRODUCAO: { label: 'Em produção', cls: 'bg-sky-50 text-sky-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-50 text-rose-600' },
}
const PAGINA = 25
const fmtQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')


/**
 * ⭐⭐ A FAMÍLIA DE COR EM 3 DEGRAUS — o pedido do dono: *"fundo tom 50, textos tons 600/800 DA
 * MESMA família, nunca preto em fundo colorido"*. Os tokens vivem no `globals.css` escopados em
 * `[data-tela='producao-home']`, com o espelho escuro invertendo 50↔800.
 */
const fam = (f: string) => ({
  bg: `var(--fam-${f}-bg)`,
  mid: `var(--fam-${f}-mid)`,
  ink: `var(--fam-${f}-ink)`,
})

/** ⚠️ nome → componente: a lib `cara-da-receita` é PURA e devolve o NOME do ícone, não JSX */
const ICONES: Record<IconeDaReceita, typeof Beef> = {
  carne: Beef, porcao: UtensilsCrossed, massa: Wheat, preparo: Scissors, generico: Factory,
}

/** o quadradinho arredondado colorido da receita — estável por nome (hash/tipo) */
function IconeDaFicha({ nome, forcar }: { nome: string; forcar?: { familia: string; Icone: typeof Beef } }) {
  const c = caraDaReceita(nome)
  const familia = forcar?.familia ?? c.familia
  const Icone = forcar?.Icone ?? ICONES[c.icone]
  const t = fam(familia)
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: t.bg }}>
      <Icone className="h-4 w-4" style={{ color: t.mid }} />
    </span>
  )
}

/**
 * ⭐⭐ O CARTÃO DE MÉTRICA — colorido com disciplina.
 * ⚠️ O número grande é 26px/peso 500/tabular; o rótulo e a sublinha ficam no `mid` da família,
 * nunca em cinza neutro (seria o "preto em fundo colorido" que o dono proibiu).
 */
function CardMetrica({ familia, Icone, rotulo, valor, sub, barra, ativo, onClick }: {
  familia: string; Icone: typeof Beef; rotulo: string; valor: string; sub?: string
  /** 0..1 — a mini-barra no tom da família (só o cartão de rendimento usa) */
  barra?: number | null
  ativo?: boolean; onClick?: () => void
}) {
  const t = fam(familia)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`rounded-xl px-3.5 py-3 text-left ${onClick ? 'transition-opacity hover:opacity-95' : ''}`}
      style={{ background: t.bg, boxShadow: ativo ? `inset 0 0 0 1.5px ${t.mid}` : undefined }}>
      <div className="flex items-center gap-1.5">
        <Icone className="h-3.5 w-3.5 shrink-0" style={{ color: t.mid }} />
        <p className="text-[12px] font-medium" style={{ color: t.mid }}>{rotulo}</p>
      </div>
      <p className="num mt-0.5 text-[26px] font-medium leading-tight" style={{ color: t.ink }}>{valor}</p>
      {sub && <p className="text-[12px]" style={{ color: t.mid }}>{sub}</p>}
      {barra != null && (
        /* ⚠️ a barra é VISUAL do mesmo número — nunca uma 2ª conta. Teto em 100% só pra não
           estourar a caixa; o valor de verdade está escrito acima (ex. 205%). */
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: t.mid, opacity: 0.18 }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, barra * 100))}%`, background: t.mid, opacity: 1 }} />
        </div>
      )}
    </Tag>
  )
}

/**
 * ⭐ A NAVEGAÇÃO — os 6 links como chips IGUAIS.
 *
 * ⛔⛔ **NENHUM aceso, por decisão do dono:** *"esta é a tela principal, não estamos dentro de
 * nenhuma delas; quem diz onde estou é o título"*. Acender um deles aqui diria que o dono está
 * numa sub-tela — e aí o chip mentiria sobre onde ele está.
 */
function ChipNav({ href, Icone, children }: { href: string; Icone: typeof Beef; children: React.ReactNode }) {
  return (
    <a href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] transition-colors"
      style={{ boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
      <Icone className="h-3.5 w-3.5" /> {children}
    </a>
  )
}

/**
 * ⭐⭐ A PÍLULA DE EFICIÊNCIA — a tela só PINTA; o degrau sai do `faixaDoSelo`, que lê as duas
 * constantes da casa (`DESVIO_ALERTA` do P8/P3 e o `DESVIO_GRAVE` do P3). Mesma régua da tela
 * "Por dia" — duas pílulas com réguas próprias divergiriam no primeiro ajuste de faixa.
 */
function PilulaEf({ pct }: { pct: number | null }) {
  const faixa = faixaDoSelo(pct == null ? null : pct * 100)
  if (faixa === 'SEM_PEDIDO') return null
  const t = fam(faixa === 'DENTRO' ? 'verde' : faixa === 'FORA' ? 'ambar' : 'coral')
  return (
    <span className="num shrink-0 rounded-full px-2 py-[3px] text-[12px] font-medium"
      style={{ background: t.bg, color: t.ink }}>
      {faixa === 'EXTREMO' ? '⚠ ' : ''}{Math.round(pct! * 100)}%
    </span>
  )
}

/** ⭐ a data por extenso da linha editorial — `null` nunca vira data de hoje chutada */
function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  const f = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return f.format(dt)
}

export default function ProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ordens, setOrdens] = useState<Ordem[] | null | undefined>(undefined)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  /**
   * ⭐ 22/09 — `?ficha=` abre a nova ordem COM a ficha escolhida. É a porta que a recusa
   * do item negativo oferece ("registrar a produção que faltou"); sem ler o parâmetro, o
   * dono cairia num dropdown pra procurar de novo o que o sistema acabou de nomear — o
   * defeito do Bamberg (13/09). Lido no 1º render, como o `?aba=`: em `useEffect` a tela
   * piscaria fechada antes de abrir, e "voltar e não ver nada" parece que não gravou.
   */
  const fichaDaUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ficha') : null
  const [novo, setNovo] = useState(!!fichaDaUrl)
  const [criando, setCriando] = useState<string | null>(null)
  const [painel, setPainel] = useState<Painel | null>(null)
  const [abertas, setAbertas] = useState<Aberta[]>([])
  const [concluidas, setConcluidas] = useState<Conclusao[]>([])
  /** ⭐ o que a rota passou a mandar pro mock v3 — a tela só DESENHA isso */
  const [contexto, setContexto] = useState<Record<string, Contexto>>({})
  const [pedidoFeito, setPedidoFeito] = useState<Record<string, PedidoFeito>>({})
  const [hoje, setHoje] = useState<{ dia: string; produzido: Quantidade; lotes: number } | null>(null)
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje')
  const [busca, setBusca] = useState('')
  const [soDeOntem, setSoDeOntem] = useState(false)
  // ⭐ ITEM 4 — período livre + paginação. São a MESMA feature (decisão do dono): período
  // grande sem "carregar mais" vira lista infinita, e paginação sem calendário não tem o
  // que paginar.
  const [custom, setCustom] = useState<{ de: string; ate: string } | null>(null)
  const [abrirCal, setAbrirCal] = useState(false)
  const [mostrar, setMostrar] = useState(PAGINA)

  // ⚠️⚠️ O DIA É O DE SÃO PAULO, NUNCA `toISOString()` (que é UTC). Das 21h à meia-noite —
  // justamente quando a cozinha fecha e lança a produção — o UTC já virou, a tela pedia o dia
  // SEGUINTE e "hoje" abria VAZIO. Medido em prod às 22:16 de 05/09: 9 lotes do dia, zero na
  // tela. O mesmo dia vem do MESMO lugar que o servidor usa pra recortar.
  const janela = (p: typeof periodo) => {
    if (custom) return custom
    const hoje = diaEmSaoPaulo()
    const dias = p === 'semana' ? -6 : p === 'mes' ? -29 : 0
    return { de: somarDias(hoje, dias), ate: hoje }
  }
  const carregar = () => {
    const { de, ate } = janela(periodo)
    return fetch(`/api/empresas/${id}/estoque/producao/ordens?de=${de}&ate=${ate}`).then((r) => r.json()).then((j) => {
      setOrdens(j.ordens ?? []); setSugestoes(j.sugestoes ?? [])
      setPainel(j.painel ?? null); setAbertas(j.abertas ?? []); setConcluidas(j.concluidas ?? [])
      setContexto(j.contexto ?? {}); setPedidoFeito(j.pedidoDasConcluidas ?? {}); setHoje(j.hoje ?? null)
    }).catch(() => setOrdens(null))
  }
  useEffect(() => { setMostrar(PAGINA); carregar() }, [id, periodo, custom]) // eslint-disable-line react-hooks/exhaustive-deps

  const produzirSugestao = async (s: Sugestao) => {
    setCriando(s.fichaId)
    try {
      const hoje = diaEmSaoPaulo()
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId: s.fichaId, escalaReceitas: s.escalaSugerida ?? 1, dataProducao: hoje }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
    } finally { setCriando(null) }
  }

  if (ordens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a produção.</div>


  return (
    <div data-tela="producao-home" className="space-y-4 -m-4 p-4 lg:-m-6 lg:p-6"
      style={{ background: 'var(--prod-bg)', minHeight: '100%' }}>
      {/* ──────────────────────────────────────────────────────────────────────
          ⭐⭐⭐ 1. O TOPO (mock v3) — título grande + linha EDITORIAL serifada.
          O dono: *"sábado, 4 de outubro — a cozinha já produziu N unidades hoje"*.
          ⛔ O número vem do `hoje.produzido.texto` do servidor, somado POR UNIDADE
          (`somarQuantidades`): porção em UN e massa em KG nunca viram um número só.
          ⚠️ Enquanto o dado não chegou, a frase NÃO afirma produção nenhuma — dizer
          "0 unidades" antes de carregar é afirmar um fato que ninguém mediu.
          ────────────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-[24px] font-medium leading-tight" style={{ color: 'var(--prod-primary)' }}>Produção</h1>
          {/* ⭐ a ÚNICA coisa preenchida de cor forte na tela — é a ação principal */}
          <button onClick={() => setNovo((v) => !v)}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--fam-indigo-mid)' }}>
            <Plus className="h-4 w-4" /> Nova ordem
          </button>
        </div>
        <p className="editorial mt-1 text-[14px]" style={{ color: 'var(--prod-secondary)' }}>
          {hoje
            ? `${dataPorExtenso(hoje.dia)}${hoje.lotes > 0 ? ` — a cozinha já produziu ${hoje.produzido.texto} hoje` : ' — a cozinha ainda não fechou lote hoje'}`
            : 'lendo o dia…'}
        </p>

        {/* ⭐ 1b. NAVEGAÇÃO — 6 chips IGUAIS, nenhum aceso (ver `ChipNav`) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ChipNav href={`/empresas/${id}/estoque/producao/hoje`} Icone={Radio}>Hoje ao vivo</ChipNav>
          <ChipNav href={`/empresas/${id}/estoque/producao/por-dia`} Icone={CalendarDays}>Por dia</ChipNav>
          <ChipNav href={`/empresas/${id}/estoque/producao/receitas`} Icone={ClipboardList}>Receitas</ChipNav>
          <ChipNav href={`/empresas/${id}/estoque/producao/pessoas`} Icone={Users}>Por pessoa</ChipNav>
          <ChipNav href={`/empresas/${id}/estoque/cardapio`} Icone={UtensilsCrossed}>Cardápio</ChipNav>
          <ChipNav href={`/empresas/${id}/estoque/producao/relatorios`} Icone={BarChart3}>Relatórios</ChipNav>
          {/* ⚠️ Equipe e CSV ficam FORA dos 6 do mock: não são telas de produção, são
              ferramentas. Mantidos discretos pra não perder a maçaneta (a lição das 11 voltas). */}
          <a href="/equipe?filtro=cozinha" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px]"
            style={{ color: 'var(--prod-muted)' }}><UserPlus className="h-3.5 w-3.5" /> Equipe</a>
          <button onClick={() => baixarCsv(`ordens-producao-${hojeArquivo()}`,
            ['Produto', 'Quanto', 'Data', 'Setor', 'Estado'],
            ordens.map((o) => [o.nomeProduzido, `${o.escalaReceitas * o.loteBase} ${o.unidadeProduzido}`, fmtDia(o.dataProducao), o.setorNome ?? '', o.estado]))}
            disabled={ordens.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] disabled:opacity-40"
            style={{ color: 'var(--prod-muted)' }}><Download className="h-3.5 w-3.5" /> CSV</button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          ⭐⭐ 2. OS 4 CARTÕES — cada um numa FAMÍLIA de cor, com os 3 degraus.
          ⛔ Zero conta nova: todo número vem do `painel` que o servidor já montava
          (`cardsDoPainel`). A tela escolhe a COR, nunca o valor.
          ────────────────────────────────────────────────────────────────────── */}
      {painel && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <CardMetrica familia="indigo" Icone={Flame} rotulo="Em aberto"
            valor={String(painel.emAberto)} sub="ordens andando"
            ativo={!soDeOntem} onClick={() => setSoDeOntem(false)} />
          <CardMetrica familia="azul" Icone={ChefHat} rotulo="Na bancada"
            valor={formatBRL(painel.valorEmProducao)}
            sub={painel.valorEmProducao > 0 ? 'insumo fora da prateleira' : 'nada parado agora'} />
          <CardMetrica familia="verde" Icone={CheckCircle2} rotulo="Concluídas hoje"
            valor={String(painel.concluidasNoPeriodo)}
            sub={`${formatBRL(painel.valorProduzidoNoPeriodo)} produzidos`} />
          {/**
            * ⭐ RENDIMENTO — *"a cor segue o valor, mesma régua do P8"*: âmbar 70-90, verde ≥90,
            * vermelho <70. ⛔ `null` é CINZA com "a apurar": pintar de verde o que ninguém
            * mediu seria afirmar que bateu (a régua do "sem contagem" do Radar).
            */}
          <CardMetrica
            familia={painel.rendimentoPeriodo == null ? 'cinza'
              : painel.rendimentoPeriodo >= 0.9 ? 'verde'
                : painel.rendimentoPeriodo >= 0.7 ? 'ambar' : 'coral'}
            Icone={Gauge} rotulo="Rendimento do dia"
            valor={painel.rendimentoPeriodo == null ? 'a apurar' : `${Math.round(painel.rendimentoPeriodo * 100)}%`}
            sub={painel.lotesNaMedia > 0 ? `de ${painel.lotesNaMedia} ${painel.lotesNaMedia === 1 ? 'lote' : 'lotes'}` : 'nada concluído'}
            barra={painel.rendimentoPeriodo} />
        </div>
      )}

      {/**
        * ⛔⛔ **O BANNER ÂMBAR MORREU (decisão de design do dono, 04/10):** *"NADA de fundo bege
        * na linha inteira — o fio e o selo bastam"*. A FUNÇÃO não morreu: o alerta virou o
        * *"N desde ontem"* com ponto coral no cabeçalho da seção «Em aberto», e ele continua
        * sendo o BOTÃO que filtra. *Remoção sem realocação é perda* (a régua de 10/09).
        */}

      {/**
        * ⭐ 4. CHIPS de período + busca — MESMA função, roupa nova. Período governa SÓ as
        * concluídas (ordem aberta nunca obedece filtro: trabalho aberto não é histórico).
        *
        * ⚠️ O chip ativo é `indigo-bg` + `indigo-ink`, **nunca preenchido de cor forte**: o dono
        * foi explícito que o "Nova ordem" é a ÚNICA coisa preenchida de cor forte na tela. Dois
        * primários competindo é o que faz a ação principal deixar de ser óbvia.
        */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['hoje', 'semana', 'mes'] as const).map((p) => {
          const on = !custom && periodo === p
          return (
            <button key={p} onClick={() => { setCustom(null); setPeriodo(p) }}
              className="h-8 rounded-full px-3 text-[12.5px] font-medium"
              style={on
                ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)' }
                : { boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
              {p === 'hoje' ? 'hoje' : p === 'semana' ? 'semana' : 'mês'}
            </button>
          )
        })}
        <button onClick={() => setAbrirCal((v) => !v)} className="h-8 rounded-full px-3 text-[12.5px] font-medium"
          style={custom
            ? { background: 'var(--fam-indigo-bg)', color: 'var(--fam-indigo-ink)' }
            : { boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
          {custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : 'período…'}
        </button>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar receita…"
          className="h-8 w-[200px] rounded-lg px-2.5 text-[12.5px] outline-none"
          style={{ background: 'var(--prod-surface)', color: 'var(--prod-primary)', boxShadow: 'inset 0 0 0 1px var(--prod-line-strong)' }} />
      </div>

      {abrirCal && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl p-3"
          style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          <label className="text-[11px]" style={{ color: 'var(--prod-secondary)' }}>de
            <input type="date" defaultValue={custom?.de ?? janela(periodo).de} id="pdDe"
              className="num mt-1 block h-8 rounded-lg px-2 text-[12.5px] outline-none"
              style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }} />
          </label>
          <label className="text-[11px]" style={{ color: 'var(--prod-secondary)' }}>até
            <input type="date" defaultValue={custom?.ate ?? janela(periodo).ate} id="pdAte"
              className="num mt-1 block h-8 rounded-lg px-2 text-[12.5px] outline-none"
              style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-primary)' }} />
          </label>
          <button onClick={() => {
            const de = (document.getElementById('pdDe') as HTMLInputElement)?.value
            const ate = (document.getElementById('pdAte') as HTMLInputElement)?.value
            // ⚠️ intervalo invertido não vira query: a rota devolveria vazio e pareceria
            // "não produziu nada", que é a mentira mais fácil de acreditar.
            if (!de || !ate || de > ate) return
            setCustom({ de, ate }); setAbrirCal(false)
          }} className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-white"
            style={{ background: 'var(--fam-indigo-mid)' }}>aplicar</button>
          {custom && <button onClick={() => { setCustom(null); setAbrirCal(false) }}
            className="h-8 rounded-lg px-3 text-[12.5px]" style={{ color: 'var(--prod-secondary)' }}>limpar</button>}
        </div>
      )}

      {novo && <NovaOrdem id={id} fichaInicial={fichaDaUrl} onCriada={(ordemId) => { window.location.href = `/empresas/${id}/estoque/producao/${ordemId}` }} onFechar={() => setNovo(false)} />}

      {/**
        * ⭐ SUGESTÃO DE PRODUÇÃO (min/máx) — **mesma lógica, roupa nova.** Não está no mock, mas
        * ficaria órfã no fundo novo (ela usava `Card` do shadcn com borda âmbar do Tailwind).
        * Agora veste a família ÂMBAR por token, e o dark mode acompanha de graça.
        */}
      {sugestoes.length > 0 && (
        <section>
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: 'var(--fam-ambar-ink)' }}>
            <TrendingDown className="h-3.5 w-3.5" /> Sugestão de produção ({sugestoes.length})
          </h2>
          <div className="overflow-hidden rounded-xl" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
            {sugestoes.map((sg, i) => (
              <div key={sg.fichaId} className="flex items-center gap-3 px-3.5 py-[14px]"
                style={{ borderLeft: '3px solid var(--fam-ambar-mid)', ...(i > 0 ? { borderTop: '1px solid var(--prod-line)' } : {}) }}>
                <IconeDaFicha nome={sg.nome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>{sg.nome}</p>
                  <p className="num truncate text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                    saldo {fmtQtd(sg.saldo)} {sg.unidade} · abaixo do mínimo {sg.estoqueMin} · faltam ~{fmtQtd(sg.faltam)} {sg.unidade}
                    {sg.rendimentoMedio == null && ' · rendimento a apurar'}
                  </p>
                </div>
                <button onClick={() => produzirSugestao(sg)} disabled={criando === sg.fichaId}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium disabled:opacity-50"
                  style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}>
                  {criando === sg.fichaId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
                  produzir {fmtQtd(sg.faltam)} {sg.unidade}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {ordens.length === 0 && !novo ? (
        <div className="flex flex-col items-center gap-2 rounded-xl p-10 text-center"
          style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          <Factory className="h-10 w-10" style={{ color: 'var(--prod-muted)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--prod-primary)' }}>Nenhuma ordem de produção ainda.</p>
          <p className="max-w-md text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>Crie uma ordem a partir de uma ficha (ex: 200 porções de carne). O sistema já pré-preenche a separação com os insumos e as quantidades.</p>
        </div>
      ) : (
        <>
          {/* ⭐⭐ 5. ABERTAS — A REGRA CENTRAL: ordem aberta NUNCA obedece o período.
              Planejada/Separada/Em produção aparecem SEMPRE, em qualquer filtro.
              Trabalho aberto não é histórico — some do filtro e o dono perde o insumo
              parado de vista. Só a busca e o clique na faixa de ontem as filtram. */}
          <ListaAbertas id={id} ctx={contexto}
            deOntem={painel?.abertasDeOntem ?? 0}
            soDeOntem={soDeOntem}
            onFiltrarOntem={() => setSoDeOntem((v) => !v)}
            ordens={abertas
              .filter((o) => !soDeOntem || o.deOntem)
              .filter((o) => !busca.trim() || o.nomeProduzido.toLowerCase().includes(busca.trim().toLowerCase()))} />

          {/* 6. CONCLUÍDAS — essas SIM obedecem os chips */}
          <ListaConcluidas id={id} periodo={custom ? `${fmtDia(custom.de)} – ${fmtDia(custom.ate)}` : periodo}
            mostrar={mostrar} onMais={() => setMostrar((m) => m + PAGINA)}
            itens={concluidas.filter((c) => {
              if (!busca.trim()) return true
              const o = ordens.find((x) => x.id === c.ordemId)
              return (o?.nomeProduzido ?? '').toLowerCase().includes(busca.trim().toLowerCase())
            })}
            nomePorOrdem={new Map(ordens.map((o) => [o.id, o.nomeProduzido]))}
            unidadePorOrdem={new Map(ordens.map((o) => [o.id, o.unidadeProduzido]))}
            pedidoFeito={pedidoFeito} />
        </>
      )}
    </div>
  )
}

type CampoO = 'produto' | 'escala' | 'data' | 'setor' | 'estado'
function Secao({ titulo, ordens, id }: { titulo: string; ordens: Ordem[]; id: string }) {
  const { col, dir, alternar, ordenar } = useSort<CampoO>('data', 'desc')
  const lista = ordenar(ordens, (o, c) => (
    c === 'produto' ? o.nomeProduzido : c === 'escala' ? o.escalaReceitas * o.loteBase : c === 'data' ? o.dataProducao
      : c === 'setor' ? (o.setorNome ?? '') : o.estado
  ))
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{titulo} ({ordens.length})</h2>
      <Card><CardContent className="p-0">
        <table className="density-normal hidden w-full sm:table">
          <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <SortableTh campo="produto" col={col} dir={dir} onSort={alternar}>Produto</SortableTh>
            <SortableTh campo="escala" col={col} dir={dir} onSort={alternar} align="right">Quanto</SortableTh>
            <SortableTh campo="data" col={col} dir={dir} onSort={alternar}>Data</SortableTh>
            <SortableTh campo="setor" col={col} dir={dir} onSort={alternar}>Setor</SortableTh>
            <SortableTh campo="estado" col={col} dir={dir} onSort={alternar}>Estado</SortableTh>
            <th className="w-10 px-3 py-2" />
          </tr></thead>
          <tbody>
            {lista.map((o) => {
              const e = ESTADO[o.estado] ?? { label: o.estado, cls: 'bg-slate-100 text-slate-600' }
              return (
                <tr key={o.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50">
                  <td className="px-3 py-0 text-[13px]"><a href={`/empresas/${id}/estoque/producao/${o.id}`} className="font-medium text-slate-800 hover:text-[#185FA5]">{o.nomeProduzido}</a></td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-500">{fmtQtd(o.escalaReceitas * o.loteBase)} {o.unidadeProduzido}</td>
                  <td className="whitespace-nowrap px-3 py-0 text-[13px] tabular-nums text-slate-500">{fmtDia(o.dataProducao)}</td>
                  <td className="px-3 py-0 text-[13px] text-slate-500">{o.setorNome ?? '—'}</td>
                  <td className="px-3 py-0"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.cls}`}>{e.label}</span></td>
                  <td className="px-3 py-0 text-right"><a href={`/empresas/${id}/estoque/producao/${o.id}`}><ChevronRight className="h-4 w-4 text-slate-300" /></a></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="divide-y divide-slate-50 sm:hidden">
          {lista.map((o) => {
            const e = ESTADO[o.estado] ?? { label: o.estado, cls: 'bg-slate-100 text-slate-600' }
            return (
              <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{o.nomeProduzido}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.cls}`}>{e.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{fmtQtd(o.escalaReceitas * o.loteBase)} {o.unidadeProduzido} · {fmtDia(o.dataProducao)}{o.setorNome ? ` · ${o.setorNome}` : ''}</p>
              </a>
            )
          })}
        </div>
      </CardContent></Card>
    </div>
  )
}

function NovaOrdem({ id, fichaInicial, onCriada, onFechar }: { id: string; fichaInicial?: string | null; onCriada: (ordemId: string) => void; onFechar: () => void }) {
  const [fichas, setFichas] = useState<FichaOpt[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [fichaId, setFichaId] = useState(fichaInicial ?? '')
  // ⭐ o dono pensa em UNIDADES ("faz 200 porções"); a escala é derivada na hora de gravar.
  const [quanto, setQuanto] = useState('')
  const [data, setData] = useState('')
  const [setorId, setSetorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json())
      // ⛔ SÓ RECEITA DE PRODUÇÃO. Sem isto a busca listava XIS COMPLETO e PIZZA — produto
      // de VENDA, montado na hora, que não se produz em lote. Régua compartilhada com a
      // tela de Receitas (fonte única, não uma 2ª lista de tipos aqui).
      .then((j) => setFichas((j.fichas ?? []).filter(ehReceitaDeProducao))).catch(() => {})
    fetch(`/api/empresas/${id}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
  }, [id])

  const ficha = fichas.find((f) => f.id === fichaId) ?? null
  /** ⭐ ESPELHO, não régua: só pra tela DIZER quanto a cozinha vem rendendo. */
  const espelho = ficha ? eficienciaMedia({ teorico: ficha.loteBase, medido: ficha.rendimentoMedio, lotes: ficha.rendimentoLotes }) : null

  /**
   * ⭐⭐ O GUARD DO ATO DA CRIAÇÃO (item 4b, 03/10) — pega ANTES de separar, não no mês
   * seguinte. O caso que o criou: ordem de 10 beef de xis propondo material pra ~6,7.
   *
   * ⛔⛔ **A SEPARAÇÃO É `escalaDoPedido` — ficha × pedido, sem rendimento** (decisão do dono,
   * 03/10). A medição não aparece em nenhuma multiplicação/divisão daqui; ela só alimenta a
   * FRASE do aviso.
   *
   * ⚠️ A régua mora em `avisosDaEscala` (lib PURA), nunca aqui: *regra que vive num
   * componente é regra que ninguém prova* — este projeto roda sem jsdom (a lição do prefill
   * do cardápio, 28/08).
   */
  const alvoNum = Number(quanto.replace(',', '.'))
  const maiorDose = (ficha?.componentes ?? []).reduce<{ nome: string; dose: number } | null>(
    (m, c) => (!m || c.qtdPlanejada > m.dose ? { nome: c.nome, dose: c.qtdPlanejada } : m), null)
  const avisos = ficha && alvoNum > 0
    ? avisosDaEscala({
        pedido: alvoNum,
        loteBase: ficha.loteBase, unidadeLoteBase: ficha.unidadeLoteBase,
        unidadeProduto: ficha.unidadeProduzido, maiorDose, espelho,
      })
    : []

  /**
   * ⭐⭐ O QUE VAI SAIR DA CÂMARA — item 2 do dono: *"a lista do que VAI SEPARAR do estoque
   * (componente a componente, da ficha × pedido) ANTES de confirmar"*.
   *
   * ⛔ A régua mora na LIB pura (`listaDoQueVaiSeparar`), que chama a PORTA — a tela só desenha.
   * Multiplicar aqui seria a segunda conta da separação: a tela prometeria um material e a
   * ordem separaria outro.
   */
  const vaiSair = ficha?.componentes?.length && alvoNum > 0
    ? listaDoQueVaiSeparar(
        ficha.componentes.map((c) => ({
          itemId: c.itemId, nome: c.nome, unidade: c.unidade, porLote: c.qtdPlanejada, custoMedio: c.custoMedio,
        })),
        alvoNum,
        ficha.loteBase,
      )
    : null

  const criar = async () => {
    setErro(null)
    const alvo = Number(quanto.replace(',', '.'))
    if (!fichaId || !ficha) return setErro('Escolha a ficha.')
    if (!(alvo > 0)) return setErro('Diga quanto você quer produzir.')
    // a escala continua sendo o que o banco guarda — só não é mais o que se digita
    const esc = escalaDoPedido({ pedido: alvo, loteBase: ficha.loteBase })
    if (esc == null || !(esc > 0)) return setErro('Não consegui converter — confira o lote base da ficha.')
    if (!data) return setErro('Informe a data de produção.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId, escalaReceitas: esc, dataProducao: data, setorId: setorId || null, pedidoUnidades: alvo }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui criar.'); return }
      onCriada(j.ordemId)
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-900">Nova ordem de produção</p><button onClick={onFechar} className="text-xs text-slate-400 hover:text-slate-600">fechar</button></div>
      {fichas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma ficha ainda — <a href={`/empresas/${id}/estoque/fichas/nova`} className="text-[#185FA5] hover:underline">crie uma ficha</a> primeiro.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[200px] text-xs text-slate-500">Ficha (o que produzir)
              <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">escolher…</option>{fichas.map((f) => <option key={f.id} value={f.id}>{f.nomeProduzido}</option>)}</select>
            </label>
            {/**
              * ⭐⭐ O CAMPO DO PEDIDO, GRANDE E CLARO (item 2 do dono, 04/10) — *"quero
              * produzir: 80 UN"*. É a pergunta da tela, então é o maior elemento dela.
              *
              * ⚠️ E a UNIDADE fica do lado, grande: foi a unidade escondida que deixou 37
              * fichas declarando lote em KG num produto contado em UN sem ninguém reparar.
              */}
            <label className="text-xs text-slate-500">Quero produzir
              <div className="mt-1 flex items-center gap-2">
                <input value={quanto} onChange={(e) => setQuanto(e.target.value)} inputMode="decimal" placeholder="80" className="block w-32 rounded-lg border border-slate-300 py-2 px-3 text-[22px] font-medium tabular-nums text-slate-900" />
                <span className="text-[17px] font-medium text-slate-500">{ficha?.unidadeProduzido ?? ''}</span>
              </div>
              {/* ⭐ A conta é SEMPRE a ficha (03/10). O espelho vai ao lado, como informação. */}
              <span className="mt-1 block text-[11px] font-normal text-slate-400">
                pela receita da ficha{espelho ? ` · seus últimos ${espelho.lotes} lotes renderam ${Math.round(espelho.pct * 100)}%` : ' · eficiência: a apurar'}
              </span>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">Data de produção
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" />
            </label>
            <label className="text-xs text-slate-500">Setor
              <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
            </label>
            {/* ⚠️ ATALHO, não segunda tela: o cadastro de gente mora em Sistema → Equipe. */}
            <a href="/equipe?filtro=cozinha" className="inline-flex items-center gap-1 pb-2 text-[11px] text-slate-400 hover:text-slate-600"><Settings className="h-3 w-3" /> setores e equipe</a>
          </div>
          {/**
            * ⭐⭐ A LISTA DO QUE SAI — ela vem ANTES dos avisos de propósito: é a resposta à
            * pergunta que o dono acabou de fazer ("quero 80"), e o aviso é a ressalva. Dizer a
            * ressalva antes da resposta manda ele procurar no lugar errado (16/09).
            */}
          {vaiSair && vaiSair.linhas.length > 0 && (
            <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  vai sair do estoque pra este pedido
                </p>
                <p className="text-[13px] tabular-nums text-slate-600">
                  {/* ⚠️ total só quando TODOS têm custo — parcial com cara de total é a
                      mentira mais fácil numa tela de dinheiro (a régua do "a definir") */}
                  {vaiSair.custoTotal != null
                    ? brl(vaiSair.custoTotal)
                    : `custo a definir · ${vaiSair.semCusto} componente(s) sem custo médio`}
                </p>
              </div>
              <div className="mt-1.5 overflow-x-auto">
                <table className="density-normal w-full">
                  <tbody>
                    {vaiSair.linhas.map((l, i) => (
                      <tr key={l.itemId} style={{ background: i % 2 === 1 ? '#FAF9F6' : undefined }}>
                        <td className="px-2 py-0 text-[13px] text-slate-800">{l.nome}</td>
                        <td className="px-2 py-0 text-right text-[13px] font-medium tabular-nums text-slate-900">
                          {l.quantidade == null ? '—' : fmtQtd(l.quantidade)} {l.unidade}
                        </td>
                        <td className="hidden px-2 py-0 text-right text-[12px] tabular-nums text-slate-400 sm:table-cell">
                          {fmtQtd(l.porLote)} {l.unidade} por receita
                        </td>
                        <td className="px-2 py-0 text-right text-[12px] tabular-nums text-slate-500">
                          {l.custoTotal == null ? 'a definir' : brl(l.custoTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {avisos.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">confira antes de criar</p>
              <ul className="mt-1 space-y-1">
                {avisos.map((a) => (
                  <li key={a.motivo} className="text-xs leading-snug text-amber-900">
                    · {a.frase}
                    {/**
                      * ⭐⭐ O ATALHO QUE O DONO PEDIU — e ele é a METADE QUE FALTA do aviso.
                      *
                      * ⛔ Este aviso existe desde 03/10 e dizia o problema **sem dizer onde
                      * resolver**: o dono lia "o lote base não diz quantas UN saem de uma
                      * receita" e ficava com o problema na mão. É a família da *"porta sem
                      * maçaneta"*, que esta casa já pagou 11 vezes — alarme sem porta é
                      * alarme que se aprende a ignorar.
                      *
                      * ⚠️ Vai SÓ no `LOTE_NAO_COMPARAVEL`: o `MEDIA_DESTOA` não se resolve
                      * convertendo lote nenhum (é eficiência, e a decisão lá é outra).
                      */}
                    {a.motivo === 'LOTE_NAO_COMPARAVEL' && fichaId && (
                      <a
                        href={`/empresas/${id}/estoque/fichas/conversao?ficha=${fichaId}`}
                        className="ml-1 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                      >
                        corrigir o lote desta ficha <ArrowRight className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {/* ⛔ AVISA, NÃO BLOQUEIA: travar pararia a cozinha por ficha mal declarada
                  (são 36 de 43 hoje) — a régua do FREIO da contagem e da sanidade do import. */}
              <p className="mt-1.5 text-[11px] text-amber-700">Dá pra criar assim mesmo — o aviso é pra você conferir a ficha.</p>
            </div>
          )}
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
          <button onClick={criar} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar ordem</button>
        </>
      )}
    </CardContent></Card>
  )
}

/** Card do painel. Flat, cantos 12px, cor só quando significa. */
function CardPainel({ rotulo, valor, sub, bg, tx, acento, ativo, onClick }: {
  rotulo: string; valor: string; sub?: string; bg?: string; tx?: string; acento?: string
  ativo?: boolean; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`rounded-xl px-3.5 py-3 text-left ${onClick ? 'transition-colors hover:brightness-[0.99]' : ''}`}
      style={{ background: bg ?? C.card, border: `1px solid ${ativo === false ? C.borda : C.borda}` }}>
      <p className={T.cardRot} style={{ color: tx ? acento ?? tx : C.txt2, fontWeight: 500 }}>{rotulo}</p>
      <p className={`mt-0.5 ${T.cardNum} tabular-nums`} style={{ color: tx ?? C.nomeTx, fontWeight: 500 }}>{valor}</p>
      {sub && <p className="mt-0.5 text-[12px]" style={{ color: tx ? acento ?? tx : C.txt3 }}>{sub}</p>}
    </Tag>
  )
}

/**
 * ⭐⭐⭐ EM ABERTO (mock v3) — filete + quadradinho + nome + sublinha + PEDIDO grande à direita.
 *
 * **A linguagem da ordem ATRASADA é CORAL** (filete, ícone de relógio, sublinha e selo), e
 * ⛔ **sem fundo bege na linha** — *"o fio e o selo bastam"*, palavras do dono. O banner âmbar
 * que existia morreu; o alerta virou o *"N desde ontem"* no cabeçalho, que continua filtrando.
 *
 * ⚠️ Toda a hierarquia é do pedido do dono: nome em peso 500 escuro, o *"há X"* em índigo peso
 * 500, e o PEDIDO em 16px tabular à direita — porque é o número que ele compara com o que saiu.
 */
function ListaAbertas({ id, ordens, ctx, deOntem, soDeOntem, onFiltrarOntem }: {
  id: string; ordens: Aberta[]; ctx: Record<string, Contexto>
  deOntem: number; soDeOntem: boolean; onFiltrarOntem: () => void
}) {
  if (!ordens.length) return null
  const coral = fam('coral')
  const indigo = fam('indigo')
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-[13.5px] font-medium" style={{ color: 'var(--prod-secondary)' }}>
          Em aberto ({ordens.length})
        </h2>
        {/* ⭐ o alerta de ontem, na roupa nova: ponto coral + botão que filtra */}
        {deOntem > 0 && (
          <button onClick={onFiltrarOntem} className="ml-auto inline-flex items-center gap-1.5 text-[12.5px]"
            style={{ color: coral.ink }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: coral.mid }} />
            {soDeOntem ? 'ver todas' : `${deOntem} desde ontem`}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
        {ordens.map((o, i) => {
          const c = ctx[o.id]
          const atrasada = !!o.deOntem
          const t = atrasada ? coral : indigo
          /**
           * ⚠️ "há X" vem do `formatarDuracao` (o formatador único), nunca de `% 60` à mão: era
           * ali que o float vazava e imprimia "3h21.830000000000013" (04/10).
           */
          const haQuanto = c?.comecouEm
            ? formatarDuracao((Date.now() - new Date(c.comecouEm).getTime()) / 60000)
            : null
          return (
            <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`}
              /**
               * ⚠️⚠️ **REGRA 12 com UMA marcação, não duas.** O pedido do dono é *"linha vira 2
               * andares com o pedido embaixo à direita"* — e isso é o RESULTADO, não o
               * mecanismo. Pra uma LINHA de lista, `flex-wrap` + `w-full lg:w-auto` entrega os
               * dois andares com UM markup; duas composições (`lg:hidden` × `hidden lg:block`)
               * é justamente o que o guard da casa existe pra policiar, porque elas divergem no
               * primeiro selo novo. O `pl-11` alinha o 2º andar depois do quadradinho.
               */
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-[14px] transition-colors hover:bg-[var(--prod-surface-1)]"
              style={{
                // ⭐ o FILETE de 3px — índigo normal, coral quando atrasada
                borderLeft: `3px solid ${t.mid}`,
                ...(i > 0 ? { borderTop: '1px solid var(--prod-line)' } : {}),
              }}>
              <IconeDaFicha nome={o.nomeProduzido}
                forcar={atrasada ? { familia: 'coral', Icone: Clock } : undefined} />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                  {o.nomeProduzido}
                </span>
                {atrasada ? (
                  <span className="block text-[12.5px]" style={{ color: coral.ink }}>
                    desde ontem {fmtDia(o.dataProducao)} — insumo saiu e não virou produto
                  </span>
                ) : (
                  <span className="block truncate text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {c?.quem.length ? c.quem.join(' e ') : <i>ninguém pegou ainda</i>}
                    {c?.comecouEm && ` · começou ${hhmm(c.comecouEm)}`}
                    {haQuanto && <> · <b className="font-medium" style={{ color: indigo.mid }}>há {haQuanto}</b></>}
                  </span>
                )}
              </span>

              {/* ⭐⭐ O PEDIDO GRANDE — e ordem antiga sem pedido DIZ isso, em muted discreto */}
              <span className="w-full shrink-0 pl-11 text-right lg:w-auto lg:pl-0">
                {c?.pedido == null ? (
                  <span className="text-[13px]" style={{ color: 'var(--prod-muted)' }}>sem pedido</span>
                ) : (
                  <span className="num text-[16px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    {fmtQtd(c.pedido)} {o.unidadeProduzido}
                    <span className="ml-1 text-[12.5px] font-normal" style={{ color: 'var(--prod-muted)' }}>pedidas</span>
                  </span>
                )}
                {atrasada && (
                  <span className="mt-0.5 block">
                    <span className="rounded-full px-2 py-[2px] text-[11.5px] font-medium"
                      style={{ background: coral.bg, color: coral.ink }}>atrasada</span>
                  </span>
                )}
              </span>

              <ChevronRight className="hidden h-4 w-4 shrink-0 lg:block" style={{ color: 'var(--prod-muted)' }} />
            </a>
          )
        })}
      </div>
    </section>
  )
}

/**
 * ⭐⭐⭐ CONCLUÍDAS (mock v3) — avatar colorido + nome + sublinha + o par *"pedido → fez"* + pílula.
 *
 * ⚠️⚠️ **O PAR E A PÍLULA TÊM DENOMINADORES DIFERENTES, e é de propósito.** O par diz *"o que eu
 * pedi → o que saiu"* (o `stockOrdemMeta`); a pílula diz *"o que saiu ÷ o que a FICHA promete"*
 * — a eficiência CONGELADA que o juiz P8 lê. **`fez ÷ pedido` NÃO é a pílula.** Quem
 * "simplificar" isso numa divisão vai fazer a tela e o e-mail do P8 discordarem sobre o mesmo
 * lote, que é a doença que este módulo mais paga.
 *
 * ⭐ O avatar é o MESMO componente da tela "Por dia" (`AvatarPessoa`): cor estável por hash do
 * nome, iniciais 1º+último. Dois avatares com hashes próprios dariam cores diferentes pra mesma
 * pessoa em duas telas — e a coluna existe justamente pra ser reconhecida.
 */
function ListaConcluidas({ id, itens, periodo, nomePorOrdem, unidadePorOrdem, pedidoFeito, mostrar, onMais }: {
  id: string; itens: Conclusao[]; periodo: string
  nomePorOrdem: Map<string, string>; unidadePorOrdem: Map<string, string>
  pedidoFeito: Record<string, PedidoFeito>
  mostrar: number; onMais: () => void
}) {
  const rotulo = periodo === 'hoje' ? 'hoje' : periodo === 'semana' ? 'últimos 7 dias' : periodo === 'mes' ? 'últimos 30 dias' : periodo
  // ⚠️ PAGINAÇÃO: período grande não pode travar a tela. E o "carregar mais" DIZ quantos
  // faltam — botão que só some quando acaba deixa a pessoa sem saber se viu tudo.
  const visiveis = itens.slice(0, mostrar)
  const faltam = itens.length - visiveis.length
  return (
    <section>
      <h2 className="mb-1.5 text-[13.5px] font-medium" style={{ color: 'var(--prod-secondary)' }}>
        Concluídas · {rotulo} ({itens.length})
      </h2>
      {itens.length === 0 ? (
        <div className="rounded-xl px-3.5 py-6 text-center text-[12.5px]"
          style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)', color: 'var(--prod-muted)' }}>
          Nada concluído {rotulo}. As ordens abertas continuam acima.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
          {visiveis.map((c, i) => {
            const pf = pedidoFeito[c.ordemId]
            const un = unidadePorOrdem.get(c.ordemId) ?? ''
            return (
              <a key={c.id} href={`/empresas/${id}/estoque/producao/${c.ordemId}`}
                /* ⚠️ 2 andares no celular com UMA marcação — ver o bloco em `ListaAbertas` */
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-[14px] transition-colors hover:bg-[var(--prod-surface-1)]"
                style={i > 0 ? { borderTop: '1px solid var(--prod-line)' } : undefined}>
                {/* ⭐ avatar: cor estável por pessoa (o componente da tela "Por dia") */}
                <AvatarPessoa nome={c.colaboradorNome} apenasAvatar tamanho={30} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    {nomePorOrdem.get(c.ordemId) ?? '—'}
                  </span>
                  <span className="block truncate text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>
                    {c.colaboradorNome ?? 'sem responsável'} · {hhmm(c.criadoEm)}
                    {/* ⛔ moeda pelo formatador da casa — o "R$ 638,5" de hoje nasceu de formatar à mão */}
                    {c.custoUnitarioReal != null && ` · ${formatBRL(c.custoUnitarioReal)}/un`}
                    {c.motivo && <i> · {c.motivo}</i>}
                  </span>
                </span>

                {/**
                  * ⭐⭐ O PAR "pedido → fez", tipográfico: o pedido desce um degrau (muted), a seta
                  * é muted, e o FEZ é o protagonista (16px, escuro, peso 500).
                  * ⚠️ Ordem antiga sem pedido mostra SÓ o "fez" — inventar um pedido pra completar
                  * o par seria o "pedido 0" que a tela Por dia já teve que consertar.
                  */}
                <span className="num ml-auto shrink-0 whitespace-nowrap pl-11 text-right lg:ml-0 lg:pl-0">
                  {pf?.pedido != null && (
                    <>
                      <span className="text-[14.5px]" style={{ color: 'var(--prod-muted)' }}>{fmtQtd(pf.pedido)}</span>
                      <ArrowRight className="mx-1 inline h-3.5 w-3.5 align-[-2px]" style={{ color: 'var(--prod-muted)' }} />
                    </>
                  )}
                  <span className="text-[16px] font-medium" style={{ color: 'var(--prod-primary)' }}>
                    {fmtQtd(c.qtdGerada)}
                  </span>
                  {un && <span className="ml-1 text-[12.5px]" style={{ color: 'var(--prod-muted)' }}>{un}</span>}
                </span>

                {/**
                  * ⭐ A PÍLULA — `selo === 'FICHA'` é o que separa lote JULGADO de FÓSSIL: lote
                  * anterior ao sprint não tem régua congelada, e recalcular daria ficção (o
                  * fóssil de 21/08 daria 2500% por causa da ficha da época).
                  */}
                {c.selo === 'FICHA' && <PilulaEf pct={c.pct} />}

                <ChevronRight className="hidden h-4 w-4 shrink-0 lg:block" style={{ color: 'var(--prod-muted)' }} />
              </a>
            )
          })}
          {faltam > 0 && (
            <button onClick={onMais} className="w-full py-2.5 text-[12.5px] transition-colors hover:bg-[var(--prod-surface-1)]"
              style={{ borderTop: '1px solid var(--prod-line)', color: 'var(--prod-secondary)' }}>
              carregar mais ({faltam} restante{faltam > 1 ? 's' : ''})
            </button>
          )}
        </div>
      )}
    </section>
  )
}
