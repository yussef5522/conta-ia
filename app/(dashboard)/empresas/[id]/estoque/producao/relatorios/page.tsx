'use client'

// ⭐⭐⭐ RELATÓRIOS DE PRODUÇÃO (13/09/2026) — régua: `docs/mocks/producao-relatorios-mock.html`.
//
// **O dono:** *"o mock é a RÉGUA: igual primeiro, melhoria só com meu pedido."* Os tokens e
// medidas abaixo são LITERAIS do arquivo, e há guard que lê o HTML e compara.
//
// ⭐ **A conta não mora aqui.** Tudo vem de `relatorios.ts`, que delega a `desempenho.ts` —
// a MESMA função que o HOJE chama, com outra janela. A tela só pinta.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchJson } from '@/lib/http/fetch-json'
import type { RelatorioDaTarefa, GeralDoPeriodo, BarraDaPessoa } from '@/lib/stock/producao/relatorios'
// ⭐ o piso vem do DONO ÚNICO — digitar "5" na tela seria a 2ª régua no dia em que ele mudar
import { PISO_DE_DURACAO_MIN } from '@/lib/stock/producao/desempenho'

/** ⭐ os tokens do mock, literais */
const M = {
  bg: '#faf9f6', card: '#fff', ink: '#1f2430', sub: '#6b7280', line: '#e8e6e0',
  roxo: '#534AB7', roxoFraco: '#eeecfa', verde: '#177245', verdeFraco: '#e6f4ec',
  ambar: '#b45309', ambarFraco: '#fdf3e3', coral: '#b3382c',
  slate: '#475569', slateFraco: '#eef2f6',
} as const

