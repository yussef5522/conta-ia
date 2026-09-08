'use client'

// ⭐⭐ AS ETAPAS DA ORDEM — quem faz cada parte, e quanto durou (06/09/2026).
//
// **O caso real:** o beef passa por duas mãos — um faz o gessado, OUTRO molda. Cada linha tem
// o SEU seletor porque etapa com funcionário diferente é o caso NORMAL, não a exceção.
//
// ⚠️ O nome vem do CADASTRO (nunca texto livre): o relatório do fim do mês agrega por pessoa,
// e "cristian"/"Cristian "/"cris" seriam três pessoas.

import { useEffect, useState } from 'react'
import { Loader2, Check, Clock, User, CircleSlash, BellRing, UserCheck, X } from 'lucide-react'

interface Etapa {
  id: string; posicao: number; nome: string
  colaboradorId: string | null; colaboradorNome: string | null
  /** ⭐ a DUPLA: os designados desta etapa (0, 1 ou 2) */
  participantes: { colaboradorId: string; nome: string; iniciou: boolean; finalizou: boolean }[]
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
  /** ⭐ o que o servidor CONFIRMOU — some sozinho em 3s */
  const [confirmado, setConfirmado] = useState<{ etapaId: string; nome: string | null } | null>(null)

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

  /**
   * ⭐⭐ DESIGNAR A LISTA FINAL (08/09) — a dupla exige mandar QUEM SÃO, não "o novo".
   *
   * ⛔ O teto de 2 continua sendo do BANCO (`designarParticipantes` → `validarEntrada`); a
   * tela só não oferece um terceiro campo. Trava de tela é conselho; trava de gravação é lei.
   */
  const designar = async (etapaId: string, colaboradorIds: string[]) => {
    setSalvando(etapaId); setErro(null); setConfirmado(null)
    const r = await fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapaId, colaboradorIds }),
    })
    const j = await r.json().catch(() => null)
    setSalvando(null)
    // ⚠️ falha VISÍVEL: designar sem feedback deixaria o encarregado achando que designou
    if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar quem faz essa etapa.'); return }
    const es: Etapa[] = j.etapas ?? []
    setEtapas(es)
    // ⭐⭐ A CONFIRMAÇÃO VISÍVEL (08/09) — decisão do dono: *"eu escolho o nome e não sei se
    // salvou"*. O check verde nasce do que o SERVIDOR devolveu, não do que eu mandei: dizer
    // "designado" a partir do meu próprio clique afirmaria uma gravação que pode não ter
    // acontecido — é a família do "a flag diz parece, o vínculo diz é".
    const salva = es.find((x) => x.id === etapaId)
    // ⭐ o check nasce do que o SERVIDOR devolveu — nomes dos participantes, não do clique
    setConfirmado({ etapaId, nome: salva?.participantes.map((p) => p.nome).join(' e ') || null })
    setTimeout(() => setConfirmado((c) => (c?.etapaId === etapaId ? null : c)), 3000)
  }

  if (etapas === null) return <div className="flex items-center gap-2 p-3 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> etapas…</div>
  // ⛔⛔ REGRA INVERTIDA EM 08/09/2026, COM O MOTIVO ESCRITO (não apagada).
  //
  // Aqui havia: `if (etapas.length <= 1 && !etapas.some(e => e.executorNome)) return null`,
  // justificado como *"mostrar um bloco de uma linha só seria ruído numa tela longa"*.
  //
  // O DONO, na ordem do FILE DE PEITO DE FRANGO: *"não tem ONDE escolher quem vai produzir.
  // (…) TODA ordem tem pelo menos a etapa 'produção', e ela precisa do seletor de quem faz."*
  //
  // ⚠️ E ele está certo pelo argumento mais forte: economizar uma linha de tela custou o
  // GESTO INTEIRO. Receita sem etapas cadastradas é a maioria — nelas, designar era
  // simplesmente impossível, e nada na tela dizia por quê.
  if (etapas.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <p className="text-[15px] font-semibold text-slate-900">Etapas</p>
        <p className="text-[11.5px] text-slate-400">quem faz cada parte</p>
      </div>
      {erro && <p className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
      <ul className="divide-y divide-slate-100">
        {etapas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11.5px] font-semibold tabular-nums text-slate-500">{e.posicao + 1}</span>
            {/* ⭐ a ETAPA é protagonista: 15px/500. Máx 2 pesos escuros por linha — este e
                o nome da PESSOA; o resto (estado, horas, insumos) fica em tom de apoio. */}
            <span className="min-w-[9rem] flex-1 text-[15px] font-medium text-slate-900">{e.nome}</span>

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
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800">
                  <Check className="h-3.5 w-3.5" /> feita
                </span>
                <span className="text-[14px] font-medium text-slate-900">{e.executorNome ?? '—'}</span>
                <span className="text-[12px] tabular-nums text-slate-500">{duracao(e.minutos)}</span>
                <span className="text-[11.5px] tabular-nums text-slate-400">{hhmm(e.iniciadoEm)}–{hhmm(e.finalizadoEm)}</span>
              </span>
            ) : (
              <>
                {/* ⭐⭐ OS DESIGNADOS COMO CHIPS (08/09) — a lacuna que o dono achou
                    navegando: o modelo aceitava 2 e a tela só tinha UM seletor.
                    ⛔ Quem JÁ INICIOU não tem X: o relógio dele está correndo, e tirá-lo
                    pela designação apagaria trabalho medido. Pra esse caso existem os dois
                    gestos do gerente, que REGISTRAM o que houve em vez de reescrever. */}
                <span className="flex flex-wrap items-center gap-1.5">
                  <User className="h-4 w-4 shrink-0 text-slate-400" />
                  {e.participantes.map((pa) => (
                    <span key={pa.colaboradorId}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white py-1 pl-2.5 pr-1 text-[13px] font-medium text-slate-900">
                      {pa.nome}
                      {pa.iniciou ? (
                        <span className="ml-0.5 rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700" title="já iniciou — só o gesto do gerente resolve">
                          no relógio
                        </span>
                      ) : (
                        <button
                          onClick={() => designar(e.id, e.participantes.filter((x) => x.colaboradorId !== pa.colaboradorId).map((x) => x.colaboradorId))}
                          disabled={salvando === e.id}
                          aria-label={`tirar ${pa.nome} da etapa`}
                          className="rounded-full p-0.5 text-slate-300 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-40"
                        ><X className="h-3.5 w-3.5" /></button>
                      )}
                    </span>
                  ))}
                  {/* ⚠️ o "+" some quando a vaga acaba: o teto de 2 aparece como AUSÊNCIA
                      de opção, não como erro depois do clique. */}
                  {e.participantes.length < 2 && (
                    <select
                      value=""
                      onChange={(ev) => { if (ev.target.value) designar(e.id, [...e.participantes.map((x) => x.colaboradorId), ev.target.value]) }}
                      disabled={salvando === e.id}
                      aria-label="adicionar pessoa na etapa"
                      className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[13px] text-slate-400 disabled:opacity-40"
                    >
                      <option value="">{e.participantes.length === 0 ? '+ quem faz' : '+ adicionar pessoa'}</option>
                      {colaboradores
                        .filter((c) => !e.participantes.some((pa) => pa.colaboradorId === c.id))
                        .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                  {e.participantes.length === 0 && (
                    <span className="text-[11.5px] text-slate-400">quem pegar com o PIN fica registrado</span>
                  )}
                </span>
                {e.estado === 'EM_ANDAMENTO' ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800">
                      <Clock className="h-3.5 w-3.5" /> em andamento
                      <span className="font-medium tabular-nums">{duracao(e.minutos)}</span>
                    </span>
                    <span className="text-[11.5px] tabular-nums text-slate-400">desde {hhmm(e.iniciadoEm)}</span>
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
                  /* ⭐ AGUARDANDO também é um dos 5 estados — ganha o chip, em tom neutro:
                     ele informa, não pede ação, e âmbar aqui competiria com "em andamento". */
                  // ⚠️ a frase "quem pegar com o PIN" já vive nos chips acima — repetir aqui
                  // seria a mesma informação em dois lugares da MESMA linha.
                  e.participantes.length > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                      <Clock className="h-3.5 w-3.5" /> aguardando
                    </span>
                  ) : null
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
