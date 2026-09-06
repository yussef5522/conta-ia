'use client'

// ⭐⭐ PRODUÇÃO POR PESSOA (06/09/2026) — a pergunta do dono: quem é mais rápido, quem produz
// mais, quem entrega dentro do esperado.
//
// ⛔⛔ ISTO NÃO É PONTO, e a frase fica NA TELA (não num manual): a jornada oficial é o REP
// homologado. Aqui se mede TAREFA. Sem esse aviso à vista, o primeiro desentendimento
// trabalhista nasce de um relatório que ninguém disse o que era.
//
// ⚠️ E O RANKING SÓ EXISTE AQUI — nunca na janela do funcionário, nunca em tela compartilhada
// (decisão do dono). A rota exige `stock.manage`.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Users, AlertTriangle, Info } from 'lucide-react'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { duracao } from '@/components/estoque/etapas-da-ordem'

interface Pessoa {
  colaboradorId: string; nome: string; tarefas: number; minutos: number
  produziu: number; unidade: string | null; minPorUnidade: number | null
  rendimentoVsEsperado: number | null; lotesComRegua: number
}
interface Tarefa { nome: string; vezes: number; minutosMedia: number; minPorUnidade: number | null; unidade: string | null }
interface Aberta { etapaId: string; nome: string; quem: string | null; horas: number; ordemId: string }

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export default function PessoasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hoje = diaEmSaoPaulo()
  const [de, setDe] = useState(`${hoje.slice(0, 8)}01`)
  const [ate, setAte] = useState(hoje)
  const [dados, setDados] = useState<{ pessoas: Pessoa[]; porTarefa: Tarefa[]; abertasIgnoradas: number; avisoDeEscopo: string } | null | undefined>(undefined)
  const [abertas, setAbertas] = useState<Aberta[]>([])
  const [detalhe, setDetalhe] = useState<string | null>(null)

  useEffect(() => {
    const q = new URLSearchParams({ de, ate })
    if (detalhe) q.set('colaborador', detalhe)
    fetch(`/api/empresas/${id}/estoque/producao/relatorio-pessoas?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setDados(j.relatorio); setAbertas(j.abertas ?? []) })
      .catch(() => setDados(null))
  }, [id, de, ate, detalhe])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Produção</a>
        <Users className="h-5 w-5 text-slate-400" />
        <h1 className="text-base font-semibold text-slate-900">Produção por pessoa</h1>
        <div className="ml-auto flex items-center gap-2">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-xs" />
          {dados && dados.pessoas.length > 0 && (
            <button onClick={() => baixarCsv(`producao-por-pessoa-${hojeArquivo()}`,
              ['pessoa', 'tarefas', 'minutos', 'produziu', 'unidade', 'min_por_unidade', 'rendimento_vs_esperado_%'],
              dados.pessoas.map((p) => [p.nome, p.tarefas, p.minutos, p.produziu, p.unidade ?? '', p.minPorUnidade ?? '', p.rendimentoVsEsperado ?? '']))}
              className="h-8 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">exportar CSV</button>
          )}
        </div>
      </div>

      {/* ⛔ o aviso vem ANTES dos números, não num rodapé que ninguém lê */}
      <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
        {dados?.avisoDeEscopo ?? 'Isto mede TAREFA, não presença.'}
      </p>

      {abertas.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> {abertas.length} tarefa(s) aberta(s) há mais de 4h</p>
          {/* ⚠️ o gestor vê e decide. O sistema NÃO fecha sozinha — fechar seria inventar um
              horário que ninguém mediu, e ele entraria na média como fato. */}
          <ul className="mt-1.5 space-y-0.5 text-[11px] text-amber-800">
            {abertas.map((a) => (
              <li key={a.etapaId}>
                <a href={`/empresas/${id}/estoque/producao/${a.ordemId}`} className="underline underline-offset-2">
                  “{a.nome}” · {a.quem ?? 'sem nome'} · aberta há {a.horas}h
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dados === undefined ? <div className="flex items-center gap-2 p-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> carregando…</div>
        : dados === null ? <p className="p-6 text-sm text-slate-500">Não consegui carregar o relatório.</p>
        : dados.pessoas.length === 0 ? (
          <Card><CardContent className="p-6 text-center">
            <p className="text-sm text-slate-600">Nenhuma tarefa finalizada neste período.</p>
            {/* ⚠️ vazio EXPLICADO: sem etapas na receita, ninguém aperta botão e este
                relatório fica em branco pra sempre — a tela diz por onde começar. */}
            <p className="mt-1 text-xs text-slate-400">
              As tarefas nascem das <strong>etapas</strong> da receita. Adicione etapas na ficha e designe quem faz cada uma na ordem de produção.
            </p>
          </CardContent></Card>
        ) : (
          <>
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="density-normal w-full">
                  <thead><tr>
                    <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-400">pessoa</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400">tarefas</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400">produziu</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400">tempo</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400">min/unid.</th>
                    <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-400">rendimento</th>
                  </tr></thead>
                  <tbody>
                    {dados.pessoas.map((p) => (
                      <tr key={p.colaboradorId} onClick={() => setDetalhe(detalhe === p.colaboradorId ? null : p.colaboradorId)}
                        className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${detalhe === p.colaboradorId ? 'bg-slate-50' : ''}`}>
                        <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{p.nome}</td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{p.tarefas}</td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{p.produziu > 0 ? `${num(p.produziu)} ${p.unidade ?? ''}` : '—'}</td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{duracao(p.minutos)}</td>
                        {/* ⭐ a coluna que responde a pergunta do dono: tempo bruto puniria quem
                            pegou o lote grande. */}
                        <td className="px-3 py-0 text-right text-[13px] font-medium tabular-nums text-slate-800">{p.minPorUnidade != null ? num(p.minPorUnidade) : '—'}</td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums">
                          {/* ⚠️ "a apurar" com menos de 3 lotes: 1 lote não é média, é anedota */}
                          {p.rendimentoVsEsperado == null
                            ? <span className="text-slate-400">a apurar</span>
                            : <span className={p.rendimentoVsEsperado >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                {p.rendimentoVsEsperado > 0 ? '+' : ''}{num(p.rendimentoVsEsperado)}%
                              </span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
            <p className="text-[11px] text-slate-400">
              min/unid. = tempo ÷ quantidade produzida — lote grande não vira lentidão. Quantidade de um lote com duas etapas é dividida entre quem fez cada uma.
              {dados.abertasIgnoradas > 0 && ` · ${dados.abertasIgnoradas} tarefa(s) ainda aberta(s) ficaram de fora da conta.`}
            </p>

            {detalhe && dados.porTarefa.length > 0 && (
              <Card><CardContent className="p-3">
                <p className="text-sm font-semibold text-slate-900">
                  Por tipo de tarefa — {dados.pessoas.find((p) => p.colaboradorId === detalhe)?.nome}
                </p>
                <ul className="mt-2 space-y-1">
                  {dados.porTarefa.map((t) => (
                    <li key={t.nome} className="flex flex-wrap items-baseline gap-x-4 text-[13px] text-slate-700">
                      <span className="min-w-[10rem] font-medium">{t.nome}</span>
                      <span className="tabular-nums text-slate-500">{t.vezes}×</span>
                      <span className="tabular-nums text-slate-500">média {duracao(t.minutosMedia)}</span>
                      {t.minPorUnidade != null && <span className="tabular-nums text-slate-500">{num(t.minPorUnidade)} min/{t.unidade}</span>}
                    </li>
                  ))}
                </ul>
              </CardContent></Card>
            )}
          </>
        )}
    </div>
  )
}
