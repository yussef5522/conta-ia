'use client'

// FLUXO DE CAIXA — a página central do dono (25/08): entrou X, paguei Y, sobrou Z.
//
// ⚠️ NÃO É O DRE (competência) — é DINHEIRO VIVO nas contas. A diferença mais visível
// é o cartão: aqui a saída é o PAGAMENTO da fatura, não a compra. A tela DIZ isso, pra
// ninguém comparar com o DRE e achar que um dos dois está errado.
//
// Anatomia da /contas-a-pagar: cards do topo → barra de filtro → tabela densa com
// listras por tom → régua de totais. Componentes compartilhados, zero cópia.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Wallet, TrendingUp, TrendingDown, Landmark, Download, ChevronRight, ChevronDown,
  AlertTriangle, Info, Loader2,
} from 'lucide-react'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'

interface Lancamento { id: string; data: string; conta: string; descricao: string; valor: number }
interface Grupo { rotulo: string; total: number; n: number; sintetico: boolean; lancamentos: Lancamento[] }
interface MesSerie { mes: string; entrou: number; saiu: number; resultado: number; completo: boolean; motivo: string | null }
interface Conta { id: string; nome: string; saldo: number }
interface FluxoData {
  mes: string; hoje: string
  entrou: number; saiu: number; resultado: number
  entradas: Grupo[]; saidas: Grupo[]
  aClassificar: { n: number; entrada: number; saida: number }
  informativas: Grupo[]
  totalInformativo: number
  saldoContas: number; contas: Conta[]
  serie: MesSerie[]
  transferenciasExcluidas: { n: number; total: number }
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => iso.split('-').reverse().join('/')
const MESNOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const rotuloMes = (m: string) => `${MESNOME[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const mesCurto = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`
const CAT_SEM = 'A CLASSIFICAR'

type Campo = 'rotulo' | 'total' | 'n'

export default function FluxoDeCaixaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const hojeMes = new Date().toISOString().slice(0, 7)
  const [mes, setMes] = useState(hojeMes)
  const [data, setData] = useState<FluxoData | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const { col, dir, alternar, ordenar } = useSort<Campo>('total', 'desc')

