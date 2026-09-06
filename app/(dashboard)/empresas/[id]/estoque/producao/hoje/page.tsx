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
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'

type Estado = 'FAZENDO' | 'NA_FILA' | 'AGUARDA_ANTERIOR' | 'FEITA'
interface Lote { qtdGerada: number; custoUnitario: number | null; unidade: string }
interface Tarefa {
  etapaId: string; ordemId: string; nome: string; produto: string; posicao: number
  estado: Estado; iniciadoEm: string | null; finalizadoEm: string | null
  minutos: number | null; esperando: string | null; loteFechado: Lote | null; abertaDemais: boolean
}
interface Pessoa { colaboradorId: string; nome: string; fazendo: number; naFila: number; feitas: number; tarefas: Tarefa[] }
interface Evento { quando: string; tipo: 'INICIOU' | 'FINALIZOU' | 'DESIGNOU'; quem: string; texto: string; minutos: number | null; loteFechado: Lote | null; ordemId: string | null }
interface Dia {
  dia: string
  agora: { colaboradorId: string; nome: string; tarefa: Tarefa }[]
  pessoas: Pessoa[]; linhaDoTempo: Evento[]; abertasDemais: number; ehHoje: boolean
}

/** ⚠️ a tela existe pra ficar aberta — 30s é o intervalo aprovado pelo dono */
const SEGUNDOS_ATE_RECARREGAR = 30

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
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

/** ⭐ o cronômetro: diferença pro instante que o toque gravou, contada AQUI */
function decorrido(desde: string, agoraMs: number): string {
  const min = Math.max(0, Math.floor((agoraMs - new Date(desde).getTime()) / 60000))
  if (min < 60) return `há ${min}min`
  return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}
