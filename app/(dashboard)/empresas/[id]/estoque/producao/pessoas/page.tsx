'use client'

// ⭐⭐ PRODUÇÃO POR PESSOA (06/09/2026) — a pergunta do dono: quem é mais rápido, quem produz
// mais, quem entrega dentro do esperado. Construída sobre o mock aprovado.
//
// ⛔⛔ ISTO NÃO É PONTO, e a frase fica NA TELA (não num manual): a jornada oficial é o REP
// homologado. Aqui se mede TAREFA. Sem esse aviso à vista, o primeiro desentendimento
// trabalhista nasce de um relatório que ninguém disse o que era.
//
// ⛔ E O RANKING SÓ EXISTE AQUI — nunca na janela do funcionário, nunca em tela compartilhada
// (decisão do dono). A rota exige `stock.manage`. Ranking é conversa de gestão.
//
// ⚠️ AS RÉGUAS DE HONESTIDADE SÃO DO SERVIDOR, não desta tela: destaques, média e "a apurar"
// vêm calculados da MESMA lista que aqui se desenha. Recalcular no cliente abriria a porta pra
// o card premiar alguém que a lista não mostra.

import { useEffect, useState, use } from 'react'
import { ArrowLeft, Loader2, AlertTriangle, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { duracao } from '@/components/estoque/etapas-da-ordem'

interface Pessoa {
  colaboradorId: string; nome: string; tarefas: number; minutos: number
  produziu: number; unidade: string | null; minPorUnidade: number | null
  rendimentoVsEsperado: number | null; lotesComRegua: number
  pctDoEsperado: number | null; tarefasFeitas: string[]; sparkline: number[]
}
interface LinhaTarefa {
  tarefa: string; produtos: string[]
  maisRapido: { colaboradorId: string; nome: string; minPorUnidade: number } | null
  semVencedor: string | null; mediaDaEquipe: number | null; volume: number; pessoas: number
}
interface Destaque {
  faceta: string; titulo: string; quem: { colaboradorId: string; nome: string }[]
  valor: number; unidadeDoValor: string; semDestaque: string | null
}
interface Aberta { etapaId: string; nome: string; quem: string | null; horas: number; ordemId: string }
interface Payload {
  relatorio: { pessoas: Pessoa[]; porTarefaEquipe: LinhaTarefa[]; abertasIgnoradas: number; avisoDeEscopo: string }
  abertas: Aberta[]
  destaques: Destaque[]
  levouAsTres: { colaboradorId: string; nome: string }[]
  media: { media: number | null; confiavel: boolean; pessoas: number }
}

const MINIMO = 3
const num = (n: number, casas = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const inicial = (nome: string) => (nome.trim()[0] ?? '?').toUpperCase()
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const rotuloDoMes = (m: string) => {
  const [a, b] = m.split('-')
  return `${MES[Number(b) - 1]} ${a}`
}
const somarMes = (m: string, n: number) => {
  const [a, b] = m.split('-').map(Number)
  const d = new Date(Date.UTC(a, b - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const ultimoDia = (m: string) => {
  const [a, b] = m.split('-').map(Number)
  return `${m}-${String(new Date(Date.UTC(a, b, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * ⭐ A LARGURA DA BARRA "velocidade vs equipe".
 *
 * ⚠️ min/un é MENOR-melhor, então a barra é **inversamente** proporcional: quem gasta menos
 * tempo por unidade tem a barra mais longa. A média fica sempre no mesmo lugar (64%) — é a
 * referência visual fixa que permite comparar dois cards sem ler os números.
 */
function larguraVelocidade(minPorUnidade: number, media: number): number {
  if (minPorUnidade <= 0 || media <= 0) return 0
  return Math.max(4, Math.min(100, (media / minPorUnidade) * 64))
}

export default function PessoasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hoje = diaEmSaoPaulo()
  const [mes, setMes] = useState(hoje.slice(0, 7))
  // ⚠️ período livre é OPT-IN: o mês é o recorte que o dono usa, e um par de campos de data
  // sempre visível transforma a tela numa consulta em vez de um relatório.
  const [periodoLivre, setPeriodoLivre] = useState(false)
  const [de, setDe] = useState(`${hoje.slice(0, 7)}-01`)
  const [ate, setAte] = useState(hoje)
  const [d, setD] = useState<Payload | null | undefined>(undefined)

  const deEfetivo = periodoLivre ? de : `${mes}-01`
  const ateEfetivo = periodoLivre ? ate : (mes === hoje.slice(0, 7) ? hoje : ultimoDia(mes))

  useEffect(() => {
    setD(undefined)
    fetch(`/api/empresas/${id}/estoque/producao/relatorio-pessoas?${new URLSearchParams({ de: deEfetivo, ate: ateEfetivo })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setD(null))
  }, [id, deEfetivo, ateEfetivo])

  const pessoas = d?.relatorio.pessoas ?? []
  const media = d?.media

  return (
    <div className="space-y-5">
      {/* ── topo ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 self-center text-xs text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Produção
          </a>
          <h1 className="text-[22px] font-semibold text-slate-900">Produção por pessoa</h1>
          {/* ⛔ o aviso de escopo fica no CABEÇALHO, colado no título — não num rodapé */}
          <span className="text-[13px] text-slate-500">mede tarefa, não presença — a jornada oficial segue no ponto</span>
        </div>
        <div className="flex items-center gap-2.5">
          {periodoLivre ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white p-1">
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-7 rounded-md px-1.5 text-xs" />
              <span className="text-xs text-slate-400">até</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-7 rounded-md px-1.5 text-xs" />
              <button onClick={() => setPeriodoLivre(false)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">por mês</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-[10px] border border-slate-200 bg-white p-1">
              <button onClick={() => setMes(somarMes(mes, -1))} aria-label="mês anterior" className="rounded-[7px] p-1 text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-sm font-semibold capitalize text-slate-800">{rotuloDoMes(mes)}</span>
              <button onClick={() => setMes(somarMes(mes, 1))} disabled={mes >= hoje.slice(0, 7)} aria-label="próximo mês"
                className="rounded-[7px] p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="h-4 w-4" /></button>
              <button onClick={() => setPeriodoLivre(true)} className="ml-1 rounded-[7px] px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">período…</button>
            </div>
          )}
          {pessoas.length > 0 && (
            <button onClick={() => baixarCsv(`producao-por-pessoa-${hojeArquivo()}`,
              ['pessoa', 'tarefas', 'produziu', 'unidade', 'tempo_min', 'min_por_unidade', 'rende_%_do_esperado', 'lotes_com_regua', 'tarefas_que_faz'],
              pessoas.map((p) => [p.nome, p.tarefas, p.produziu, p.unidade ?? '', p.minutos, p.minPorUnidade ?? 'a apurar',
                p.pctDoEsperado ?? 'a apurar', p.lotesComRegua, p.tarefasFeitas.join(' · ')]))}
              className="flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-[#534AB7] hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> exportar CSV
            </button>
          )}
        </div>
      </div>
      <p className="text-[12.5px] text-slate-400">
        Ranqueia quem tem {MINIMO}+ tarefas no período. Quem tem menos aparece na lista como “ainda apurando”.
        {d && d.relatorio.abertasIgnoradas > 0 && ` · ${d.relatorio.abertasIgnoradas} tarefa(s) ainda aberta(s) ficaram de fora da conta.`}
      </p>

      {d?.abertas && d.abertas.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> {d.abertas.length} tarefa(s) aberta(s) há mais de 4h</p>
          {/* ⚠️ o gestor vê e decide. O sistema NÃO fecha sozinho — fechar seria inventar um
              horário que ninguém mediu, e ele entraria na média como fato. */}
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-800">
            {d.abertas.map((a) => (
              <li key={a.etapaId}>
                <a href={`/empresas/${id}/estoque/producao/${a.ordemId}`} className="underline underline-offset-2">
                  “{a.nome}” · {a.quem ?? 'sem nome'} · aberta há {a.horas}h
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d === undefined ? <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
        : d === null ? <p className="p-6 text-sm text-slate-500">Não consegui carregar o relatório.</p>
        : pessoas.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-600">Nenhuma tarefa finalizada neste período.</p>
            {/* ⚠️ vazio EXPLICADO: sem etapas na receita, ninguém aperta botão e este
                relatório fica em branco pra sempre — a tela diz por onde começar. */}
            <p className="mt-1 text-xs text-slate-400">
              As tarefas nascem das <strong>etapas</strong> da receita. Adicione etapas na ficha e designe quem faz cada uma na ordem de produção.
            </p>
          </div>
        ) : (
          <>
            <Destaques destaques={d.destaques} levouAsTres={d.levouAsTres} media={media} />
            <div>
              <h2 className="mb-2.5 text-sm font-semibold text-slate-500">Equipe no período</h2>
              <div className="grid gap-3.5 md:grid-cols-2">
                {pessoas.map((p) => <CardDaPessoa key={p.colaboradorId} p={p} media={media} />)}
              </div>
            </div>
            <PorTarefa linhas={d.relatorio.porTarefaEquipe} />
            <p className="text-[12px] leading-relaxed text-slate-400">
              min/un = tempo ÷ quantidade — lote grande não vira lentidão. Lote com duas etapas divide as unidades entre quem fez cada uma.
              Ordem cancelada não conta. Esta tela é da gestão: os nomes existem para conversar, não para expor.
            </p>
          </>
        )}
    </div>
  )
}

// ── os três destaques ───────────────────────────────────────────────────────────────────
// ⚠️ Uma faceta por card, cada uma com a SUA régua. Um prêmio único misturaria réguas
// diferentes; e quem leva as três ganhou de verdade.

const PALETA: Record<string, { bg: string; tinta: string }> = {
  MAIS_PRODUZIU: { bg: 'bg-[#EDEBFA]', tinta: 'text-[#4A4390]' },
  MAIS_RAPIDO: { bg: 'bg-[#EAF3DE]', tinta: 'text-[#27500A]' },
  MELHOR_RENDIMENTO: { bg: 'bg-[#FAEEDA]', tinta: 'text-[#633806]' },
}

function Destaques({ destaques, levouAsTres, media }: {
  destaques: Destaque[]; levouAsTres: { nome: string }[]; media?: { media: number | null; confiavel: boolean }
}) {
  return (
    <div className="space-y-2">
      {levouAsTres.length > 0 && (
        <p className="text-[13px] font-medium text-[#4A4390]">
          🏅 {levouAsTres.map((q) => q.nome).join(' e ')} {levouAsTres.length > 1 ? 'levaram' : 'levou'} as três facetas no período.
        </p>
      )}
      <div className="grid gap-3.5 md:grid-cols-3">
        {destaques.map((dd) => {
          const cor = PALETA[dd.faceta] ?? PALETA.MAIS_PRODUZIU
          return (
            <div key={dd.faceta} className={`rounded-2xl px-[18px] py-4 ${cor.bg}`}>
              <div className={`text-[12.5px] font-medium ${cor.tinta}`}>{dd.titulo}</div>
              {dd.quem.length === 0 ? (
                // ⛔ card vazio sem explicar vira mistério — a frase diz o PORQUÊ
                <p className="mt-2 text-[13px] leading-snug text-slate-500">{dd.semDestaque}</p>
              ) : (
                <>
                  <div className="mt-2 flex items-center gap-2.5 text-[19px] font-semibold text-slate-900">
                    {/* ⚠️ empate mostra os DOIS — nunca desempata no escuro */}
                    {dd.quem.map((q) => (
                      <span key={q.colaboradorId} className="flex items-center gap-2">
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700">{inicial(q.nome)}</span>
                        {q.nome}
                      </span>
                    ))}
                  </div>
                  <div className={`mt-1 text-[13px] ${cor.tinta}`}>
                    {dd.faceta === 'MAIS_PRODUZIU' && `${num(dd.valor)} ${dd.unidadeDoValor}`}
                    {dd.faceta === 'MAIS_RAPIDO' && (
                      <>{num(dd.valor, 2)} min por unidade
                        {media?.media != null && media.confiavel && ` · média da equipe ${num(media.media, 2)}`}</>
                    )}
                    {dd.faceta === 'MELHOR_RENDIMENTO' && `entrega ${num(100 + dd.valor)}% do esperado`}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── o card de cada pessoa ───────────────────────────────────────────────────────────────

function CardDaPessoa({ p, media }: { p: Pessoa; media?: { media: number | null; confiavel: boolean; pessoas: number } }) {
  const apurando = p.tarefas < MINIMO
  const temBarra = !apurando && p.minPorUnidade != null && media?.media != null && media.confiavel
  const pico = Math.max(...p.sparkline, 1)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-[18px] py-4">
      <div className="mb-3.5 flex items-center gap-3">
        <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${
          apurando ? 'bg-slate-100 text-slate-400' : 'bg-[#EDEBFA] text-[#534AB7]'}`}>{inicial(p.nome)}</div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-slate-900">{p.nome}</div>
          <div className="truncate text-[12.5px] text-slate-400">
            {p.tarefas} tarefa{p.tarefas === 1 ? '' : 's'}
            {p.tarefasFeitas.length > 0 && ` · ${p.tarefasFeitas.slice(0, 2).join(', ')}`}
          </div>
        </div>
        {/* ⚠️ o selo é "% do ESPERADO" e só existe com régua medida — nunca 100% por default */}
        <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          apurando || p.pctDoEsperado == null ? 'bg-slate-50 text-slate-400'
            : p.pctDoEsperado >= 95 ? 'bg-[#EAF3DE] text-[#27500A]' : 'bg-[#FAEEDA] text-[#633806]'}`}>
          {apurando ? 'ainda apurando'
            : p.pctDoEsperado == null ? 'rendimento a apurar'
            : `rende ${num(p.pctDoEsperado)}% do esperado`}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <div className="text-[17px] font-semibold text-slate-900">{p.produziu > 0 ? `${num(p.produziu)} ${p.unidade ?? ''}` : '—'}</div>
          <div className="mt-px text-[11.5px] text-slate-400">produzidas</div>
        </div>
        <div>
          <div className="text-[17px] font-semibold text-slate-900">{duracao(p.minutos)}</div>
          <div className="mt-px text-[11.5px] text-slate-400">em tarefa</div>
        </div>
        <div>
          {/* ⭐ a coluna que responde a pergunta do dono: tempo bruto puniria quem pegou o lote grande */}
          <div className={`text-[17px] font-semibold ${apurando || p.minPorUnidade == null ? 'text-slate-400' : 'text-slate-900'}`}>
            {apurando || p.minPorUnidade == null ? 'a apurar' : num(p.minPorUnidade, 2)}
          </div>
          <div className="mt-px text-[11.5px] text-slate-400">
            {apurando ? `precisa de ${MINIMO}+ tarefas` : 'min por unidade'}
          </div>
        </div>
      </div>

      <div className="mb-2.5">
        <div className="mb-1.5 flex justify-between text-xs text-slate-500">
          <span>velocidade vs equipe</span>
          <span>
            {apurando ? `aparece com ${MINIMO} tarefas`
              : media?.media == null ? 'sem média ainda'
              // ⚠️ com menos de 3 pessoas alguém está sempre "abaixo da média" por construção
              : !media.confiavel ? `média ${num(media.media, 2)} — com ${media.pessoas} pessoa(s) ainda não compara`
              : `média ${num(media.media, 2)}`}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-slate-100">
          {temBarra && (
            <>
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#534AB7]" style={{ width: `${larguraVelocidade(p.minPorUnidade!, media!.media!)}%` }} />
              <div className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-slate-400" style={{ left: '64%' }} />
            </>
          )}
        </div>
      </div>

      {p.sparkline.length > 0 && (
        <>
          <div className="flex h-[26px] items-end gap-[3px]">
            {p.sparkline.map((v, i) => (
              <div key={i} className={`flex-1 rounded-t-[3px] ${i === p.sparkline.length - 1 ? 'bg-[#534AB7]' : 'bg-[#EDEBFA]'}`}
                style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / pico) * 100)}%` }} />
            ))}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">unidades por semana{p.unidade ? ` (${p.unidade})` : ''}</div>
        </>
      )}
    </div>
  )
}

// ── quem é mais rápido em cada tarefa ───────────────────────────────────────────────────
// ⚠️ Comparar min/un de tarefas diferentes é injusto — este recorte existe pra isso, e a
// média mostrada é a DESTA tarefa, nunca a geral.

function PorTarefa({ linhas }: { linhas: LinhaTarefa[] }) {
  if (linhas.length === 0) return null
  return (
    <div>
      <h2 className="mb-2.5 text-sm font-semibold text-slate-500">Quem é mais rápido em cada tarefa</h2>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-[18px]">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-400">
              <th className="w-[34%] py-3 font-medium">tarefa</th>
              <th className="py-3 font-medium">mais rápido</th>
              <th className="hidden py-3 font-medium sm:table-cell">média da equipe</th>
              <th className="py-3 text-right font-medium">volume no período</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.tarefa} className="border-t border-slate-100 text-sm">
                <td className="py-3 pr-3">
                  <span className="font-medium text-slate-800">{l.tarefa}</span>
                  {l.produtos.length > 0 && <small className="mt-px block text-xs font-normal text-slate-400">{l.produtos.slice(0, 2).join(' · ')}</small>}
                </td>
                <td className="py-3 pr-3 text-[13px]">
                  {/* ⛔ uma pessoa só não faz um "mais rápido" — a linha diz o motivo */}
                  {l.maisRapido
                    ? <><b className="font-semibold text-slate-800">{l.maisRapido.nome}</b> <span className="text-slate-500">{num(l.maisRapido.minPorUnidade, 2)} min/un</span></>
                    : <span className="text-slate-400">{l.semVencedor}</span>}
                </td>
                <td className="hidden py-3 pr-3 text-[13px] tabular-nums text-slate-500 sm:table-cell">
                  {l.mediaDaEquipe != null ? `${num(l.mediaDaEquipe, 2)} min/un` : '—'}
                </td>
                <td className="py-3 text-right text-[13px] tabular-nums text-slate-700">{num(l.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
