'use client'

// ⭐⭐ CONTAGEM — DOIS MODOS: CONTAR e REVISAR (31/08/2026).
//
// ⛔ A TELA ANTERIOR ESTAVA ATRÁS DAS LÍDERES EM **MÉTODO**, não só em visual (achados do
// dono testando em prod):
//   1. a coluna SISTEMA à vista durante a contagem → **viés de confirmação**: quem vê 571
//      escreve 571 mesmo tendo contado 560. É o problema que a contagem existe pra resolver.
//   2. campo com setinhas — inviável no dedo e absurdo pra digitar 6.313
//   3. unidade do outro lado da tela · 4. nome numa ponta e campo na outra (erro de linha)
//   5. coluna "última contagem" dizendo "sem contagem" em 91 linhas · 6. "0/91" duas vezes
//   7. cabeçalho de tabela repetido por categoria · 8. sessão aberta há 7 dias, sem aviso
//
// ⭐ AGORA: **CONTAR** é um item por vez, tela cheia, sem o número do sistema. **REVISAR**
// é a tela do dono — aí sim a tabela, aí sim o sistema, aí sim a divergência colorida.
// Separar os dois momentos é o que torna a contagem cega possível.
//
// ⚠️ O MOTOR NÃO MUDOU: `contarLinha`, o freio, o AJUSTE_CONTAGEM na hora e o invariante
// E8 são os mesmos. O que entrou é o RASTRO (append-only) ao lado, sem tocar na cabeça.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Loader2, Play, AlertTriangle, ListChecks, Pencil, Check, X } from 'lucide-react'
import { CartaoContar, type LinhaContar } from '@/components/estoque/contagem/cartao-contar'
import { TrilhoFila } from '@/components/estoque/contagem/trilho-fila'
import { RevisaoContagem, type VersaoLinha, type Decisao } from '@/components/estoque/contagem/revisao-contagem'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import { moverNaFila } from '@/lib/stock/contagem/ordem-fila'

interface Linha extends LinhaContar {
  categoria: string
  custoUnitario: number
  diasSemContagem: number | null
  viuSistema: boolean
  observacao: string | null
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number; contadoPorNome: string | null; contadoEm: string } | null
}
interface Quadro {
  contagem: { id: string; tipo: string; status: string; iniciadaEm: string; criadoPorNome: string | null } | null
  linhas: Linha[]; totalItens: number; totalContados: number; totalAApurar: number
  divergenciaValor: number; avisoSessao: string | null
}

