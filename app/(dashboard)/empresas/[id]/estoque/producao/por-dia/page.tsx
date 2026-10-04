'use client'

/**
 * ⭐⭐⭐ RELATÓRIO DE PRODUÇÃO POR DIA — item 3 do dono (04/10/2026).
 *
 * **Pedido:** *"Calendário/período livre (como o Real×Teórico): escolho dia 25 do mês passado e
 * vejo POR ORDEM/RECEITA — pedido (UN) · separado do estoque (R$) · produzido real (UN) ·
 * eficiência % colorida · TEMPO de produção. Subtotais do dia e por receita no período. Clicar
 * na linha abre a ordem. Filtros: receita, setor, quem concluiu; chips casaBusca."*
 *
 * ⛔⛔ **A TELA SÓ CONTA A VERDADE — zero conta aqui.** Todo número vem de `relatorioPorDia`, que
 * traduz `lotesDaJanela` + a eficiência **CONGELADA** (a mesma coluna que o juiz P8 lê). A ordem
 * foi explícita: *"NENHUMA conta nova fora da porta (REGRA 11: paralela = vermelho)"*.
 *
 * ⚠️ Tokens do RADAR (a casa tem UMA paleta), zebra, chips, e as DUAS composições — tabela no
 * desktop, cards no celular (REGRA 12).
 */

import { useCallback, useEffect, useMemo, useState, use } from 'react'
import { RADAR } from '@/components/estoque/radar-tokens'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { casaBusca } from '@/lib/busca-texto'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { BarChart3, ChevronRight, Loader2, Search, X } from 'lucide-react'

/**
 * ⚠️⚠️ **DERIVADO DA LIB, não reescrito à mão.** A 1ª versão declarou
 * `{ porUnidade: Record<string, number>; frase: string }` — e a forma real é
 * `{ porUnidade: {unidade,qtd}[]; total; unidade; mista; texto }`. O `tsc` ficou **VERDE**
 * porque interface de tela não tem vínculo com o tipo do servidor; quem pegou foi o TESTE.
 * É a dívida registrada em 01/09: *interface escrita à mão sobre payload é promessa, não prova*.
 */
import type { Quantidade } from '@/lib/stock/producao/desempenho'
// ⭐ a frase do pedido tem DONO: "pedido 0" leria como "pedi zero" (achado na prova em prod)
import { textoDoPedido } from '@/lib/stock/producao/relatorio-por-dia'
interface Linha {
  ordemId: string; dia: string; tarefa: string; unidade: string
  pedido: number | null; produzido: number; pctDoPedido: number | null
  seloDoPedido: 'OK' | 'BAIXO' | 'ALTO' | 'SEM_META'
  eficiencia: number | null; separadoReais: number | null
  minutos: number | null; relampago: boolean
  setor: string | null; quemConcluiu: string | null
}
interface Dia {
  dia: string; lotes: number; pedido: Quantidade; produzido: Quantidade; semPedido: number
  eficienciaMedia: number | null; lotesComEficiencia: number; separadoReais: number
  minutos: number | null; semTempo: number; relampagos: number
}
interface PorReceita {
  tarefa: string; unidade: string; lotes: number; pedido: Quantidade; produzido: Quantidade
  semPedido: number; pctMedio: number | null; eficienciaMedia: number | null
  separadoReais: number; minutosPorLote: number | null; semTempo: number; relampagos: number
}
interface Payload {
  linhas: Linha[]; dias: Dia[]; porReceita: PorReceita[]; vazio: boolean
  periodo: { de: string; ate: string }
  filtros: { tarefas: string[]; setores: string[]; pessoas: string[] }
}

