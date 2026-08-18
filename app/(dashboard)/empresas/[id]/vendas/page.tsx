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
interface VendasData { mes: string; moduleInicio: string | null; hoje: string; dias: Record<string, DiaVenda>; blocos: Bloco[] }

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
                {Object.entries(bloco1.porMeio).sort().map(([m, v]) => (
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
              {Object.entries(selData.porMeio).sort().map(([m, v]) => (
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