  useEffect(() => {
    setData(null); setErro(null); setAberto(null)
    fetch(`/api/empresas/${id}/fluxo-caixa?mes=${mes}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Falha ao carregar o fluxo de caixa'))))
      .then(setData)
      .catch((e) => setErro(e.message))
  }, [id, mes])

  // ⚠️ REGRA 9 — TODOS os hooks ficam ACIMA dos early returns abaixo. Foi assim que a
  // tela de vendas caiu em 25/08 (hook novo colado onde é usado, depois do `if (!data)`).
  const saidasOrd = useMemo(
    () => ordenar(data?.saidas ?? [], (g, c) => (c === 'rotulo' ? g.rotulo : c === 'n' ? g.n : g.total)),
    [data, ordenar],
  )
  const entradasOrd = useMemo(
    () => ordenar(data?.entradas ?? [], (g, c) => (c === 'rotulo' ? g.rotulo : c === 'n' ? g.n : g.total)),
    [data, ordenar],
  )
  const maxBarra = useMemo(
    () => Math.max(1, ...(data?.serie ?? []).flatMap((s) => [s.entrou, s.saiu])),
    [data],
  )
  const mesesOpcoes = useMemo(() => {
    const out: string[] = []
    const [a, m] = hojeMes.split('-').map(Number)
    for (let i = 0; i < 13; i++) {
      const d = new Date(Date.UTC(a, m - 1 - i, 1))
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    return out
  }, [hojeMes])

  function exportar() {
    if (!data) return
    const linhas: unknown[][] = []
    for (const g of data.entradas) for (const l of g.lancamentos) linhas.push(['ENTRADA', g.rotulo, l.data, l.conta, l.descricao, l.valor])
    for (const g of data.saidas) for (const l of g.lancamentos) linhas.push(['SAÍDA', g.rotulo, l.data, l.conta, l.descricao, l.valor])
    baixarCsv(`fluxo-de-caixa-${data.mes}-${hojeArquivo()}.csv`,
      ['Tipo', 'Categoria', 'Data', 'Conta', 'Descrição', 'Valor'], linhas)
  }

  if (erro) return <p className="text-sm text-rose-600">{erro}</p>
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>

  const mesAtual = data.serie.find((s) => s.mes === data.mes)
  const sobrou = data.resultado >= 0

  return (
    <div className="space-y-4">
      {/* ── CABEÇALHO DE UMA LINHA (molde da CaP) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">Fluxo de caixa</h1>
        <span className="hidden text-xs text-slate-400 lg:inline">
          dinheiro que entrou e saiu das contas — não é o DRE (que é por competência)
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select value={mes} onChange={(e) => setMes(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs">
            {mesesOpcoes.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
          </select>
          <button onClick={exportar} className="flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs hover:bg-muted">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {mesAtual && !mesAtual.completo && (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 shrink-0" /> {rotuloMes(data.mes)} está <b>{mesAtual.motivo}</b>.
        </p>
      )}

      {/* ── 1. CARDS DO TOPO ── */}
      <StatCardGrid>
        <StatCard tone="emerald" icon={TrendingUp} label="Entrou" value={brl(data.entrou)}
          sub={`${data.entradas.reduce((s, g) => s + g.n, 0)} lançamentos`} />
        <StatCard tone="rose" icon={TrendingDown} label="Saiu" value={brl(data.saiu)}
          sub={`${data.saidas.reduce((s, g) => s + g.n, 0)} lançamentos`} />
        <StatCard tone={sobrou ? 'emerald' : 'rose'} icon={Wallet}
          label={sobrou ? 'Sobrou' : 'Faltou'} value={brl(Math.abs(data.resultado))}
          sub={sobrou ? 'entrou mais do que saiu' : 'saiu mais do que entrou'} />
        <StatCard tone={data.saldoContas >= 0 ? 'sky' : 'rose'} icon={Landmark}
          label="Saldo hoje em contas" value={brl(data.saldoContas)}
          sub={`${data.contas.length} contas · ${dia(data.hoje)}`} />
      </StatCardGrid>

      {/* saldo por conta — o consolidado pode ser negativo por causa da conta garantida */}
      <Card>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2.5">
          {data.contas.map((c) => (
            <span key={c.id} className="text-[11px] text-muted-foreground">
              {c.nome}: <span className={`tabular-nums font-medium ${c.saldo < 0 ? 'text-rose-600' : 'text-foreground'}`}>{brl(c.saldo)}</span>
            </span>
          ))}
        </CardContent>
      </Card>

      {data.aClassificar.n > 0 && (
        <p className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <b>A CLASSIFICAR: {brl(data.aClassificar.saida + data.aClassificar.entrada)}</b>
          <span>em {data.aClassificar.n} lançamento(s) sem categoria — está somado nos totais, mas não dá pra dizer no que foi.</span>
        </p>
      )}

      {/* ── 2. SAÍDAS POR CATEGORIA ── */}
      <TabelaCategorias titulo="Saídas por categoria" tom="rose" grupos={saidasOrd} total={data.saiu}
        col={col} dir={dir} alternar={alternar} aberto={aberto} setAberto={setAberto} prefixo="s" />

      {/* ── 3. ENTRADAS POR CATEGORIA ── */}
      <TabelaCategorias titulo="Entradas por categoria" tom="emerald" grupos={entradasOrd} total={data.entrou}
        col={col} dir={dir} alternar={alternar} aberto={aberto} setAberto={setAberto} prefixo="e" />

      {/* ── 4. GRÁFICO 6 MESES ── */}
      <Card>
        <CardContent className="py-5">
          <h2 className="mb-1 text-sm font-medium">Últimos 6 meses</h2>
          <p className="mb-4 text-xs text-muted-foreground">Barra cheia = entrou · barra vazada = saiu. Mês com ressalva vem hachurado.</p>
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {data.serie.map((s) => (
              <button key={s.mes} onClick={() => setMes(s.mes)}
                className={`flex min-w-[62px] flex-1 flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-muted/50 ${s.mes === data.mes ? 'bg-muted' : ''}`}
                title={s.motivo ?? 'mês fechado'}>
                <span className={`text-[10px] tabular-nums font-medium ${s.resultado >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {s.resultado >= 0 ? '+' : '−'}{Math.abs(Math.round(s.resultado / 1000))}k
                </span>
                <div className="flex h-24 items-end gap-1">
                  <div className={`w-4 rounded-t bg-emerald-500 ${!s.completo ? 'opacity-50' : ''}`}
                    style={{ height: `${Math.max(2, (s.entrou / maxBarra) * 96)}px` }} />
                  <div className={`w-4 rounded-t border-2 border-rose-400 bg-rose-100 ${!s.completo ? 'opacity-50' : ''}`}
                    style={{ height: `${Math.max(2, (s.saiu / maxBarra) * 96)}px` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{mesCurto(s.mes)}</span>
                {!s.completo && <span className="text-[9px] leading-tight text-amber-600">ressalva</span>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 5. O QUE FICOU DE FORA (a exclusão à vista) ── */}
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-1 text-sm font-medium">O que ficou de fora, de propósito</h2>
          {/* ⭐ ENTRADA QUE NÃO É RECEITA (26/08) — dinheiro que caiu na conta e NÃO
              soma no ENTROU: liberação de empréstimo é DÍVIDA entrando, aporte é
              capital do sócio. Ficam aqui, com valor à vista e o motivo escrito. */}
          {data.informativas.length > 0 && (
            <div className="mb-3 space-y-1.5 rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2">
              {data.informativas.map((g) => (
                <div key={g.rotulo}>
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-medium text-sky-900">+ {g.rotulo}:</span>
                    <span className="font-semibold tabular-nums text-sky-900">{brl(g.total)}</span>
                    <span className="text-sky-700">
                      (não somado — {g.rotulo === 'Liberação de empréstimo' ? 'é dívida' : 'não é venda'})
                    </span>
                  </div>
                  {g.lancamentos.map((l) => (
                    <div key={l.id} className="pl-3 text-[11px] text-sky-800/80">
                      {dia(l.data)} · {l.conta} · {l.descricao} · <span className="tabular-nums">{brl(l.valor)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              <b className="text-foreground">Empréstimo e aporte não são receita:</b> dinheiro de empréstimo
              é dívida entrando e aporte é capital do sócio — nenhum dos dois é venda, então ficam fora
              do <b>Entrou</b> (e do gráfico), visíveis na faixa acima.
            </li>
            <li>
              <b className="text-foreground">Transferências entre contas próprias:</b>{' '}
              {data.transferenciasExcluidas.n} lançamento(s), {brl(data.transferenciasExcluidas.total)} movimentados.
              Tirar dinheiro do Sicredi e pôr no cofre não é entrada nem saída — se contasse, o fluxo inflaria dos dois lados.
            </li>
            <li>
              <b className="text-foreground">Compras no cartão:</b> a saída de caixa é o <b>pagamento da fatura</b> (que aparece
              nas saídas acima), não a compra. A compra é competência e conta no DRE.
            </li>
            <li>
              <b className="text-foreground">Contas a pagar em aberto:</b> só entra o que já saiu da conta de verdade.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function TabelaCategorias({ titulo, tom, grupos, total, col, dir, alternar, aberto, setAberto, prefixo }: {
  titulo: string; tom: 'rose' | 'emerald'; grupos: Grupo[]; total: number
  col: Campo; dir: 'asc' | 'desc'; alternar: (c: Campo) => void
  aberto: string | null; setAberto: (s: string | null) => void; prefixo: string
}) {
  const listra = tom === 'rose' ? 'bg-rose-400' : 'bg-emerald-400'
  const valor = tom === 'rose' ? 'text-rose-600' : 'text-emerald-600'

  return (
    <Card>
      <CardContent className="py-4">
        <h2 className="mb-3 text-sm font-medium">{titulo}</h2>
        {grupos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="density-normal w-full">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-6 px-1 py-2" />
                  <SortableTh campo="rotulo" col={col} dir={dir} onSort={alternar}>Categoria</SortableTh>
                  <SortableTh campo="n" col={col} dir={dir} onSort={alternar} align="right">Lanç.</SortableTh>
                  <SortableTh campo="total" col={col} dir={dir} onSort={alternar} align="right">Valor</SortableTh>
                  <th className="px-3 py-2 text-right">% do total</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const chave = `${prefixo}:${g.rotulo}`
                  const on = aberto === chave
                  const alerta = g.rotulo === CAT_SEM
                  return (
                    <>
                      <tr key={chave} onClick={() => setAberto(on ? null : chave)}
                        className="cursor-pointer border-b hover:bg-muted/40">
                        <td className="px-1 py-0">
                          <div className="flex items-center gap-1">
                            <span className={`h-6 w-1 rounded-full ${alerta ? 'bg-amber-400' : listra}`} />
                            {on ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </td>
                        <td className="px-3 py-0 text-[13px]">
                          {g.rotulo}
                          {g.sintetico && !alerta && (
                            <span className="ml-2 rounded bg-slate-100 px-1 py-px text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              pelo sistema
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums text-muted-foreground">{g.n}</td>
                        <td className={`px-3 py-0 text-right text-[13px] font-medium tabular-nums ${alerta ? 'text-amber-700' : valor}`}>{brl(g.total)}</td>
                        <td className="px-3 py-0 text-right text-[13px] tabular-nums text-muted-foreground">
                          {total > 0 ? `${((g.total / total) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                      {on && (
                        <tr key={`${chave}-det`} className="border-b bg-muted/20">
                          <td />
                          <td colSpan={4} className="px-3 py-2">
                            <div className="max-h-72 overflow-y-auto">
                              <table className="w-full">
                                <tbody>
                                  {g.lancamentos.map((l) => (
                                    <tr key={l.id} className="border-b border-dashed last:border-0">
                                      <td className="py-1 pr-3 text-[12px] tabular-nums text-muted-foreground whitespace-nowrap">{dia(l.data)}</td>
                                      <td className="py-1 pr-3 text-[12px] text-muted-foreground whitespace-nowrap">{l.conta}</td>
                                      <td className="py-1 pr-3 text-[12px]">{l.descricao}</td>
                                      <td className="py-1 text-right text-[12px] font-medium tabular-nums whitespace-nowrap">{brl(l.valor)}</td>
                                      <td className="py-1 pl-3 text-right whitespace-nowrap">
                                        <a href={`/transacoes?busca=${encodeURIComponent(l.descricao)}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[11px] text-sky-600 hover:underline">ver no extrato</a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td />
                  <td className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Total</td>
                  <td className="px-3 py-2 text-right text-[13px] tabular-nums text-muted-foreground">
                    {grupos.reduce((s, g) => s + g.n, 0)}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm font-semibold tabular-nums ${valor}`}>{brl(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
