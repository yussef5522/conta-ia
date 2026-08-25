'use client'

// ESTOQUE FASE 1 — POSIÇÃO nível líder (a tela de trabalho diária). Cards de valor por
// categoria + total · busca + filtro por categoria · colunas com tendência de custo e
// badge de idade da última entrada · ordenação · linha → ficha · renomear inline ·
// agrupamento colapsável · mobile em cards. Mesma família visual de Vendas.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { TotalsBar, type TotalItem } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { Boxes, Loader2, AlertTriangle, Search, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight, Download, PackageMinus, TrendingDown, MoreHorizontal, SlidersHorizontal, FileText } from 'lucide-react'
import { NomeEditavel } from '@/components/estoque/nome-editavel'
import { SaidaModal } from '@/components/estoque/saida-modal'
import { StatusBar, StatusDot, STATUS_BORDA } from '@/components/estoque/status-bar'
import type { StatusEstoqueResult } from '@/lib/stock/status-estoque'

interface PosItem {
  itemId: string; nome: string; categoria: string; categoriaLabel: string; unidadeControle: string
  saldo: number; custoMedio: number | null; valor: number; negativo: boolean
  ultimaEntrada: string | null; ultimaEntradaDias: number | null; custoTendencia: 'subiu' | 'desceu' | 'igual' | null
  estoqueMin: number | null; estoqueMax: number | null; status: StatusEstoqueResult
}
interface Posicao { itens: PosItem[]; valorTotal: number; porCategoria: { categoria: string; label: string; valor: number; itens: number }[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
type Campo = 'nome' | 'categoria' | 'saldo' | 'custo' | 'valor' | 'idade'

// Passe de densidade: texto CURTO ("hoje" · "2d" · "23d") — a coluna deixa de
// carregar "23 dias" e a linha ganha largura útil pro que importa.
function IdadeBadge({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-xs text-slate-400">—</span>
  const txt = dias === 0 ? 'hoje' : `${dias}d`
  const cor = dias > 14 ? 'bg-rose-50 text-rose-700' : dias > 7 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${cor}`}>{txt}</span>
}
function Tendencia({ t }: { t: PosItem['custoTendencia'] }) {
  if (t === 'subiu') return <ArrowUp className="inline h-3.5 w-3.5 text-rose-500" />
  if (t === 'desceu') return <ArrowDown className="inline h-3.5 w-3.5 text-emerald-500" />
  if (t === 'igual') return <Minus className="inline h-3 w-3 text-slate-300" />
  return null
}

export default function PosicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Posicao | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState<string | null>(null)
  // ordenação agora é POR COLUNA (setinha no header) — o select virou redundante
  const { col: ordCol, dir: ordDir, alternar, ordenar } = useSort<Campo>('valor', 'desc')
  const [sel, setSel] = useState<string[]>([])
  const [agrupar, setAgrupar] = useState(false)
  const [soAbaixo, setSoAbaixo] = useState(false)
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const [saida, setSaida] = useState<{ id: string; nome: string; unidadeControle: string; custoMedio: number | null } | 'novo' | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/posicao`).then((r) => r.json()).then((j) => setData(j.posicao ?? null)).catch(() => setData(null))
  }, [id])

