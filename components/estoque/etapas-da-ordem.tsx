'use client'

// ⭐⭐ AS ETAPAS DA ORDEM — quem faz cada parte, e quanto durou (06/09/2026).
//
// **O caso real:** o beef passa por duas mãos — um faz o gessado, OUTRO molda. Cada linha tem
// o SEU seletor porque etapa com funcionário diferente é o caso NORMAL, não a exceção.
//
// ⚠️ O nome vem do CADASTRO (nunca texto livre): o relatório do fim do mês agrega por pessoa,
// e "cristian"/"Cristian "/"cris" seriam três pessoas.

import { useEffect, useState } from 'react'
import { Loader2, Check, Clock, User } from 'lucide-react'

interface Etapa {
  id: string; posicao: number; nome: string
  colaboradorId: string | null; colaboradorNome: string | null
  executorNome: string | null; iniciadoEm: string | null; finalizadoEm: string | null
  estado: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FEITA'; minutos: number | null
}
interface Colaborador { id: string; nome: string }

const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—')
/** ⚠️ "1h12", não "72min": é como a cozinha fala */
export function duracao(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export function EtapasDaOrdem({ id, ordemId, colaboradores }: { id: string; ordemId: string; colaboradores: Colaborador[] }) {
  const [etapas, setEtapas] = useState<Etapa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`)
    .then((r) => r.json()).then((j) => setEtapas(j.etapas ?? [])).catch(() => setEtapas([]))
  useEffect(() => { carregar() }, [id, ordemId]) // eslint-disable-line react-hooks/exhaustive-deps

  const designar = async (etapaId: string, colaboradorId: string) => {
    setSalvando(etapaId); setErro(null)
    const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapaId, colaboradorId: colaboradorId || null }),
    })
    const j = await r.json().catch(() => null)
    setSalvando(null)
    // ⚠️ falha VISÍVEL: designar sem feedback deixaria o encarregado achando que designou
    if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar quem faz essa etapa.'); return }
    setEtapas(j.etapas ?? [])
  }

  if (etapas === null) return <div className="flex items-center gap-2 p-3 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> etapas…</div>
  // ⚠️ receita sem etapas declaradas vira UMA ("produção") — mostrar um bloco de uma linha só
  // seria ruído numa tela que já é longa. Quem não usa etapas não vê nada de novo.
  if (etapas.length <= 1) return null

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">Etapas</p>
        <p className="text-[11px] text-slate-400">quem faz cada parte</p>
      </div>
      {erro && <p className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
      <ul className="divide-y divide-slate-100">
        {etapas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold tabular-nums text-slate-500">{e.posicao + 1}</span>
            <span className="min-w-[9rem] flex-1 text-sm text-slate-800">{e.nome}</span>

            {/* ⭐ FEITA: o seletor sai e fica o rastro — quem fez não se "redesigna" */}
            {e.estado === 'FEITA' ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                <span className="font-medium">{e.executorNome ?? '—'}</span>
                <span className="tabular-nums text-slate-500">· {duracao(e.minutos)}</span>
                <span className="text-slate-400">· {hhmm(e.iniciadoEm)}–{hhmm(e.finalizadoEm)}</span>
              </span>
            ) : (
              <>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={e.colaboradorId ?? ''}
                    onChange={(ev) => designar(e.id, ev.target.value)}
                    disabled={salvando === e.id || e.estado === 'EM_ANDAMENTO'}
                    className="rounded-lg border border-slate-300 py-1.5 px-2 text-xs disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {/* ⚠️ "ninguém ainda" NÃO é erro: etapa solta funciona, e quem pegar com o
                        PIN fica registrado. Nada trava a cozinha por falta de designação. */}
                    <option value="">— ninguém ainda</option>
                    {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
                {e.estado === 'EM_ANDAMENTO' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> em andamento · <span className="tabular-nums">{duracao(e.minutos)}</span>
                    <span className="font-normal text-slate-400">desde {hhmm(e.iniciadoEm)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {e.colaboradorId ? 'aguardando' : 'quem pegar com o PIN fica registrado'}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
