'use client'

// ESTOQUE FASE 2 item 2.1 — home da PRODUÇÃO: lista de ordens (por estado) + nova ordem
// (escolhe a ficha + escala do lote base + data + setor). A conclusão ("quantos saíram?")
// é 2.2. Sem sugestão por min/max ainda (2.4).

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Factory, Loader2, Plus, ChevronRight, ClipboardList, Settings, TrendingDown, UtensilsCrossed } from 'lucide-react'

interface Ordem { id: string; nomeProduzido: string; unidadeProduzido: string; escalaReceitas: number; estado: string; dataProducao: string; setorNome: string | null }
interface Sugestao { fichaId: string; itemProduzidoId: string; nome: string; unidade: string; saldo: number; estoqueMin: number; estoqueMax: number | null; faltam: number; escalaSugerida: number | null; rendimentoMedio: number | null }
interface FichaOpt { id: string; nomeProduzido: string }
interface Setor { id: string; nome: string; ativo: boolean }

const ESTADO: Record<string, { label: string; cls: string }> = {
  PLANEJADA: { label: 'Planejada', cls: 'bg-slate-100 text-slate-600' },
  SEPARADA: { label: 'Separada', cls: 'bg-amber-50 text-amber-700' },
  EM_PRODUCAO: { label: 'Em produção', cls: 'bg-sky-50 text-sky-700' },
  CONCLUIDA: { label: 'Concluída', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-rose-50 text-rose-600' },
}
const fmtDia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export default function ProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ordens, setOrdens] = useState<Ordem[] | null | undefined>(undefined)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [novo, setNovo] = useState(false)
  const [criando, setCriando] = useState<string | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens`).then((r) => r.json()).then((j) => { setOrdens(j.ordens ?? []); setSugestoes(j.sugestoes ?? []) }).catch(() => setOrdens(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const produzirSugestao = async (s: Sugestao) => {
    setCriando(s.fichaId)
    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId: s.fichaId, escalaReceitas: s.escalaSugerida ?? 1, dataProducao: hoje }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ordemId) window.location.href = `/empresas/${id}/estoque/producao/${j.ordemId}`
    } finally { setCriando(null) }
  }

  if (ordens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (ordens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a produção.</div>

  const abertas = ordens.filter((o) => ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'].includes(o.estado))
  const encerradas = ordens.filter((o) => ['CONCLUIDA', 'CANCELADA'].includes(o.estado))

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Factory className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Produção</h1><p className="text-sm text-slate-500">Cria a ordem, separa da câmara e produz. A ficha diz a receita; aqui você faz.</p></div>
        <a href={`/empresas/${id}/estoque/cardapio`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><UtensilsCrossed className="h-4 w-4" /> Cardápio</a>
        <a href={`/empresas/${id}/estoque/fichas`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><ClipboardList className="h-4 w-4" /> Fichas</a>
        <button onClick={() => setNovo((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]"><Plus className="h-4 w-4" /> Nova ordem</button>
      </div>

      {novo && <NovaOrdem id={id} onCriada={(ordemId) => { window.location.href = `/empresas/${id}/estoque/producao/${ordemId}` }} onFechar={() => setNovo(false)} />}

      {/* sugestão de produção (min/max) */}
      {sugestoes.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><TrendingDown className="h-4 w-4" /> Sugestão de produção ({sugestoes.length})</h2>
          <div className="space-y-2">
            {sugestoes.map((s) => (
              <Card key={s.fichaId} className="border-amber-200"><CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{s.nome}</p>
                  <p className="text-xs text-slate-500">saldo {s.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {s.unidade} · abaixo do mínimo {s.estoqueMin} · faltam ~{s.faltam.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} {s.unidade}{s.rendimentoMedio == null && ' · rendimento a apurar'}</p>
                </div>
                <button onClick={() => produzirSugestao(s)} disabled={criando === s.fichaId} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50">{criando === s.fichaId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />} produzir{s.escalaSugerida ? ` ${s.escalaSugerida}×` : ''}</button>
              </CardContent></Card>
            ))}
          </div>
        </div>
      )}

      {ordens.length === 0 && !novo ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Factory className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhuma ordem de produção ainda.</p>
          <p className="max-w-md text-xs text-slate-500">Crie uma ordem a partir de uma ficha (ex: 5× a receita da porção de carne). O sistema já pré-preenche a separação com os insumos e as quantidades.</p>
        </CardContent></Card>
      ) : (
        <>
          {abertas.length > 0 && <Secao titulo="Em aberto" ordens={abertas} id={id} />}
          {encerradas.length > 0 && <Secao titulo="Encerradas" ordens={encerradas} id={id} />}
        </>
      )}
    </div>
  )
}

function Secao({ titulo, ordens, id }: { titulo: string; ordens: Ordem[]; id: string }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{titulo} ({ordens.length})</h2>
      <div className="space-y-2">
        {ordens.map((o) => {
          const e = ESTADO[o.estado] ?? { label: o.estado, cls: 'bg-slate-100 text-slate-600' }
          return (
            <a key={o.id} href={`/empresas/${id}/estoque/producao/${o.id}`} className="block">
              <Card className="transition hover:border-[#185FA5] hover:shadow-sm"><CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{o.nomeProduzido}</p>
                  <p className="text-xs text-slate-500">{o.escalaReceitas}× a receita · {fmtDia(o.dataProducao)}{o.setorNome ? ` · ${o.setorNome}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${e.cls}`}>{e.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </div>
              </CardContent></Card>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function NovaOrdem({ id, onCriada, onFechar }: { id: string; onCriada: (ordemId: string) => void; onFechar: () => void }) {
  const [fichas, setFichas] = useState<FichaOpt[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [fichaId, setFichaId] = useState('')
  const [escala, setEscala] = useState('1')
  const [data, setData] = useState('')
  const [setorId, setSetorId] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/fichas`).then((r) => r.json()).then((j) => setFichas(j.fichas ?? [])).catch(() => {})
    fetch(`/api/empresas/${id}/estoque/setores`).then((r) => r.json()).then((j) => setSetores(j.setores ?? [])).catch(() => {})
  }, [id])

  const criar = async () => {
    setErro(null)
    const esc = Number(escala.replace(',', '.'))
    if (!fichaId) return setErro('Escolha a ficha.')
    if (!(esc > 0)) return setErro('Escala tem que ser maior que zero.')
    if (!data) return setErro('Informe a data de produção.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichaId, escalaReceitas: esc, dataProducao: data, setorId: setorId || null }) })
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
            <label className="text-xs text-slate-500">Escala (× lote base)
              <input value={escala} onChange={(e) => setEscala(e.target.value)} inputMode="decimal" className="mt-1 block w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-500">Data de produção
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm" />
            </label>
            <label className="text-xs text-slate-500">Setor
              <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option value="">—</option>{setores.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
            </label>
            <a href={`/empresas/${id}/estoque/producao/cadastros`} className="inline-flex items-center gap-1 pb-2 text-[11px] text-slate-400 hover:text-slate-600"><Settings className="h-3 w-3" /> setores</a>
          </div>
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
          <button onClick={criar} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar ordem</button>
        </>
      )}
    </CardContent></Card>
  )
}
