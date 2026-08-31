'use client'

// ⭐⭐ MODO REVISÃO — a tela do DONO, não a de quem conta (31/08/2026).
//
// ⚠️ AQUI SIM a tabela, AQUI SIM o sistema aparece, AQUI SIM a divergência vem colorida.
// Separar os dois momentos é o que permite a contagem ser CEGA: o número do sistema não
// pode existir enquanto ela conta, e tem que existir quando ele revisa.
//
// ⚠️⚠️ "CONFERIDO" NÃO APLICA NADA — e o botão diz isso. O ajuste no ledger já aconteceu na
// hora da contagem (decisão de 23/08: sessão de vários dias não pode segurar os ajustes
// reféns). Chamar de "Aceitar" faria o botão **mentir** sobre o que o clique faz.
//
// ⛔⛔ E A REGRA MAIS IMPORTANTE DESTA TELA, que é sobre GENTE e não sobre software:
// **o rastro diz QUEM CONTOU, não quem é culpado.** Quem descobre a falta não é quem
// causou. Por isso o nome de quem contou **nunca** aparece na mesma linha do número da
// divergência — ele mora DENTRO do histórico, com o rótulo "contado por". Se contar virar
// risco pessoal, ninguém conta direito, e aí o estoque inteiro deixa de valer.

import { useState } from 'react'
import { Check, RotateCcw, Search, ChevronRight, ChevronDown, Eye, HelpCircle, MessageSquare } from 'lucide-react'

