'use client'

// VENDAS FASE 1 item 6 — tela /vendas, Blocos 1 (número grande) + 2 (calendário).
// Tudo ~ESTIMADO por enquanto (extrato-inferido): til + cor de estimativa, distinta
// de confirmado (que ainda não existe). Comparação SDLW/SWLY = "a apurar" (só 6 dias
// de histórico). Foco agosto: dias antes de 12/08 = "antes do início do sistema"
// (distinto de sem-venda). Fim de semana num card só; composição no clique.

import { useEffect, useState, useMemo, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, Info } from 'lucide-react'

interface DiaVenda { total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }
interface Bloco { inicio: string; fim: string; total: number; porMeio: Record<string, number>; estimado: boolean; confirmadoPerfil: boolean }
interface Balde { samples: number; total: number; media: number }
interface PerfilSemana { SEG: Balde; TER: Balde; QUA: Balde; QUI: Balde; FDS: Balde }
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
  const unidades = useMemo(() => {
    if (!data) return []
    const cobertos = new Set<string>()
    for (const b of data.blocos) { let c = parseDia(b.inicio); const f = parseDia(b.fim); while (c.getTime() <= f.getTime()) { cobertos.add(c.toISOString().slice(0, 10)); c = new Date(c.getTime() + 86400000) } }
    const us: { inicio: string; fim: string; total: number; porMeio: Record<string, number>; isBloco: boolean }[] = []
    for (const [d, v] of Object.entries(data.dias)) if (!cobertos.has(d)) us.push({ inicio: d, fim: d, total: v.total, porMeio: v.porMeio, isBloco: false })
    for (const b of data.blocos) { const ag = fimDeSemanaAgg(data, b); us.push({ inicio: b.inicio, fim: b.fim, total: ag.total, porMeio: ag.porMeio, isBloco: true }) }
    return us.sort((a, b) => (a.fim < b.fim ? -1 : 1))
  }, [data])

  const bloco1 = useMemo(() => {
    if (!data || unidades.length === 0) return null
    const somaMeio = (us: typeof unidades) => us.reduce((acc, u) => { for (const [m, v] of Object.entries(u.porMeio)) acc[m] = (acc[m] ?? 0) + v; return acc }, {} as Record<string, number>)
    if (toggle === 'MES') {
      const tot = unidades.reduce((s, u) => s + u.total, 0)
      return { label: `${MESNOME[Number(mes.split('-')[1]) - 1]} (a partir de 12/08)`, total: tot, porMeio: somaMeio(unidades) }
    }
    if (toggle === 'SEMANA') {
      // Semana (seg-dom) que contém a última competência.
      const ultima = parseDia(unidades[unidades.length - 1].fim)
      const dow = (ultima.getUTCDay() + 6) % 7 // seg=0
      const segMs = ultima.getTime() - dow * 86400000
      const domMs = segMs + 6 * 86400000
      const naSemana = unidades.filter((u) => { const t = parseDia(u.fim).getTime(); return t >= segMs && t <= domMs })
      const seg = new Date(segMs), dom = new Date(domMs)
      const rot = `Semana ${String(seg.getUTCDate()).padStart(2, '0')}/${String(seg.getUTCMonth() + 1).padStart(2, '0')}–${String(dom.getUTCDate()).padStart(2, '0')}/${String(dom.getUTCMonth() + 1).padStart(2, '0')}`
      return { label: rot, total: naSemana.reduce((s, u) => s + u.total, 0), porMeio: somaMeio(naSemana) }
    }
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
    for (const b of data.blocos) add(b.porMeio)
    const total = Object.values(pm).reduce((s, v) => s + v, 0)
    return { total: Math.round((total + 1e-9) * 100) / 100, porMeio: pm }
  }, [data])

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div>
        <h1 className="text-xl font-medium">Vendas</h1>
        <p className="text-sm text-muted-foreground">Quando a venda aconteceu (não quando o dinheiro chegou). Tudo <span className="text-sky-600">~estimado</span> pelo extrato por enquanto.</p>
      </div>

      {/* BLOCO 1 — número grande */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex rounded-lg border p-0.5 text-xs">
              {(['DIA', 'SEMANA', 'MES'] as Toggle[]).map((t) => (
                <button key={t} onClick={() => setToggle(t)} className={`px-3 py-1 rounded-md transition-colors ${toggle === t ? 'bg-sky-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                  {t === 'DIA' ? 'Dia' : t === 'SEMANA' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">vs período anterior: <span className="italic">a apurar</span></span>
          </div>
          {bloco1 ? (
            <>
              <p className="text-xs text-muted-foreground">{bloco1.label}</p>
              <p className="text-4xl font-semibold tabular-nums text-sky-700">
                <span className="text-2xl align-top text-sky-400">~</span>{brl(bloco1.total)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {ordenarMeios(bloco1.porMeio).map(([m, v]) => (
                  <span key={m}>{MEIO_LABEL[m] ?? m}: <span className="tabular-nums text-foreground">{brl(v)}</span></span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-2xl font-medium text-muted-foreground">Sem vendas no período</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Comparação semana passada / ano passado: <span className="italic">a apurar</span> (só há 6 dias de histórico desde 12/08).</p>
        </CardContent>
      </Card>

      {/* BLOCO 2 — calendário */}
      <Card>
        <CardContent className="py-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">{MESNOME[Number(mes.split('-')[1]) - 1]} de {mes.split('-')[0]}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <Info className="h-3 w-3" /> O sistema de vendas começou em <b className="mx-1">12/08</b> — dias antes disso não têm dado de venda (não é loja fechada).
          </p>
          <Calendario data={data} onSel={setSel} sel={sel} />
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <Legenda cls="bg-sky-100 border-sky-300" txt="~venda estimada" />
            <Legenda cls="bg-emerald-500/80 border-emerald-600" txt="venda confirmada (fase 2)" />
            <Legenda cls="bg-slate-100 border-slate-200 border-dashed" txt="aguardando (dinheiro não chegou)" />
            <Legenda cls="bg-slate-50 border-slate-200 opacity-50" txt="antes do início (12/08)" />
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 3 — perfil da semana */}
      <Card>
        <CardContent className="py-5">
          <h2 className="text-sm font-medium mb-1">Perfil da semana</h2>
          <p className="text-xs text-muted-foreground mb-4">Quanto uma [dia] típica vende, na média. Precisa de pelo menos {MIN_AMOSTRAS} semanas por dia — até lá, <span className="italic">a apurar</span>.</p>
          <PerfilSemanaBloco perfil={data.perfilSemana} />
        </CardContent>
      </Card>

      {/* BLOCO 4 — composição por meio (do mês) */}
      <Card>
        <CardContent className="py-5">
          <h2 className="text-sm font-medium mb-1">Composição por meio · {MESNOME[Number(mes.split('-')[1]) - 1]}</h2>
          <p className="text-xs text-muted-foreground mb-3">Bruto, taxa e líquido por adquirente chegam na fase 2. Estornos aparecem como faixa negativa (0 por enquanto).</p>
          {composicaoMes.total > 0 ? (
            <>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {ordenarMeios(composicaoMes.porMeio).map(([m, v]) => (
                  <div key={m} className={MEIO_COR[m] ?? 'bg-slate-400'} style={{ width: `${(v / composicaoMes.total) * 100}%` }} title={`${MEIO_LABEL[m] ?? m}: ${brl(v)}`} />
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {ordenarMeios(composicaoMes.porMeio).map(([m, v]) => (
                  <div key={m} className="flex items-center gap-2 text-sm">
                    <span className={`inline-block h-3 w-3 rounded-sm ${MEIO_COR[m] ?? 'bg-slate-400'}`} />
                    <span className="text-muted-foreground w-24">{MEIO_LABEL[m] ?? m}</span>
                    <span className="tabular-nums font-medium">{brl(v)}</span>
                    <span className="text-xs text-muted-foreground">({Math.round((v / composicaoMes.total) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Sem vendas no mês.</p>}
        </CardContent>
      </Card>

      {/* BLOCO 6 — período e comparação */}
      <Card>
        <CardContent className="py-5">
          <h2 className="text-sm font-medium mb-1">Comparações</h2>
          <p className="text-xs text-muted-foreground mb-3">Semana × semana passada, mês × mês anterior, trimestre, ano × ano. Ligam quando houver histórico suficiente.</p>
          <div className="space-y-2 text-sm">
            {[
              ['Esta semana × semana passada (SDLW)', 'a apurar — 1ª semana'],
              ['Este mês × mês anterior', 'a apurar — só agosto (desde 12/08)'],
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
            <p className="text-2xl font-semibold tabular-nums text-sky-700 mt-1"><span className="text-lg align-top text-sky-400">~</span>{brl(selData.total)}</p>
            <div className="mt-2 space-y-1 text-sm">
              {ordenarMeios(selData.porMeio).map(([m, v]) => (
                <div key={m} className="flex justify-between"><span className="text-muted-foreground">{MEIO_LABEL[m] ?? m}</span><span className="tabular-nums">{brl(v)}</span></div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground italic">Composição estimada pelo extrato. "Ver operações do dia" e contagem chegam na fase 2 (adquirente).</p>
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
          <div key={label} className="flex items-center gap-3 text-sm">
            <span className="w-28 text-muted-foreground shrink-0">{label}</span>
            <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden relative">
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
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground text-center">
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
    <div className="grid grid-cols-7 gap-1">
      {row.map((key: string | null, ci: number) => {
        if (blocoCobreFDS && ci === 4) {
          const selKey = `${bloco.inicio}|${bloco.fim}`
          const on = sel?.tipo === 'bloco' && sel.key === selKey
          const ag = fimDeSemanaAgg(data, bloco)
          return (
            <button key={ci} onClick={() => onSel(on ? null : { tipo: 'bloco', key: selKey })}
              className={`col-span-3 rounded-md border p-2 text-left transition-colors bg-sky-100 border-sky-300 hover:bg-sky-200 ${on ? 'ring-2 ring-sky-500' : ''}`}>
              <div className="text-[10px] text-sky-700">fim de semana {parseDia(bloco.inicio).getUTCDate()}–{parseDia(bloco.fim).getUTCDate()} · sex+sáb+dom</div>
              <div className="text-sm font-semibold tabular-nums text-sky-800">~{brl(ag.total)}</div>
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
        className={`rounded-md border border-sky-300 p-2 text-left transition-colors hover:bg-sky-200 ${bg} ${on ? 'ring-2 ring-sky-500' : ''}`}>
        <div className="text-[10px] text-muted-foreground">{n}</div>
        <div className="text-xs font-semibold tabular-nums text-sky-800">~{brl(venda.total)}</div>
      </button>
    )
  }
  if (preInicio) return <div className="rounded-md border border-slate-200 bg-slate-50 p-2 opacity-50"><div className="text-[10px] text-slate-400">{n}</div></div>
  if (!futuro && inicio && dayKey >= inicio) return <div className="rounded-md border border-dashed border-slate-200 p-2"><div className="text-[10px] text-slate-400">{n}</div><div className="text-[9px] text-slate-400">aguardando</div></div>
  return <div className="rounded-md border border-transparent p-2"><div className="text-[10px] text-slate-300">{n}</div></div>
}
