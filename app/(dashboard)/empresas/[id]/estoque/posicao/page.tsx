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
import { StatCard } from '@/components/ui/stat-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { corDaCategoria, STRIPE_FAIXA } from '@/lib/stock/categoria-cores'
import { Boxes, Loader2, AlertTriangle, Search, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight, Download, PackageMinus, TrendingDown, MoreHorizontal, SlidersHorizontal, FileText, Layers } from 'lucide-react'
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
      <div className="flex items-center gap-3">
        <Boxes className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Posição de estoque</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} {filtrados.length === 1 ? 'item no filtro' : 'itens no filtro'}</p>
        </div>
        <div className="flex items-center gap-2">
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
          {/* CARDS DE RESUMO — mesma grade e mesmo componente da Contas a Pagar.
           * Total em destaque + um card POR CATEGORIA, cada um na sua cor. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="slate" label="Total em estoque" value={brl(data.valorTotal)}
              sub={`${data.itens.length} ${data.itens.length === 1 ? 'item' : 'itens'}`} icon={Boxes}
              onClick={() => setCatFiltro(null)} active={!catFiltro} />
            {data.porCategoria.map((c) => (
              <StatCard key={c.categoria} tone={corDaCategoria(c.categoria).tone} label={c.label}
                value={brl(c.valor)} sub={`${c.itens} ${c.itens === 1 ? 'item' : 'itens'}`} icon={Layers}
                onClick={() => setCatFiltro(catFiltro === c.categoria ? null : c.categoria)}
                active={catFiltro === c.categoria} />
            ))}
          </div>

          {/* BARRA DE FILTROS — mesmas medidas da Contas a Pagar (h-9, gap-2,
           * busca flex-1 min-w-[200px] max-w-md) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] max-w-md flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar item…" className="h-9 pl-7 text-sm" aria-label="Busca textual" />
            </div>
            <select value={catFiltro ?? ''} onChange={(e) => setCatFiltro(e.target.value || null)}
              className="h-9 min-w-[140px] rounded-md border bg-background px-2 text-sm">
              <option value="">Todas as categorias</option>
              {data.porCategoria.map((c) => <option key={c.categoria} value={c.categoria}>{c.label}</option>)}
            </select>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
              <Checkbox checked={soAbaixo} onCheckedChange={(v) => setSoAbaixo(!!v)} />
              Só abaixo do mínimo{nAbaixo > 0 ? ` (${nAbaixo})` : ''}
            </label>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
              <Checkbox checked={agrupar} onCheckedChange={(v) => setAgrupar(!!v)} /> Agrupar
            </label>
            <span className="ml-auto text-sm text-muted-foreground">{filtrados.length} de {data.itens.length}</span>
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
          <th className="w-1 p-0" aria-hidden="true" />
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
          {itens.map((i, idx) => (
            <tr key={i.itemId} className={`group border-b last:border-0 transition-colors hover:bg-muted/30 ${sel.includes(i.itemId) ? 'bg-primary/5' : idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
              {/* Tarja lateral (mesmo padrão da Contas a Pagar): com mín/máx a cor conta
                  o ESTADO DO SALDO — a informação mais urgente da linha; sem mín/máx,
                  cai na cor da categoria. */}
              <td className={`w-1 p-0 ${i.estoqueMin != null ? (STRIPE_FAIXA[i.status.cor] ?? 'bg-slate-300') : corDaCategoria(i.categoria).stripe}`} aria-hidden="true" />
              <td className="px-3 py-0">
                <Checkbox checked={sel.includes(i.itemId)} onCheckedChange={() => setSel((s) => s.includes(i.itemId) ? s.filter((x) => x !== i.itemId) : [...s, i.itemId])} aria-label={`selecionar ${i.nome}`} />
              </td>
              <td className="px-3 py-0 text-[13px]"><NomeEditavel companyId={id} itemId={i.itemId} nome={i.nome} comLink onSalvo={(n) => onRenomear(i.itemId, n)} /></td>
              <td className="px-3 py-0">
                <Badge variant="outline" className={`border-0 text-[10px] uppercase tracking-wide ${corDaCategoria(i.categoria).badgeBg} ${corDaCategoria(i.categoria).badgeText}`}>{i.categoriaLabel}</Badge>
              </td>
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
