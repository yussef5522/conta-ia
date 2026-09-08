'use client'

// ⭐⭐ "HOJE" AO VIVO (06/09/2026) — o dia da cozinha num olhar, no desenho aprovado.
//
// Três blocos, na ordem em que a pergunta aparece: **AGORA** responde o urgente; **o dia de
// cada uma** responde "quem tem fila e quem terminou"; **a linha do tempo** é o diário — e é o
// que sobra quando o dia vira ontem.
//
// ⛔ **O CRONÔMETRO É DA TELA, O INSTANTE É DO SERVIDOR.** A tela recebe `iniciadoEm` e conta a
// diferença localmente a cada segundo. ⚠️ O relógio do aparelho pode estar torto — por isso a
// linha mostra TAMBÉM o horário de início ("começou 08:40"): se o cronômetro disser algo
// estranho, a hora absoluta permite conferir.
//
// ⛔⛔ **NENHUM VERMELHO DE ATRASO** (decisão do dono): não existe hora prometida por tarefa.
// O único alarme é o das 4h em aberto. "Na fila" é cinza, neutro.
//
// ⛔ Tela de GESTÃO (`stock.manage`), nunca telão de cozinha.

import { useEffect, useState, use, useCallback } from 'react'
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Clock } from 'lucide-react'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
// ⛔ o cronômetro é FUNÇÃO DE LIB, testada — a lição do tablet que passou dois dias
// mentindo zero porque a conta morava dentro do componente.
import { textoDoCronometro as cronometro } from '@/lib/stock/producao/cronometro'

// ⭐⭐ OS CINCO ESTADOS — os MESMOS da tela da ordem e do tablet (fonte única, 07/09)
type Estado = 'AGUARDANDO' | 'EM_ANDAMENTO' | 'FEITA' | 'FINALIZADA_PELO_GERENTE' | 'ENCERRADA_SEM_FINALIZAR'
interface Lote { qtdGerada: number; custoUnitario: number | null; unidade: string }
interface Tarefa {
  etapaId: string; ordemId: string; nome: string; produto: string; posicao: number
  estado: Estado; iniciadoEm: string | null; finalizadoEm: string | null
  /** ⭐ última etapa da ordem — o gesto do gerente conclui ali mesmo quando é */
  ehUltima: boolean
  /** ⭐ quem está designado NESTA etapa — o redesignar precisa da verdade da etapa */
  designados: string[]
  minutos: number | null; esperando: string | null; loteFechado: Lote | null; abertaDemais: boolean
  /** ⭐ o rótulo pronto — a MESMA frase das outras duas telas */
  rotulo: string
  pedidoEmAberto: boolean
}
interface Pessoa { colaboradorId: string; nome: string; fazendo: number; naFila: number; feitas: number; encerradas: number; tarefas: Tarefa[] }
interface Evento { quando: string; tipo: 'INICIOU' | 'FINALIZOU' | 'DESIGNOU'; quem: string; texto: string; minutos: number | null; loteFechado: Lote | null; ordemId: string | null; rotulo: string | null }
interface Dia {
  dia: string
  agora: { colaboradorId: string; nome: string; tarefa: Tarefa }[]
  pessoas: Pessoa[]; linhaDoTempo: Evento[]; abertasDemais: number; ehHoje: boolean
}

