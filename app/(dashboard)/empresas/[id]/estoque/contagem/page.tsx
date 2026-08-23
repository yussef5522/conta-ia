'use client'

// ESTOQUE FASE 3 PARTE 2 — CONTAGEM (template Vuca). Lista ÚNICA agrupada por categoria,
// progresso por categoria e geral, busca, filtro "não contados > 7 dias". Por linha:
// produto · última contagem (tap → QUEM contou) · saldo do sistema no instante · campo de
// contagem inline (KG decimal / UN inteiro) · divergência ao vivo em qtd e R$ · check.
//
// O contador conta VENDO o teórico (decisão do dono — é como o Vuca faz: esconder o
// sistema atrasa e não impede o viés, e o dono quer enxergar a diferença na hora).
// Item nunca contado = "sem contagem" CINZA, nunca zero — zero é uma afirmação.
// Ajuste na hora, por linha: confirmar grava AJUSTE_CONTAGEM no ledger na mesma hora.
// Divergência grande → o SERVIDOR recusa (409 FREIO) e a tela pede a 2ª confirmação.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Loader2, Search, Check, AlertTriangle, ChevronDown, ChevronRight, User, X, Play, Flag } from 'lucide-react'

interface Linha {
  itemId: string; nome: string; categoria: string; categoriaLabel: string; unidadeControle: string
  saldoSistema: number; custoUnitario: number
  ultimaContagemEm: string | null; ultimaContagemPor: string | null; diasSemContagem: number | null
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number; contadoPorNome: string | null; contadoEm: string } | null
}
interface Quadro {
  contagem: { id: string; tipo: string; status: string; iniciadaEm: string; criadoPorNome: string | null } | null
  linhas: Linha[]; totalItens: number; totalContados: number; divergenciaValor: number
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const fmtQuando = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ContagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [q, setQ] = useState<Quadro | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [soAntigos, setSoAntigos] = useState(false)
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const [rascunho, setRascunho] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [quemContou, setQuemContou] = useState<string | null>(null)
  const [freio, setFreio] = useState<{ itemId: string; nome: string; qtd: number; msg: string } | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/contagem`).then((r) => r.json()).then((j) => setQ(j.quadro ?? null)).catch(() => setQ(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    if (!q) return []
    let ls = q.linhas
    if (busca.trim()) ls = ls.filter((l) => l.nome.toLowerCase().includes(busca.toLowerCase()))
    if (soPendentes) ls = ls.filter((l) => !l.contado)
    // "não contados > 7 dias" inclui quem NUNCA foi contado (null = nunca, o pior caso)
    if (soAntigos) ls = ls.filter((l) => l.diasSemContagem == null || l.diasSemContagem > 7)
    return ls
  }, [q, busca, soPendentes, soAntigos])

  const grupos = useMemo(() => {
    const m = new Map<string, Linha[]>()
    for (const l of filtradas) { const a = m.get(l.categoriaLabel) ?? []; a.push(l); m.set(l.categoriaLabel, a) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtradas])

  async function iniciar(tipo?: 'INICIAL' | 'ROTINA') {
    setIniciando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tipo ? { tipo } : {}) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui iniciar a contagem.'); return }
      await carregar()
    } catch { setErro('Falha de rede ao iniciar a contagem.') } finally { setIniciando(false) }
  }

  async function contar(l: Linha, valor: string, confirmarFreio = false) {
    if (!q?.contagem) return
    const qtd = Number(valor.replace(',', '.'))
    if (valor.trim() === '' || !Number.isFinite(qtd) || qtd < 0) { setErro(`Quantidade inválida em "${l.nome}".`); return }
    setSalvando(l.itemId); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/linha`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contagemId: q.contagem.id, itemId: l.itemId, qtdContada: qtd, confirmarFreio }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.status === 409 && j.code === 'FREIO') { setFreio({ itemId: l.itemId, nome: l.nome, qtd, msg: j.erro }); return }
      if (!r.ok) { setErro(j.erro ?? 'Não consegui gravar a contagem.'); return }
      setRascunho((s) => { const n = { ...s }; delete n[l.itemId]; return n })
      setFreio(null)
      await carregar()
    } catch { setErro('Falha de rede ao gravar a contagem.') } finally { setSalvando(null) }
  }

  async function finalizar(acao: 'finalizar' | 'cancelar') {
    if (!q?.contagem) return
    setFinalizando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/finalizar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contagemId: q.contagem.id, acao }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui encerrar a contagem.'); return }
      location.href = `/empresas/${id}/estoque/contagens`
    } catch { setErro('Falha de rede ao encerrar.') } finally { setFinalizando(false) }
  }

  if (q === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!q) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a contagem.</div>

  // ---- sem sessão aberta: começar ----
  if (!q.contagem) {
    const primeira = q.linhas.every((l) => l.ultimaContagemEm == null)
    return (
      <div className="space-y-3">
        <Cabecalho id={id} />
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">{primeira ? 'Nenhuma contagem ainda — essa é a INICIAL, o ponto-zero do estoque.' : 'Nenhuma contagem aberta.'}</p>
          <p className="max-w-lg text-xs text-slate-500">
            {primeira
              ? 'Você conta vendo o que o sistema acha que tem; cada linha confirmada ajusta o saldo na hora. Pode contar por área e voltar depois — a sessão fica aberta até você finalizar.'
              : 'Comece uma nova contagem. Ela fica aberta enquanto você anda pela loja; cada linha confirmada ajusta o saldo na hora.'}
          </p>
          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
          <button onClick={() => iniciar()} disabled={iniciando} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-50">
            {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {primeira ? 'Começar contagem inicial' : 'Começar contagem'}
          </button>
        </CardContent></Card>
      </div>
    )
  }

  const pct = q.totalItens ? Math.round((q.totalContados / q.totalItens) * 100) : 0

  return (
    <div className="space-y-3 pb-24">
      <Cabecalho id={id} sessao={q.contagem} />

      {/* progresso geral + filtros numa linha */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative w-full max-w-[320px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item…" className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-sm" />
        </div>
        <button onClick={() => setSoPendentes((v) => !v)} className={`h-9 shrink-0 rounded-lg border px-2.5 text-xs ${soPendentes ? 'border-[#185FA5] bg-[#185FA5]/5 text-[#185FA5]' : 'border-slate-300 text-slate-600'}`}>Só não contados</button>
        <button onClick={() => setSoAntigos((v) => !v)} className={`h-9 shrink-0 rounded-lg border px-2.5 text-xs ${soAntigos ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-600'}`}>Não contados &gt; 7 dias</button>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="tabular-nums"><b className="text-slate-800">{q.totalContados}/{q.totalItens}</b> contados</span>
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block"><span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} /></span>
        </span>
      </div>

      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {grupos.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-slate-500">Nenhum item com esse filtro.</CardContent></Card>
      ) : grupos.map(([label, ls]) => {
        const col = colapsadas.has(label)
        const contados = ls.filter((l) => l.contado).length
        return (
          <div key={label} className="space-y-1">
            <button onClick={() => setColapsadas((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })}
              className="flex w-full items-center gap-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {col ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {label}
              <span className="font-normal normal-case tracking-normal text-slate-400">{contados}/{ls.length} contados</span>
            </button>
            {!col && (
              <Card><CardContent className="p-0">
                {/* ===== DESKTOP ===== */}
                <table className="density-normal hidden w-full sm:table">
                  <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Produto</th>
                    <th className="px-3 py-2 font-medium">Última contagem</th>
                    <th className="px-3 py-2 text-right font-medium">Sistema</th>
                    <th className="px-3 py-2 text-right font-medium">Contado</th>
                    <th className="px-3 py-2 text-right font-medium">Divergência</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {ls.map((l) => (
                      <LinhaTabela key={l.itemId} l={l} rascunho={rascunho} setRascunho={setRascunho} salvando={salvando === l.itemId}
                        onContar={(v) => contar(l, v)} quemContou={quemContou} setQuemContou={setQuemContou} />
                    ))}
                  </tbody>
                </table>
                {/* ===== MOBILE (é onde o dono conta, andando) ===== */}
                <div className="divide-y divide-slate-50 sm:hidden">
                  {ls.map((l) => (
                    <LinhaCard key={l.itemId} l={l} rascunho={rascunho} setRascunho={setRascunho} salvando={salvando === l.itemId}
                      onContar={(v) => contar(l, v)} quemContou={quemContou} setQuemContou={setQuemContou} />
                  ))}
                </div>
              </CardContent></Card>
            )}
          </div>
        )
      })}

      {/* BARRA FIXA — progresso, divergência acumulada e encerrar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:left-60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs tabular-nums text-slate-500"><b className="text-slate-800">{q.totalContados}/{q.totalItens}</b> contados</span>
          {Math.abs(q.divergenciaValor) > 0.005 && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${q.divergenciaValor < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              <AlertTriangle className="h-3.5 w-3.5" /> ajuste acumulado {brl(q.divergenciaValor)}
            </span>
          )}
          <span className="hidden text-[11px] text-slate-400 lg:block">Cada linha confirmada já ajustou o saldo — pode sair e voltar depois.</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => finalizar('cancelar')} disabled={finalizando} className="h-10 rounded-xl border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar sessão</button>
            <button onClick={() => finalizar('finalizar')} disabled={finalizando || q.totalContados === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
              {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} Finalizar contagem
            </button>
          </div>
        </div>
      </div>

      {/* O FREIO — 2ª confirmação. O servidor já recusou uma vez; aqui o dono assume. */}
      {freio && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setFreio(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-slate-900">Diferença grande — confere?</h3>
                <p className="mt-1 text-sm text-slate-600">{freio.msg}</p>
                <p className="mt-2 text-xs text-slate-400">Confirmando, o ajuste entra no estoque agora e não se apaga (a correção seria um novo ajuste).</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFreio(null)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">Vou recontar</button>
              <button onClick={() => { const l = q.linhas.find((x) => x.itemId === freio.itemId); if (l) contar(l, String(freio.qtd), true) }}
                className="h-9 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700">Está certo, gravar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Cabecalho({ id, sessao }: { id: string; sessao?: { tipo: string; iniciadaEm: string; criadoPorNome: string | null } }) {
  return (
    <div className="flex items-center gap-2.5">
      <ClipboardList className="h-5 w-5 shrink-0 text-[#185FA5]" />
      <h1 className="text-base font-semibold text-slate-900">Contagem</h1>
      {sessao && (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${sessao.tipo === 'INICIAL' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
          {sessao.tipo === 'INICIAL' ? 'inicial' : 'rotina'}
        </span>
      )}
      {sessao && <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">aberta em {fmtQuando(sessao.iniciadaEm)}{sessao.criadoPorNome ? ` por ${sessao.criadoPorNome}` : ''} · confirmar a linha ajusta o saldo na hora</p>}
      <a href={`/empresas/${id}/estoque/contagens`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">Sessões</a>
    </div>
  )
}

/** "sem contagem" CINZA — nunca zero. Zero é uma afirmação; "nunca contei" é outra coisa. */
function UltimaContagem({ l, aberto, onToggle }: { l: Linha; aberto: boolean; onToggle: () => void }) {
  if (!l.ultimaContagemEm) return <span className="text-xs text-slate-300">sem contagem</span>
  const cor = l.diasSemContagem != null && l.diasSemContagem > 14 ? 'text-rose-600' : l.diasSemContagem != null && l.diasSemContagem > 7 ? 'text-amber-600' : 'text-slate-500'
  return (
    <button onClick={onToggle} title={l.ultimaContagemPor ? `contado por ${l.ultimaContagemPor}` : 'sem registro de quem contou'} className="text-left">
      <span className={`text-[13px] tabular-nums ${cor}`}>{fmtQuando(l.ultimaContagemEm)}</span>
      {aberto && (
        <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          <User className="h-3 w-3" /> {l.ultimaContagemPor ?? 'sem registro'}
        </span>
      )}
    </button>
  )
}

/** Divergência ao vivo: quantidade E dinheiro (o dono decide vendo os dois). */
function Divergencia({ l, rascunhoVal }: { l: Linha; rascunhoVal?: string }) {
  const digitando = rascunhoVal != null && rascunhoVal.trim() !== ''
  const qtd = digitando ? Number(rascunhoVal.replace(',', '.')) : l.contado?.qtdContada
  if (qtd == null || !Number.isFinite(qtd)) return <span className="text-xs text-slate-300">—</span>
  const div = Math.round((qtd - l.saldoSistema + 1e-9) * 1000) / 1000
  if (Math.abs(div) <= 0.0001) return <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> bate</span>
  const valor = div * (l.custoUnitario || 0)
  return (
    <span className={`text-[13px] font-semibold tabular-nums ${div < 0 ? 'text-rose-600' : 'text-sky-600'}`}>
      {div > 0 ? '+' : ''}{num(div)} {l.unidadeControle}
      {Math.abs(valor) > 0.005 && <span className="ml-1 text-[11px] font-normal text-slate-400">{brl(valor)}</span>}
    </span>
  )
}

interface LinhaProps {
  l: Linha; rascunho: Record<string, string>; setRascunho: (f: (s: Record<string, string>) => Record<string, string>) => void
  salvando: boolean; onContar: (v: string) => void
  quemContou: string | null; setQuemContou: (v: string | null) => void
}

/** KG/LT = decimal (balança); UN = inteiro (meia unidade não existe — o back também recusa). */
function inputProps(unidade: string) {
  return unidade.toUpperCase() === 'UN' ? { step: 1, inputMode: 'numeric' as const } : { step: 0.001, inputMode: 'decimal' as const }
}

function LinhaTabela({ l, rascunho, setRascunho, salvando, onContar, quemContou, setQuemContou }: LinhaProps) {
  const val = rascunho[l.itemId] ?? (l.contado ? String(l.contado.qtdContada) : '')
  const ip = inputProps(l.unidadeControle)
  return (
    <tr className={`border-b border-slate-50 last:border-b-0 ${l.contado ? 'bg-emerald-50/30' : ''}`}>
      <td className="px-3 py-1 text-[13px] font-medium text-slate-800">{l.nome}</td>
      <td className="px-3 py-1"><UltimaContagem l={l} aberto={quemContou === l.itemId} onToggle={() => setQuemContou(quemContou === l.itemId ? null : l.itemId)} /></td>
      <td className="whitespace-nowrap px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{num(l.saldoSistema)} {l.unidadeControle}</td>
      <td className="px-3 py-1 text-right">
        <input type="number" {...ip} value={val} placeholder="—"
          onChange={(e) => setRascunho((s) => ({ ...s, [l.itemId]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') onContar(val) }}
          onBlur={() => { if (val.trim() !== '' && val !== String(l.contado?.qtdContada ?? '')) onContar(val) }}
          className={`h-8 w-24 rounded-lg border px-2 text-right text-[13px] tabular-nums ${l.contado ? 'border-emerald-300 bg-white' : 'border-slate-300'}`} />
      </td>
      <td className="px-3 py-1 text-right"><Divergencia l={l} rascunhoVal={rascunho[l.itemId]} /></td>
      <td className="px-3 py-1 text-center">
        {salvando ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
          : l.contado ? <Check className="mx-auto h-4 w-4 text-emerald-600" />
          : <span className="text-xs text-slate-300">·</span>}
      </td>
    </tr>
  )
}

function LinhaCard({ l, rascunho, setRascunho, salvando, onContar, quemContou, setQuemContou }: LinhaProps) {
  const val = rascunho[l.itemId] ?? (l.contado ? String(l.contado.qtdContada) : '')
  const ip = inputProps(l.unidadeControle)
  return (
    <div className={`p-4 ${l.contado ? 'bg-emerald-50/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{l.nome}</p>
        {salvando ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : l.contado ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : null}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>sistema <b className="tabular-nums text-slate-700">{num(l.saldoSistema)} {l.unidadeControle}</b></span>
        <UltimaContagem l={l} aberto={quemContou === l.itemId} onToggle={() => setQuemContou(quemContou === l.itemId ? null : l.itemId)} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {/* alvo grande: o dono digita andando, com o celular na mão */}
        <input type="number" {...ip} value={val} placeholder="contar…"
          onChange={(e) => setRascunho((s) => ({ ...s, [l.itemId]: e.target.value }))}
          className={`h-11 w-32 rounded-lg border px-3 text-right text-base tabular-nums ${l.contado ? 'border-emerald-300' : 'border-slate-300'}`} />
        <span className="text-xs text-slate-400">{l.unidadeControle}</span>
        <button onClick={() => onContar(val)} disabled={salvando || val.trim() === ''}
          className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 text-sm font-semibold text-white active:bg-[#0F4A8C] disabled:bg-slate-200 disabled:text-slate-400">
          <Check className="h-4 w-4" /> {l.contado ? 'Recontar' : 'Confirmar'}
        </button>
      </div>
      <div className="mt-1.5 text-right"><Divergencia l={l} rascunhoVal={rascunho[l.itemId]} /></div>
    </div>
  )
}
