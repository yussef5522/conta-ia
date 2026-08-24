'use client'

// ESTOQUE FASE 1 item 4 — tela RECEBIMENTOS. A fila (AGUARDANDO_MERCADORIA) nasce vazia
// e enche sozinha (cron horário). Badge "aguardando há X dias" (amarelo>2, vermelho>5),
// com "deixar pra depois" que SILENCIA o badge (decisão do dono; a nota fica na fila,
// cinza). Busca por chave ("chegou sem aparecer na fila"). Seção "Recebidas" com recibo.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Inbox, PackageOpen, Archive, Info, Loader2, Clock, FlaskConical, ChevronRight, MoonStar, Search, Loader, CheckCircle2, Receipt, AlertTriangle } from 'lucide-react'

interface FilaCard {
  id: string; emitNome: string | null; emitCnpj: string | null; vNF: number | null
  dataEmissao: string | null; nItens: number; cancelada: boolean; esperandoDias: number | null
  adiada: boolean; motivoAdiada: string | null
}
interface Recebida {
  nfeId: string; conferenceId: string | null; chave: string; nNF: string | null
  emitNome: string | null; vNF: number | null; confirmadoEm: string | null; divergente: boolean
}
interface Recebimentos {
  dataCorte: string | null; ultimoDownload: string | null
  fila: FilaCard[]; recebidas: Recebida[]
  historicasCount: number; historicasPeriodo: { de: string | null; ate: string | null }
}
interface EntradaManual { id: string; fornecedorNome: string; data: string; valorTotal: number; geraPayable: boolean; criadoPorNome: string | null }
interface Relatorio { total: number; historicas: number; novas: number; fornecedoresDistintos: number; valorTotalNovas: number }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const fmtDataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const fmtCnpj = (c: string | null) => (c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—')

export default function RecebimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ recebimentos: Recebimentos; relatorio: Relatorio } | null | undefined>(undefined)
  const [verHistoricas, setVerHistoricas] = useState(false)
  // entradas manuais (compra sem nota) entram na MESMA seção "Recebidas", marcadas MANUAL
  const [manuais, setManuais] = useState<EntradaManual[]>([])

  const recarregar = () => fetch(`/api/empresas/${id}/estoque/recebimentos`).then((r) => r.json()).then((j) => setData(j.recebimentos ? j : null)).catch(() => setData(null))
  useEffect(() => { recarregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/entrada-manual`).then((x) => x.json()).then((j) => setManuais(j.entradas ?? [])).catch(() => {})
  }, [id])

  if (data === undefined) return <div className="p-0"><Card><CardContent className="flex items-center gap-2 p-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</CardContent></Card></div>
  if (data === null) return <div className="p-0"><Card><CardContent className="p-6 text-sm text-slate-500">Não consegui carregar os recebimentos.</CardContent></Card></div>

  const { recebimentos: r, relatorio: rel } = data
  const filaAtiva = r.fila.filter((n) => !n.adiada)
  const filaAdiada = r.fila.filter((n) => n.adiada)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Inbox className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Recebimentos</h1>
        <p className="hidden min-w-[20rem] flex-1 truncate text-xs text-slate-400 lg:block">Notas emitidas contra o CNPJ da empresa, direto da SEFAZ — a fila enche sozinha a partir de {fmt(r.dataCorte)}</p>
        {/* Fornecedor que NÃO emite nota (produtor rural, compra avulsa no mercado) não
         * pode ficar fora do estoque só porque não tem XML — entra por aqui. */}
        <a href={`/empresas/${id}/estoque/entrada-manual`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
          <PackageOpen className="h-3.5 w-3.5" /> Entrada manual (sem nota)
        </a>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 p-6 text-sm sm:grid-cols-4">
          <Stat label="Na fila" value={String(filaAtiva.length)} accent="text-[#185FA5]" />
          <Stat label="Recebidas" value={String(r.recebidas.length)} accent="text-emerald-600" />
          <Stat label="Históricas" value={String(r.historicasCount)} />
          <Stat label="Último download" value={fmtDataHora(r.ultimoDownload)} small />
        </CardContent>
      </Card>

      {/* Busca por chave — "chegou sem aparecer na fila" */}
      <BuscarChave id={id} onAchou={recarregar} />

      {/* FILA ativa */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><PackageOpen className="h-4 w-4" /> Aguardando mercadoria ({filaAtiva.length})</h2>
        {filaAtiva.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">A fila está vazia — e é assim que começa.</p>
            <p className="max-w-md text-xs text-slate-500">Nada do que já passou entra no estoque. Quando um fornecedor emitir uma nota a partir de {fmt(r.dataCorte)}, ela aparece aqui sozinha (a SEFAZ é consultada de hora em hora). Aí você confere a mercadoria e confirma.</p>
            <a href={`/empresas/${id}/estoque/recebimentos/preview`} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#185FA5] px-4 py-2 text-sm font-medium text-[#185FA5] active:bg-slate-50"><FlaskConical className="h-4 w-4" /> Testar a conferência (modo teste)</a>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">{filaAtiva.map((n) => <FilaLinha key={n.id} n={n} id={id} onMudou={recarregar} />)}</div>
        )}
      </div>

      {/* Adiadas — "deixar pra depois" (silenciadas) */}
      {filaAdiada.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-500"><MoonStar className="h-4 w-4" /> Deixadas pra depois ({filaAdiada.length})</h2>
          <p className="mb-2 text-xs text-slate-400">Ficam na fila, sem alarme. Você escolheu não dar entrada agora — traga de volta quando quiser conferir.</p>
          <div className="space-y-2">{filaAdiada.map((n) => <FilaLinha key={n.id} n={n} id={id} onMudou={recarregar} />)}</div>
        </div>
      )}

      {/* RECEBIDAS — confirmadas, com recibo */}
      {(r.recebidas.length > 0 || manuais.length > 0) && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Recebidas ({r.recebidas.length + manuais.length})</h2>
          <div className="space-y-2">
            {manuais.map((m) => (
              <Card key={m.id} className="transition hover:border-emerald-400 hover:shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {m.fornecedorNome}
                      <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">manual</span>
                    </p>
                    <p className="text-xs text-slate-500">sem nota · compra em {fmt(m.data)}{m.criadoPorNome ? ` · por ${m.criadoPorNome}` : ''}{m.geraPayable ? ' · gera parcela' : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(m.valorTotal)}</span>
                    <a href={`/empresas/${id}/estoque/entradas/${m.id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><Receipt className="h-3.5 w-3.5" /> recibo</a>
                  </div>
                </CardContent>
              </Card>
            ))}
            {r.recebidas.map((n) => (
              <Card key={n.nfeId} className={n.conferenceId ? 'transition hover:border-emerald-400 hover:shadow-sm' : ''}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{n.emitNome ?? '(sem nome)'}{n.divergente && <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"><AlertTriangle className="h-3 w-3" /> divergência</span>}</p>
                    <p className="text-xs text-slate-500">{n.nNF ? `nº ${n.nNF} · ` : ''}confirmada {fmtDataHora(n.confirmadoEm)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(n.vNF)}</span>
                    {n.conferenceId && <a href={`/empresas/${id}/estoque/recibos/${n.conferenceId}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><Receipt className="h-3.5 w-3.5" /> recibo</a>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* HISTÓRICAS — visíveis, sem ação */}
      <div>
        <button onClick={() => setVerHistoricas((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
          <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> {r.historicasCount} notas históricas (antes de {fmt(r.dataCorte)})</span>
          <span className="text-xs text-slate-400">{verHistoricas ? 'ocultar' : 'ver'}</span>
        </button>
        {verHistoricas && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-slate-50 p-4 text-xs text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{r.historicasCount} notas de {fmt(r.historicasPeriodo.de)} a {fmt(r.historicasPeriodo.ate)} — a mercadoria delas já foi recebida e consumida. Ficam aqui só pra consulta: <b>não entram no estoque</b> (senão criariam estoque fantasma). O estoque começa do zero, daqui pra frente.</span>
          </div>
        )}
      </div>
    </div>
  )
}

// badge de idade: amarelo>2, vermelho>5; adiada → silencia (cinza)
function IdadeBadge({ dias, adiada }: { dias: number | null; adiada: boolean }) {
  if (adiada) return <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><MoonStar className="h-3 w-3" /> pra depois</span>
  if (dias == null || dias <= 0) return null
  const cor = dias > 5 ? 'text-rose-600' : dias > 2 ? 'text-amber-600' : 'text-slate-400'
  return <span className={`inline-flex items-center gap-1 text-[11px] ${cor}`}><Clock className="h-3 w-3" /> {dias}d esperando</span>
}

function FilaLinha({ n, id, onMudou }: { n: FilaCard; id: string; onMudou: () => void }) {
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    try {
      await fetch(`/api/empresas/${id}/estoque/recebimentos/${n.id}/adiar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adiar: !n.adiada }) })
      onMudou()
    } finally { setBusy(false) }
  }
  return (
    <Card className={n.adiada ? 'opacity-70' : 'transition hover:border-[#185FA5] hover:shadow-sm'}>
      <CardContent className="flex items-center justify-between gap-2 p-4">
        <a href={`/empresas/${id}/estoque/recebimentos/${n.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{n.emitNome ?? '(sem nome)'}</p>
          <p className="text-xs text-slate-500">{fmtCnpj(n.emitCnpj)} · {fmt(n.dataEmissao)} · {n.nItens} {n.nItens === 1 ? 'item' : 'itens'}{n.cancelada && <span className="ml-1 font-semibold text-rose-600">· CANCELADA</span>}</p>
        </a>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(n.vNF)}</span>
          <IdadeBadge dias={n.esperandoDias} adiada={n.adiada} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} disabled={busy} title={n.adiada ? 'trazer de volta pra fila' : 'deixar pra depois (silencia o aviso)'} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : n.adiada ? 'trazer de volta' : 'deixar pra depois'}
          </button>
          <a href={`/empresas/${id}/estoque/recebimentos/${n.id}`}><ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /></a>
        </div>
      </CardContent>
    </Card>
  )
}

function BuscarChave({ id, onAchou }: { id: string; onAchou: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [chave, setChave] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const digitos = chave.replace(/\D/g, '')

  const buscar = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/recebimentos/buscar-chave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: digitos }) })
      const j = await r.json().catch(() => null)
      setMsg({ ok: !!j?.ok, texto: j?.motivo ?? 'Não consegui buscar.' })
      if (j?.ok) { setChave(''); onAchou() }
    } catch { setMsg({ ok: false, texto: 'Falha de conexão.' }) } finally { setBusy(false) }
  }

  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5]">
      <Search className="h-4 w-4" /> Chegou uma nota que não apareceu na fila? Buscar pela chave
    </button>
  )
  return (
    <Card><CardContent className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Search className="h-4 w-4" /> Buscar nota pela chave</p>
      <p className="text-xs text-slate-500">Digite (ou aponte a câmera pro código de barras do DANFE — em breve leitura automática) os 44 dígitos da chave de acesso. A gente consulta a SEFAZ e coloca a nota na fila.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={chave} onChange={(e) => setChave(e.target.value)} inputMode="numeric" placeholder="chave de 44 dígitos" className="flex-1 min-w-[220px] rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
        <span className={`text-xs tabular-nums ${digitos.length === 44 ? 'text-emerald-600' : 'text-slate-400'}`}>{digitos.length}/44</span>
        <button onClick={buscar} disabled={busy || digitos.length !== 44} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50">{busy ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar</button>
        <button onClick={() => { setAberto(false); setMsg(null) }} className="text-xs text-slate-400 hover:text-slate-600">fechar</button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.texto}</p>}
    </CardContent></Card>
  )
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent?: string; small?: boolean }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className={`font-semibold tabular-nums ${small ? 'text-sm' : 'text-lg'} ${accent ?? 'text-slate-900'}`}>{value}</p></div>
}
