'use client'

// ⭐⭐ AS ETAPAS DA ORDEM — quem faz cada parte, e quanto durou (06/09/2026).
//
// **O caso real:** o beef passa por duas mãos — um faz o gessado, OUTRO molda. Cada linha tem
// o SEU seletor porque etapa com funcionário diferente é o caso NORMAL, não a exceção.
//
// ⚠️ O nome vem do CADASTRO (nunca texto livre): o relatório do fim do mês agrega por pessoa,
// e "cristian"/"Cristian "/"cris" seriam três pessoas.

import { useEffect, useState } from 'react'
import { Loader2, Check, Clock, User, CircleSlash, BellRing, UserCheck } from 'lucide-react'

interface Etapa {
  id: string; posicao: number; nome: string
  colaboradorId: string | null; colaboradorNome: string | null
  executorNome: string | null; iniciadoEm: string | null; finalizadoEm: string | null
  estado: 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FEITA' | 'FINALIZADA_PELO_GERENTE' | 'ENCERRADA_SEM_FINALIZAR'
  minutos: number | null
  /** ⛔ a ordem acabou e levou a etapa aberta junto — sem tempo medido */
  encerradaPor: 'ORDEM_CONCLUIDA' | 'ORDEM_CANCELADA' | null
  /** ⭐ o rastro do gesto do gerente */
  finalizadaPorNome: string | null
  emNomeDeNome: string | null
  /** ⭐ o recado "finalize sua tarefa" já está no tablet dela */
  pedidoEmAberto: boolean
  /** ⭐ o rótulo pronto — a MESMA frase nas três telas (fonte única) */
  rotulo: string
}
interface Colaborador { id: string; nome: string }

const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—')
/** ⚠️ "1h12", não "72min": é como a cozinha fala */
export function duracao(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export function EtapasDaOrdem({ id, ordemId, colaboradores, aoSaberAssinadas, aoSaberAbertas }: {
  id: string; ordemId: string; colaboradores: Colaborador[]
  /** ⭐ avisa a página quando alguma etapa já foi ASSINADA (executor carimbado pelo PIN) —
      é o que faz o dropdown "quem produziu" sair da conclusão. */
  aoSaberAssinadas?: (assinadas: boolean) => void
  /** ⛔ as etapas ABERTAS — a conclusão avisa que a ordem vai levá-las junto (06/09).
      ⚠️ Sai DAQUI, do payload que este componente já buscou: um segundo fetch faria o aviso
      e a lista discordarem sobre quais etapas estão abertas. */
  aoSaberAbertas?: (abertas: { nome: string; executorNome: string | null }[]) => void
}) {
  const [etapas, setEtapas] = useState<Etapa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`)
    .then((r) => r.json()).then((j) => {
      const es: Etapa[] = j.etapas ?? []
      setEtapas(es)
      aoSaberAssinadas?.(es.some((e) => !!e.executorNome))
      aoSaberAbertas?.(es.filter((e) => e.estado === 'EM_ANDAMENTO').map((e) => ({ nome: e.nome, executorNome: e.executorNome })))
    }).catch(() => setEtapas([]))
  useEffect(() => { carregar() }, [id, ordemId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐⭐ OS DOIS GESTOS DO GERENTE (07/09) — pra ele nunca ficar preso olhando etapa aberta.
  const gesto = async (etapaId: string, acao: 'pedir-finalizar' | 'finalizar-pelo-gerente') => {
    setSalvando(etapaId); setErro(null)
    const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapaId, acao }),
    })
    const j = await r.json().catch(() => null)
    setSalvando(null)
    // ⚠️ falha VISÍVEL: sem isso o gerente aperta e não sabe se pegou
    if (!r.ok) { setErro(j?.erro ?? 'Não consegui.'); return }
    const es: Etapa[] = j.etapas ?? []
    setEtapas(es)
    aoSaberAbertas?.(es.filter((e) => e.estado === 'EM_ANDAMENTO').map((e) => ({ nome: e.nome, executorNome: e.executorNome })))
  }

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
  // ⚠️ some quando a receita não usa etapas — MAS não quando a única etapa foi assinada:
  // aí ela carrega quem fez e quanto durou, e esconder isso apagaria o rastro da tela.
  if (etapas.length <= 1 && !etapas.some((e) => e.executorNome)) return null

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

            {/* ⛔⛔ ENCERRADA SEM FINALIZAR: a ordem acabou e levou a etapa junto. NÃO é
                "feita" (ninguém apertou finalizar) e NÃO tem duração — dizer "1h12" aqui
                seria inventar um tempo que ninguém mediu. */}
            {e.estado === 'FINALIZADA_PELO_GERENTE' ? (
              /* ⛔ NÃO é "feita": o rastro diz quem REALMENTE apertou, e o tempo é a apurar */
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-800">{e.emNomeDeNome ?? e.executorNome ?? '—'}</span>
                <span className="text-slate-500">· {e.rotulo}</span>
                <span className="text-slate-400">· começou {hhmm(e.iniciadoEm)}</span>
              </span>
            ) : e.estado === 'ENCERRADA_SEM_FINALIZAR' ? (
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <CircleSlash className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">{e.executorNome ?? '—'}</span>
                <span>· {e.rotulo}</span>
                <span className="text-slate-400">{e.iniciadoEm ? `· começou ${hhmm(e.iniciadoEm)} ` : ''}· tempo a apurar</span>
              </span>
            ) : e.estado === 'FEITA' ? (
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
                  <>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <Clock className="h-3.5 w-3.5" /> em andamento · <span className="tabular-nums">{duracao(e.minutos)}</span>
                      <span className="font-normal text-slate-400">desde {hhmm(e.iniciadoEm)}</span>
                    </span>
                    {/* ⭐⭐ AS AÇÕES (07/09) — o gerente nunca fica preso olhando.
                        ⚠️ "Pedir" vem PRIMEIRO e é o caminho preferido: ela aperta com o PIN
                        dela e o tempo é DELA, medido de verdade. "Finalizar pelo gerente" é a
                        saída de quando ela não está mais lá — e custa o tempo (a apurar). */}
                    <span className="flex items-center gap-1.5">
                      {e.pedidoEmAberto ? (
                        <span className="flex items-center gap-1 rounded-lg bg-[#f1edff] px-2 py-1 text-[11px] font-medium text-[#534AB7]">
                          <BellRing className="h-3 w-3" /> pedido enviado ao tablet
                          <button onClick={() => gesto(e.id, 'pedir-finalizar')} disabled={salvando === e.id} className="ml-1 underline underline-offset-2 hover:text-[#3a318f]">reenviar</button>
                        </span>
                      ) : (
                        <button onClick={() => gesto(e.id, 'pedir-finalizar')} disabled={salvando === e.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#534AB7]/40 px-2 py-1 text-[11px] font-medium text-[#534AB7] hover:bg-[#f1edff] disabled:opacity-50">
                          <BellRing className="h-3 w-3" /> pedir pra finalizar
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm(`Finalizar “${e.nome}” no lugar de ${e.executorNome ?? 'quem começou'}?\n\nO registro vai dizer que foi VOCÊ quem apertou, e o TEMPO fica “a apurar” — você não tem como saber quando ela parou de verdade.\n\nSe ela ainda estiver aí, prefira “pedir pra finalizar”.`)) gesto(e.id, 'finalizar-pelo-gerente') }}
                        disabled={salvando === e.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        <UserCheck className="h-3 w-3" /> finalizar por ela
                      </button>
                    </span>
                  </>
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