export interface LinhaRevisao {
  itemId: string
  titulo: string
  especificacao: string
  unidadeControle: string
  saldoSistema: number
  avisoUnidade: string | null
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
  viuSistema: boolean
  observacao: string | null
  contado: { qtdContada: number; divergencia: number; valorDivergencia: number } | null
}
export interface VersaoLinha {
  versao: number; estado: string; qtdContada: number | null; qtdAnterior: number | null
  viuSistema: boolean; observacao: string | null; contadoPorNome: string | null; contadoEm: string
}
export type Decisao = 'CONFERIDO' | 'RECONTAR' | 'INVESTIGAR'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const quando = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function RevisaoContagem({
  linhas, historico, decisoes, podeDecidir, onDecidir, onRecontar,
}: {
  linhas: LinhaRevisao[]
  historico: Record<string, VersaoLinha[]>
  decisoes: Record<string, { decisao: string; motivo: string | null; decididoPorNome: string | null }>
  /** decidir é `stock.manage`; a operadora VÊ (é o resultado do trabalho dela) e não decide */
  podeDecidir: boolean
  onDecidir: (itemId: string, decisao: Decisao) => void
  onRecontar: (itemId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'diverg' | 'apurar' | 'bateu'>('todas')
  const [aberta, setAberta] = useState<Set<string>>(new Set())

  const comDiverg = linhas.filter((l) => l.contado && Math.abs(l.contado.divergencia) > 1e-9)
  const aApurar = linhas.filter((l) => l.estado === 'NAO_SEI')
  const bateram = linhas.filter((l) => l.contado && Math.abs(l.contado.divergencia) <= 1e-9)
  const valorDiverg = comDiverg.reduce((s, l) => s + (l.contado?.valorDivergencia ?? 0), 0)

  const q = busca.trim().toLowerCase()
  const base = filtro === 'diverg' ? comDiverg : filtro === 'apurar' ? aApurar : filtro === 'bateu' ? bateram : linhas
  const visiveis = q ? base.filter((l) => `${l.titulo} ${l.especificacao}`.toLowerCase().includes(q)) : base

  const Card = ({ label, valor, sub, tom, ativo, onClick }: {
    label: string; valor: string; sub?: string; tom: string; ativo: boolean; onClick: () => void
  }) => (
    <button type="button" onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition-colors ${ativo ? 'ring-2 ring-[#185FA5]' : ''} ${tom}`}>
      <p className="text-[11px] font-medium">{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight">{valor}</p>
      {sub && <p className="text-[10px] opacity-70">{sub}</p>}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card label="Divergência" valor={String(comDiverg.length)} sub={brl(valorDiverg)}
          tom="border-rose-200 bg-rose-50 text-rose-900"
          ativo={filtro === 'diverg'} onClick={() => setFiltro(filtro === 'diverg' ? 'todas' : 'diverg')} />
        <Card label="A apurar" valor={String(aApurar.length)} sub="marcados “não sei”"
          tom="border-amber-200 bg-amber-50 text-amber-900"
          ativo={filtro === 'apurar'} onClick={() => setFiltro(filtro === 'apurar' ? 'todas' : 'apurar')} />
        <Card label="Bateram" valor={String(bateram.length)}
          tom="border-emerald-200 bg-emerald-50 text-emerald-900"
          ativo={filtro === 'bateu'} onClick={() => setFiltro(filtro === 'bateu' ? 'todas' : 'bateu')} />
        <Card label="Todas" valor={String(linhas.length)}
          tom="border-slate-200 bg-white text-slate-700"
          ativo={filtro === 'todas'} onClick={() => setFiltro('todas')} />
      </div>

      <div className="relative max-w-[320px]">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item"
          className="h-9 w-full rounded-lg border border-slate-300 pl-7 pr-2 text-sm" />
      </div>

      {/* ⚠️ a frase que impede o mal-entendido do botão */}
      {podeDecidir && (
        <p className="text-[11px] text-slate-500">
          O ajuste no estoque <b>já foi aplicado quando ela contou</b> — “conferido” fecha a
          linha, não aplica nada. “Recontar” devolve o item pra fila.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="density-normal w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-right">Sistema</th>
              <th className="px-3 py-2 text-right">Contado</th>
              <th className="px-3 py-2 text-right">Diferença</th>
              <th className="px-3 py-2 text-right">R$</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const d = l.contado
              const div = d?.divergencia ?? 0
              const cor = !d ? 'text-slate-400' : Math.abs(div) <= 1e-9 ? 'text-slate-400' : div < 0 ? 'text-rose-600' : 'text-sky-700'
              const versoes = historico[l.itemId] ?? []
              const dec = decisoes[l.itemId]
              const exp = aberta.has(l.itemId)
              return (
                <>
                  <tr key={l.itemId} className={`border-b border-slate-100 ${dec?.decisao === 'CONFERIDO' ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-0 text-[13px]">
                      <button type="button"
                        onClick={() => setAberta((s) => { const n = new Set(s); n.has(l.itemId) ? n.delete(l.itemId) : n.add(l.itemId); return n })}
                        className="flex items-center gap-1 text-left">
                        {exp ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        <span className="font-medium text-slate-800">{l.titulo}</span>
                        {l.especificacao && <span className="hidden text-[11px] text-slate-400 lg:inline">{l.especificacao}</span>}
                      </button>
                      {l.avisoUnidade && (
                        <span className="ml-5 text-[10px] text-amber-700">⚠️ unidade suspeita — pode ser do cadastro</span>
                      )}
                    </td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-500">{num(l.saldoSistema)}</td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-800">
                      {l.estado === 'NAO_SEI'
                        ? <span className="text-amber-600">a apurar</span>
                        : l.estado === 'PULADO'
                          ? <span className="text-slate-400">pulado</span>
                          : d ? num(d.qtdContada) : <span className="text-slate-300">—</span>}
                      {/* ⭐ marca discreta: contou COM o número à vista */}
                      {l.viuSistema && <Eye className="ml-1 inline h-3 w-3 text-slate-400" aria-label="contado com o sistema à vista" />}
                      {l.observacao && <MessageSquare className="ml-1 inline h-3 w-3 text-sky-500" aria-label="tem observação" />}
                    </td>
                    <td className={`px-3 py-0 text-right text-[13px] font-medium tabular-nums ${cor}`}>
                      {d && Math.abs(div) > 1e-9 ? `${div > 0 ? '+' : ''}${num(div)}` : '—'}
                    </td>
                    <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${cor}`}>
                      {d && Math.abs(div) > 1e-9 ? brl(d.valorDivergencia) : '—'}
                    </td>
                    <td className="px-3 py-0 text-right">
                      {podeDecidir ? (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => onDecidir(l.itemId, 'CONFERIDO')} title="conferido — fecha a linha (não aplica nada)"
                            className={`rounded p-1 ${dec?.decisao === 'CONFERIDO' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => onRecontar(l.itemId)} title="recontar — devolve pra fila"
                            className="rounded p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => onDecidir(l.itemId, 'INVESTIGAR')} title="investigar — fica aberto pra você olhar"
                            className={`rounded p-1 ${dec?.decisao === 'INVESTIGAR' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}>
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">{dec?.decisao?.toLowerCase() ?? ''}</span>
                      )}
                    </td>
                  </tr>
                  {exp && (
                    <tr key={`${l.itemId}-h`} className="border-b border-slate-100 bg-slate-50/60">
                      <td colSpan={6} className="px-3 py-2">
                        {versoes.length === 0 ? (
                          <p className="text-[11px] text-slate-400">sem histórico — este item não foi tocado nesta contagem</p>
                        ) : (
                          <ul className="space-y-1">
                            {versoes.map((v) => (
                              <li key={v.versao} className="text-[11px] text-slate-600">
                                <b className="tabular-nums">v{v.versao}</b> · {quando(v.contadoEm)} ·{' '}
                                {v.estado === 'CONTADO' ? <b className="tabular-nums">{num(v.qtdContada ?? 0)} {l.unidadeControle}</b> : v.estado === 'NAO_SEI' ? 'a apurar' : 'pulado'}
                                {v.qtdAnterior != null && <span className="text-slate-400"> (era {num(v.qtdAnterior)})</span>}
                                {/* ⛔ o nome mora AQUI, longe do número da divergência —
                                    quem descobre a falta não é quem causou */}
                                <span className="text-slate-400"> — contado por {v.contadoPorNome ?? 'não identificado'}</span>
                                {v.viuSistema && <span className="text-slate-400"> · sistema estava à vista</span>}
                                {v.observacao && <span className="block pl-6 text-sky-700">“{v.observacao}”</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {dec && (
                          <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
                            decisão: <b>{dec.decisao.toLowerCase()}</b>{dec.decididoPorNome ? ` por ${dec.decididoPorNome}` : ''}
                            {dec.motivo ? ` — “${dec.motivo}”` : ''}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