const fmtQuando = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ContagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { pode } = usePermissoes(id)
  const [q, setQ] = useState<Quadro | null | undefined>(undefined)
  const [modo, setModo] = useState<'contar' | 'revisar'>('contar')
  const [atualId, setAtualId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [freio, setFreio] = useState<{ itemId: string; qtd: number; msg: string; opts: { viuSistema: boolean; observacao: string | null } } | null>(null)
  const [historico, setHistorico] = useState<Record<string, VersaoLinha[]>>({})
  const [decisoes, setDecisoes] = useState<Record<string, { decisao: string; motivo: string | null; decididoPorNome: string | null }>>({})

  const carregar = () => fetch(`/api/empresas/${id}/estoque/contagem`).then((r) => r.json()).then((j) => setQ(j.quadro ?? null)).catch(() => setQ(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // o histórico só é buscado quando o dono abre a revisão — a contagem não precisa dele
  useEffect(() => {
    if (modo !== 'revisar' || !q?.contagem) return
    fetch(`/api/empresas/${id}/estoque/contagem/revisao?contagemId=${q.contagem.id}`)
      .then((r) => r.json())
      .then((j) => { setHistorico(j.historico ?? {}); setDecisoes(j.decisoes ?? {}) })
      .catch(() => {})
  }, [modo, q?.contagem?.id, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendentes = useMemo(() => (q?.linhas ?? []).filter((l) => !l.estado), [q])
  const atual = useMemo(() => {
    const ls = q?.linhas ?? []
    return ls.find((l) => l.itemId === atualId) ?? pendentes[0] ?? ls[0] ?? null
  }, [q, atualId, pendentes])

  /** ⚠️ o próximo é sempre o próximo PENDENTE — quem já passou não volta sozinho */
  const irProximo = () => {
    const prox = (q?.linhas ?? []).find((l) => !l.estado && l.itemId !== atual?.itemId)
    setAtualId(prox?.itemId ?? null)
  }

  async function iniciar(tipo?: 'INICIAL' | 'ROTINA') {
    setIniciando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tipo ? { tipo } : {}) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui iniciar a contagem.'); return }
      await carregar()
    } catch { setErro('Falha de rede ao iniciar a contagem.') } finally { setIniciando(false) }
  }

  async function contar(itemId: string, qtd: number, opts: { viuSistema: boolean; observacao: string | null }, confirmarFreio = false) {
    if (!q?.contagem) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/linha`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contagemId: q.contagem.id, itemId, qtdContada: qtd, confirmarFreio, ...opts }),
      })
      const j = await r.json().catch(() => ({}))
      // ⛔ o FREIO é do SERVIDOR: divergência grande sem 2ª confirmação = 409 e o ledger
      // não se move. A tela só PERGUNTA — não é ela que decide (REGRA 5).
      if (r.status === 409 && j.code === 'FREIO') { setFreio({ itemId, qtd, msg: j.erro, opts }); return }
      if (!r.ok) { setErro(j.erro ?? 'Não consegui gravar a contagem.'); return }
      setFreio(null)
      await carregar()
      irProximo()
    } catch { setErro('Falha de rede ao gravar a contagem.') } finally { setSalvando(false) }
  }

  async function marcar(itemId: string, estado: 'NAO_SEI' | 'PULADO', observacao: string | null) {
    if (!q?.contagem) return
    setSalvando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contagem/marcar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contagemId: q.contagem.id, itemId, estado, observacao }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui marcar a linha.'); return }
      await carregar()
      irProximo()
    } catch { setErro('Falha de rede.') } finally { setSalvando(false) }
  }

  async function reordenar(de: number, para: number) {
    if (!q) return
    const caminho = moverNaFila(q.linhas.map((l) => ({ itemId: l.itemId, nome: l.nome, categoria: l.categoria })), de, para)
    // otimista: a fila reordena na hora e o servidor guarda em seguida
    const ordenadas = [...q.linhas].sort((a, b) => (caminho.get(a.itemId)! - caminho.get(b.itemId)!))
    setQ({ ...q, linhas: ordenadas })
    await fetch(`/api/empresas/${id}/estoque/contagem/ordem`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caminho: [...caminho.entries()].map(([itemId, ordem]) => ({ itemId, ordem })) }),
    }).catch(() => {})
  }

  async function decidir(itemId: string, decisao: Decisao) {
    if (!q?.contagem) return
    const r = await fetch(`/api/empresas/${id}/estoque/contagem/revisao`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contagemId: q.contagem.id, itemId, decisao }),
    })
    if (r.ok) setDecisoes((s) => ({ ...s, [itemId]: { decisao, motivo: null, decididoPorNome: null } }))
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

  // ── sem sessão aberta ──
  if (!q.contagem) {
    const primeira = q.linhas.every((l) => l.ultimaContagemEm == null)
    return (
      <div className="space-y-3">
        <Cabecalho id={id} />
        <Card><CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ClipboardList className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">{primeira ? 'Nenhuma contagem ainda — essa é a INICIAL, o ponto-zero do estoque.' : 'Nenhuma contagem aberta.'}</p>
          <p className="max-w-lg text-xs text-slate-500">
            Você conta <b>sem ver</b> o que o sistema acha que tem — é o que faz a contagem
            valer. Cada linha confirmada ajusta o saldo na hora, e dá pra parar e voltar:
            a sessão fica aberta até você finalizar.
          </p>
          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
          <button onClick={() => iniciar()} disabled={iniciando} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-50">
            {iniciando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {primeira ? 'Começar contagem inicial' : 'Começar contagem'}
          </button>
        </CardContent></Card>
      </div>
    )
  }

  const feitos = q.linhas.filter((l) => l.estado).length

  return (
    <div className="space-y-3 pb-6">
      <Cabecalho id={id} sessao={q.contagem} />

      {/* ⚠️ SESSÃO VELHA — AVISA, NUNCA FECHA SOZINHA: fechar jogaria fora o trabalho de
          quem está no meio do estoque, que é justamente quem mais precisa que não atrapalhe */}
      {q.avisoSessao && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-[12px] leading-snug text-amber-900">{q.avisoSessao}</p>
          <button onClick={() => { setModo('contar'); setAtualId(q.linhas.find((l) => l.estado)?.itemId ?? null) }}
            className="shrink-0 rounded-md border border-amber-400 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100">
            recontar os mais antigos
          </button>
        </div>
      )}

      {/* os dois modos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-lg border border-slate-300 p-0.5">
          <button onClick={() => setModo('contar')}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${modo === 'contar' ? 'bg-[#185FA5] text-white' : 'text-slate-600'}`}>
            <Pencil className="h-3.5 w-3.5" /> Contar
          </button>
          <button onClick={() => setModo('revisar')}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${modo === 'revisar' ? 'bg-[#185FA5] text-white' : 'text-slate-600'}`}>
            <ListChecks className="h-3.5 w-3.5" /> Revisar
            {q.totalAApurar > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 text-[10px] text-white">{q.totalAApurar}</span>}
          </button>
        </div>
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          <b className="text-slate-800">{feitos}</b> de {q.totalItens}
        </span>
        {modo === 'revisar' && pode('stock.manage') && (
          <button onClick={() => finalizar('finalizar')} disabled={finalizando}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} finalizar contagem
          </button>
        )}
      </div>

      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      {modo === 'contar' ? (
        atual ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card><CardContent className="py-6">
              <CartaoContar
                linha={atual}
                posicao={feitos + 1}
                total={q.totalItens}
                salvando={salvando}
                onConfirmar={(qtd, opts) => contar(atual.itemId, qtd, opts)}
                onMarcar={(estado, obs) => marcar(atual.itemId, estado, obs)}
                onPular={() => marcar(atual.itemId, 'PULADO', null)}
              />
            </CardContent></Card>

            <Card className="hidden lg:block"><CardContent className="p-2.5">
              <TrilhoFila
                itens={q.linhas}
                atualId={atual.itemId}
                onIr={setAtualId}
                onMover={reordenar}
                podeReordenar={pode('stock.manage')}
              />
            </CardContent></Card>
          </div>
        ) : (
          <Card><CardContent className="p-10 text-center">
            <Check className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-slate-700">Tudo passou — {feitos} de {q.totalItens}.</p>
            <p className="mt-1 text-xs text-slate-500">Agora é a revisão: lá o sistema aparece e dá pra comparar.</p>
            <button onClick={() => setModo('revisar')} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 text-xs font-semibold text-white">
              <ListChecks className="h-4 w-4" /> ir pra revisão
            </button>
          </CardContent></Card>
        )
      ) : (
        <RevisaoContagem
          linhas={q.linhas}
          historico={historico}
          decisoes={decisoes}
          podeDecidir={pode('stock.manage')}
          onDecidir={decidir}
          onRecontar={(itemId) => { setAtualId(itemId); setModo('contar') }}
        />
      )}

      {/* ⛔ O FREIO — a 2ª confirmação que o SERVIDOR exigiu */}
      {freio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setFreio(null)}>
          <div className="w-full rounded-t-2xl bg-white p-4 sm:max-w-md sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-start gap-2 text-sm text-slate-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {freio.msg}
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setFreio(null)} className="h-10 flex-1 rounded-lg border border-slate-300 text-sm text-slate-600">
                <X className="mr-1 inline h-4 w-4" /> voltar e conferir
              </button>
              <button onClick={() => contar(freio.itemId, freio.qtd, freio.opts, true)}
                className="h-10 flex-1 rounded-lg bg-[#185FA5] text-sm font-semibold text-white">
                confirmar mesmo assim
              </button>
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
