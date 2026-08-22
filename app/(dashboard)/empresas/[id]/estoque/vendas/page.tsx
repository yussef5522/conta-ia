'use client'

// ESTOQUE FASE 3 — import de vendas do Suitable (passo 1: parse + mapa que aprende). Sobe
// o .xls (HTML), o sistema lista os produtos e resolve o que já foi mapeado; o que falta,
// o dono aponta pra ficha (produto final) ou item de revenda (bebida). Duplicata do PDV
// (XIS COMPLETO / XIS - COMPLETO) → aponta as duas pra mesma ficha. A baixa (com a data)
// é o próximo passo, quando o mapa estiver completo.

import { useRef, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, Loader2, Upload, Check, ClipboardList, Package } from 'lucide-react'

interface Linha { produto: string; quantidade: number; valorTotal: number; mapeado: boolean; alvoTipo: string | null; alvoId: string | null; alvoNome: string | null }
interface Preview { linhas: Linha[]; totalUnidades: number; totalProdutos: number; naoMapeados: number; opcoes: { fichas: { id: string; nome: string; tipo: string }[]; itens: { id: string; nome: string }[] } }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function VendasImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [html, setHtml] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const enviar = async (conteudo: string) => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: conteudo }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ler o arquivo.'); setPreview(null); return }
      setPreview(j.preview)
    } catch { setErro('Falha de conexão.') } finally { setCarregando(false) }
  }

  const onFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => { const t = String(reader.result ?? ''); setHtml(t); enviar(t) }
    reader.readAsText(f, 'utf-8')
  }

  const mapear = async (nomeSuitable: string, valor: string) => {
    // valor = "FICHA:<id>" | "REVENDA:<id>" | "REMOVER" | "CRIAR_FICHA" | "CRIAR_REVENDA"
    if (valor === 'CRIAR_FICHA') {
      // abre o editor de ficha JÁ no tipo PRODUTO_FINAL com o nome pré-preenchido
      window.location.href = `/empresas/${id}/estoque/fichas/nova?nome=${encodeURIComponent(nomeSuitable)}&tipo=PRODUTO_FINAL`
      return
    }
    if (valor === 'CRIAR_REVENDA') {
      // cria o item de revenda (UN, categoria REVENDA) e já mapeia
      const r = await fetch(`/api/empresas/${id}/estoque/itens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nomeSuitable, unidadeControle: 'UN', categoria: 'REVENDA' }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.item?.id) await fetch(`/api/empresas/${id}/estoque/vendas/mapear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nomeSuitable, alvoTipo: 'REVENDA', itemId: j.item.id }) })
      if (html) enviar(html)
      return
    }
    const [tipo, alvoId] = valor.split(':')
    const body = tipo === 'REMOVER' ? { nomeSuitable, alvoTipo: 'REMOVER' } : tipo === 'FICHA' ? { nomeSuitable, alvoTipo: 'FICHA', fichaId: alvoId } : { nomeSuitable, alvoTipo: 'REVENDA', itemId: alvoId }
    const r = await fetch(`/api/empresas/${id}/estoque/vendas/mapear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { const j = await r.json().catch(() => null); setErro(j?.erro ?? 'Não consegui mapear.'); return }
    setErro(null)
    if (html) enviar(html) // re-preview pra refletir
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-7 w-7 text-[#185FA5]" />
        <div><h1 className="text-xl font-semibold text-slate-900">Vendas (Suitable)</h1><p className="text-sm text-slate-500">Suba o relatório de produtos do Suitable. O sistema aprende que produto é cada um — depois a venda baixa o estoque sozinha.</p></div>
      </div>

      {/* upload */}
      <Card><CardContent className="p-4">
        <input ref={fileRef} type="file" accept=".xls,.html,.htm" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5]">
          {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} {carregando ? 'Lendo…' : 'Escolher o arquivo do Suitable (.xls)'}
        </button>
        {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}
      </CardContent></Card>

      {preview && (
        <>
          <Card><CardContent className="grid grid-cols-3 gap-4 p-4 text-sm">
            <div><p className="text-xs text-slate-500">Produtos</p><p className="text-lg font-semibold text-slate-900">{preview.totalProdutos}</p></div>
            <div><p className="text-xs text-slate-500">Unidades</p><p className="text-lg font-semibold text-slate-900">{preview.totalUnidades}</p></div>
            <div><p className="text-xs text-slate-500">A mapear</p><p className={`text-lg font-semibold ${preview.naoMapeados > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{preview.naoMapeados}</p></div>
          </CardContent></Card>

          {preview.naoMapeados > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">Aponte cada produto ainda sem destino pra uma ficha (produto que você faz) ou um item de revenda (bebida). O sistema aprende — na próxima o mesmo nome já vem resolvido.</p>}

          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Produto (Suitable)</th><th className="p-3 text-right font-medium">Qtd</th><th className="p-3 font-medium">Destino no estoque</th>
              </tr></thead>
              <tbody>
                {preview.linhas.map((l) => (
                  <tr key={l.produto} className={`border-b border-slate-50 last:border-0 ${!l.mapeado ? 'bg-amber-50/30' : ''}`}>
                    <td className="p-3 font-medium text-slate-800">{l.produto}</td>
                    <td className="p-3 text-right tabular-nums text-slate-600">{l.quantidade}</td>
                    <td className="p-3">
                      <select value={l.mapeado ? `${l.alvoTipo}:${l.alvoId}` : ''} onChange={(e) => e.target.value && mapear(l.produto, e.target.value)} className={`w-full max-w-xs rounded-lg border py-1.5 px-2 text-sm ${l.mapeado ? 'border-slate-200 text-slate-700' : 'border-amber-300 text-amber-700'}`}>
                        <option value="">— escolher —</option>
                        {l.mapeado && <option value="REMOVER">✕ desmapear</option>}
                        <optgroup label="Criar novo">
                          <option value="CRIAR_FICHA">＋ criar ficha de produto final…</option>
                          <option value="CRIAR_REVENDA">＋ criar item de revenda (bebida)</option>
                        </optgroup>
                        {preview.opcoes.fichas.length > 0 && (
                          <optgroup label="Produtos finais (ficha)">
                            {preview.opcoes.fichas.map((f) => <option key={f.id} value={`FICHA:${f.id}`}>{f.nome}</option>)}
                          </optgroup>
                        )}
                        {preview.opcoes.itens.length > 0 && (
                          <optgroup label="Revenda (bebida etc.)">
                            {preview.opcoes.itens.map((i) => <option key={i.id} value={`REVENDA:${i.id}`}>{i.nome}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>

          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
            <Package className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Quando todos estiverem mapeados, o próximo passo liga a <b>baixa por venda</b>: você informa a data (o arquivo não traz), e cada venda baixa o estoque — produto composto (Combo) explode nos componentes; bebida baixa direto. Idempotente por dia.</span>
          </div>
        </>
      )}

      {!preview && !carregando && (
        <div className="flex items-center gap-2 text-xs text-slate-400"><ClipboardList className="h-4 w-4" /> Exporte no Suitable: Relatório de Produtos (Agrupado) do dia → salve o .xls → suba aqui.</div>
      )}
    </div>
  )
}