  const filtrados = useMemo(() => {
    if (!data) return []
    let its = data.itens
    if (catFiltro) its = its.filter((i) => i.categoria === catFiltro)
    if (soAbaixo) its = its.filter((i) => i.status.status === 'ABAIXO')
    if (busca.trim()) its = its.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()))
    return ordenar(its, (i, c) => (
      c === 'nome' ? i.nome : c === 'categoria' ? i.categoriaLabel : c === 'saldo' ? i.saldo
        : c === 'custo' ? i.custoMedio : c === 'valor' ? i.valor : i.ultimaEntradaDias
    ))
  }, [data, catFiltro, busca, soAbaixo, ordenar])

  const nAbaixo = useMemo(() => (data?.itens.filter((i) => i.status.status === 'ABAIXO').length ?? 0), [data])

  const grupos = useMemo(() => {
    const m = new Map<string, PosItem[]>()
    for (const i of filtrados) { const a = m.get(i.categoriaLabel) ?? []; a.push(i); m.set(i.categoriaLabel, a) }
    return [...m.entries()]
  }, [filtrados])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!data) return <div className="p-6 text-sm text-slate-500">Não consegui carregar a posição.</div>

  const renomeado = (itemId: string, n: string) => setData({ ...data, itens: data.itens.map((i) => (i.itemId === itemId ? { ...i, nome: n } : i)) })

  return (
    <div className="space-y-3">
      {/* Cabeçalho de UMA linha: título + subtítulo lado a lado, botões h-8.
       * Era ícone 28px + 2 linhas de texto + botões py-2 = ~76px só de topo. */}
      <div className="flex items-center gap-2.5">
        <Boxes className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Posição de estoque</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">Saldo derivado dos movimentos · clique num item pra ver a ficha</p>
        <div className="flex flex-1 items-center justify-end gap-1.5 lg:flex-none">
          <a href={`/empresas/${id}/estoque/perdas`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><TrendingDown className="h-3.5 w-3.5" /> Perdas</a>
          <button onClick={() => setSaida('novo')} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><PackageMinus className="h-3.5 w-3.5" /> Registrar saída</button>
          {data.itens.length > 0 && <a href={`/api/empresas/${id}/estoque/posicao?formato=csv`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> CSV</a>}
        </div>
      </div>
      {saida && <SaidaModal companyId={id} itemInicial={saida === 'novo' ? undefined : { id: saida.id, nome: saida.nome, unidadeControle: saida.unidadeControle, custoMedio: saida.custoMedio }} onClose={() => setSaida(null)} onSalvo={() => { setSaida(null); location.reload() }} />}

      {data.itens.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Boxes className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">O estoque está zerado — e é assim que começa.</p>
          <p className="max-w-md text-xs text-slate-500">Confirme o primeiro recebimento na fila e os itens aparecem aqui com saldo e valor.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* FAIXA horizontal por categoria (era tijolo de 3 linhas × N, que
           * quebrava em 2ª fileira e comia a altura da lista).
           * Retoque 23/08: a 1ª versão apertou DEMAIS (virou texto espremido).
           * Agora rótulo 10px caixa-alta EM CIMA e valor 15px bold embaixo —
           * continua faixa (rola no eixo x, nunca 2ª fileira), só legível. */}
          <div className="-mx-1 flex items-stretch gap-2 overflow-x-auto px-1 pb-1">
            <button onClick={() => setCatFiltro(null)} className={`flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2 text-left transition ${!catFiltro ? 'border-[#185FA5] bg-[#185FA5]/5 ring-1 ring-[#185FA5]/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</span>
              <span className="text-[15px] font-bold tabular-nums leading-none text-slate-900">{brl(data.valorTotal)}</span>
            </button>
            {data.porCategoria.map((c) => (
              <button key={c.categoria} onClick={() => setCatFiltro(catFiltro === c.categoria ? null : c.categoria)} className={`flex shrink-0 flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2 text-left transition ${catFiltro === c.categoria ? 'border-[#185FA5] bg-[#185FA5]/5 ring-1 ring-[#185FA5]/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {c.label} <span className="font-normal normal-case tracking-normal text-slate-300">{c.itens}</span>
                </span>
                <span className="text-[15px] font-bold tabular-nums leading-none text-slate-900">{brl(c.valor)}</span>
              </button>
            ))}
          </div>

          {/* Filtros em UMA linha (h-9). A busca não estica mais o fim da tela:
           * teto de 320px, o resto do espaço vai pra lista. */}
          <div className="flex items-center gap-1.5">
            <div className="relative w-full max-w-[320px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item…" className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-sm" />
            </div>
            <button onClick={() => setAgrupar((v) => !v)} className={`h-9 shrink-0 rounded-lg border px-2.5 text-xs ${agrupar ? 'border-[#185FA5] bg-[#185FA5]/5 text-[#185FA5]' : 'border-slate-300 text-slate-600'}`}>Agrupar</button>
            {nAbaixo > 0 && <button onClick={() => setSoAbaixo((v) => !v)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs ${soAbaixo ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600'}`}><AlertTriangle className="h-3.5 w-3.5" /> {nAbaixo} abaixo do mín.</button>}
            <span className="ml-auto hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block">{filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}</span>
          </div>

          {/* lista */}
          {filtrados.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-slate-500">Nenhum item com esse filtro.</CardContent></Card>
          ) : agrupar ? (
            <div className="space-y-2">
              {grupos.map(([label, its]) => {
                const col = colapsadas.has(label)
                return (
                  <div key={label}>
                    <button onClick={() => setColapsadas((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })} className="flex w-full items-center gap-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {col ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} {label} <span className="text-xs font-normal text-slate-400">({its.length} · {brl(its.reduce((s, i) => s + i.valor, 0))})</span>
                    </button>
                    {!col && <ListaItens itens={its} id={id} onRenomear={renomeado} sort={{ col: ordCol, dir: ordDir, alternar }} sel={sel} setSel={setSel} onSaida={setSaida} />}
                  </div>
                )
              })}
            </div>
          ) : (
            <ListaItens itens={filtrados} id={id} onRenomear={renomeado} sort={{ col: ordCol, dir: ordDir, alternar }} sel={sel} setSel={setSel} onSaida={setSaida} />
          )}
          {/* RÉGUA DE TOTAIS — soma por categoria + total geral (anatomia oficial) */}
          <TotalsBar
            itens={data.porCategoria.map((c): TotalItem => ({
              chave: c.categoria, label: c.label,
              tone: TOM_CATEGORIA[c.categoria] ?? 'slate',
              valor: c.valor, n: c.itens,
              onClick: () => setCatFiltro(catFiltro === c.categoria ? null : c.categoria),
            }))}
            total={data.valorTotal}
            totalLabel="Estoque total"
          />
        </>
      )}
    </div>
  )
}

