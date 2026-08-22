'use client'

// ESTOQUE PARTE B — CATÁLOGO de itens. Mostra TODOS (inclusive saldo zero, que a Posição
// esconde). "+ novo item" (nome · unidade · categoria · min/máx). Item manual nasce SEM
// saldo e SEM custo ("a definir"); saldo só por nota/produção/contagem. Intermediário/produto
// final só via ficha (aqui só as 5 categorias-base). Dedup por nome. Busca + filtro + editar.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Loader2, Plus, Search, Ban, RotateCcw } from 'lucide-react'
import { NomeEditavel } from '@/components/estoque/nome-editavel'

interface Item { id: string; nome: string; unidadeControle: string; categoria: string; categoriaLabel: string; produzido: boolean; ativo: boolean; saldo: number; custoMedio: number | null; estoqueMin: number | null; estoqueMax: number | null; criadoVia: string }
const CATS = [{ v: 'MATERIA_PRIMA', l: 'Matéria-prima' }, { v: 'REVENDA', l: 'Revenda' }, { v: 'EMBALAGEM', l: 'Embalagem' }, { v: 'LIMPEZA', l: 'Limpeza' }, { v: 'USO_INTERNO', l: 'Uso interno' }]
const brl = (n: number | null) => (n == null ? 'a definir' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return s.trim() === '' || !Number.isFinite(n) ? null : n }

export default function CatalogoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [itens, setItens] = useState<Item[] | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [verInativos, setVerInativos] = useState(false)
  const [novo, setNovo] = useState(false)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/catalogo`).then((r) => r.json()).then((j) => setItens(j.itens ?? [])).catch(() => setItens(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setAtivo = async (itemId: string, ativo: boolean) => { await fetch(`/api/empresas/${id}/estoque/itens/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }) }); carregar() }

  const filtrados = useMemo(() => {
    if (!itens) return []
    return itens.filter((i) => (verInativos || i.ativo) && (!catFiltro || i.categoria === catFiltro) && (!busca.trim() || i.nome.toLowerCase().includes(busca.toLowerCase())))
  }, [itens, busca, catFiltro, verInativos])

  if (itens === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (itens === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o catálogo.</div>

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Package className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Catálogo de itens</h1><p className="text-sm text-slate-500">Todos os itens do estoque (inclusive os zerados). Item novo nasce sem saldo — o saldo vem de nota, produção ou contagem.</p></div>
        <button onClick={() => setNovo((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#185FA5] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C]"><Plus className="h-4 w-4" /> Novo item</button>
      </div>

      {novo && <NovoItem id={id} onCriado={() => { setNovo(false); carregar() }} onFechar={() => setNovo(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div>
        <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-600"><option value="">todas categorias</option>{CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}<option value="INTERMEDIARIO">Intermediário</option><option value="PRODUTO_FINAL">Produto final</option></select>
        <button onClick={() => setVerInativos((v) => !v)} className={`rounded-lg border px-3 py-2 text-sm ${verInativos ? 'border-[#185FA5] bg-[#185FA5]/5 text-[#185FA5]' : 'border-slate-300 text-slate-600'}`}>inativos</button>
      </div>

      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
            <th className="p-3 font-medium">Item</th><th className="p-3 font-medium">Categoria</th>
            <th className="p-3 text-right font-medium">Saldo</th><th className="p-3 text-right font-medium">Custo médio</th><th className="p-3 text-right font-medium">Mín/Máx</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id} className={`border-b border-slate-50 last:border-0 ${!i.ativo ? 'opacity-50' : ''}`}>
                <td className="p-3">{i.produzido ? <span className="font-medium text-slate-800">{i.nome}</span> : <NomeEditavel companyId={id} itemId={i.id} nome={i.nome} comLink onSalvo={carregar} />}</td>
                <td className="p-3 text-slate-500">{i.categoriaLabel}{i.produzido && <span className="ml-1 text-[10px] text-slate-400">via ficha</span>}</td>
                <td className={`p-3 text-right tabular-nums ${i.saldo < 0 ? 'text-rose-600' : i.saldo === 0 ? 'text-slate-400' : 'text-slate-800'}`}>{num(i.saldo)} {i.unidadeControle}</td>
                <td className="p-3 text-right tabular-nums text-slate-600">{brl(i.custoMedio)}</td>
                <td className="p-3 text-right tabular-nums text-slate-400">{i.estoqueMin != null ? `${num(i.estoqueMin)}${i.estoqueMax != null ? '–' + num(i.estoqueMax) : ''}` : '—'}</td>
                <td className="p-3 text-right">
                  {i.ativo ? <button onClick={() => setAtivo(i.id, false)} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500" title="desativar"><Ban className="h-3.5 w-3.5" /></button>
                    : <button onClick={() => setAtivo(i.id, true)} className="inline-flex items-center gap-1 text-xs text-[#185FA5] hover:underline"><RotateCcw className="h-3.5 w-3.5" /> reativar</button>}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-500">Nenhum item{busca || catFiltro ? ' com esse filtro' : ' ainda'}.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
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
