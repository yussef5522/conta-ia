'use client'

// ESTOQUE PARTE B — CATÁLOGO de itens. Mostra TODOS (inclusive saldo zero, que a Posição
// esconde). "+ novo item" (nome · unidade · categoria · min/máx). Item manual nasce SEM
// saldo e SEM custo ("a definir"); saldo só por nota/produção/contagem. Intermediário/produto
// final só via ficha (aqui só as 5 categorias-base). Dedup por nome. Busca + filtro + editar.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Loader2, Plus, Search, Ban, RotateCcw, Download, MoreHorizontal, FileText, Boxes, Layers, HelpCircle, CircleSlash } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { TotalsBar, type TotalItem } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { corDaCategoria } from '@/lib/stock/categoria-cores'
import { NomeEditavel } from '@/components/estoque/nome-editavel'

interface Item { id: string; nome: string; unidadeControle: string; categoria: string; categoriaLabel: string; produzido: boolean; ativo: boolean; saldo: number; custoMedio: number | null; estoqueMin: number | null; estoqueMax: number | null; criadoVia: string }
const CATS = [{ v: 'MATERIA_PRIMA', l: 'Matéria-prima' }, { v: 'REVENDA', l: 'Revenda' }, { v: 'EMBALAGEM', l: 'Embalagem' }, { v: 'LIMPEZA', l: 'Limpeza' }, { v: 'USO_INTERNO', l: 'Uso interno' }]
const brl = (n: number | null) => (n == null ? 'a definir' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
type Campo = 'nome' | 'categoria' | 'saldo' | 'custo' | 'minmax'
const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n }

