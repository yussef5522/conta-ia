'use client'

// ESTOQUE — ENTRADA MANUAL (compra sem nota nenhuma): produtor rural que não emite,
// compra avulsa no mercado. Fornecedor (busca ou cria) + data + itens (do catálogo ou
// criados na hora) → preview → confirmar → movimentos ENTRADA_MANUAL → recibo.
// A parcela do contas a pagar é OPT-IN: compra à vista não gera.

import { useEffect, useMemo, useState, use } from 'react'
import { filtrarPorBusca } from '@/lib/busca-texto'
import { Card, CardContent } from '@/components/ui/card'
import { PackageOpen, Plus, Trash2, Loader2, Check, ArrowLeft } from 'lucide-react'

interface ItemCat { id: string; nome: string; unidadeControle: string }
interface Forn {
  /** id do estoque — null quando o fornecedor só existe no financeiro ainda */
  id: string | null
  financeiroId: string | null
  razaoSocial: string
  cnpj: string | null
  origem: 'ESTOQUE' | 'FINANCEIRO' | 'AMBOS'
}
interface Linha { itemId: string; novoNome: string; unidade: string; categoria: string; qtd: string; custo: string }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (s: string) => Number(String(s).replace(',', '.')) || 0
const hoje = () => new Date().toISOString().slice(0, 10)
const vazia = (): Linha => ({ itemId: '', novoNome: '', unidade: 'KG', categoria: 'MATERIA_PRIMA', qtd: '', custo: '' })

const CATEGORIAS = [
  ['MATERIA_PRIMA', 'Matéria-prima'], ['REVENDA', 'Revenda'], ['EMBALAGEM', 'Embalagem'],
  ['LIMPEZA', 'Limpeza'], ['USO_INTERNO', 'Uso interno'],
] as const

