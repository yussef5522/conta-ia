'use client'

// VENDAS FASE 1 item 6 — tela /vendas, Blocos 1 (número grande) + 2 (calendário).
// Tudo ~ESTIMADO por enquanto (extrato-inferido): til + cor de estimativa, distinta
// de confirmado (que ainda não existe). Comparação SDLW/SWLY = "a apurar" (só 6 dias
// de histórico). Foco agosto: dias antes de 12/08 = "antes do início do sistema"
// (distinto de sem-venda). Fim de semana num card só; composição no clique.

import { useEffect, useState, useMemo, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  CalendarDays, Info, ChevronDown, ChevronRight, ChevronLeft, ExternalLink,
  Store, CalendarRange, CalendarCheck, CreditCard,
} from 'lucide-react'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { resumoSemana, resumoMes, type Unidade } from '@/lib/vendas/resumo-periodo'

interface DiaVenda { total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }
interface Bloco { inicio: string; fim: string; total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean; incluiMesAnterior?: boolean }
interface Balde { samples: number; total: number; media: number }
interface PerfilSemana { SEG: Balde; TER: Balde; QUA: Balde; QUI: Balde; FDS: Balde }
interface LancamentoOrigem { transactionId: string; dataEntrada: string; contaId: string; contaNome: string; descricao: string; valor: number; motivo: string }
interface DetalheDia { de: string; ate: string; total: number; meios: { meio: string; valor: number; lancamentos: LancamentoOrigem[] }[]; aguardando: { meio: string; contaNome: string; chegaEm: string; frase: string }[] }
interface VendasData { mes: string; moduleInicio: string | null; hoje: string; dias: Record<string, DiaVenda>; blocos: Bloco[]; perfilSemana: PerfilSemana | null }