const PILULAS = [
  { chave: 'HOJE', rotulo: 'hoje', dias: 0 },
  { chave: 'SETE', rotulo: '7 dias', dias: -6 },
  { chave: 'MES', rotulo: '30 dias', dias: -29 },
] as const
type Chave = (typeof PILULAS)[number]['chave'] | 'LIVRE'

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const qtd = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }))
const dia = (iso: string) => iso.split('-').reverse().join('/')
/** ⚠️ `null` é "não dá pra dizer", nunca "0 min" — a régua do tempo medido (13/09) */
const min = (m: number | null) => (m == null ? 'a apurar' : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}min`)

/**
 * ⭐ O TOM DA EFICIÊNCIA — os MESMOS degraus do bloco da ordem e do juiz P8 (±15%).
 * ⛔ `null` é cinza com "a apurar": pintar de verde o que ninguém mediu seria afirmar que bateu.
 */
function tomDaEficiencia(pct: number | null) {
  if (pct == null) return { bg: RADAR.mudoBg, cor: RADAR.mudo, texto: 'a apurar' }
  const n = Math.round(pct * 100)
  if (n < 85) return { bg: RADAR.coralBg, cor: RADAR.coral, texto: `${n}%` }
  // ⭐ ACIMA é AZUL, não vermelho: render acima do prometido não é prejuízo — é ficha generosa
  if (n > 115) return { bg: RADAR.azulBg, cor: RADAR.azul, texto: `${n}%` }
  return { bg: RADAR.verdeBg, cor: RADAR.verde, texto: `${n}%` }
}

export default function RelatorioPorDiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hojeBR = diaEmSaoPaulo()
  const [chave, setChave] = useState<Chave>('SETE')
  const [de, setDe] = useState(somarDias(hojeBR, -6))
  const [ate, setAte] = useState(hojeBR)
  const [tarefa, setTarefa] = useState<string | null>(null)
  const [setor, setSetor] = useState<string | null>(null)
  const [quem, setQuem] = useState<string | null>(null)
  const [abrirTarefas, setAbrirTarefas] = useState(false)
  const [buscaTarefa, setBuscaTarefa] = useState('')
  const [data, setData] = useState<Payload | null | undefined>(undefined)

  const aplicarPilula = (c: typeof PILULAS[number]) => {
    setChave(c.chave)
    setDe(somarDias(hojeBR, c.dias))
    setAte(hojeBR)
  }

  const carregar = useCallback(() => {
    const q = new URLSearchParams({ de, ate })
    if (tarefa) q.set('tarefa', tarefa)
    if (setor) q.set('setor', setor)
    if (quem) q.set('quem', quem)
    setData(undefined)
    return fetchComTimeout<Payload>(`/api/empresas/${id}/estoque/producao/relatorio-por-dia?${q}`)
      .then((r) => setData(r.ok ? r.data! : null))
      .catch(() => setData(null))
  }, [id, de, ate, tarefa, setor, quem])

  useEffect(() => { void carregar() }, [carregar])

  /** ⭐ a busca da casa: palavra em qualquer ordem, sem caixa e sem acento (08/09) */
  const tarefasFiltradas = useMemo(
    // ⚠️ `casaBusca(texto, termo)` — o NOME da receita é o palheiro, o digitado é a agulha.
    // Invertido, ele procuraria o nome da receita DENTRO do que o dono digitou (sempre falso).
    () => (data?.filtros.tarefas ?? []).filter((t) => casaBusca(t, buscaTarefa)),
    [data?.filtros.tarefas, buscaTarefa],
  )

  const linhasPorDia = useMemo(() => {
    const m = new Map<string, Linha[]>()
    for (const l of data?.linhas ?? []) m.set(l.dia, [...(m.get(l.dia) ?? []), l])
    return m
  }, [data?.linhas])

  return (
    <div style={{ background: RADAR.bg }} className="-mx-4 -my-6 min-h-screen px-4 py-6 lg:-mx-6 lg:px-6">
      {/* ── cabeçalho ───────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BarChart3 className="h-5 w-5 shrink-0" style={{ color: RADAR.roxo }} />
        <h1 className="text-[15px] font-bold" style={{ color: RADAR.ink }}>Produção por dia</h1>
        <p className="hidden flex-1 truncate text-[12px] lg:block" style={{ color: RADAR.sub }}>
          pedido · o que saiu do estoque · produzido · eficiência · tempo — por ordem e por receita
        </p>
      </div>

      {/* ── filtros ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-[14px] p-2" style={{ background: RADAR.card }}>
        {PILULAS.map((p) => (
          <button
            key={p.chave}
            onClick={() => aplicarPilula(p)}
            className="h-8 rounded-full px-3 text-[12.5px] font-bold"
            style={chave === p.chave ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}
          >
            {p.rotulo}
          </button>
        ))}
        {/* ⭐ período LIVRE — *"escolho dia 25 do mês passado"* (o calendário do Real×Teórico) */}
        <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: chave === 'LIVRE' ? RADAR.roxoBg : RADAR.bg }}>
          <input
            type="date" value={de} max={hojeBR}
            onChange={(e) => { setDe(e.target.value); setChave('LIVRE') }}
            className="h-6 bg-transparent text-[12px] font-semibold outline-none" style={{ color: RADAR.ink }}
          />
          <span className="text-[11px]" style={{ color: RADAR.sub }}>até</span>
          <input
            type="date" value={ate} max={hojeBR}
            onChange={(e) => { setAte(e.target.value); setChave('LIVRE') }}
            className="h-6 bg-transparent text-[12px] font-semibold outline-none" style={{ color: RADAR.ink }}
          />
        </div>

        {/* receita (chips com busca) */}
        <button
          onClick={() => setAbrirTarefas((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-bold"
          style={tarefa ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}
        >
          <Search className="h-3.5 w-3.5" /> {tarefa ?? 'receita'}
        </button>
        {/**
          * ⚠️ setor e pessoa saem da PRÓPRIA lista do período (a rota devolve). Oferecer um
          * setor que não produziu nada ali é oferecer um filtro que devolve vazio.
          */}
        {(data?.filtros.setores.length ?? 0) > 0 && (
          <select
            value={setor ?? ''} onChange={(e) => setSetor(e.target.value || null)}
            className="h-8 rounded-full px-3 text-[12.5px] font-bold outline-none"
            style={setor ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}
          >
            <option value="">setor</option>
            {data!.filtros.setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(data?.filtros.pessoas.length ?? 0) > 0 && (
          <select
            value={quem ?? ''} onChange={(e) => setQuem(e.target.value || null)}
            className="h-8 rounded-full px-3 text-[12.5px] font-bold outline-none"
            style={quem ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}
          >
            <option value="">quem concluiu</option>
            {data!.filtros.pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {(tarefa || setor || quem) && (
          <button
            onClick={() => { setTarefa(null); setSetor(null); setQuem(null) }}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px]"
            style={{ background: RADAR.bg, color: RADAR.sub }}
          >
            <X className="h-3.5 w-3.5" /> limpar
          </button>
        )}
      </div>

      {abrirTarefas && (
        <div className="mb-3 rounded-[14px] p-2.5" style={{ background: RADAR.card }}>
          <input
            value={buscaTarefa} onChange={(e) => setBuscaTarefa(e.target.value)}
            placeholder="buscar receita… (ex: coxao porcao)"
            className="mb-2 h-8 w-full rounded-lg px-2.5 text-[12.5px] outline-none"
            style={{ background: RADAR.bg, color: RADAR.ink }}
          />
          <div className="flex flex-wrap gap-1.5">
            {tarefasFiltradas.map((t) => (
              <button
                key={t}
                onClick={() => { setTarefa(t === tarefa ? null : t); setAbrirTarefas(false) }}
                className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                style={t === tarefa ? { background: RADAR.roxo, color: '#fff' } : { background: RADAR.bg, color: RADAR.sub }}
              >
                {t}
              </button>
            ))}
            {!tarefasFiltradas.length && (
              <p className="text-[12px]" style={{ color: RADAR.sub }}>
                nada com «{buscaTarefa}» entre as {data?.filtros.tarefas.length ?? 0} receitas que produziram neste período
              </p>
            )}
          </div>
        </div>
      )}

      {data === undefined && (
        <p className="flex items-center gap-2 text-[13px]" style={{ color: RADAR.sub }}>
          <Loader2 className="h-4 w-4 animate-spin" /> lendo a produção…
        </p>
      )}
      {/* ⛔ erro e vazio NUNCA juntos: sem a carga, o sistema não SABE se está vazio (09/09) */}
      {data === null && (
        <div className="rounded-[14px] p-4" style={{ background: RADAR.ambarBg }}>
          <p className="text-[13px]" style={{ color: RADAR.ambar }}>Não consegui carregar o relatório.</p>
          <button onClick={() => void carregar()} className="mt-1 text-[12px] underline" style={{ color: RADAR.ambar }}>
            tentar de novo
          </button>
        </div>
      )}
      {/* ⚠️ o vazio DIZ o recorte — "sem produção" seco faria o dono achar que o dado sumiu */}
      {data && data.vazio && (
        <div className="rounded-[14px] p-6 text-center" style={{ background: RADAR.card }}>
          <p className="text-[13px] font-semibold" style={{ color: RADAR.ink }}>Sem produção neste recorte.</p>
          <p className="mt-1 text-[12px]" style={{ color: RADAR.sub }}>
            {dia(data.periodo.de)} a {dia(data.periodo.ate)}
            {tarefa ? ` · receita «${tarefa}»` : ''}{setor ? ` · setor ${setor}` : ''}{quem ? ` · concluído por ${quem}` : ''}
          </p>
        </div>
      )}

      {data && !data.vazio && (
        <>
          {/* ── por receita no período ─────────────────────────────────────── */}
          <div className="mb-3 rounded-[14px] p-3" style={{ background: RADAR.card }}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: RADAR.sub }}>
              por receita · {dia(data.periodo.de)} a {dia(data.periodo.ate)}
            </p>
            <div className="overflow-x-auto">
              <table className="density-normal w-full">
                <thead>
                  <tr>
                    {['receita', 'lotes', 'pedido', 'produzido', '% do pedido', 'eficiência', 'tempo/lote', 'saiu do estoque'].map((h, i) => (
                      <th key={h} className={`px-2 py-1.5 text-[11px] uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: RADAR.sub }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.porReceita.map((r, i) => {
                    const ef = tomDaEficiencia(r.eficienciaMedia)
                    return (
                      <tr key={r.tarefa} style={{ background: i % 2 === 1 ? RADAR.bg : undefined }}>
                        <td className="px-2 py-0 text-[13px] font-medium" style={{ color: RADAR.ink }}>
                          {r.tarefa}
                          {r.semPedido > 0 && (
                            <span className="ml-1.5 text-[11px]" style={{ color: RADAR.sub }}>
                              ({r.semPedido} sem pedido registrado)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>{r.lotes}</td>
                        {/* ⛔ a frase vem do servidor (`somarQuantidades`): UN e KG nunca viram um número só */}
                        <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>{textoDoPedido(r.pedido, r.semPedido, r.lotes)}</td>
                        <td className="px-2 py-0 text-right text-[13px] font-medium tabular-nums" style={{ color: RADAR.ink }}>{r.produzido.texto}</td>
                        <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>
                          {r.pctMedio == null ? 'sem pedido' : `${Math.round(r.pctMedio)}%`}
                        </td>
                        <td className="px-2 py-0 text-right">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums" style={{ background: ef.bg, color: ef.cor }}>{ef.texto}</span>
                        </td>
                        <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>
                          {min(r.minutosPorLote)}
                          {r.semTempo > 0 && <span className="ml-1 text-[11px]">({r.semTempo} sem tempo)</span>}
                        </td>
                        <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>{brl(r.separadoReais)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── dia por dia ────────────────────────────────────────────────── */}
          {data.dias.map((d) => (
            <div key={d.dia} className="mb-3 rounded-[14px] p-3" style={{ background: RADAR.card }}>
              {/* subtotal do dia */}
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-[14px] font-bold" style={{ color: RADAR.ink }}>{dia(d.dia)}</p>
                <p className="text-[12px]" style={{ color: RADAR.sub }}>
                  {d.lotes} {d.lotes === 1 ? 'ordem' : 'ordens'} · pedido {textoDoPedido(d.pedido, d.semPedido, d.lotes)} · produziu {d.produzido.texto}
                  {d.semPedido > 0 && ` · ${d.semPedido} sem pedido registrado`}
                </p>
                <span className="inline-flex rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums"
                  style={{ background: tomDaEficiencia(d.eficienciaMedia).bg, color: tomDaEficiencia(d.eficienciaMedia).cor }}>
                  {tomDaEficiencia(d.eficienciaMedia).texto}
                  {d.lotesComEficiencia > 0 && d.lotesComEficiencia < d.lotes && (
                    <span className="ml-1 font-normal">de {d.lotesComEficiencia} de {d.lotes}</span>
                  )}
                </span>
                <p className="ml-auto text-[12px] tabular-nums" style={{ color: RADAR.sub }}>
                  saiu do estoque {brl(d.separadoReais)} · {min(d.minutos)}
                  {d.relampagos > 0 && ` · ${d.relampagos} registro(s) retroativo(s), fora do tempo`}
                </p>
              </div>

              {/* ─── DESKTOP: tabela ─── */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="density-normal w-full">
                  <thead>
                    <tr>
                      {['receita', 'pedido', 'produzido', '%', 'eficiência', 'tempo', 'saiu do estoque', 'quem', ''].map((h, i) => (
                        <th key={h + i} className={`px-2 py-1.5 text-[11px] uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`} style={{ color: RADAR.sub }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(linhasPorDia.get(d.dia) ?? []).map((l, i) => {
                      const ef = tomDaEficiencia(l.eficiencia)
                      return (
                        <tr
                          key={l.ordemId}
                          onClick={() => { window.location.href = `/empresas/${id}/estoque/producao/${l.ordemId}` }}
                          className="cursor-pointer hover:brightness-[0.98]"
                          style={{ background: i % 2 === 1 ? RADAR.bg : undefined }}
                        >
                          <td className="px-2 py-0 text-[13px] font-medium" style={{ color: RADAR.ink }}>{l.tarefa}</td>
                          <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>
                            {l.pedido == null ? 'sem pedido' : `${qtd(l.pedido)} ${l.unidade}`}
                          </td>
                          <td className="px-2 py-0 text-right text-[13px] font-medium tabular-nums" style={{ color: RADAR.ink }}>{qtd(l.produzido)} {l.unidade}</td>
                          <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>
                            {l.pctDoPedido == null ? '—' : `${l.pctDoPedido}%`}
                          </td>
                          <td className="px-2 py-0 text-right">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums" style={{ background: ef.bg, color: ef.cor }}>{ef.texto}</span>
                          </td>
                          <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>
                            {l.relampago ? 'retroativo' : min(l.minutos)}
                          </td>
                          <td className="px-2 py-0 text-right text-[13px] tabular-nums" style={{ color: RADAR.sub }}>{brl(l.separadoReais)}</td>
                          <td className="px-2 py-0 text-right text-[13px]" style={{ color: RADAR.sub }}>{l.quemConcluiu ?? '—'}</td>
                          <td className="px-2 py-0 text-right"><ChevronRight className="h-4 w-4" style={{ color: RADAR.sub }} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── CELULAR: cards (REGRA 12 — composição própria, MESMOS dados) ─── */}
              <div className="space-y-1.5 lg:hidden">
                {(linhasPorDia.get(d.dia) ?? []).map((l) => {
                  const ef = tomDaEficiencia(l.eficiencia)
                  return (
                    <a
                      key={l.ordemId}
                      href={`/empresas/${id}/estoque/producao/${l.ordemId}`}
                      className="block rounded-xl p-2.5"
                      style={{ background: RADAR.bg }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: RADAR.ink }}>{l.tarefa}</span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums" style={{ background: ef.bg, color: ef.cor }}>{ef.texto}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] tabular-nums" style={{ color: RADAR.sub }}>
                        {l.pedido == null ? 'sem pedido' : `pedido ${qtd(l.pedido)} ${l.unidade}`} · produziu {qtd(l.produzido)} {l.unidade}
                        {l.pctDoPedido != null && ` · ${l.pctDoPedido}%`}
                      </p>
                      <p className="text-[12px] tabular-nums" style={{ color: RADAR.sub }}>
                        {brl(l.separadoReais)} · {l.relampago ? 'retroativo' : min(l.minutos)}
                        {l.quemConcluiu ? ` · ${l.quemConcluiu}` : ''}
                      </p>
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