export default function CatalogoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [itens, setItens] = useState<Item[] | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [verInativos, setVerInativos] = useState(false)
  const [novo, setNovo] = useState(false)
  const { col, dir, alternar, ordenar } = useSort<Campo>('nome', 'asc')
  const [soSemCusto, setSoSemCusto] = useState(false)
  const [sel, setSel] = useState<string[]>([])

  const carregar = () => fetch(`/api/empresas/${id}/estoque/catalogo`).then((r) => r.json()).then((j) => setItens(j.itens ?? [])).catch(() => setItens(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAtivo = async (itemId: string, ativo: boolean) => { await fetch(`/api/empresas/${id}/estoque/itens/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }) }); carregar() }

  const filtrados = useMemo(() => {
    if (!itens) return []
    const ls = itens.filter((i) => (verInativos || i.ativo) && (!catFiltro || i.categoria === catFiltro) && (!soSemCusto || i.custoMedio == null) && (!busca.trim() || i.nome.toLowerCase().includes(busca.toLowerCase())))
    return ordenar(ls, (i, c) => (
      c === 'nome' ? i.nome : c === 'categoria' ? i.categoriaLabel : c === 'saldo' ? i.saldo
        : c === 'custo' ? i.custoMedio : i.estoqueMin
    ))
  }, [itens, busca, catFiltro, verInativos, soSemCusto, ordenar])

  if (itens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (itens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o catálogo.</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Package className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Catálogo de itens</h1>
          <p className="text-sm text-muted-foreground">{filtrados.length} {filtrados.length === 1 ? 'item no filtro' : 'itens no filtro'}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => baixarCsv(`catalogo-${hojeArquivo()}`,
            ['Item', 'Categoria', 'Unidade', 'Saldo', 'Custo médio', 'Mínimo', 'Máximo', 'Ativo'],
            filtrados.map((i) => [i.nome, i.categoriaLabel, i.unidadeControle, i.saldo, i.custoMedio, i.estoqueMin, i.estoqueMax, i.ativo ? 'sim' : 'não']))}
            disabled={filtrados.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => setNovo((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]"><Plus className="h-3.5 w-3.5" /> Novo item</button>
        </div>
      </div>

      {novo && <NovoItem id={id} onCriado={() => { setNovo(false); carregar() }} onFechar={() => setNovo(false)} />}

      {/* CARDS DE RESUMO — não existiam. Mesma grade e componente da Contas a Pagar. */}
      {itens.length > 0 && (() => {
        const ativos = itens.filter((i) => i.ativo)
        const porCat = [...new Map(ativos.map((i) => [i.categoria, i.categoriaLabel])).entries()]
        const semCusto = ativos.filter((i) => i.custoMedio == null)
        const zerados = ativos.filter((i) => i.saldo === 0)
        const valorDe = (ls: Item[]) => ls.reduce((a, i) => a + (i.custoMedio ?? 0) * i.saldo, 0)
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard tone="slate" label="Itens no catálogo" value={String(ativos.length)}
              sub={`${itens.length - ativos.length} inativos`} icon={Package}
              onClick={() => { setCatFiltro(''); setSoSemCusto(false) }} active={!catFiltro && !soSemCusto} />
            {porCat.map(([cat, label]) => {
              const ls = ativos.filter((i) => i.categoria === cat)
              return (
                <StatCard key={cat} tone={corDaCategoria(cat).tone} label={label}
                  value={String(ls.length)} sub={brl(valorDe(ls))} icon={Layers}
                  onClick={() => setCatFiltro(catFiltro === cat ? '' : cat)} active={catFiltro === cat} />
              )
            })}
            <StatCard tone="amber" label="Sem custo (a definir)" value={String(semCusto.length)}
              sub="esperando a 1ª nota" icon={HelpCircle}
              onClick={() => setSoSemCusto((v) => !v)} active={soSemCusto} />
            <StatCard tone="sky" label="Zerados" value={String(zerados.length)}
              sub="sem saldo hoje" icon={CircleSlash} />
          </div>
        )
      })()}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item…" className="h-9 pl-7 text-sm" aria-label="Busca textual" />
        </div>
        <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="h-9 min-w-[140px] rounded-md border bg-background px-2 text-sm">
          <option value="">Todas as categorias</option>{CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}<option value="INTERMEDIARIO">Intermediário</option><option value="PRODUTO_FINAL">Produto final</option>
        </select>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
          <Checkbox checked={soSemCusto} onCheckedChange={(v) => setSoSemCusto(!!v)} /> Só sem custo
        </label>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
          <Checkbox checked={verInativos} onCheckedChange={(v) => setVerInativos(!!v)} /> Ver inativos
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{filtrados.length} de {itens.length}</span>
      </div>

      <Card><CardContent className="p-0">
        <table className="density-normal w-full">
          <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="w-1 p-0" aria-hidden="true" />
            <th className="w-10 px-3 py-2">
              <Checkbox checked={filtrados.length > 0 && filtrados.every((i) => sel.includes(i.id))}
                onCheckedChange={(v) => setSel(v ? filtrados.map((i) => i.id) : [])} aria-label="selecionar todos" />
            </th>
            <SortableTh campo="nome" col={col} dir={dir} onSort={alternar}>Item</SortableTh>
            <SortableTh campo="categoria" col={col} dir={dir} onSort={alternar}>Categoria</SortableTh>
            <SortableTh campo="saldo" col={col} dir={dir} onSort={alternar} align="right">Saldo</SortableTh>
            <SortableTh campo="custo" col={col} dir={dir} onSort={alternar} align="right">Custo médio</SortableTh>
            <SortableTh campo="minmax" col={col} dir={dir} onSort={alternar} align="right">Mín/Máx</SortableTh>
            <th className="w-10 px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {filtrados.map((i, idx) => (
              <tr key={i.id} className={`group border-b last:border-0 transition-colors hover:bg-muted/30 ${!i.ativo ? 'opacity-50' : ''} ${sel.includes(i.id) ? 'bg-primary/5' : idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                {/* tarja lateral na cor da categoria (mesmo padrão da Contas a Pagar) */}
                <td className={`w-1 p-0 ${corDaCategoria(i.categoria).stripe}`} aria-hidden="true" />
                <td className="px-3 py-0">
                  <Checkbox checked={sel.includes(i.id)} onCheckedChange={() => setSel((x) => x.includes(i.id) ? x.filter((y) => y !== i.id) : [...x, i.id])} aria-label={`selecionar ${i.nome}`} />
                </td>
                <td className="px-3 py-0 text-[13px]">{i.produzido ? <span className="font-medium text-slate-800">{i.nome}</span> : <NomeEditavel companyId={id} itemId={i.id} nome={i.nome} comLink onSalvo={carregar} />}</td>
                <td className="px-3 py-0">
                  <Badge variant="outline" className={`border-0 text-[10px] uppercase tracking-wide ${corDaCategoria(i.categoria).badgeBg} ${corDaCategoria(i.categoria).badgeText}`}>{i.categoriaLabel}</Badge>
                  {i.produzido && <span className="ml-1 text-[10px] text-slate-400">via ficha</span>}
                </td>
                <td className={`px-3 py-0 text-[13px] text-right tabular-nums ${i.saldo < 0 ? 'text-rose-600' : i.saldo === 0 ? 'text-slate-400' : 'text-slate-800'}`}>{num(i.saldo)} {i.unidadeControle}</td>
                <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-600">{brl(i.custoMedio)}</td>
                <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-400">{i.estoqueMin != null ? `${num(i.estoqueMin)}${i.estoqueMax != null ? '–' + num(i.estoqueMax) : ''}` : '—'}</td>
                <td className="px-3 py-0 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={`ações de ${i.nome}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <a href={`/empresas/${id}/estoque/itens/${i.id}`} className="cursor-pointer"><FileText className="mr-2 h-3.5 w-3.5" /> Ver ficha</a>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/empresas/${id}/estoque/itens/${i.id}`} className="cursor-pointer"><Boxes className="mr-2 h-3.5 w-3.5" /> Editar mín/máx</a>
                      </DropdownMenuItem>
                      {i.ativo
                        ? <DropdownMenuItem onClick={() => setAtivo(i.id, false)}><Ban className="mr-2 h-3.5 w-3.5" /> Desativar</DropdownMenuItem>
                        : <DropdownMenuItem onClick={() => setAtivo(i.id, true)}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Reativar</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-sm text-slate-500">Nenhum item{busca || catFiltro ? ' com esse filtro' : ' ainda'}.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      {/* RÉGUA — valor em estoque por categoria + total (anatomia oficial) */}
      {filtrados.length > 0 && (
        <TotalsBar
          itens={[...new Map(filtrados.map((i) => [i.categoria, i.categoriaLabel])).entries()]
            .map(([cat, label]): TotalItem => {
              const doGrupo = filtrados.filter((i) => i.categoria === cat)
              return {
                chave: cat, label, tone: corDaCategoria(cat).tone, n: doGrupo.length,
                valor: doGrupo.reduce((s2, i) => s2 + (i.custoMedio ?? 0) * i.saldo, 0),
                onClick: () => setCatFiltro(catFiltro === cat ? '' : cat),
              }
            })}
          totalLabel="Valor em estoque"
        />
      )}
    </div>
  )
}

function NovoItem({ id, onCriado, onFechar }: { id: string; onCriado: () => void; onFechar: () => void }) {
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState<'KG' | 'UN' | 'LT'>('UN')
  const [categoria, setCategoria] = useState('MATERIA_PRIMA')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const criar = async () => {
    setErro(null)
    if (!nome.trim()) return setErro('Dê um nome ao item.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/itens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nome.trim(), unidadeControle: unidade, categoria, estoqueMin: parseNum(min), estoqueMax: parseNum(max) }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui criar.'); return }
      onCriado()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  return (
    <Card><CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-900">Novo item</p><button onClick={onFechar} className="text-xs text-slate-400 hover:text-slate-600">fechar</button></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[180px] text-xs text-slate-500">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Molho de tomate" className="mt-1 block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
        <label className="text-xs text-slate-500">Unidade<select value={unidade} onChange={(e) => setUnidade(e.target.value as 'KG' | 'UN' | 'LT')} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm"><option>UN</option><option>KG</option><option>LT</option></select></label>
        <label className="text-xs text-slate-500">Categoria<select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 py-2 px-3 text-sm">{CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">Mínimo (opcional)<input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" className="mt-1 block w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" /></label>
        <label className="text-xs text-slate-500">Máximo (opcional)<input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" className="mt-1 block w-24 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" /></label>
      </div>
      <p className="text-[11px] text-slate-400">Nasce com saldo 0 e custo "a definir" — o custo vem quando a 1ª nota entrar (ou na contagem). Produto que você FAZ é criado como ficha, não aqui.</p>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <button onClick={criar} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar item</button>
    </CardContent></Card>
  )
}