// Ordem fixa do maior pro menor típico (como o dono pensa), não alfabética.
const MEIO_ORDER = ['CARTAO', 'PIX', 'DINHEIRO', 'OUTRO']
const ordenarMeios = (pm: Record<string, number>): [string, number][] =>
  Object.entries(pm).sort((a, b) => {
    const ia = MEIO_ORDER.indexOf(a[0]), ib = MEIO_ORDER.indexOf(b[0])
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
const MIN_AMOSTRAS = 2 // < isso → "a apurar"
const MEIO_COR: Record<string, string> = { CARTAO: 'bg-sky-500', PIX: 'bg-emerald-500', DINHEIRO: 'bg-amber-500', OUTRO: 'bg-slate-400' }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// O card do fim de semana = o bloco (cartão) + os dias únicos que ele engloba
// (PIX/dinheiro de 14,15,16). Total 62.090,93, não só o bloco 28.422,17.
function fimDeSemanaAgg(data: VendasData, bloco: Bloco): { total: number; porMeio: Record<string, number> } {
  const porMeio: Record<string, number> = { ...bloco.porMeio }
  let total = bloco.total
  let cur = parseDia(bloco.inicio)
  const fim = parseDia(bloco.fim)
  while (cur.getTime() <= fim.getTime()) {
    const k = cur.toISOString().slice(0, 10)
    const d = data.dias[k]
    if (d) { total += d.total; for (const [m, v] of Object.entries(d.porMeio)) porMeio[m] = (porMeio[m] ?? 0) + v }
    cur = new Date(cur.getTime() + 86400000)
  }
  return { total: Math.round((total + 1e-9) * 100) / 100, porMeio }
}
const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESNOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const parseDia = (s: string) => new Date(s + 'T12:00:00Z')
const fmtDiaCurto = (s: string) => { const d = parseDia(s); return `${DOW[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` }
// dd/MM do início do módulo — NUNCA literal na tela: a janela mudou de 12/08 pra
// 01/08 em 25/08 e cinco textos ficaram mentindo. A fonte é o `moduleInicio` da API.
const fmtDDMM = (s: string | null) => { if (!s) return '—'; const d = parseDia(s); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

/** Navegação de mês na barra de filtro — só UI, a API já aceitava ?mes=. */
const mesVizinho = (mes: string, delta: number) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

type Toggle = 'DIA' | 'SEMANA' | 'MES'
const MEIO_LABEL: Record<string, string> = { CARTAO: 'Cartão', PIX: 'PIX', DINHEIRO: 'Dinheiro', OUTRO: 'Outro' }

export default function VendasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<VendasData | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [toggle, setToggle] = useState<Toggle>('SEMANA')
  const [sel, setSel] = useState<{ tipo: 'dia' | 'bloco'; key: string } | null>(null)

  // Mês default: o do início do sistema (agosto) — a Cacula só tem agosto.
  const [mes, setMes] = useState('2026-08')

  useEffect(() => {
    setData(null); setErro(null)
    fetch(`/api/empresas/${id}/vendas?mes=${mes}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Falha ao carregar'))))
      .then(setData)
      .catch((e) => setErro(e.message))
  }, [id, mes])

  // Unidades de EXIBIÇÃO: dias de semana avulsos + GRUPO de fim de semana (bloco +
  // dias que ele engloba, merged). Sem double-count (bloco=cartão, dias=PIX/dinheiro,
  // disjuntos). Usado pro toggle e é a mesma lógica do calendário.
  // ⚠️⚠️ O SOMATÓRIO É SÓ AGOSTO PURO (26/08). O bloco que COMEÇA no mês anterior
  // (31/07–02/08) é exibido — isso está certo —, mas NÃO PODE ENTRAR NA SOMA: ele
  // contém venda de julho e não é separável. Somá-lo fez a tela mostrar 595 mil num
  // mês de 380 mil. O fix da sobreposição resolveu a EXIBIÇÃO e vazou pro TOTAL.
  // Mesmo padrão das exclusões do Fluxo de Caixa: visível, fora da soma, explicado.
  const unidades = useMemo(() => {
    if (!data) return []
    const blocosDoMes = data.blocos.filter((b) => !b.incluiMesAnterior)
    // só os blocos DO MÊS "cobrem" dias — o bloco de borda não engole 01 e 02/08,
    // que são dias de agosto de pleno direito (dinheiro e PIX do mesmo dia).
    const cobertos = new Set<string>()
    for (const b of blocosDoMes) { let c = parseDia(b.inicio); const f = parseDia(b.fim); while (c.getTime() <= f.getTime()) { cobertos.add(c.toISOString().slice(0, 10)); c = new Date(c.getTime() + 86400000) } }
    const us: { inicio: string; fim: string; total: number; porMeio: Record<string, number>; isBloco: boolean }[] = []
    for (const [d, v] of Object.entries(data.dias)) if (!cobertos.has(d)) us.push({ inicio: d, fim: d, total: v.total, porMeio: v.porMeio, isBloco: false })
    for (const b of blocosDoMes) { const ag = fimDeSemanaAgg(data, b); us.push({ inicio: b.inicio, fim: b.fim, total: ag.total, porMeio: ag.porMeio, isBloco: true }) }
    return us.sort((a, b) => (a.fim < b.fim ? -1 : 1))
  }, [data])

  /** O bloco de borda, à parte — exibido, nunca somado. */
  const bordaJulho = useMemo(() => {
    const b = (data?.blocos ?? []).filter((x) => x.incluiMesAnterior)
    return b.length ? { total: b.reduce((s, x) => s + x.total, 0), blocos: b } : null
  }, [data])

  const bloco1 = useMemo(() => {
    if (!data || unidades.length === 0) return null
    if (toggle === 'MES') return resumoMes(unidades, mes, data.moduleInicio)
    if (toggle === 'SEMANA') return resumoSemana(unidades)
    // DIA — última unidade (dia ou bloco de fim de semana)
    const u = unidades[unidades.length - 1]
    const label = u.isBloco ? `Fim de semana ${fmtDiaCurto(u.inicio)}–${fmtDiaCurto(u.fim)}` : fmtDiaCurto(u.inicio)
    return { label, total: u.total, porMeio: u.porMeio }
  }, [data, unidades, toggle, mes])

  // Composição do MÊS por meio (bloco 4) — soma dias + blocos.
  const composicaoMes = useMemo(() => {
    if (!data) return { total: 0, porMeio: {} as Record<string, number> }
    const pm: Record<string, number> = {}
    const add = (o: Record<string, number>) => { for (const [m, v] of Object.entries(o)) pm[m] = (pm[m] ?? 0) + v }
    for (const d of Object.values(data.dias)) add(d.porMeio)
    // ⚠️ sem o bloco de borda — ver `unidades` acima (só agosto puro entra na soma)
    for (const b of data.blocos.filter((x) => !x.incluiMesAnterior)) add(b.porMeio)
    const total = Object.values(pm).reduce((s, v) => s + v, 0)
    return { total: Math.round((total + 1e-9) * 100) / 100, porMeio: pm }
  }, [data])

  // Cards do topo — os MESMOS agregados do número grande (helpers puros acima).
  const cards = useMemo(() => {
    if (!data) return null
    const semana = resumoSemana(unidades)
    const mesAgora = resumoMes(unidades, mes, data.moduleInicio)
    const pm = composicaoMes.porMeio
    return { semana, mesAgora, fds: data.perfilSemana?.FDS ?? null, porMeio: pm }
  }, [data, unidades, mes, composicaoMes])

  // ⚠️ HOOKS FICAM AQUI, ANTES DOS EARLY RETURNS ABAIXO.
  // Em 25/08 estes 4 nasceram DEPOIS do `if (!data) return` e derrubaram a tela:
  // na 1ª renderização o componente retornava cedo e registrava N hooks; quando o
  // fetch voltava, passava dos returns e registrava N+4 → "Rendered more hooks than
  // during the previous render". É o MESMO bug da ordem de produção (21/08).
  const [meioAberto, setMeioAberto] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<DetalheDia | null>(null)
  const [carregandoDet, setCarregandoDet] = useState(false)

  // troca de dia fecha o meio aberto e recarrega o rastro
  useEffect(() => {
    setMeioAberto(null)
    setDetalhe(null)
    if (!sel) return
    const [de, ate] = sel.tipo === 'dia' ? [sel.key, sel.key] : sel.key.split('|')
    setCarregandoDet(true)
    fetch(`/api/empresas/${id}/vendas/dia?de=${de}&ate=${ate}`)
      .then((r) => r.json()).then((j) => setDetalhe(j.detalhe ?? null))
      .catch(() => setDetalhe(null))
      .finally(() => setCarregandoDet(false))
  }, [sel, id])

  if (erro) return <div className="p-6 text-sm text-rose-600">Erro: {erro}</div>
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Carregando vendas…</div>

  const selData: { total: number; porMeio: Record<string, number>; titulo: string } | null = (() => {
    if (!sel) return null
    if (sel.tipo === 'dia') { const v = data.dias[sel.key]; return v ? { total: v.total, porMeio: v.porMeio, titulo: fmtDiaCurto(sel.key) } : null }
    const b = data.blocos.find((x) => `${x.inicio}|${x.fim}` === sel.key)
    if (!b) return null
    const ag = fimDeSemanaAgg(data, b)
    return { total: ag.total, porMeio: ag.porMeio, titulo: `Fim de semana ${fmtDiaCurto(b.inicio)} – ${fmtDiaCurto(b.fim)}` }
  })()

  const outrosMeios = ordenarMeios(cards?.porMeio ?? {}).slice(1)

  return (
    <div className="space-y-4">
      {/* ── CABEÇALHO DE UMA LINHA (molde CaP) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Store className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">Vendas</h1>
        <span className="hidden text-xs text-slate-400 lg:inline">
          quando a venda aconteceu, não quando o dinheiro chegou
        </span>
        <span className="ml-auto rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
          ~estimado pelo extrato
        </span>
      </div>

      {/* ── BARRA ÚNICA DE FILTRO (h-9, molde CaP) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-md border p-0.5 text-xs">
          {(['DIA', 'SEMANA', 'MES'] as Toggle[]).map((t) => (
            <button key={t} onClick={() => setToggle(t)}
              className={`h-8 rounded px-3 transition-colors ${toggle === t ? 'bg-sky-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
              {t === 'DIA' ? 'Dia' : t === 'SEMANA' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
        <div className="inline-flex h-9 items-center gap-1 rounded-md border px-1">
          <button onClick={() => setMes(mesVizinho(mes, -1))} aria-label="Mês anterior"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[104px] text-center text-xs font-medium tabular-nums">
            {MESNOME[Number(mes.split('-')[1]) - 1]} {mes.split('-')[0]}
          </span>
          <button onClick={() => setMes(mesVizinho(mes, 1))} aria-label="Próximo mês"
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <span className="text-xs text-muted-foreground">vs período anterior: <span className="italic">a apurar</span></span>
      </div>

      {/* ── CARDS DE RESUMO (StatCard compartilhado — mesmos tamanhos das irmãs) ── */}
      <StatCardGrid>
        <StatCard tone="sky" icon={CalendarRange} label="Semana atual"
          value={cards?.semana ? `~${brl(cards.semana.total)}` : 'sem dado'}
          sub={cards?.semana?.label ?? 'nenhuma competência no mês'} />
        <StatCard tone="sky" icon={CalendarDays} label="Mês até agora"
          value={`~${brl(cards?.mesAgora.total ?? 0)}`}
          sub={`desde ${fmtDDMM(data.moduleInicio)} · ${unidades.length} dias/blocos`} />
        <StatCard tone="violet" icon={CalendarCheck} label="Perfil fim de semana"
          value={cards?.fds && cards.fds.samples >= MIN_AMOSTRAS ? `~${brl(cards.fds.media)}` : 'a apurar'}
          sub={cards?.fds ? `${cards.fds.samples} fim(ns) de semana na média` : '—'} />
        <StatCard tone="emerald" icon={CreditCard}
          label={`${MEIO_LABEL[ordenarMeios(cards?.porMeio ?? {})[0]?.[0]] ?? 'Meios'} no mês`}
          value={brl(ordenarMeios(cards?.porMeio ?? {})[0]?.[1] ?? 0)}
          sub={outrosMeios.map(([m, v]) => `${MEIO_LABEL[m] ?? m} ${brl(v)}`).join(' · ') || 'sem composição'} />
      </StatCardGrid>

      {/* BLOCO 1 — número grande do período escolhido */}
      <Card>
        <CardContent className="py-4">
          {bloco1 ? (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{bloco1.label}</p>
              <p className="mt-0.5 text-3xl font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                <span className="align-top text-xl text-sky-400">~</span>{brl(bloco1.total)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ordenarMeios(bloco1.porMeio).map(([m, v]) => (
                  <span key={m}>{MEIO_LABEL[m] ?? m}: <span className="tabular-nums text-foreground">{brl(v)}</span></span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xl font-medium text-muted-foreground">Sem vendas no período</p>
          )}
          {bordaJulho && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Fora deste total: <b>{brl(bordaJulho.total)}</b> do fim de semana que começa em julho —
              inclui venda de julho e não é separável (aparece no calendário, marcado).
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">Comparação semana passada / ano passado: <span className="italic">a apurar</span> (histórico desde {fmtDDMM(data.moduleInicio)}).</p>
        </CardContent>
      </Card>

      {/* BLOCO 2 — calendário */}
      <Card>
        <CardContent className="py-4">
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">{MESNOME[Number(mes.split('-')[1]) - 1]} de {mes.split('-')[0]}</h2>
          </div>
          <p className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" /> O sistema de vendas começou em <b className="mx-1">{fmtDDMM(data.moduleInicio)}</b> — dias antes disso não têm dado de venda (não é loja fechada).
          </p>
          {/* ⚠️ BLOCO QUE COMEÇA NO MÊS ANTERIOR — a sexta cai fora da grade, então o
              card não cabe numa célula. Fica aqui em cima, com o aviso: o depósito de
              segunda junta sexta+sábado+domingo e o banco NÃO diz qual real é de qual
              dia — não dá pra separar a parte que é do mês passado. */}
          {data.blocos.filter((b) => b.incluiMesAnterior).map((b) => {
            const selKey = `${b.inicio}|${b.fim}`
            const on = sel?.tipo === 'bloco' && sel.key === selKey
            const mesAnt = MESNOME[parseDia(b.inicio).getUTCMonth()]
            return (
              <button key={selKey} onClick={() => setSel(on ? null : { tipo: 'bloco', key: selKey })}
                className={`mb-3 w-full rounded-md border border-amber-300 bg-amber-50 p-2 text-left transition-colors hover:bg-amber-100 ${on ? 'ring-2 ring-amber-500' : ''}`}>
                <div className="text-[10px] text-amber-800">fim de semana {fmtDDMM(b.inicio)}–{fmtDDMM(b.fim)} · sex+sáb+dom</div>
                <div className="text-sm font-semibold tabular-nums text-amber-900">~{brl(b.total)}</div>
                <div className="mt-0.5 text-[10px] text-amber-700">
                  inclui venda de fim de {mesAnt} — <b>não somado no total do mês</b>. O depósito de
                  segunda junta sexta+sábado+domingo e o banco não diz qual real é de qual dia.
                </div>
              </button>
            )
          })}
          <Calendario data={data} onSel={setSel} sel={sel} />
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <Legenda cls="bg-sky-100 border-sky-300" txt="~venda estimada" />
            <Legenda cls="bg-emerald-500/80 border-emerald-600" txt="venda confirmada (fase 2)" />
            <Legenda cls="bg-slate-100 border-slate-200 border-dashed" txt="aguardando (dinheiro não chegou)" />
            <Legenda cls="bg-slate-50 border-slate-200 opacity-50" txt={`antes do início (${fmtDDMM(data.moduleInicio)})`} />
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3 — perfil da semana */}
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-1 text-sm font-medium">Perfil da semana</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Quanto um dia típico vende, na média. Precisa de pelo menos {MIN_AMOSTRAS} semanas por dia — até lá, <span className="italic">a apurar</span>.</p>
          <PerfilSemanaBloco perfil={data.perfilSemana} />
        </CardContent>
      </Card>

      {/* BLOCO 4 — composição por meio (do mês) */}
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-1 text-sm font-medium">Composição por meio · {MESNOME[Number(mes.split('-')[1]) - 1]}</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Bruto, taxa e líquido por adquirente chegam na fase 2. Estornos aparecem como faixa negativa (0 por enquanto).</p>
          {composicaoMes.total > 0 ? (
            <>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {ordenarMeios(composicaoMes.porMeio).map(([m, v]) => (
                  <div key={m} className={MEIO_COR[m] ?? 'bg-slate-400'} style={{ width: `${(v / composicaoMes.total) * 100}%` }} title={`${MEIO_LABEL[m] ?? m}: ${brl(v)}`} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {ordenarMeios(composicaoMes.porMeio).map(([m, v]) => (
                  <div key={m} className="flex items-center gap-2 text-[13px]">
                    <span className={`inline-block h-3 w-3 rounded-sm ${MEIO_COR[m] ?? 'bg-slate-400'}`} />
                    <span className="w-24 text-muted-foreground">{MEIO_LABEL[m] ?? m}</span>
                    <span className="font-medium tabular-nums">{brl(v)}</span>
                    <span className="text-[11px] text-muted-foreground">({Math.round((v / composicaoMes.total) * 100)}%)</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Total do mês</span>
                <span className="text-sm font-semibold tabular-nums text-sky-700 dark:text-sky-400">~{brl(composicaoMes.total)}</span>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Sem vendas no mês.</p>}
        </CardContent>
      </Card>

      {/* BLOCO 6 — período e comparação */}
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-1 text-sm font-medium">Comparações</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">Semana × semana passada, mês × mês anterior, trimestre, ano × ano. Ligam quando houver histórico suficiente.</p>
          <div className="space-y-1.5 text-[13px]">
            {[
              ['Esta semana × semana passada (SDLW)', 'a apurar — 1ª semana'],
              ['Este mês × mês anterior', `a apurar — só agosto (desde ${fmtDDMM(data.moduleInicio)})`],
              ['Trimestre', 'a apurar'],
              ['Este ano × ano passado (SWLY)', 'a apurar — precisa de 12 meses'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-1.5 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="italic text-slate-500">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Composição do dia/bloco selecionado */}
      {selData && (
        <Card className="border-sky-200 bg-sky-50/40">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{selData.titulo}</h3>
              <button onClick={() => setSel(null)} className="text-xs text-muted-foreground hover:text-foreground">fechar ✕</button>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-700 dark:text-sky-400"><span className="align-top text-lg text-sky-400">~</span>{brl(selData.total)}</p>
            {/* Cada meio ABRE nos lançamentos que o compõem — dia → lançamento → extrato.
                Somado não se audita: quando o número parece errado, o dono desce até a
                origem, igual ao estoque faz de movimento → nota. */}
            <div className="mt-2 space-y-1 text-[13px]">
              {ordenarMeios(selData.porMeio).map(([m, v]) => {
                const aberto = meioAberto === m
                const det = detalhe?.meios.find((x) => x.meio === m)
                return (
                  <div key={m} className="rounded-md border border-transparent hover:border-sky-200">
                    <button onClick={() => setMeioAberto(aberto ? null : m)}
                      className="flex w-full items-center justify-between px-1 py-0.5 text-left">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {MEIO_LABEL[m] ?? m}
                      </span>
                      <span className="tabular-nums">{brl(v)}</span>
                    </button>

                    {aberto && (
                      <div className="space-y-1.5 border-t border-sky-100 px-2 py-2">
                        {carregandoDet && <p className="text-xs text-muted-foreground">carregando lançamentos…</p>}
                        {!carregandoDet && (det?.lancamentos.length ?? 0) === 0 && (
                          <p className="text-xs text-muted-foreground">Sem lançamento vinculado — este valor não tem origem rastreada no extrato.</p>
                        )}
                        {det?.lancamentos.map((l) => (
                          <div key={l.transactionId} className="rounded bg-white/70 px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium">{l.descricao}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  entrou {fmtDiaCurto(l.dataEntrada)} · {l.contaNome}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-medium tabular-nums">{brl(l.valor)}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] italic text-sky-700">{l.motivo}</p>
                            {l.contaId && (
                              <a href={`/empresas/${id}/contas/${l.contaId}/transacoes?tx=${l.transactionId}`}
                                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline">
                                ver no extrato <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Regra do fim de semana: o que AINDA não caiu */}
            {(detalhe?.aguardando.length ?? 0) > 0 && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                {detalhe!.aguardando.map((a) => (
                  <p key={a.meio} className="text-[11px] text-amber-900">
                    <b>{MEIO_LABEL[a.meio] ?? a.meio} aguardando:</b> {a.frase}
                  </p>
                ))}
              </div>
            )}

            <p className="mt-2 text-[11px] text-muted-foreground italic">Composição estimada pelo extrato. Contagem por operação chega na fase 2 (adquirente).</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PerfilSemanaBloco({ perfil }: { perfil: PerfilSemana | null }) {
  if (!perfil) return <p className="text-sm text-muted-foreground">Perfil não configurado.</p>
  const dias: [string, Balde][] = [
    ['Seg', perfil.SEG], ['Ter', perfil.TER], ['Qua', perfil.QUA], ['Qui', perfil.QUI], ['Fim de semana', perfil.FDS],
  ]
  const maxMedia = Math.max(1, ...dias.filter(([, b]) => b.samples >= MIN_AMOSTRAS).map(([, b]) => b.media))
  return (
    <div className="space-y-2">
      {dias.map(([label, b]) => {
        const apurar = b.samples < MIN_AMOSTRAS
        return (
          <div key={label} className="flex items-center gap-3 text-[13px]">
            <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              {!apurar && <div className="h-full bg-sky-400/70" style={{ width: `${(b.media / maxMedia) * 100}%` }} />}
              <span className="absolute inset-0 flex items-center px-2 text-xs">
                {apurar
                  ? <span className="italic text-slate-400">a apurar ({b.samples} de {MIN_AMOSTRAS} semana{b.samples === 1 ? '' : 's'})</span>
                  : <span className="tabular-nums font-medium text-sky-900">~{brl(b.media)} <span className="text-[10px] text-muted-foreground font-normal">({b.samples} semanas)</span></span>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Legenda({ cls, txt }: { cls: string; txt: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded border ${cls}`} /> {txt}</span>
}

// Calendário: semanas seg-dom. Fim de semana com bloco → card único (span 3).
function Calendario({ data, onSel, sel }: { data: VendasData; onSel: (s: { tipo: 'dia' | 'bloco'; key: string } | null) => void; sel: { tipo: 'dia' | 'bloco'; key: string } | null }) {
  const [ano, mes] = data.mes.split('-').map(Number)
  const inicio = data.moduleInicio
  const hoje = data.hoje
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const d1 = new Date(Date.UTC(ano, mes - 1, 1))
  const offset = (d1.getUTCDay() + 6) % 7 // seg=0 — quantas células vazias antes do dia 1
  const maxVenda = Math.max(1, ...Object.values(data.dias).map((v) => v.total))

  // Mapa: 'YYYY-MM-DD' → bloco que o cobre (pro span do fim de semana).
  const blocoDoDia: Record<string, Bloco> = {}
  for (const b of data.blocos) {
    let cur = parseDia(b.inicio)
    const fim = parseDia(b.fim)
    while (cur.getTime() <= fim.getTime()) { blocoDoDia[cur.toISOString().slice(0, 10)] = b; cur = new Date(cur.getTime() + 86400000) }
  }

  // Constrói a sequência de células (offset vazio + dias 1..N).
  const celulas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)]

  const rows: (string | null)[][] = []
  for (let i = 0; i < celulas.length; i += 7) rows.push(celulas.slice(i, i + 7))

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => <div key={d}>{d}</div>)}
      </div>
      {rows.map((row, ri) => <SemanaRow key={ri} row={row} inicio={inicio} hoje={hoje} data={data} blocoDoDia={blocoDoDia} maxVenda={maxVenda} onSel={onSel} sel={sel} />)}
    </div>
  )
}

function SemanaRow({ row, inicio, hoje, data, blocoDoDia, maxVenda, onSel, sel }: any) {
  // Se as colunas sex/sáb/dom (índices 4,5,6) são cobertas por UM bloco, renderiza
  // Mon-Thu + card único de fim de semana (span 3).
  const sexKey = row[4], sabKey = row[5], domKey = row[6]
  const bloco = sexKey && blocoDoDia[sexKey]
  const blocoCobreFDS = bloco && sabKey && domKey && blocoDoDia[sabKey] === bloco && blocoDoDia[domKey] === bloco

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {row.map((key: string | null, ci: number) => {
        if (blocoCobreFDS && ci === 4) {
          const selKey = `${bloco.inicio}|${bloco.fim}`
          const on = sel?.tipo === 'bloco' && sel.key === selKey
          const ag = fimDeSemanaAgg(data, bloco)
          return (
            <button key={ci} onClick={() => onSel(on ? null : { tipo: 'bloco', key: selKey })}
              className={`col-span-3 rounded-md border border-sky-300 bg-sky-100 p-2 text-left transition-colors hover:bg-sky-200 ${on ? 'ring-1 ring-sky-500' : ''}`}>
              <div className="text-[10px] text-sky-700">fim de semana {parseDia(bloco.inicio).getUTCDate()}–{parseDia(bloco.fim).getUTCDate()} · sex+sáb+dom</div>
              <div className="text-[13px] font-semibold tabular-nums text-sky-800">~{brl(ag.total)}</div>
            </button>
          )
        }
        if (blocoCobreFDS && (ci === 5 || ci === 6)) return null // absorvido pelo span
        return <DiaCel key={ci} dayKey={key} inicio={inicio} hoje={hoje} data={data} maxVenda={maxVenda} onSel={onSel} sel={sel} />
      })}
    </div>
  )
}

function DiaCel({ dayKey, inicio, hoje, data, maxVenda, onSel, sel }: any) {
  if (!dayKey) return <div />
  const n = parseDia(dayKey).getUTCDate()
  const venda: DiaVenda | undefined = data.dias[dayKey]
  const preInicio = inicio && dayKey < inicio
  const futuro = dayKey > hoje
  const on = sel?.tipo === 'dia' && sel.key === dayKey

  if (venda) {
    const intensidade = Math.min(1, venda.total / maxVenda)
    const bg = intensidade > 0.66 ? 'bg-sky-200' : intensidade > 0.33 ? 'bg-sky-100' : 'bg-sky-50'
    return (
      <button onClick={() => onSel(on ? null : { tipo: 'dia', key: dayKey })}
        className={`rounded-md border border-sky-300 p-2 text-left transition-colors hover:bg-sky-200 ${bg} ${on ? 'ring-1 ring-sky-500' : ''}`}>
        <div className="text-[10px] text-muted-foreground">{n}</div>
        <div className="text-[13px] font-semibold tabular-nums text-sky-800">~{brl(venda.total)}</div>
      </button>
    )
  }
  if (preInicio) return <div className="rounded-md border border-slate-200 bg-slate-50 p-2 opacity-50"><div className="text-[10px] text-slate-400">{n}</div></div>
  if (!futuro && inicio && dayKey >= inicio) return <div className="rounded-md border border-dashed border-slate-200 p-2"><div className="text-[10px] text-slate-400">{n}</div><div className="text-[9px] text-slate-400">aguardando</div></div>
  return <div className="rounded-md border border-transparent p-2"><div className="text-[10px] text-slate-300">{n}</div></div>
}