export default function EntradaManualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cat, setCat] = useState<ItemCat[]>([])
  const [forns, setForns] = useState<Forn[]>([])
  const [buscaForn, setBuscaForn] = useState('')
  // ⭐ o filtro roda sobre a MESMA lista que a tela renderiza (REGRA 4): filtro e lista não
  // têm como discordar, e o `take` do servidor não corta a busca.
  const fornsFiltrados = useMemo(() => filtrarPorBusca<Forn>(forns, buscaForn, (f) => f.razaoSocial), [forns, buscaForn])
  const [supplierId, setSupplierId] = useState('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [data, setData] = useState(hoje())
  const [obs, setObs] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([vazia(), vazia()])
  const [aPrazo, setAPrazo] = useState(false)
  const [venc, setVenc] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [preview, setPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/itens`).then((r) => r.json()).then((j) => setCat(j.itens ?? [])).catch(() => {})
    fetch(`/api/empresas/${id}/estoque/fornecedores`).then((r) => r.json()).then((j) => setForns(j.fornecedores ?? [])).catch(() => {})
  }, [id])

  const preenchidas = useMemo(() => linhas.filter((l) => (l.itemId || l.novoNome.trim()) && num(l.qtd) > 0), [linhas])
  const total = useMemo(() => preenchidas.reduce((s, l) => s + num(l.qtd) * num(l.custo), 0), [preenchidas])
  const set = (i: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  // o valor da parcela acompanha o total até o dono mexer nele
  useEffect(() => { if (aPrazo && !valorParcela) setValorParcela(total ? total.toFixed(2) : '') }, [aPrazo, total]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar() {
    setErro(null); setSalvando(true)
    try {
      const itens = preenchidas.map((l) => l.itemId
        ? { itemId: l.itemId, quantidade: num(l.qtd), custoUnitario: num(l.custo) }
        : { novo: { nome: l.novoNome.trim(), unidadeControle: l.unidade, categoria: l.categoria }, quantidade: num(l.qtd), custoUnitario: num(l.custo) })
      const body = {
        fornecedor: supplierId ? { supplierId } : { nome: nomeNovo.trim() },
        data, observacao: obs.trim() || null, itens,
        payable: aPrazo ? { vencimento: venc, valor: num(valorParcela) } : null,
      }
      const r = await fetch(`/api/empresas/${id}/estoque/entrada-manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui registrar a entrada.'); setPreview(false); return }
      location.href = `/empresas/${id}/estoque/entradas/${j.entradaId}`
    } catch { setErro('Falha de rede ao registrar a entrada.'); setPreview(false) } finally { setSalvando(false) }
  }

  const podeSeguir = (supplierId || nomeNovo.trim()) && data && preenchidas.length > 0 && (!aPrazo || (venc && num(valorParcela) > 0))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <PackageOpen className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Entrada manual (sem nota)</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">Produtor rural, feira, compra avulsa — entra no estoque igual, com custo real</p>
        <a href={`/empresas/${id}/estoque/recebimentos`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-3.5 w-3.5" /> voltar</a>
      </div>

      <Card><CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Fornecedor</label>
            {/* ⭐⭐ BUSCA POR PEDAÇO, SEM ACENTO, SEM CAIXA — a régua de 31/08
                (`filtrarPorBusca`), no APP, sobre a MESMA lista que a tela mostra. Antes era
                um `<select>` nativo: só casava por prefixo e caixa, então "RM2" não achava
                "rm2". ⚠️ Mas o bug maior era outro — a original nem estava na lista. */}
            <input value={buscaForn} onChange={(e) => { setBuscaForn(e.target.value); setSupplierId('') }}
              placeholder="buscar fornecedor…"
              className="mt-1 block h-9 w-64 rounded-lg border border-slate-300 px-2 text-sm" />
            {!supplierId && buscaForn.trim() && (
              <ul className="mt-1 max-h-48 w-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {fornsFiltrados.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-400">nenhum com esse nome — deixe em branco pra cadastrar novo</li>}
                {fornsFiltrados.map((f) => (
                  <li key={f.id ?? f.financeiroId}>
                    <button type="button"
                      onClick={() => { setSupplierId(f.id ?? `fin:${f.financeiroId}`); setBuscaForn(f.razaoSocial) }}
                      className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                      <span className="min-w-0 flex-1 truncate text-slate-800">{f.razaoSocial}</span>
                      {/* ⚠️ a ORIGEM fica à vista: quando o sistema não pode PROVAR que dois
                          registros são o mesmo, ele mostra os dois — fusão errada de
                          fornecedor é pior que duplicata visível. */}
                      {f.origem === 'FINANCEIRO' && <span className="shrink-0 rounded bg-sky-50 px-1 text-[10px] text-sky-700">do financeiro</span>}
                      {f.cnpj && <span className="shrink-0 text-[10px] text-slate-400">{f.cnpj.slice(0, 8)}…</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!supplierId && (
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Nome do fornecedor</label>
              <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="ex: Seu Zé — hortifruti" className="mt-1 block h-9 w-64 rounded-lg border border-slate-300 px-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Data da compra</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Observação (opcional)</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex: pago em dinheiro na entrega" className="mt-1 block h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" />
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <table className="density-normal hidden w-full sm:table">
          <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">Produto</th>
            <th className="px-3 py-2 text-right font-medium">Qtd</th>
            <th className="px-3 py-2 text-right font-medium">Custo unit.</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 w-10"></th>
          </tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-b-0">
                <td className="px-3 py-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select value={l.itemId} onChange={(e) => set(i, { itemId: e.target.value })} className="h-8 w-52 rounded-lg border border-slate-300 px-2 text-[13px]">
                      <option value="">— criar produto novo —</option>
                      {cat.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.unidadeControle})</option>)}
                    </select>
                    {!l.itemId && (<>
                      <input value={l.novoNome} onChange={(e) => set(i, { novoNome: e.target.value })} placeholder="nome do produto" className="h-8 w-44 rounded-lg border border-slate-300 px-2 text-[13px]" />
                      <select value={l.unidade} onChange={(e) => set(i, { unidade: e.target.value })} className="h-8 rounded-lg border border-slate-300 px-1 text-[13px]">
                        <option>KG</option><option>UN</option><option>LT</option>
                      </select>
                      <select value={l.categoria} onChange={(e) => set(i, { categoria: e.target.value })} className="h-8 rounded-lg border border-slate-300 px-1 text-[12px]">
                        {CATEGORIAS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                      </select>
                    </>)}
                  </div>
                </td>
                <td className="px-3 py-1 text-right"><input value={l.qtd} onChange={(e) => set(i, { qtd: e.target.value })} inputMode="decimal" placeholder="0" className="h-8 w-20 rounded-lg border border-slate-300 px-2 text-right text-[13px] tabular-nums" /></td>
                <td className="px-3 py-1 text-right"><input value={l.custo} onChange={(e) => set(i, { custo: e.target.value })} inputMode="decimal" placeholder="0,00" className="h-8 w-24 rounded-lg border border-slate-300 px-2 text-right text-[13px] tabular-nums" /></td>
                <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-600">{num(l.qtd) * num(l.custo) > 0 ? brl(num(l.qtd) * num(l.custo)) : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-1 text-center">{linhas.length > 1 && <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* mobile */}
        <div className="divide-y divide-slate-50 sm:hidden">
          {linhas.map((l, i) => (
            <div key={i} className="space-y-2 p-3">
              <select value={l.itemId} onChange={(e) => set(i, { itemId: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 px-2 text-sm">
                <option value="">— criar produto novo —</option>
                {cat.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.unidadeControle})</option>)}
              </select>
              {!l.itemId && (
                <div className="flex gap-2">
                  <input value={l.novoNome} onChange={(e) => set(i, { novoNome: e.target.value })} placeholder="nome do produto" className="h-11 flex-1 rounded-lg border border-slate-300 px-2 text-sm" />
                  <select value={l.unidade} onChange={(e) => set(i, { unidade: e.target.value })} className="h-11 rounded-lg border border-slate-300 px-2 text-sm"><option>KG</option><option>UN</option><option>LT</option></select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input value={l.qtd} onChange={(e) => set(i, { qtd: e.target.value })} inputMode="decimal" placeholder="qtd" className="h-11 w-24 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
                <input value={l.custo} onChange={(e) => set(i, { custo: e.target.value })} inputMode="decimal" placeholder="custo un." className="h-11 flex-1 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
                {linhas.length > 1 && <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-300"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 px-3 py-2">
          <button onClick={() => setLinhas((ls) => [...ls, vazia()])} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> mais um item</button>
        </div>
      </CardContent></Card>

      {/* parcela OPT-IN — compra à vista não gera nada */}
      <Card><CardContent className="flex flex-wrap items-end gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={aPrazo} onChange={(e) => setAPrazo(e.target.checked)} className="h-4 w-4" />
          Gera parcela a pagar? <span className="text-xs text-slate-400">(compra à vista não gera)</span>
        </label>
        {aPrazo && (<>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Vencimento</label>
            <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Valor da parcela</label>
            <input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} inputMode="decimal" className="mt-1 block h-9 w-32 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
          </div>
        </>)}
      </CardContent></Card>

      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">total da entrada <b className="tabular-nums text-slate-900">{brl(total)}</b> · {preenchidas.length} {preenchidas.length === 1 ? 'item' : 'itens'}</span>
        <button onClick={() => setPreview(true)} disabled={!podeSeguir}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:bg-slate-200 disabled:text-slate-400">
          Revisar e confirmar
        </button>
      </div>

      {/* PREVIEW — responde "o que acontece se eu confirmar?" numa tela só */}
      {preview && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => !salvando && setPreview(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900">Confirmar entrada de {supplierId ? (forns.find((f: Forn) => (f.id ?? `fin:${f.financeiroId}`) === supplierId)?.razaoSocial ?? nomeNovo) : nomeNovo}</h3>
            <p className="mt-0.5 text-xs text-slate-400">Vai entrar no estoque agora, com custo real. O movimento é imutável — correção depois é estorno.</p>
            <table className="density-normal mt-3 w-full">
              <tbody>
                {preenchidas.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-b-0">
                    <td className="px-1 py-0 text-[13px] text-slate-700">{l.itemId ? cat.find((c) => c.id === l.itemId)?.nome : `${l.novoNome} (novo)`}</td>
                    <td className="px-1 py-0 text-right text-[13px] tabular-nums text-slate-500">{num(l.qtd)} × {brl(num(l.custo))}</td>
                    <td className="px-1 py-0 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(num(l.qtd) * num(l.custo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right text-sm font-semibold tabular-nums text-slate-900">{brl(total)}</p>
            <p className="mt-1 text-xs text-slate-500">{aPrazo ? `Gera 1 parcela de ${brl(num(valorParcela))} vencendo ${venc.split('-').reverse().join('/')}.` : 'Compra à vista — não gera parcela a pagar.'}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPreview(false)} disabled={salvando} className="h-9 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">Voltar</button>
              <button onClick={confirmar} disabled={salvando} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#185FA5] px-4 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-60">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
