'use client'

// ⭐⭐ AS ETAPAS DA ORDEM — quem faz cada parte, e quanto durou (06/09/2026).
//
// **O caso real:** o beef passa por duas mãos — um faz o gessado, OUTRO molda. Cada linha tem
// o SEU seletor porque etapa com funcionário diferente é o caso NORMAL, não a exceção.
//
// ⚠️ O nome vem do CADASTRO (nunca texto livre): o relatório do fim do mês agrega por pessoa,
// e "cristian"/"Cristian "/"cris" seriam três pessoas.
//
// ⭐⭐⭐ VISUAL v4 (05/10/2026) — **as etapas viraram LINHA DO TEMPO.**
//
// **Ordem do dono:** *"ETAPAS viram linha do tempo: feita = check verde + pílula «feita · 9min»
// + mini-avatar de quem fez + horários; a etapa ATIVA = linha acesa índigo-50 + ícone relógio
// índigo + «no relógio · 1h26» ATUALIZANDO AO VIVO (timer no cliente, sem reload); futura =
// apagada. Mini-avatars do componente único (hash estável)."*
//
// ⛔⛔ **O QUE A LINHA DO TEMPO RESOLVE E A LISTA NÃO RESOLVIA:** numa lista achatada as três
// coisas (passado, agora, futuro) têm o MESMO peso, e a pergunta da tela é *"onde o lote está
// agora?"*. O trilho coloca a resposta no eixo: o que já passou fica quieto em verde, o AGORA
// acende, e o futuro apaga. ⚠️ Nada de comportamento mudou — designar, o plano da etapa e os
// dois gestos do gerente são os MESMOS; o que mudou é a hierarquia.

import { useEffect, useRef, useState } from 'react'
import { Loader2, Check, Clock, User, CircleSlash, BellRing, UserCheck, X } from 'lucide-react'
import { formatarDuracao } from '@/lib/format/duracao'
import { textoDoCronometro, desvioDoAparelho } from '@/lib/stock/producao/cronometro'
import { quemProduziuNasEtapas } from '@/lib/stock/producao/quem-produziu'
import { AvatarPessoa } from '@/components/estoque/avatar-pessoa'

interface Etapa {
  id: string; posicao: number; nome: string
  colaboradorId: string | null; colaboradorNome: string | null
  diaPrevisto: string | null
  liberadaParaEquipe: boolean
  visibilidade: string | null
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
  return formatarDuracao(min)
}

