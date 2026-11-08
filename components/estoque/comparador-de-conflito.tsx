'use client'
/**
 * ⭐⭐ 08/11/2026 — A MAÇANETA DO CONFLITO. O "escolher →" da linha em conflito abria a
 * central geral (porta oferecida sem nada atrás). Agora ele abre ESTE comparador: as fichas
 * do conflito lado a lado, e o "ficar com esta" é o gesto do dono.
 *
 * ⛔ A tela não decide nada: a régua (quem é conflito, quem consome cada ficha, se inativar
 * vem marcado) vem da rota → `lib/stock/vendas/conflito-de-grafia.ts`.
 *
 * Três peças, e as duas puras existem pra o teste EXECUTAR a fiação (o projeto roda sem
 * jsdom — chamar a função é executar o componente, REGRA 3):
 *   · `AcaoDoConflito` — o "escolher →" da linha (central e revisão usam a MESMA);
 *   · `ComparadorView` — o lado a lado + a confirmação;
 *   · `ComparadorDeConflito` — o modal com o fetch e o POST.
 */
import { useCallback, useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import type { ComparadorDoConflito } from '@/lib/stock/vendas/conflito-de-grafia'
import { avisoDosConsumidores } from '@/lib/stock/vendas/aviso-de-consumidores'

/** ⭐ A URL da porta — a mesma função no componente e no teste da fiação */
export const urlDoConflito = (empresaId: string, nome?: string) =>
  `/api/empresas/${empresaId}/estoque/vendas/conflito${nome !== undefined ? `?nome=${encodeURIComponent(nome)}` : ''}`

/** ⭐ o "escolher →" da linha em conflito — UMA peça, usada pela central e pela revisão */
export function AcaoDoConflito({ candidatas, onEscolher }: { candidatas: string[]; onEscolher: () => void }) {
  return (
    <span className="text-[12px] font-semibold" style={{ color: 'var(--fam-coral-ink)' }} title={`apontam pra destinos diferentes: ${candidatas.join(' · ')}`}>
      conflito: {candidatas.join(' × ')} —{' '}
      <button type="button" data-testid="escolher-conflito" onClick={onEscolher} className="underline-offset-2 hover:underline" style={{ color: 'var(--fam-indigo-mid)' }}>
        escolher →
      </button>
    </span>
  )
}

const brl = (n: number | null) => (n == null ? 'a definir' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const dia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export interface ComparadorViewProps {
  dados: ComparadorDoConflito
  escolhida: string | null
  inativar: Set<string>
  gravando: boolean
  erro: string | null
  onEscolher: (fichaId: string) => void
  onAlternarInativar: (fichaId: string) => void
  onConfirmar: () => void
  onVoltar: () => void
}

export function ComparadorView({ dados, escolhida, inativar, gravando, erro, onEscolher, onAlternarInativar, onConfirmar, onVoltar }: ComparadorViewProps) {
  const venc = dados.fichas.find((f) => f.fichaId === escolhida) ?? null
  const perdedoras = venc ? dados.fichas.filter((f) => f.fichaId !== venc.fichaId) : []
  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        «{dados.nome}» é o mesmo produto de grafias que já apontam pra fichas diferentes. Fique com uma: todas as grafias passam a baixar por ela.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {dados.fichas.map((f) => {
          const avisos = avisoDosConsumidores(f.consumidores)
          const marcada = f.fichaId === escolhida
          return (
            <div key={f.fichaId} data-testid="ficha-do-conflito" className={`rounded-xl border p-3 text-xs ${marcada ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'}`}>
              <div className="mb-2 text-sm font-semibold text-slate-900">{f.nome}{!f.ativo && <span className="ml-1 text-slate-400">(inativa)</span>}</div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-slate-600">
                <dt className="text-slate-400">ingredientes</dt><dd className="tabular-nums">{f.ingredientes}</dd>
                <dt className="text-slate-400">custo do lote</dt><dd className="tabular-nums">{brl(f.custoLote)}</dd>
                <dt className="text-slate-400">última edição</dt><dd className="tabular-nums">{dia(f.ultimaEdicao)}</dd>
                <dt className="text-slate-400">grafias do PDV</dt><dd>{f.grafias.join(' · ') || '—'}</dd>
                <dt className="text-slate-400">vendas 30 dias</dt><dd className="tabular-nums">{f.vendasRecentes.unidades} un{f.vendasRecentes.ultimoDia ? ` (última ${dia(f.vendasRecentes.ultimoDia)})` : ''}</dd>
                <dt className="text-slate-400">também usada em</dt><dd>{avisos.length ? avisos.join(' · ') : 'nada além deste produto'}</dd>
              </dl>
              <button
                type="button"
                data-testid="ficar-com-esta"
                disabled={!f.ativo || gravando}
                onClick={() => onEscolher(f.fichaId)}
                className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold ${marcada ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'} disabled:opacity-50`}
              >
                {marcada ? '✓ escolhida' : 'ficar com esta'}
              </button>
            </div>
          )
        })}
      </div>

      {venc && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="mb-2 text-slate-700">
            As grafias {perdedoras.flatMap((p) => p.grafias).map((g) => `«${g}»`).join(', ')} passam a apontar pra <b>{venc.nome}</b>.
          </div>
          {perdedoras.map((p) => {
            const avisos = avisoDosConsumidores(p.consumidores)
            return (
              <label key={p.fichaId} className="flex items-start gap-2 py-1">
                <input type="checkbox" data-testid="inativar-perdedora" checked={inativar.has(p.fichaId)} onChange={() => onAlternarInativar(p.fichaId)} className="mt-0.5" />
                <span>
                  inativar a ficha <b>{p.nome}</b>
                  {avisos.length > 0 && <span className="block text-amber-700">⚠ ainda usada: {avisos.join(' · ')}</span>}
                </span>
              </label>
            )
          })}
          {erro && <div className="mt-2 text-rose-700">{erro}</div>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={onVoltar} disabled={gravando} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">voltar</button>
            <button type="button" data-testid="confirmar-escolha" onClick={onConfirmar} disabled={gravando} className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60" style={{ background: 'var(--fam-indigo-ink)', color: 'var(--fam-indigo-bg)' }}>
              {gravando ? 'gravando…' : `confirmar: ficar com ${venc.nome}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ⭐ O MODAL. O padrão do "inativar" vem da régua: marcado SÓ pra perdedora sem consumidor
 * de fora (`inativarSemAviso`); com consumidor, desmarcado e com o aviso à vista.
 */
export function ComparadorDeConflito({ empresaId, nome, onFechar, onResolvido }: { empresaId: string; nome: string; onFechar: () => void; onResolvido: () => void }) {
  const [dados, setDados] = useState<ComparadorDoConflito | null>(null)
  const [estado, setEstado] = useState<'CARREGANDO' | 'OK' | 'SEM_CONFLITO' | 'FALHOU'>('CARREGANDO')
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [inativar, setInativar] = useState<Set<string>>(new Set())
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setEstado('CARREGANDO')
    const r = await fetchComTimeout<{ comparador: ComparadorDoConflito | null; erro?: string }>(urlDoConflito(empresaId, nome))
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui abrir o comparador.'); setEstado('FALHOU'); return }
    if (!r.data.comparador) { setEstado('SEM_CONFLITO'); return }
    setDados(r.data.comparador)
    setEstado('OK')
  }, [empresaId, nome])
  useEffect(() => { void carregar() }, [carregar])

  const escolher = (fichaId: string) => {
    setEscolhida(fichaId)
    setErro(null)
    setInativar(new Set((dados?.fichas ?? []).filter((f) => f.fichaId !== fichaId && f.inativarSemAviso).map((f) => f.fichaId)))
  }
  const alternar = (fichaId: string) => setInativar((s) => { const n = new Set(s); if (n.has(fichaId)) n.delete(fichaId); else n.add(fichaId); return n })

  const confirmar = async () => {
    if (!escolhida || !dados) return
    setGravando(true)
    setErro(null)
    const lista = [...inativar]
    const comAviso = dados.fichas.some((f) => lista.includes(f.fichaId) && !f.inativarSemAviso)
    const r = await fetchComTimeout<{ ok?: boolean; erro?: string }>(urlDoConflito(empresaId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, fichaEscolhidaId: escolhida, inativar: lista, inativarMesmoComConsumidores: comAviso }),
    })
    setGravando(false)
    if (!r.ok || !r.data?.ok) { setErro(r.erro ?? r.data?.erro ?? 'Não consegui gravar a escolha.'); return }
    onResolvido()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Qual ficha vale pra «{nome}»?</h3>
          <button type="button" onClick={onFechar} aria-label="fechar"><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        {estado === 'CARREGANDO' && <div className="py-8 text-center text-slate-400"><Loader2 className="inline h-5 w-5 animate-spin" /></div>}
        {estado === 'FALHOU' && <div className="py-4 text-sm text-rose-700">{erro} <button type="button" onClick={() => void carregar()} className="underline">tentar de novo</button></div>}
        {estado === 'SEM_CONFLITO' && <div className="py-4 text-sm text-slate-600">Este nome não está mais em conflito. <button type="button" onClick={onResolvido} className="underline">atualizar a lista</button></div>}
        {estado === 'OK' && dados && (
          <ComparadorView
            dados={dados} escolhida={escolhida} inativar={inativar} gravando={gravando} erro={erro}
            onEscolher={escolher} onAlternarInativar={alternar} onConfirmar={() => void confirmar()} onVoltar={() => setEscolhida(null)}
          />
        )}
      </div>
    </div>
  )
}