/** ⚠️ a tela existe pra ficar aberta — 30s é o intervalo aprovado pelo dono */
const SEGUNDOS_ATE_RECARREGAR = 30

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const duracaoCurta = (min: number) => (min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`)
const inicial = (n: string) => (n.trim()[0] ?? '?').toUpperCase()
const DIA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
function rotuloDoDia(dia: string, hoje: string) {
  const [a, m, d] = dia.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  const nome = dia === hoje ? 'HOJE' : dia === somarDias(hoje, -1) ? 'ONTEM' : ''
  const cheio = `${DIA_SEMANA[dt.getUTCDay()]}, ${d} de ${MES[m - 1]}`
  return { nome, cheio }
}

import { AcoesDoGerenteHoje } from '@/components/estoque/acoes-do-gerente-hoje'
import { RedesignarInline, type ColaboradorRef } from '@/components/estoque/redesignar-inline'

export default function HojeAoVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hoje = diaEmSaoPaulo()
  const [dia, setDia] = useState(hoje)
  const [d, setD] = useState<Dia | null | undefined>(undefined)
  // ⚠️ o "agora" do cronômetro é estado, e anda de segundo em segundo SEM pedir nada ao
  // servidor. Buscar o servidor por segundo custaria uma requisição por pessoa por segundo.
  const [agoraMs, setAgoraMs] = useState(() => Date.now())
  const [recarregando, setRecarregando] = useState(false)

  // ⭐ a equipe ativa, pro redesignar inline. Carrega uma vez — a lista não muda no dia.
  const [colaboradores, setColaboradores] = useState<ColaboradorRef[]>([])
  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/colaboradores`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setColaboradores(j?.colaboradores ?? []))
      .catch(() => { /* silencioso: sem a lista o botão some, o resto da tela segue */ })
  }, [id])

  const carregar = useCallback(() => {
    setRecarregando(true)
    fetch(`/api/empresas/${id}/estoque/producao/dia-ao-vivo?dia=${dia}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setRecarregando(false))
  }, [id, dia])

  useEffect(() => { setD(undefined); carregar() }, [carregar])
  useEffect(() => {
    const t = setInterval(() => setAgoraMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    // ⚠️ só o dia de HOJE se auto-atualiza: recarregar o passado de 30 em 30s seria gastar
    // requisição pra buscar um dia que não muda mais.
    if (dia !== hoje) return
    const t = setInterval(carregar, SEGUNDOS_ATE_RECARREGAR * 1000)
    return () => clearInterval(t)
  }, [dia, hoje, carregar])

  const r = rotuloDoDia(dia, hoje)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Produção
        </a>
        <div className="flex items-center gap-1 rounded-[10px] border border-slate-200 bg-white p-1">
          <button onClick={() => setDia(somarDias(dia, -1))} aria-label="dia anterior" className="rounded-[7px] p-1 text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2 text-sm text-slate-800">
            {r.nome && <b className="mr-1.5 font-semibold">{r.nome}</b>}
            <span className={r.nome ? 'text-slate-500' : 'font-semibold'}>{r.cheio}</span>
          </span>
          <button onClick={() => setDia(somarDias(dia, 1))} disabled={dia >= hoje} aria-label="próximo dia"
            className="rounded-[7px] p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
          {dia === hoje && <span>atualiza sozinha a cada {SEGUNDOS_ATE_RECARREGAR}s</span>}
          <button onClick={carregar} aria-label="atualizar agora" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
            <RefreshCw className={`h-3.5 w-3.5 ${recarregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {d === undefined ? <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
        : d === null ? <p className="p-6 text-sm text-slate-500">Não consegui carregar o dia.</p>
        : (
          <>
            {/* ── AGORA ─────────────────────────────────────────────────────────────── */}
            {/* ⛔ dia passado não tem "agora" — o bloco some em vez de aparecer vazio */}
            {d.ehHoje && (
              <section>
                <div className="mb-2.5 flex items-baseline gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agora</h2>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                    {d.agora.length === 0 ? 'ninguém trabalhando'
                      : `${d.agora.length} pessoa${d.agora.length > 1 ? 's' : ''} trabalhando`}
                    {d.abertasDemais > 0 && ` · ${d.abertasDemais} aberta(s) há mais de 4h`}
                  </span>
                </div>
                {d.agora.length === 0 ? (
                  /* ⭐ ESTADO VAZIO BONITO (decisão 6): é o estado do fim do dia e do começo
                     da manhã — aparece TODA HORA e não pode parecer "não carregou". */
                  <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                    <span className="mb-1 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-slate-100">
                      <Clock className="h-6 w-6 text-slate-400" />
                    </span>
                    <span className="text-[16px] font-semibold text-slate-800">Cozinha em silêncio</span>
                    <span className="max-w-[46ch] text-[12.5px] leading-relaxed text-slate-400">
                      Nada em produção agora. O dia de cada uma continua abaixo — e quando alguém
                      apertar INICIAR no tablet, o cronômetro aparece aqui.
                    </span>
                  </div>
                ) : (
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
                    {d.agora.map(({ nome, tarefa }) => {
                      /* ⛔ DECISÃO 2: o alarme das 4h pinta o CARD INTEIRO de coral. É o único
                         alarme da tela e tem causa real — ícone no canto é fácil de não ver
                         justo no caso que existe pra ser visto. */
                      const alarme = tarefa.abertaDemais
                      return (
                        <article key={tarefa.etapaId}
                          className={`flex flex-col gap-3 rounded-2xl border px-[18px] py-4 ${
                            alarme ? 'border-rose-300 bg-rose-50' : 'border-amber-200 bg-[#fdf4e3]'
                          }`}>
                          <div className="flex items-center gap-3">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[17px] font-bold ${
                              alarme ? 'border-rose-300 text-rose-700' : 'border-amber-200 text-[#c2760a]'
                            }`}>{inicial(nome)}</span>
                            <span className="min-w-0">
                              {/* ⭐ o NOME grande: de 2 metros, é quem está trabalhando */}
                              <span className="block text-[20px] font-semibold leading-tight tracking-[-0.015em] text-slate-900">{nome}</span>
                              <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">
                                {tarefa.nome}
                                {tarefa.produto && <> · <b className="font-semibold text-slate-800">{tarefa.produto}</b></>}
                              </span>
                            </span>
                            {/* ⭐⭐ DECISÃO 1: o CRONÔMETRO é o protagonista — 34px, cor própria */}
                            <span className="ml-auto shrink-0 text-right">
                              <span className={`block text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${
                                alarme ? 'text-rose-700' : 'text-[#c2760a]'
                              }`}>{tarefa.iniciadoEm && cronometro(tarefa.iniciadoEm, agoraMs)}</span>
                              {/* ⚠️ a hora ABSOLUTA ao lado: relógio de aparelho torto se confere aqui */}
                              <span className="mt-1 block text-[11px] tabular-nums text-slate-400">
                                começou {tarefa.iniciadoEm && hora(tarefa.iniciadoEm)}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                              alarme ? 'bg-white text-rose-700' : 'border border-amber-200 bg-white text-[#c2760a]'
                            }`}>
                              <span className={`h-[7px] w-[7px] rounded-full motion-safe:animate-pulse ${alarme ? 'bg-rose-600' : 'bg-[#c2760a]'}`} />
                              fazendo
                            </span>
                            {alarme && (
                              <a href={`/empresas/${id}/estoque/producao/${tarefa.ordemId}`}
                                className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700">
                                <AlertTriangle className="h-3.5 w-3.5" /> aberta há mais de 4h
                              </a>
                            )}
                            {tarefa.ehUltima && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500">
                                última etapa da ordem
                              </span>
                            )}
                            {tarefa.pedidoEmAberto && (
                              <span className="inline-flex items-center rounded-full bg-[#f1edff] px-2.5 py-1 text-[11.5px] font-semibold text-[#4A4390]">
                                recado no tablet
                              </span>
                            )}
                          </div>

                          {/* ⭐ DECISÕES 3 e 4: botões de verdade, "pedir" como primário, e o
                              "quantos saíram?" nascendo aqui quando é a última etapa. */}
                          <AcoesDoGerenteHoje
                            empresaId={id} ordemId={tarefa.ordemId} etapaId={tarefa.etapaId}
                            quem={nome} pedidoEmAberto={tarefa.pedidoEmAberto}
                            ehUltima={tarefa.ehUltima} onFeito={carregar}
                          />
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── o dia de cada uma ──────────────────────────────────────────────────── */}
            <section>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">O dia de cada uma</h2>
                <span className="text-[11px] font-semibold tabular-nums text-slate-400">{d.pessoas.length} pessoas</span>
              </div>
              {d.pessoas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-[18px] py-5 text-center text-sm text-slate-500">
                  Nenhuma pessoa ativa cadastrada.
                  <a href={`/empresas/${id}/equipe`} className="ml-1 text-[#534AB7] underline underline-offset-2">cadastrar equipe →</a>
                </div>
              ) : (
                /* ⭐ grade de cards, o molde do "Por Pessoa": no notebook cabem dois por
                   linha e o gerente varre a cozinha inteira sem rolar. */
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
                  {d.pessoas.map((p) => (
                    <CardDaPessoa key={p.colaboradorId} p={p} empresaId={id} agoraMs={agoraMs}
                      colaboradores={colaboradores} onMudou={carregar} />
                  ))}
                </div>
              )}
            </section>

            {/* ── linha do tempo ─────────────────────────────────────────────────────── */}
            <section>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Linha do tempo</h2>
                <span className="text-[11px] text-slate-400">mais recente em cima</span>
              </div>
              {d.linhaDoTempo.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white px-[18px] py-5 text-center text-sm text-slate-400">Nada aconteceu neste dia.</p>
              ) : (
                <ol className="rounded-2xl border border-slate-200 bg-white px-[18px] py-1">
                  {d.linhaDoTempo.map((e, i) => (
                    <li key={`${e.quando}-${i}`} className="border-t border-slate-100 py-2.5 first:border-t-0">
                      <div className="flex items-center gap-3 text-[13.5px]">
                        {/* ⭐ a HORA em destaque e o ícone num disco colorido: a timeline se
                            lê pela COLUNA da esquerda, e um caractere solto some no meio do
                            texto quando a lista cresce. */}
                        <span className="w-11 shrink-0 text-[13.5px] font-semibold tabular-nums text-slate-800">{hora(e.quando)}</span>
                        <span aria-hidden className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center self-start rounded-full text-[12px] ${
                          e.tipo === 'INICIOU' ? 'bg-[#fdf4e3] text-[#c2760a]'
                            : e.tipo === 'FINALIZOU' ? 'bg-emerald-50 text-[#15803d]'
                            : 'bg-[#f1edff] text-[#4A4390]'}`}>
                          {e.tipo === 'INICIOU' ? '▶' : e.tipo === 'FINALIZOU' ? '✓' : '◆'}
                        </span>
                        <span className="text-slate-700">
                          {e.tipo === 'DESIGNOU' ? <>Você designou {e.texto}</>
                            : <><b className="font-medium text-slate-900">{e.quem}</b> {e.tipo === 'INICIOU' ? 'iniciou' : 'finalizou'} {e.texto}
                              {e.minutos != null && <span className="text-slate-500"> · {duracaoCurta(e.minutos)}</span>}</>}
                        </span>
                      </div>
                      {/* ⚠️ o lote fechado vem INDENTADO sob o "finalizou" que o gerou — é
                          consequência daquele toque, não um evento solto */}
                      {/* ⭐ o desfecho da tarefa ao lado do INICIOU — "ficou aberta…" */}
                      {e.rotulo && (
                        <div className="ml-[4.6rem] mt-0.5 text-[12px] text-slate-400">└ {e.rotulo}</div>
                      )}
                      {e.loteFechado && (
                        <div className="ml-[4.6rem] mt-0.5 text-[12px] text-slate-400">
                          └ lote fechado · {num(e.loteFechado.qtdGerada)} {e.loteFechado.unidade}
                          {e.loteFechado.custoUnitario != null && ` · R$ ${num(e.loteFechado.custoUnitario)}/un`}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
    </div>
  )
}

function CardDaPessoa({ p, empresaId, agoraMs, colaboradores, onMudou }: {
  p: Pessoa; empresaId: string; agoraMs: number
  /** ⭐ a equipe ativa — pro redesignar inline da fila */
  colaboradores: ColaboradorRef[]
  onMudou: () => void
}) {
  // ⭐ quem não tem nada hoje APARECE — é o momento em que o gestor designa. Some da lista
  // quem está inativo, não quem está livre.
  const vazio = p.tarefas.length === 0
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        {/* ⭐ DECISÃO 6: quem não tem nada APARECE, apagado — sumir com quem está livre
            esconderia justamente a decisão que o gerente precisa tomar. */}
        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
          vazio ? 'bg-slate-100 text-slate-400' : 'bg-[#f1edff] text-[#4A4390]'}`}>{inicial(p.nome)}</div>
        <span className={`text-[15.5px] font-semibold ${vazio ? 'text-slate-500' : 'text-slate-900'}`}>{p.nome}</span>
        <span className="ml-auto text-[11.5px] tabular-nums text-slate-400">
          {vazio ? 'nada designado hoje'
            // ⚠️ o cabeçalho FECHA com a lista: linha visível que o resumo não conta é a
            // mesma doença do card `PRONTOS −72`.
            : `${p.fazendo} fazendo · ${p.naFila} na fila · ${p.feitas} feita${p.feitas === 1 ? '' : 's'}${p.encerradas ? ` · ${p.encerradas} sem finalizar` : ''}`}
        </span>
      </div>
      {vazio ? (
        <p className="text-[12.5px] text-slate-400">
          é o momento de designar —{' '}
          <a href={`/empresas/${empresaId}/estoque/producao`} className="font-medium text-[#534AB7] hover:underline">abrir produção →</a>
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5 border-t border-slate-100 pt-2.5">
          {p.tarefas.map((t) => (
            <li key={t.etapaId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px]">
              {/* ⭐⭐ CADA ESTADO COM UMA CARA SÓ, agora em CHIP — o caractere solto sumia
                  no meio do texto quando a lista crescia. */}
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                t.estado === 'EM_ANDAMENTO' ? 'bg-[#fdf4e3] text-[#c2760a]'
                  : t.estado === 'FEITA' ? 'bg-emerald-50 text-[#15803d]'
                  : t.estado === 'FINALIZADA_PELO_GERENTE' ? 'bg-slate-100 text-slate-500'
                  : t.estado === 'ENCERRADA_SEM_FINALIZAR' ? 'bg-slate-100 text-slate-500'
                  : 'bg-slate-100 text-slate-500'}`}>
                {t.estado === 'EM_ANDAMENTO' ? <><span className="h-[6px] w-[6px] rounded-full bg-[#c2760a] motion-safe:animate-pulse" /> fazendo</>
                  : t.estado === 'FEITA' ? '✓ feita'
                  : t.estado === 'FINALIZADA_PELO_GERENTE' ? 'pelo gerente'
                  : t.estado === 'ENCERRADA_SEM_FINALIZAR' ? '⊘ sem finalizar'
                  : 'na fila'}
              </span>
              <a href={`/empresas/${empresaId}/estoque/producao/${t.ordemId}`} className="text-[14px] font-medium text-slate-800 hover:underline hover:underline-offset-2">
                {t.nome}
              </a>
              {t.produto && <span className="text-[12px] text-slate-400">{t.produto}</span>}
              {/* ⭐⭐ CADA ESTADO COM UMA CARA SÓ — e a frase vem do servidor (fonte única),
                  nunca redigida aqui. Texto copiado em três telas diverge na 1ª revisão. */}
              {/* ⭐ o cronômetro VIVO também aqui — 16px: menor que o do AGORA, mas é a
                  mesma pergunta, e ela não pode virar texto cinza. */}
              <span className={`ml-auto shrink-0 tabular-nums ${
                t.estado === 'EM_ANDAMENTO' ? 'text-[16px] font-semibold text-[#c2760a]'
                  : t.estado === 'FEITA' ? 'text-[12.5px] text-[#15803d]'
                  : 'text-[12.5px] text-slate-400'}`}>
                {t.estado === 'EM_ANDAMENTO' && t.iniciadoEm ? cronometro(t.iniciadoEm, agoraMs)
                  : t.estado === 'FEITA' && t.iniciadoEm && t.finalizadoEm ? `${hora(t.iniciadoEm)}–${hora(t.finalizadoEm)} · ${duracaoCurta(t.minutos ?? 0)}`
                  // ⚠️ "depois do gessado" é SEQUÊNCIA da receita, não atraso dela — cinza, neutro
                  : t.estado === 'AGUARDANDO' && t.esperando ? `depois do ${t.esperando}`
                  : t.rotulo}
              </span>

              {/* ⭐ DECISÃO 3: os gestos do gerente TAMBÉM aqui, em botões de verdade */}
              {t.estado === 'EM_ANDAMENTO' && (
                <span className="w-full">
                  <AcoesDoGerenteHoje
                    empresaId={empresaId} ordemId={t.ordemId} etapaId={t.etapaId}
                    quem={p.nome} pedidoEmAberto={t.pedidoEmAberto}
                    ehUltima={t.ehUltima} onFeito={onMudou}
                  />
                </span>
              )}
              {/* ⭐⭐ REDESIGNAR NA FILA (08/09) — decisão do dono: *"remanejo é decisão de
                  manhã e a tela é o lugar dela"*. ⛔ Só em AGUARDANDO: etapa iniciada tem
                  relógio correndo no nome de alguém, e trocar o nome por baixo do tempo
                  medido escreveria o trabalho de uma pessoa na conta de outra. */}
              {t.estado === 'AGUARDANDO' && colaboradores.length > 0 && (
                <span className="w-full">
                  <RedesignarInline
                    empresaId={empresaId} ordemId={t.ordemId} etapaId={t.etapaId}
                    colaboradores={colaboradores} atuais={t.designados} onFeito={onMudou}
                  />
                </span>
              )}
              {t.loteFechado && (
                <span className="w-full text-[12px] text-slate-400">
                  └ lote fechado: {num(t.loteFechado.qtdGerada)} {t.loteFechado.unidade}
                  {t.loteFechado.custoUnitario != null && ` · R$ ${num(t.loteFechado.custoUnitario)}/un`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