export function EtapasDaOrdem({ id, ordemId, colaboradores, aoSaberQuemProduziu, aoSaberAbertas }: {
  id: string; ordemId: string; colaboradores: Colaborador[]
  /**
   * ⭐⭐ OS NOMES de quem pôs a mão — é o que faz o dropdown "quem produziu" sair da conclusão
   * e virar a linha discreta *"produzido por X e Y (das etapas)"* (05/10).
   *
   * ⚠️ Era um BOOLEANO (`aoSaberAssinadas`): a modal sabia QUE alguém assinou e não QUEM. Pedir
   * o nome num 2º fetch faria as duas telas discordarem sobre o mesmo lote — sai do MESMO
   * payload que este componente já buscou, exatamente como o aviso de etapas abertas.
   */
  aoSaberQuemProduziu?: (nomes: string[]) => void
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

  /**
   * ⭐⭐ O CRONÔMETRO VIVO DA ETAPA ATIVA (05/10) — e o desvio é MEDIDO, nunca suposto.
   *
   * ⛔ `desvio` é o quanto o relógio DESTE aparelho está torto em relação ao servidor. Sem ele,
   * um tablet atrasado faria a conta dar negativo e o cronômetro **parar em 00:00 em vez de
   * acusar** — o defeito exato de 08/09, que levou dois dias pra ser notado porque mentir zero
   * parece "ainda não começou".
   *
   * ⚠️ `tick` é só pra forçar o re-render de segundo em segundo; quem calcula o texto é a lib.
   */
  const desvioRef = useRef(0)
  const [, setTick] = useState(0)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/producao/ordens/${ordemId}/etapas`)
    .then((r) => r.json()).then((j) => {
      // ⭐ o desvio é remedido a cada resposta: o aparelho pode ser corrigido no meio do turno
      if (typeof j.agoraServidor === 'string') desvioRef.current = desvioDoAparelho(j.agoraServidor)
      const es: Etapa[] = j.etapas ?? []
      setEtapas(es)
      aoSaberQuemProduziu?.(quemProduziuNasEtapas(es))
      aoSaberAbertas?.(es.filter((e) => e.estado === 'EM_ANDAMENTO').map((e) => ({ nome: e.nome, executorNome: e.executorNome })))
    }).catch(() => setEtapas([]))
  useEffect(() => { carregar() }, [id, ordemId]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⚠️ O INTERVALO SÓ EXISTE QUANDO HÁ ETAPA ATIVA — ordem concluída não gasta um timer por
   * segundo pra sempre. É a mesma régua do auto-refresh do "HOJE ao vivo", que só liga no dia
   * de hoje: *recarregar o passado é gastar requisição num dia que não muda.*
   */
  const temAtiva = !!etapas?.some((e) => e.estado === 'EM_ANDAMENTO')
  useEffect(() => {
    if (!temAtiva) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [temAtiva])

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
    if (typeof j?.agoraServidor === 'string') desvioRef.current = desvioDoAparelho(j.agoraServidor)
    const es: Etapa[] = j.etapas ?? []
    setEtapas(es)
    // ⚠️ o gesto do gerente MUDA quem assinou — reavisar é o que impede a modal de ficar com
    // o nome de antes (o estado novo vem do que o SERVIDOR devolveu, nunca do clique)
    aoSaberQuemProduziu?.(quemProduziuNasEtapas(es))
    aoSaberAbertas?.(es.filter((e) => e.estado === 'EM_ANDAMENTO').map((e) => ({ nome: e.nome, executorNome: e.executorNome })))
  }

  /**
   * ⭐⭐ DESIGNAR A LISTA FINAL (08/09) — a dupla exige mandar QUEM SÃO, não "o novo".
   *
   * ⛔ O teto de 2 continua sendo do BANCO (`designarParticipantes` → `validarEntrada`); a
   * tela só não oferece um terceiro campo. Trava de tela é conselho; trava de gravação é lei.
   */
  /**
   * ⭐⭐ O PLANO DA ETAPA (15/09) — dia próprio e "liberar pra equipe".
   * ⚠️ Campo ausente NÃO MEXE no outro: mudar o dia não pode desligar a liberação sem querer.
   */
  const plano = async (etapaId: string, corpo: { diaPrevisto?: string | null; liberadaParaEquipe?: boolean }) => {
    setSalvando(etapaId); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/etapas/${etapaId}/plano`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
      })
      const j = await r.json().catch(() => null)
      // ⚠️ falha VISÍVEL: plano sem feedback deixaria o encarregado achando que marcou o dia
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui salvar o plano da etapa.'); return }
      // ⭐ o estado novo vem do que o SERVIDOR aceitou — nunca do clique (a régua de 12/09)
      await carregar()
    } finally { setSalvando(null) }
  }

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
    if (typeof j?.agoraServidor === 'string') desvioRef.current = desvioDoAparelho(j.agoraServidor)
    const es: Etapa[] = j.etapas ?? []
    setEtapas(es)
    aoSaberQuemProduziu?.(quemProduziuNasEtapas(es))
    // ⭐⭐ A CONFIRMAÇÃO VISÍVEL (08/09) — decisão do dono: *"eu escolho o nome e não sei se
    // salvou"*. O check verde nasce do que o SERVIDOR devolveu, não do que eu mandei: dizer
    // "designado" a partir do meu próprio clique afirmaria uma gravação que pode não ter
    // acontecido — é a família do "a flag diz parece, o vínculo diz é".
    const salva = es.find((x) => x.id === etapaId)
    // ⭐ o check nasce do que o SERVIDOR devolveu — nomes dos participantes, não do clique
    setConfirmado({ etapaId, nome: salva?.participantes.map((p) => p.nome).join(' e ') || null })
    setTimeout(() => setConfirmado((c) => (c?.etapaId === etapaId ? null : c)), 3000)
  }

  if (etapas === null) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs" style={{ color: 'var(--prod-muted)' }}>
        <Loader2 className="h-3 w-3 animate-spin" /> etapas…
      </div>
    )
  }
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

  /**
   * ⭐ O ESTADO DA ETAPA NO TRILHO — três caras, derivadas do estado que o SERVIDOR mandou.
   *
   * ⛔ A tela NÃO decide "feita/ativa/futura" por conta própria: o `estado` vem de
   * `derivarEstadoDaEtapa`, o dono único dos 5 estados (07/09). Uma segunda derivação aqui
   * faria a linha do tempo discordar do "HOJE ao vivo" no primeiro caso de borda — foi
   * exatamente isso que produziu o *"na fila"* numa ordem já concluída.
   */
  const faseDa = (e: Etapa): 'PASSADO' | 'AGORA' | 'FUTURO' => {
    if (e.estado === 'EM_ANDAMENTO') return 'AGORA'
    if (e.estado === 'AGUARDANDO') return 'FUTURO'
    return 'PASSADO'
  }

  return (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--prod-line)', background: 'var(--prod-surface)' }}>
      <div
        className="flex items-baseline justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--prod-line)', background: 'var(--prod-surface-1)' }}
      >
        <p className="text-[15px] font-semibold" style={{ color: 'var(--prod-primary)' }}>Etapas</p>
        <p className="text-[11.5px]" style={{ color: 'var(--prod-muted)' }}>linha do tempo</p>
      </div>
      {erro && (
        <p className="px-3 py-2 text-xs" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)', borderBottom: '1px solid var(--prod-line)' }}>
          {erro}
        </p>
      )}
      <ol>
        {etapas.map((e, i) => {
          const fase = faseDa(e)
          const ultima = i === etapas.length - 1
          return (
            <li
              key={e.id}
              className="relative flex gap-3 px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid var(--prod-line)' : undefined,
                // ⭐ a etapa ATIVA é a ÚNICA com fundo: é ela que responde "onde o lote está"
                background: fase === 'AGORA' ? 'var(--fam-indigo-bg)' : undefined,
              }}
            >
              {/* ⭐⭐ O TRILHO: bolinha por etapa + fio ligando. ⚠️ O fio NÃO desce depois da
                  última — fio que termina no vazio promete uma etapa que não existe. */}
              <span className="relative flex w-6 shrink-0 justify-center pt-0.5" aria-hidden>
                {!ultima && (
                  <span
                    className="absolute top-7 bottom-[-14px] w-px"
                    style={{ background: fase === 'PASSADO' ? 'var(--fam-verde-mid)' : 'var(--prod-line)' }}
                  />
                )}
                <span
                  className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums"
                  style={
                    fase === 'PASSADO'
                      ? { background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }
                      : fase === 'AGORA'
                        ? { background: 'var(--fam-indigo-mid)', color: 'var(--prod-acao-ink)' }
                        : // ⚠️ FUTURA é APAGADA, não cinza-escura: ela existe e não pede nada agora
                          { background: 'var(--prod-surface-1)', color: 'var(--prod-muted)' }
                  }
                >
                  {fase === 'PASSADO' && e.estado === 'FEITA' ? <Check className="h-3.5 w-3.5" /> : e.posicao + 1}
                </span>
              </span>

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                {/* ⭐ a ETAPA é protagonista: 15px/500 — mas APAGA quando é futura, porque ali
                    o protagonista da tela é a etapa de agora. */}
                <span
                  className="min-w-[9rem] flex-1 text-[15px] font-medium"
                  style={{ color: fase === 'FUTURO' ? 'var(--prod-secondary)' : 'var(--prod-primary)' }}
                >
                  {e.nome}
                </span>

                {/* ⛔⛔ ENCERRADA SEM FINALIZAR: a ordem acabou e levou a etapa junto. NÃO é
                    "feita" (ninguém apertou finalizar) e NÃO tem duração — dizer "1h12" aqui
                    seria inventar um tempo que ninguém mediu. */}
                {e.estado === 'FINALIZADA_PELO_GERENTE' ? (
                  /* ⛔ NÃO é "feita": o rastro diz quem REALMENTE apertou, e o tempo é a apurar */
                  <span className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--prod-secondary)' }}>
                    <UserCheck className="h-3.5 w-3.5" style={{ color: 'var(--prod-muted)' }} />
                    <AvatarPessoa nome={e.emNomeDeNome ?? e.executorNome} tamanho={20} />
                    <span style={{ color: 'var(--prod-muted)' }}>· {e.rotulo}</span>
                    <span style={{ color: 'var(--prod-muted)' }}>· começou {hhmm(e.iniciadoEm)}</span>
                  </span>
                ) : e.estado === 'ENCERRADA_SEM_FINALIZAR' ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--prod-muted)' }}>
                    <CircleSlash className="h-3.5 w-3.5" style={{ color: 'var(--prod-muted)' }} />
                    <AvatarPessoa nome={e.executorNome} tamanho={20} />
                    <span>· {e.rotulo}</span>
                    <span>{e.iniciadoEm ? `· começou ${hhmm(e.iniciadoEm)} ` : ''}· tempo a apurar</span>
                  </span>
                ) : e.estado === 'FEITA' ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* ⭐ a pílula diz O QUE e QUANTO numa coisa só: "feita · 9min" */}
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }}
                    >
                      <Check className="h-3.5 w-3.5" /> feita · <span className="tabular-nums">{duracao(e.minutos)}</span>
                    </span>
                    {/* ⭐ o mini-avatar vem do componente ÚNICO (hash estável): a mesma pessoa
                        tem a mesma cor aqui, na home e no relatório. */}
                    <AvatarPessoa nome={e.executorNome} tamanho={20} />
                    <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>
                      {hhmm(e.iniciadoEm)}–{hhmm(e.finalizadoEm)}
                    </span>
                  </span>
                ) : (
                  <>
                    {/* ⭐⭐ OS DESIGNADOS COMO CHIPS (08/09) — a lacuna que o dono achou
                        navegando: o modelo aceitava 2 e a tela só tinha UM seletor.
                        ⛔ Quem JÁ INICIOU não tem X: o relógio dele está correndo, e tirá-lo
                        pela designação apagaria trabalho medido. Pra esse caso existem os dois
                        gestos do gerente, que REGISTRAM o que houve em vez de reescrever. */}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <User className="h-4 w-4 shrink-0" style={{ color: 'var(--prod-muted)' }} />
                      {e.participantes.map((pa) => (
                        <span key={pa.colaboradorId}
                          className="inline-flex items-center gap-1 rounded-full py-1 pl-1.5 pr-1 text-[13px] font-medium"
                          style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}>
                          <AvatarPessoa nome={pa.nome} tamanho={18} />
                          {pa.iniciou ? (
                            <span
                              className="ml-0.5 rounded-full px-1.5 text-[10px] font-semibold"
                              style={{ background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}
                              title="já iniciou — só o gesto do gerente resolve"
                            >
                              no relógio
                            </span>
                          ) : (
                            <button
                              onClick={() => designar(e.id, e.participantes.filter((x) => x.colaboradorId !== pa.colaboradorId).map((x) => x.colaboradorId))}
                              disabled={salvando === e.id}
                              aria-label={`tirar ${pa.nome} da etapa`}
                              className="rounded-full p-0.5 disabled:opacity-40"
                              style={{ color: 'var(--prod-muted)' }}
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
                          className="rounded-full px-2.5 py-1 text-[13px] disabled:opacity-40"
                          style={{ border: '1px dashed var(--prod-line-strong)', color: 'var(--prod-muted)', background: 'transparent' }}
                        >
                          <option value="">{e.participantes.length === 0 ? '+ quem faz' : '+ adicionar pessoa'}</option>
                          {colaboradores
                            .filter((c) => !e.participantes.some((pa) => pa.colaboradorId === c.id))
                            .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      )}
                      {confirmado?.etapaId === e.id && (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium" style={{ color: 'var(--fam-verde-ink)' }}>
                          <Check className="h-3.5 w-3.5" /> {confirmado.nome ? `${confirmado.nome} designado(a)` : 'designação removida'}
                        </span>
                      )}
                    </span>

                    {/* ⭐⭐⭐ O PLANO DA ETAPA (15/09) — o dia dela e quem pode vê-la.
                        ⛔ O texto antigo aqui dizia *"quem pegar com o PIN fica registrado"*, e
                        ele descrevia o mundo que morreu: etapa sem nome **não aparece pra
                        ninguém**. Deixá-lo seria a tela documentando uma regra que não existe
                        mais — o defeito de 10/09, em forma de frase. */}
                    <span className="flex flex-wrap items-center gap-2 text-[11.5px]">
                      {e.visibilidade && (
                        <span
                          className="rounded-full px-2 py-0.5 font-medium"
                          style={e.liberadaParaEquipe
                            ? { background: 'var(--fam-azul-bg)', color: 'var(--fam-azul-ink)' }
                            : { background: 'var(--fam-ambar-bg)', color: 'var(--fam-ambar-ink)' }}
                        >
                          {e.visibilidade}
                        </span>
                      )}
                      <label className="inline-flex items-center gap-1" style={{ color: 'var(--prod-muted)' }}>
                        dia
                        {/* ⚠️ vazio = o dia da ORDEM (o caso comum, tudo no mesmo dia) */}
                        <input
                          type="date" value={e.diaPrevisto ?? ''} disabled={salvando === e.id}
                          onChange={(ev) => plano(e.id, { diaPrevisto: ev.target.value || null })}
                          aria-label={`dia previsto da etapa ${e.nome}`}
                          className="h-7 rounded-lg px-1.5 text-[11.5px] disabled:opacity-40"
                          style={{ border: '1px solid var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}
                        />
                        {!e.diaPrevisto && <span>= o da ordem</span>}
                      </label>
                      {/* ⛔ LIBERAR É ESCOLHA, nunca o padrão por omissão: o silêncio não publica */}
                      {e.participantes.length === 0 && (
                        <button
                          onClick={() => plano(e.id, { liberadaParaEquipe: !e.liberadaParaEquipe })}
                          disabled={salvando === e.id}
                          className="inline-flex h-7 items-center rounded-lg px-2 font-medium disabled:opacity-40"
                          style={e.liberadaParaEquipe
                            ? { border: '1px solid var(--fam-azul-mid)', background: 'var(--fam-azul-bg)', color: 'var(--fam-azul-ink)' }
                            : { border: '1px solid var(--prod-line-strong)', color: 'var(--prod-secondary)' }}
                        >
                          {e.liberadaParaEquipe ? 'voltar a ser rascunho' : 'liberar pra equipe'}
                        </button>
                      )}
                    </span>
                    {e.estado === 'EM_ANDAMENTO' ? (
                      <>
                        {/* ⭐⭐ O CRONÔMETRO AO VIVO — ícone de relógio índigo + o tempo andando.
                            ⚠️ O TEXTO vem de `textoDoCronometro`, o dono único da régua de
                            relógio desta casa (`mm:ss` abaixo de 1h, `h:mm` acima) — a MESMA
                            que o "HOJE ao vivo" usa. Formatar aqui faria o mesmo lote mostrar
                            dois tempos em duas telas. */}
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{ background: 'var(--prod-surface)', color: 'var(--fam-indigo-ink)', border: '1px solid var(--fam-indigo-mid)' }}
                        >
                          <Clock className="h-3.5 w-3.5" style={{ color: 'var(--fam-indigo-mid)' }} />
                          no relógio ·{' '}
                          <span className="tabular-nums">
                            {e.iniciadoEm ? textoDoCronometro(e.iniciadoEm, Date.now() + desvioRef.current) : duracao(e.minutos)}
                          </span>
                        </span>
                        <span className="text-[11.5px] tabular-nums" style={{ color: 'var(--prod-muted)' }}>desde {hhmm(e.iniciadoEm)}</span>
                        {/* ⭐⭐ AS AÇÕES (07/09) — o gerente nunca fica preso olhando.
                            ⚠️ "Pedir" vem PRIMEIRO e é o caminho preferido: ela aperta com o PIN
                            dela e o tempo é DELA, medido de verdade. "Finalizar pelo gerente" é a
                            saída de quando ela não está mais lá — e custa o tempo (a apurar). */}
                        <span className="flex items-center gap-1.5">
                          {e.pedidoEmAberto ? (
                            <span
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium"
                              style={{ background: 'var(--prod-surface)', color: 'var(--fam-indigo-ink)' }}
                            >
                              <BellRing className="h-3 w-3" /> pedido enviado ao tablet
                              <button onClick={() => gesto(e.id, 'pedir-finalizar')} disabled={salvando === e.id} className="ml-1 underline underline-offset-2">reenviar</button>
                            </span>
                          ) : (
                            <button onClick={() => gesto(e.id, 'pedir-finalizar')} disabled={salvando === e.id}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium disabled:opacity-50"
                              style={{ border: '1px solid var(--fam-indigo-mid)', color: 'var(--fam-indigo-ink)' }}>
                              <BellRing className="h-3 w-3" /> pedir pra finalizar
                            </button>
                          )}
                          <button
                            onClick={() => { if (confirm(`Finalizar “${e.nome}” no lugar de ${e.executorNome ?? 'quem começou'}?\n\nO registro vai dizer que foi VOCÊ quem apertou, e o TEMPO fica “a apurar” — você não tem como saber quando ela parou de verdade.\n\nSe ela ainda estiver aí, prefira “pedir pra finalizar”.`)) gesto(e.id, 'finalizar-pelo-gerente') }}
                            disabled={salvando === e.id}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] disabled:opacity-50"
                            style={{ border: '1px solid var(--prod-line-strong)', color: 'var(--prod-secondary)' }}>
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
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                          style={{ background: 'var(--prod-surface-1)', color: 'var(--prod-secondary)' }}
                        >
                          <Clock className="h-3.5 w-3.5" /> aguardando
                        </span>
                      ) : null
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