const duracaoCurta = (min: number) => (min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`)

export default function HojeAoVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hoje = diaEmSaoPaulo()
  const [dia, setDia] = useState(hoje)
  const [d, setD] = useState<Dia | null | undefined>(undefined)
  // ⚠️ o "agora" do cronômetro é estado, e anda de segundo em segundo SEM pedir nada ao
  // servidor. Buscar o servidor por segundo custaria uma requisição por pessoa por segundo.
  const [agoraMs, setAgoraMs] = useState(() => Date.now())
  const [recarregando, setRecarregando] = useState(false)

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
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agora</h2>
                {d.agora.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-[18px] py-5 text-center text-sm text-slate-400">
                    Ninguém com tarefa em andamento neste momento.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {d.agora.map(({ colaboradorId, nome, tarefa }) => (
                      <div key={tarefa.etapaId} className="rounded-2xl border border-amber-200 bg-[#fdf4e3] px-[18px] py-3.5">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#c2760a]" />
                            {nome}
                          </span>
                          <span className="text-[15px] text-slate-700">· {tarefa.nome}</span>
                          <span className="ml-auto text-[15px] font-semibold tabular-nums text-[#c2760a]">
                            {tarefa.iniciadoEm && decorrido(tarefa.iniciadoEm, agoraMs)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-slate-500">
                          {tarefa.produto && <>{tarefa.produto} · </>}
                          {/* ⚠️ a hora ABSOLUTA fica ao lado do cronômetro: relógio de aparelho torto se confere aqui */}
                          começou {tarefa.iniciadoEm && hora(tarefa.iniciadoEm)}
                          {tarefa.abertaDemais && (
                            <a href={`/empresas/${id}/estoque/producao/${tarefa.ordemId}`} className="ml-2 inline-flex items-center gap-1 font-medium text-[#c2760a] underline underline-offset-2">
                              <AlertTriangle className="h-3 w-3" /> aberta há mais de 4h
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    <p className="text-[12px] text-slate-400">
                      {d.agora.length} pessoa{d.agora.length === 1 ? '' : 's'} com a mão na massa
                      {d.abertasDemais > 0 && ` · ${d.abertasDemais} tarefa(s) aberta(s) há mais de 4h ⚠`}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* ── o dia de cada uma ──────────────────────────────────────────────────── */}
            <section>
              <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">O dia de cada uma</h2>
              {d.pessoas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-[18px] py-5 text-center text-sm text-slate-500">
                  Nenhuma pessoa ativa cadastrada.
                  <a href={`/empresas/${id}/equipe`} className="ml-1 text-[#534AB7] underline underline-offset-2">cadastrar equipe →</a>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {d.pessoas.map((p) => <CardDaPessoa key={p.colaboradorId} p={p} empresaId={id} agoraMs={agoraMs} />)}
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
                      <div className="flex items-baseline gap-3 text-[13px]">
                        <span className="w-11 shrink-0 font-semibold tabular-nums text-slate-800">{hora(e.quando)}</span>
                        <span className="w-3 shrink-0 text-center" aria-hidden>
                          {e.tipo === 'INICIOU' ? <span className="text-[#c2760a]">▶</span>
                            : e.tipo === 'FINALIZOU' ? <span className="text-[#15803d]">✓</span>
                            : <span className="text-[#534AB7]">◆</span>}
                        </span>
                        <span className="text-slate-700">
                          {e.tipo === 'DESIGNOU' ? <>Você designou {e.texto}</>
                            : <><b className="font-medium text-slate-900">{e.quem}</b> {e.tipo === 'INICIOU' ? 'iniciou' : 'finalizou'} {e.texto}
                              {e.minutos != null && <span className="text-slate-500"> · {duracaoCurta(e.minutos)}</span>}</>}
                        </span>
                      </div>
                      {/* ⚠️ o lote fechado vem INDENTADO sob o "finalizou" que o gerou — é
                          consequência daquele toque, não um evento solto */}
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

function CardDaPessoa({ p, empresaId, agoraMs }: { p: Pessoa; empresaId: string; agoraMs: number }) {
  // ⭐ quem não tem nada hoje APARECE — é o momento em que o gestor designa. Some da lista
  // quem está inativo, não quem está livre.
  const vazio = p.tarefas.length === 0
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-[18px] py-3.5">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
          vazio ? 'bg-slate-100 text-slate-400' : 'bg-[#f1edff] text-[#534AB7]'}`}>{inicial(p.nome)}</div>
        <span className="text-[15px] font-medium text-slate-900">{p.nome}</span>
        <span className="ml-auto text-[12.5px] text-slate-400">
          {vazio ? 'nada designado hoje' : `${p.fazendo} fazendo · ${p.naFila} na fila · ${p.feitas} feita${p.feitas === 1 ? '' : 's'}`}
        </span>
      </div>
      {vazio ? (
        <p className="mt-1.5 pl-11 text-[12.5px] text-slate-400">
          <a href={`/empresas/${empresaId}/estoque/producao`} className="underline underline-offset-2">designe uma tarefa pela ordem de produção →</a>
        </p>
      ) : (
        <ul className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5">
          {p.tarefas.map((t) => (
            <li key={t.etapaId} className="flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
              <span className="w-3 shrink-0 text-center" aria-hidden>
                {t.estado === 'FAZENDO' ? <span className="text-[#c2760a]">●</span>
                  : t.estado === 'FEITA' ? <span className="text-[#15803d]">✓</span>
                  : <span className="text-slate-300">○</span>}
              </span>
              <a href={`/empresas/${empresaId}/estoque/producao/${t.ordemId}`} className="text-slate-700 hover:underline hover:underline-offset-2">
                {t.nome}{t.produto && <span className="text-slate-400"> · {t.produto}</span>}
              </a>
              <span className={`ml-auto shrink-0 text-[12.5px] tabular-nums ${
                t.estado === 'FAZENDO' ? 'font-medium text-[#c2760a]' : t.estado === 'FEITA' ? 'text-[#15803d]' : 'text-slate-400'}`}>
                {t.estado === 'FAZENDO' && t.iniciadoEm ? `fazendo · ${decorrido(t.iniciadoEm, agoraMs)}`
                  : t.estado === 'FEITA' && t.iniciadoEm && t.finalizadoEm ? `${hora(t.iniciadoEm)}–${hora(t.finalizadoEm)} · ${duracaoCurta(t.minutos ?? 0)}`
                  // ⚠️ "depois do gessado" é SEQUÊNCIA da receita, não atraso dela — cinza, neutro
                  : t.esperando ? `depois do ${t.esperando}`
                  : 'na fila'}
              </span>
              {t.loteFechado && (
                <span className="w-full pl-[1.4rem] text-[12px] text-slate-400">
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