/** tom por categoria — mapa explícito (Tailwind não vê classe interpolada) */
const TOM_CATEGORIA: Record<string, TotalItem['tone']> = {
  MATERIA_PRIMA: 'rose', REVENDA: 'sky', EMBALAGEM: 'amber',
  LIMPEZA: 'emerald', USO_INTERNO: 'slate', INTERMEDIARIO: 'violet', PRODUTO_FINAL: 'violet',
}

interface SortProps { col: Campo; dir: 'asc' | 'desc'; alternar: (c: Campo) => void }
function ListaItens({ itens, id, onRenomear, sort, sel, setSel, onSaida }: {
  itens: PosItem[]; id: string; onRenomear: (itemId: string, n: string) => void
  sort: SortProps
  sel: string[]; setSel: (f: (s: string[]) => string[]) => void
  onSaida: (i: { id: string; nome: string; unidadeControle: string; custoMedio: number | null }) => void
}) {
  const todosMarcados = itens.length > 0 && itens.every((i) => sel.includes(i.itemId))
  return (
    <Card><CardContent className="p-0">
      {/* desktop: tabela.
       * Passe de densidade — REUSA o `density-normal` que já existe em globals.css
       * (linha de 48px), em vez de inventar uma segunda escala de altura só pro
       * estoque. Um sistema de densidade no projeto, não dois (REGRA 4).
       * Padding vertical sai (py-0): quem manda na altura é a classe. */}
      <table className="density-normal hidden w-full sm:table">
        <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <th className="w-10 px-3 py-2">
            <Checkbox checked={todosMarcados} onCheckedChange={(v) => setSel((s) => v ? [...new Set([...s, ...itens.map((i) => i.itemId)])] : s.filter((x) => !itens.some((i) => i.itemId === x)))} aria-label="selecionar todos" />
          </th>
          <SortableTh campo="nome" col={sort.col} dir={sort.dir} onSort={sort.alternar}>Item</SortableTh>
          <SortableTh campo="categoria" col={sort.col} dir={sort.dir} onSort={sort.alternar}>Categoria</SortableTh>
          <SortableTh campo="saldo" col={sort.col} dir={sort.dir} onSort={sort.alternar} align="right">Saldo</SortableTh>
          <th className="px-3 py-2 font-medium">Faixa</th>
          <SortableTh campo="custo" col={sort.col} dir={sort.dir} onSort={sort.alternar} align="right">Custo médio</SortableTh>
          <SortableTh campo="valor" col={sort.col} dir={sort.dir} onSort={sort.alternar} align="right">Valor</SortableTh>
          <SortableTh campo="idade" col={sort.col} dir={sort.dir} onSort={sort.alternar} align="right">Entrada</SortableTh>
          <th className="w-10 px-3 py-2" />
        </tr></thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.itemId} className={`border-b border-l-2 border-slate-50 last:border-b-0 hover:bg-slate-50 ${STATUS_BORDA[i.status.cor]} ${sel.includes(i.itemId) ? 'bg-[#185FA5]/5' : ''}`}>
              <td className="px-3 py-0">
                <Checkbox checked={sel.includes(i.itemId)} onCheckedChange={() => setSel((s) => s.includes(i.itemId) ? s.filter((x) => x !== i.itemId) : [...s, i.itemId])} aria-label={`selecionar ${i.nome}`} />
              </td>
              <td className="px-3 py-0 text-[13px]"><NomeEditavel companyId={id} itemId={i.itemId} nome={i.nome} comLink onSalvo={(n) => onRenomear(i.itemId, n)} /></td>
              <td className="px-3 py-0 text-[13px] text-slate-500">{i.categoriaLabel}</td>
              <td className={`whitespace-nowrap px-3 py-0 text-right text-[13px] tabular-nums ${i.negativo ? 'font-semibold text-rose-600' : 'text-slate-800'}`}>{i.negativo && <AlertTriangle className="mr-1 inline h-3 w-3" />}{num(i.saldo)} {i.unidadeControle}</td>
              {/* faixa numa LINHA só: barra + mín–máx ao lado (era barra + rodapé embaixo = 2 linhas) */}
              <td className="w-32 px-3 py-0">
                {i.estoqueMin == null ? <span className="text-xs text-slate-300">—</span> : (
                  <div className="flex items-center gap-1.5">
                    <StatusBar status={i.status} className="flex-1" />
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{num(i.estoqueMin)}{i.estoqueMax != null ? `–${num(i.estoqueMax)}` : ''}</span>
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{i.custoMedio != null ? brl(i.custoMedio) : '—'} <Tendencia t={i.custoTendencia} /></td>
              <td className="whitespace-nowrap px-3 py-0 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(i.valor)}</td>
              <td className="px-3 py-0 text-right"><IdadeBadge dias={i.ultimaEntradaDias} /></td>
              <td className="px-3 py-0 text-right"><AcoesItem i={i} id={id} onSaida={onSaida} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* mobile: cards */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {itens.map((i) => (
          <div key={i.itemId} className={`border-l-2 p-4 ${STATUS_BORDA[i.status.cor]}`}>
            <div className="flex items-start justify-between gap-2">
              <NomeEditavel companyId={id} itemId={i.itemId} nome={i.nome} comLink onSalvo={(n) => onRenomear(i.itemId, n)} />
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(i.valor)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span className={i.negativo ? 'font-semibold text-rose-600' : ''}>{num(i.saldo)} {i.unidadeControle} · {i.custoMedio != null ? brl(i.custoMedio) : '—'} <Tendencia t={i.custoTendencia} /></span>
              <IdadeBadge dias={i.ultimaEntradaDias} />
            </div>
            {i.estoqueMin != null && (
              <div className="mt-2 flex items-center gap-2">
                <StatusBar status={i.status} className="flex-1" />
                <StatusDot status={i.status} />
              </div>
            )}
          </div>
        ))}
      </div>
    </CardContent></Card>
  )
}

/** menu "..." por linha — as ações que já existiam, agora agrupadas na anatomia oficial */
function AcoesItem({ i, id, onSaida }: {
  i: PosItem; id: string
  onSaida: (x: { id: string; nome: string; unidadeControle: string; custoMedio: number | null }) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={`ações de ${i.nome}`}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <a href={`/empresas/${id}/estoque/itens/${i.itemId}`} className="cursor-pointer"><FileText className="mr-2 h-3.5 w-3.5" /> Ver ficha</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSaida({ id: i.itemId, nome: i.nome, unidadeControle: i.unidadeControle, custoMedio: i.custoMedio })}>
          <PackageMinus className="mr-2 h-3.5 w-3.5" /> Registrar saída
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* mín/máx mora na ficha (MinMaxEditor) — o menu leva pra lá em vez de
            duplicar o editor aqui: um lugar que edita, não dois (REGRA 4) */}
        <DropdownMenuItem asChild>
          <a href={`/empresas/${id}/estoque/itens/${i.itemId}`} className="cursor-pointer"><SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Ajustar mín/máx</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