interface Dados {
  de: string; ate: string; periodo: string; tarefa: string | null; pessoa: string | null
  /** ⭐ o estado é EXPLÍCITO: ou a tela fala de uma tarefa, ou fala de todas */
  visaoGeral: boolean
  tarefas: { tarefa: string; lotes: number; unidades: number; unidade: string }[]
  porTarefa: RelatorioDaTarefa | null
  porPessoa: BarraDaPessoa[]
  geral: GeralDoPeriodo
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)}min`)

export default function RelatoriosDeProducaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const sp = useSearchParams()
  const router = useRouter()
  // ⚠️ REGRA 9: todo hook ANTES de qualquer early return
  const [periodo, setPeriodo] = useState(sp.get('periodo') ?? (sp.get('de') ? 'livre' : '7d'))
  const [de, setDe] = useState(sp.get('de') ?? '')
  const [ate, setAte] = useState(sp.get('ate') ?? '')
  const [tarefa, setTarefa] = useState(sp.get('tarefa') ?? '')
  const [pessoa, setPessoa] = useState(sp.get('pessoa') ?? '')
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [trocando, setTrocando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const q = new URLSearchParams()
    if (periodo !== 'livre') q.set('periodo', periodo)
    if (de) q.set('de', de)
    if (ate) q.set('ate', ate)
    if (tarefa) q.set('tarefa', tarefa)
    if (pessoa) q.set('pessoa', pessoa)
    const r = await fetchJson<Dados>(`/api/empresas/${id}/estoque/producao/relatorios?${q}`)
    // ⛔ erro NUNCA vira vazio: "sem produção" é uma afirmação, e ela precisa ser verdade
    if (!r.ok || !r.data) { setErro(r.message ?? 'resposta vazia'); setCarregando(false); return }
    setErro(null); setD(r.data); setCarregando(false)
    // ⛔ E AQUI MORREU O AUTO-ESCOLHE: a tela adotava sozinha a tarefa que mais produziu e
    // seguia desenhando os painéis gerais embaixo — recorte em cima, empresa inteira embaixo,
    // sem ninguém dizer. Sem tarefa na URL, o estado é "todas as tarefas", explícito.
  }, [id, periodo, de, ate, tarefa, pessoa])

  useEffect(() => { void carregar() }, [carregar])

  /**
   * ⭐ O FILTRO VIVE NA URL (item 5 do dono): compartilhar o link ou voltar no navegador
   * devolve o MESMO recorte. `replace` e não `push` — cada toque num chip não merece uma
   * entrada no histórico, senão o "voltar" vira um desfazer de filtro, um por um.
   */
  useEffect(() => {
    const q = new URLSearchParams()
    if (periodo !== 'livre') q.set('periodo', periodo)
    if (de) q.set('de', de)
    if (ate) q.set('ate', ate)
    if (tarefa) q.set('tarefa', tarefa)
    if (pessoa) q.set('pessoa', pessoa)
    const nova = q.toString()
    if (nova !== sp.toString()) router.replace(`?${nova}`, { scroll: false })
  }, [router, sp, periodo, de, ate, tarefa, pessoa])

  const chip = (on: boolean) => ({
    background: on ? M.roxo : M.card, color: on ? '#fff' : M.ink,
    border: `1px solid ${on ? M.roxo : M.line}`, borderRadius: 99,
    padding: '8px 14px', fontSize: 13, fontWeight: on ? 600 : 400, whiteSpace: 'nowrap' as const,
  })

  return (
    <div className="mx-auto max-w-[900px] pb-12" style={{ color: M.ink }}>
      <div className="mb-3.5">
        <div className="flex items-center gap-2">
          <h1 className="text-[21px] font-bold">Relatórios de Produção</h1>
          <Link href={`/empresas/${id}/estoque/producao/hoje`} className="ml-auto text-[13px] font-semibold" style={{ color: M.roxo }}>
            ← o dia de hoje
          </Link>
        </div>
        <p className="text-[13px]" style={{ color: M.sub }}>
          tempo, rendimento e custo por tarefa e por pessoa — derivado dos lotes reais
        </p>
      </div>

      {/* ── FILTROS ─────────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {([['hoje', 'hoje'], ['7d', 'últimos 7 dias'], ['mes', 'mês']] as const).map(([v, r]) => (
          <button key={v} onClick={() => { setPeriodo(v); setDe(''); setAte('') }} style={chip(periodo === v)}>{r}</button>
        ))}
        <label style={chip(periodo === 'livre')} className="inline-flex cursor-pointer items-center gap-1.5">
          📅 <span>escolher datas</span>
          <input type="date" value={de || d?.de || ''} max={ate || undefined}
            onChange={(e) => { setPeriodo('livre'); setDe(e.target.value); if (!ate) setAte(d?.ate ?? e.target.value) }}
            className="bg-transparent text-[12px] outline-none" style={{ colorScheme: periodo === 'livre' ? 'dark' : 'light' }} />
          <span>→</span>
          <input type="date" value={ate || d?.ate || ''} min={de || undefined}
            onChange={(e) => { setPeriodo('livre'); setAte(e.target.value); if (!de) setDe(d?.de ?? e.target.value) }}
            className="bg-transparent text-[12px] outline-none" style={{ colorScheme: periodo === 'livre' ? 'dark' : 'light' }} />
        </label>
        <label style={chip(!!pessoa)} className="inline-flex cursor-pointer items-center gap-1.5">
          <b className="font-bold">pessoa:</b>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}
            className="cursor-pointer bg-transparent text-[13px] outline-none"
            style={{ color: pessoa ? '#fff' : M.ink }}>
            <option value="" style={{ color: M.ink }}>todas</option>
            {(d?.porPessoa ?? []).map((p) => (
              <option key={p.colaboradorId} value={p.colaboradorId} style={{ color: M.ink }}>{p.nome}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ⚠️ a janela EXAMINADA fica escrita: período que o dono não vê escrito engana */}
      {d && (
        <p className="-mt-2 mb-3 text-[11.5px]" style={{ color: M.sub }}>
          de <b>{diaCurto(d.de)}</b> a <b>{diaCurto(d.ate)}</b>
          {d.pessoa && ' · filtrado por pessoa'}
        </p>
      )}

      {erro && (
        <div className="mb-3 rounded-[12px] border px-4 py-3 text-[13px]"
          style={{ background: M.ambarFraco, borderColor: M.ambar, color: M.ambar }}>
          não consegui carregar os relatórios: {erro} — <b>ausência aqui não é prova de que não houve produção</b>.
        </div>
      )}

      {carregando && !d && <p className="py-8 text-center text-[13px]" style={{ color: M.sub }}>carregando…</p>}

      {d && (
        <>
          {/* ── POR TAREFA ─────────────────────────────────────────────────────── */}
          {/* ⭐⭐ O ESTADO É EXPLÍCITO: ou "todas as tarefas" (visão geral) ou UMA tarefa.
              Antes a tela adotava sozinha a que mais produziu e misturava os dois mundos. */}
          <button onClick={() => setTrocando((v) => !v)}
            className="mb-3.5 flex w-full items-center gap-2.5 rounded-[14px] border px-4 py-3 text-left"
            style={{ background: M.card, borderColor: d.visaoGeral ? M.line : M.roxo }}>
            <span className="text-[20px]">{d.visaoGeral ? '🍽️' : '🎯'}</span>
            <span className="flex-1 text-[16px] font-bold">
              {d.tarefa ?? 'todas as tarefas'}
              {d.visaoGeral && <small className="ml-2 text-[12px] font-normal" style={{ color: M.sub }}>visão geral</small>}
            </span>
            <span className="text-[13px] font-semibold" style={{ color: M.roxo }}>trocar tarefa ▾</span>
          </button>
          {trocando && (
            <div className="mb-3.5 overflow-hidden rounded-[14px] border" style={{ background: M.card, borderColor: M.line }}>
              {/* ⭐ "todas" é uma OPÇÃO do seletor, no topo — e é o default ao abrir */}
              <button onClick={() => { setTarefa(''); setTrocando(false) }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px]"
                style={{ fontWeight: d.visaoGeral ? 700 : 400, background: d.visaoGeral ? M.roxoFraco : undefined }}>
                <span className="flex-1">todas as tarefas</span>
                <span style={{ color: M.sub }}>{d.tarefas.length} tarefa(s) no período</span>
              </button>
              {d.tarefas.map((t) => (
                <button key={t.tarefa} onClick={() => { setTarefa(t.tarefa); setTrocando(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px]"
                  style={{ borderTop: `1px solid #f1efe9`, fontWeight: t.tarefa === d.tarefa ? 700 : 400 }}>
                  <span className="flex-1">{t.tarefa}</span>
                  <span style={{ color: M.sub }}>{t.lotes} lote{t.lotes > 1 ? 's' : ''} · {num(t.unidades)} {t.unidade}</span>
                </button>
              ))}
            </div>
          )}

          {d.visaoGeral ? null : d.porTarefa?.vazio || !d.porTarefa ? (
            // ⛔ o vazio DIZ o motivo — nunca um painel de zeros
            <div className="mb-3.5 rounded-[16px] border px-4 py-8 text-center text-[13px]"
              style={{ background: M.card, borderColor: M.line, color: M.sub }}>
              {d.porTarefa?.vazio ?? 'sem produção no filtro'}
            </div>
          ) : (
            <>
              <div className="mb-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat rotulo="Lotes no período" valor={String(d.porTarefa.lotes)}
                  detalhe={`${num(d.porTarefa.unidades)} UN produzidas`} />
                <Stat rotulo="Tempo médio" roxo
                  valor={d.porTarefa.media.minutosPorLote ? fmt(d.porTarefa.media.minutosPorLote) : '—'}
                  sufixo={d.porTarefa.media.minutosPorLote ? '/lote' : undefined}
                  detalhe={d.porTarefa.media.minutosPorLote
                    ? `mediana ${fmt(d.porTarefa.media.medianaMinutos!)}`
                      + (d.porTarefa.media.lotesSemTempo ? ` · ${d.porTarefa.media.lotesSemTempo} sem tempo` : '')
                      /* ⭐ o relâmpago é DITO, como o "sem tempo" — some da média, nunca da tela */
                      + (d.porTarefa.media.lotesRelampago ? ` · ${d.porTarefa.media.lotesRelampago} relâmpago` : '')
                    /* ⚠️ sem média a tela DIZ o porquê, em vez de mostrar um número falso */
                    : d.porTarefa.media.porQue ?? 'sem média ainda'} />
                <Stat rotulo="Rendimento"
                  valor={d.porTarefa.rendimento.pct != null ? `${d.porTarefa.rendimento.pct}%` : '—'}
                  /* ⛔ META PARCIAL É DITA: "2 de 3 lotes com meta · 104% nesses" — nunca
                     uma média silenciosa só dos que têm */
                  detalhe={d.porTarefa.lotesComMeta > 0 && d.porTarefa.lotesComMeta < d.porTarefa.lotes
                    ? `${d.porTarefa.lotesComMeta} de ${d.porTarefa.lotes} lotes com meta · ${d.porTarefa.rendimento.pct}% nesses`
                    : d.porTarefa.rendimento.frase}
                  cor={d.porTarefa.rendimento.selo === 'OK' ? M.verde : d.porTarefa.rendimento.selo === 'SEM_META' ? undefined : M.ambar} />
                <Stat rotulo="Custo médio"
                  valor={d.porTarefa.custoMedio != null ? brl(d.porTarefa.custoMedio) : '—'}
                  sufixo={d.porTarefa.custoMedio != null ? '/un' : undefined}
                  detalhe={d.porTarefa.custoMedio != null
                    ? `de ${num(d.porTarefa.custoMin!)} a ${num(d.porTarefa.custoMax!)} no período${d.porTarefa.lotesSemCusto ? ` · ${d.porTarefa.lotesSemCusto} sem custo` : ''}`
                    : 'nenhum lote com custo fechado'} />
              </div>

              <Painel titulo="Tempo médio por dia" nota="· minutos por lote">
                <LinhaDoTempo pontos={d.porTarefa.porDia} melhor={d.porTarefa.melhor} />
              </Painel>

              <Painel titulo="Quem fez essa tarefa" nota="· velocidade só com 3+ lotes medidos">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Pessoa', 'Lotes', 'Quantidade', 'un/min', 'vs média'].map((h, i) => (
                          <th key={h} className="px-2 py-2 text-[10.5px] font-bold uppercase tracking-[.04em]"
                            style={{ color: M.sub, borderBottom: `1px solid ${M.line}`, textAlign: i ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.porTarefa.pessoas.map((p) => (
                        <tr key={p.colaboradorId}>
                          <td className="px-2 py-2.5" style={{ borderBottom: '1px solid #f1efe9' }}>
                            <span className="flex items-center gap-2 font-semibold">
                              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                                style={{ background: M.roxoFraco, color: M.roxo }}>{p.nome.slice(0, 1).toUpperCase()}</span>
                              {p.nome}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right" style={{ borderBottom: '1px solid #f1efe9' }}>{p.tarefas}</td>
                          <td className="px-2 py-2.5 text-right" style={{ borderBottom: '1px solid #f1efe9' }}>{p.quantidade.texto}</td>
                          <td className="px-2 py-2.5 text-right" style={{ borderBottom: '1px solid #f1efe9' }}>
                            {/* ⛔ un/min só existe com UMA unidade — misto não vira número */}
                            {p.minutosMedidos > 0 && p.quantidade.total != null
                              ? <b>{num(Math.round((p.quantidade.total / p.minutosMedidos) * 10) / 10)}</b>
                              : p.quantidade.mista
                              ? <span className="text-[12px] italic" style={{ color: M.sub }}>unidades mistas</span>
                              /* ⚠️ tempo a apurar é DITO, nunca vira 0 (a lição de 06/09) */
                              : <span className="text-[12px] italic" style={{ color: M.sub }}>sem tempo (pelo gerente)</span>}
                          </td>
                          <td className="px-2 py-2.5 text-right" style={{ borderBottom: '1px solid #f1efe9' }}>
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                              style={p.selo === 'ACIMA' ? { background: M.verdeFraco, color: M.verde }
                                : p.selo === 'ABAIXO' ? { background: M.ambarFraco, color: M.ambar }
                                : { background: M.slateFraco, color: M.slate }}>
                              {p.selo === 'SEM_MEDIA' ? '—' : p.frase}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11.5px]" style={{ color: M.sub }}>
                  comparação com a média da tarefa, sem pódio · tempo a apurar fica fora das médias e é dito · lote cancelado fora pelo estado
                  {/* ⭐⭐ A RÉGUA DO PISO FICA VISÍVEL, como as outras — quem lê o número
                      precisa saber o que ele exclui (ordem do dono, 13/09) */}
                  {' · '}<b>lote abaixo de {PISO_DE_DURACAO_MIN} min é “relâmpago”</b> (registro retroativo): conta na produção, fica fora do tempo
                </p>
              </Painel>
            </>
          )}

          {/* ── POR PESSOA (todas as tarefas) ──────────────────────────────────── */}
          <Painel titulo={d.visaoGeral ? 'Unidades por pessoa' : 'Quem produziu essa tarefa'}
            nota={d.visaoGeral
              ? `· no período, todas as tarefas${d.porPessoa[0]?.emLotes ? ' · barra em LOTES (unidades mistas)' : ''}`
              : `· ${d.tarefa}`}>
            {d.porPessoa.length === 0
              ? <p className="text-[13px] italic" style={{ color: M.sub }}>ninguém produziu no filtro</p>
              : d.porPessoa.map((p, i) => (
                <div key={p.colaboradorId} className="flex items-center gap-2.5 py-1.5">
                  <span className="w-[86px] shrink-0 truncate text-[12px]">{p.nome}</span>
                  <span className="h-4 flex-1 overflow-hidden rounded-full" style={{ background: M.slateFraco }}>
                    <i className="block h-full rounded-full"
                      style={{ width: `${Math.round(p.proporcao * 100)}%`, background: ['#534AB7', '#8b84d6', '#b3aee6', '#d5d2f0'][Math.min(i, 3)] }} />
                  </span>
                  <span className="w-[96px] shrink-0 text-right text-[11.5px] font-bold">
                    {p.quantidade.texto}
                    {p.emLotes && <small className="block font-normal" style={{ color: M.sub }}>{p.lotes} lote(s)</small>}
                  </span>
                </div>
              ))}
          </Painel>

          {/* ── GERAL ──────────────────────────────────────────────────────────── */}
          {/* ⛔⛔ O GERAL SÓ APARECE NA VISÃO GERAL. Com uma tarefa escolhida ele mostrava a
              empresa inteira DENTRO do recorte — o defeito do print (51 lotes, top queijo,
              numa tela que dizia falar de massa de pizza). */}
          {d.visaoGeral && (
            <Painel titulo="Geral do período"
              nota={`· ${d.pessoa ? 'as tarefas dessa pessoa' : 'todas as tarefas'}, ${diaCurto(d.de)}–${diaCurto(d.ate)}`}>
              {d.geral.vazio
                ? <p className="text-[13px] italic" style={{ color: M.sub }}>{d.geral.vazio}</p>
                : (
                  <>
                    <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      <Stat nu rotulo="Lotes" valor={String(d.geral.lotes)} />
                      {/* ⛔ por UNIDADE: "6.912 UN · 23 KG", nunca um número composto */}
                      <Stat nu pequeno rotulo="Quantidade" valor={d.geral.quantidade.texto} />
                      <Stat nu rotulo="Horas de cozinha" valor={`${num(d.geral.horas)}h`}
                        detalhe={[
                          d.geral.lotesSemTempo ? `${d.geral.lotesSemTempo} sem tempo` : null,
                          d.geral.lotesRelampago ? `${d.geral.lotesRelampago} relâmpago` : null,
                        ].filter(Boolean).join(' · ') || undefined} />
                    </div>
                    <div className="text-[10.5px] font-bold uppercase tracking-[.04em]" style={{ color: M.sub }}>
                      {d.pessoa ? 'Top tarefas dela' : 'Top tarefas'}
                      {/* ⚠️ por LOTES: ordenar por quantidade seria comparar UN com KG */}
                      <small className="font-normal normal-case tracking-normal"> · por nº de lotes</small>
                    </div>
                    {/* ⭐ CLICÁVEIS: daqui o dono entra no recorte de cada uma (pedido dele) */}
                    {d.geral.topTarefas.slice(0, 6).map((t) => (
                      <button key={t.tarefa} onClick={() => setTarefa(t.tarefa)}
                        className="flex w-full items-center gap-2 py-1.5 text-left text-[13.5px]"
                        style={{ borderTop: '1px solid #f1efe9' }}>
                        <span className="flex-1 truncate" style={{ color: M.roxo, fontWeight: 600 }}>{t.tarefa} →</span>
                        <span className="shrink-0 text-[12px]" style={{ color: M.sub }}>
                          {t.lotes} lote{t.lotes > 1 ? 's' : ''} · {num(t.unidades)} {t.unidade}
                        </span>
                      </button>
                    ))}
                  </>
                )}
            </Painel>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ rotulo, valor, sufixo, detalhe, roxo, cor, nu, pequeno }: {
  rotulo: string; valor: string; sufixo?: string; detalhe?: string
  roxo?: boolean; cor?: string; nu?: boolean; pequeno?: boolean
}) {
  return (
    <div className={nu ? 'px-2 py-1' : 'rounded-[14px] border px-3.5 py-3'}
      style={nu ? undefined : { background: M.card, borderColor: M.line }}>
      <div className="text-[10.5px] font-bold uppercase tracking-[.04em]" style={{ color: M.sub }}>{rotulo}</div>
      <div className="my-0.5 font-bold" style={{
        fontSize: pequeno ? 15 : nu ? 20 : 24,
        color: cor ?? (roxo ? M.roxo : M.ink),
      }}>
        {valor}{sufixo && <small className="text-[13px] font-semibold" style={{ color: M.sub }}>{sufixo}</small>}
      </div>
      {detalhe && <div className="text-[11.5px]" style={{ color: M.sub }}>{detalhe}</div>}
    </div>
  )
}

function Painel({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5 rounded-[16px] border p-4" style={{ background: M.card, borderColor: M.line }}>
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-[.03em]" style={{ color: M.sub }}>
        {titulo}{nota && <small className="font-normal normal-case tracking-normal"> {nota}</small>}
      </h3>
      {children}
    </div>
  )
}

/** ⭐ a linha do mock — SVG puro. Dia sem lote medido fica SEM ponto (não vira zero). */
function LinhaDoTempo({ pontos, melhor }: {
  pontos: { dia: string; minutosPorLote: number | null; lotes: number; semTempoMedido: boolean }[]
  melhor: { frase: string } | null
}) {
  const medidos = pontos.filter((p) => p.minutosPorLote != null)
  const semTempo = pontos.filter((p) => p.semTempoMedido).length
  if (medidos.length === 0) {
    return <p className="text-[13px] italic" style={{ color: M.sub }}>
      nenhum lote com tempo medido no período — <b>sem tempo medido não há linha</b>, e inventar um valor seria pior que a ausência
    </p>
  }
  const vals = medidos.map((p) => p.minutosPorLote!)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const x = (i: number) => 70 + (i * 480) / Math.max(1, pontos.length - 1)
  const y = (v: number) => 145 - ((v - min) / span) * 105
  const linha = pontos.map((p, i) => (p.minutosPorLote == null ? null : `${x(i)},${y(p.minutosPorLote)}`)).filter(Boolean).join(' ')

  return (
    <svg viewBox="0 0 640 180" className="block h-auto w-full">
      <line x1="40" y1="20" x2="40" y2="145" stroke={M.line} />
      <line x1="40" y1="145" x2="620" y2="145" stroke={M.line} />
      <text x="34" y="30" fontSize="10" fill={M.sub} textAnchor="end">{fmt(max)}</text>
      <text x="34" y="148" fontSize="10" fill={M.sub} textAnchor="end">{fmt(min)}</text>
      <polyline points={linha} fill="none" stroke={M.roxo} strokeWidth="2.5" />
      {pontos.map((p, i) => p.minutosPorLote != null && (
        <circle key={p.dia} cx={x(i)} cy={y(p.minutosPorLote)} r="4" fill={M.roxo} />
      ))}
      {/* ⛔ DIA COM LOTE E SEM TEMPO MEDIDO: marca vazada no eixo, nunca um ponto em zero.
          O buraco fica VISÍVEL (régua do dono) em vez de mudo — e zero inventado seria pior. */}
      {pontos.map((p, i) => p.minutosPorLote == null && p.lotes > 0 && (
        <circle key={`v-${p.dia}`} cx={x(i)} cy="145" r="3.5" fill="none" stroke={M.sub} strokeDasharray="2 2" />
      ))}
      <g fontSize="10" fill={M.sub} textAnchor="middle">
        {pontos.map((p, i) => (
          <text key={p.dia} x={x(i)} y="162" fill={p.semTempoMedido ? M.sub : M.ink} opacity={p.semTempoMedido ? 0.6 : 1}>
            {diaCurto(p.dia)}
          </text>
        ))}
      </g>
      {melhor && <text x="330" y="14" fontSize="10.5" fontWeight="700" fill={M.verde} textAnchor="middle">{melhor.frase}</text>}
      {semTempo > 0 && (
        <text x="330" y="176" fontSize="9.5" fill={M.sub} textAnchor="middle">
          ○ {semTempo} dia(s) com lote e sem tempo medido — sem ponto, nunca zero
        </text>
      )}
    </svg>
  )
}
