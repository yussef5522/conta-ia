'use client'

// ESTOQUE FASE 3 — vendas do Suitable, 2 áreas claras: (1) MAPEAMENTO (cadastro permanente,
// chips) · (2) PROCESSAR O DIA (data + checkboxes do que entra + confirmar → preview → recibo).
// + aba PROCESSADOS (histórico por dia, reprocessar). Nada falha em silêncio: sempre preview
// ou erro visível. Date picker robusto no Safari (showPicker).

import { useEffect, useMemo, useRef, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, Loader2, Upload, Check, Pencil, Search, Play, Receipt, AlertTriangle, History, RefreshCw, Store } from 'lucide-react'
import { PlanoVendaModal } from '@/components/estoque/plano-venda-modal'

interface Linha { produto: string; quantidade: number; valorTotal: number; mapeado: boolean; alvoTipo: string | null; alvoId: string | null; alvoNome: string | null }
interface Preview { linhas: Linha[]; totalUnidades: number; totalProdutos: number; naoMapeados: number; opcoes: { fichas: { id: string; nome: string; tipo: string }[]; itens: { id: string; nome: string }[] } }
interface Plano { produtos: { nome: string; quantidade: number; alvoNome: string }[]; pendentes: { nome: string; quantidade: number }[]; fora: { nome: string; quantidade: number }[]; agregada: { nome: string; qtd: number; valor: number | null }[]; totalMapeados: number; totalPendentes: number }
interface Recibo { data: string; baixados: number; itensBaixados: number; pendentes: number; valorBaixado: number }
interface Dia { data: string; totalUnidades: number; baixados: number; valorBaixado: number; pendentes: number; status: string }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmtDia = (d: string) => d.split('-').reverse().join('/')

export default function VendasImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [aba, setAba] = useState<'importar' | 'manual' | 'processados'>('importar')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [html, setHtml] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [soPendentes, setSoPendentes] = useState(false)
  const [editando, setEditando] = useState<Set<string>>(new Set())
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set()) // mapeados que o dono TIROU deste processamento
  const [data, setData] = useState('')
  const [erroProc, setErroProc] = useState<string | null>(null)
  const [plano, setPlano] = useState<Plano | null>(null)
  const [modoReprocesso, setModoReprocesso] = useState<string | null>(null) // data sendo reprocessada
  const [estornaItens, setEstornaItens] = useState(0)
  const [verLista, setVerLista] = useState(false)
  const [erroModal, setErroModal] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<Recibo | null>(null)
  const [processando, setProcessando] = useState(false)
  const [processados, setProcessados] = useState<Dia[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const carregarProcessados = () => fetch(`/api/empresas/${id}/estoque/vendas/processados`).then((r) => r.json()).then((j) => setProcessados(j.processados ?? [])).catch(() => {})
  useEffect(() => { carregarProcessados() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (conteudo: string) => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: conteudo }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ler o arquivo.'); setPreview(null); return }
      setPreview(j.preview); setDesmarcados(new Set())
    } catch { setErro('Falha de conexão.') } finally { setCarregando(false) }
  }
  const onFile = (f: File) => { const reader = new FileReader(); reader.onload = () => { const t = String(reader.result ?? ''); setHtml(t); enviar(t) }; reader.readAsText(f, 'utf-8') }

  const mapear = async (nomeSuitable: string, valor: string) => {
    if (valor === 'CRIAR_FICHA') { window.location.href = `/empresas/${id}/estoque/fichas/nova?nome=${encodeURIComponent(nomeSuitable)}&tipo=PRODUTO_FINAL`; return }
    if (valor === 'CRIAR_REVENDA') {
      const r = await fetch(`/api/empresas/${id}/estoque/itens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: nomeSuitable, unidadeControle: 'UN', categoria: 'REVENDA' }) })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.item?.id) await fetch(`/api/empresas/${id}/estoque/vendas/mapear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nomeSuitable, alvoTipo: 'REVENDA', itemId: j.item.id }) })
      setEditando((s) => { const n = new Set(s); n.delete(nomeSuitable); return n }); if (html) enviar(html); return
    }
    const [tipo, alvoId] = valor.split(':')
    const body = tipo === 'REMOVER' ? { nomeSuitable, alvoTipo: 'REMOVER' } : tipo === 'FICHA' ? { nomeSuitable, alvoTipo: 'FICHA', fichaId: alvoId } : { nomeSuitable, alvoTipo: 'REVENDA', itemId: alvoId }
    const r = await fetch(`/api/empresas/${id}/estoque/vendas/mapear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { const j = await r.json().catch(() => null); setErro(j?.erro ?? 'Não consegui mapear.'); return }
    setErro(null); setEditando((s) => { const n = new Set(s); n.delete(nomeSuitable); return n }); if (html) enviar(html)
  }

  // nomes marcados = mapeados − desmarcados
  const marcados = useMemo(() => (preview ? preview.linhas.filter((l) => l.mapeado && !desmarcados.has(l.produto)).map((l) => l.produto) : []), [preview, desmarcados])

  const abrirModal = (p: Plano, reprocessoDia: string | null, estorna: number) => { setPlano(p); setModoReprocesso(reprocessoDia); setEstornaItens(estorna); setVerLista(false); setErroModal(null) }

  const abrirPreview = async () => {
    setErroProc(null)
    if (!data) { setErroProc('Escolha a data das vendas antes de processar.'); return }
    if (marcados.length === 0) { setErroProc('Marque ao menos um produto pra processar.'); return }
    setProcessando(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/processar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, data, confirmar: false, incluir: marcados }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErroProc(j?.erro ?? 'Não consegui montar o preview.'); return }
      abrirModal(j.plano, null, 0)
    } catch { setErroProc('Falha de conexão ao processar.') } finally { setProcessando(false) }
  }
  const reprocessar = async (dia: string) => {
    setProcessando(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/processar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dia, reprocessar: true, confirmar: false }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { alert(j?.erro ?? 'Não consegui montar o reprocesso.'); return }
      abrirModal(j.plano, dia, j.estornaItens ?? 0)
    } catch { alert('Falha de conexão ao reprocessar.') } finally { setProcessando(false) }
  }
  const confirmar = async () => {
    setProcessando(true); setErroModal(null)
    try {
      const body = modoReprocesso
        ? { data: modoReprocesso, reprocessar: true, confirmar: true }
        : { html, data, confirmar: true, incluir: marcados }
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/processar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (r.ok) { setRecibo(j.recibo); setPlano(null); setModoReprocesso(null); carregarProcessados(); if (modoReprocesso) setAba('processados') }
      else setErroModal(j?.erro ?? 'Não consegui processar.')
    } catch { setErroModal('Falha de conexão.') } finally { setProcessando(false) }
  }

  const linhasFiltradas = useMemo(() => {
    if (!preview) return []
    let ls = preview.linhas
    if (soPendentes) ls = ls.filter((l) => !l.mapeado)
    if (busca.trim()) ls = ls.filter((l) => l.produto.toLowerCase().includes(busca.toLowerCase()))
    return ls
  }, [preview, soPendentes, busca])

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-7 w-7 text-[#185FA5]" />
        <div className="flex-1"><h1 className="text-xl font-semibold text-slate-900">Vendas (Suitable)</h1><p className="text-sm text-slate-500">Mapeia uma vez (vale sempre); processa o dia; a venda baixa o estoque.</p></div>
      </div>

      {/* abas */}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setAba('importar')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'importar' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}>Importar dia</button>
        <button onClick={() => setAba('manual')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'manual' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}><Store className="mr-1 inline h-3.5 w-3.5" />Lançamento manual</button>
        <button onClick={() => setAba('processados')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'processados' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}><History className="mr-1 inline h-3.5 w-3.5" />Processados ({processados.length})</button>
      </div>

      {aba === 'processados' ? (
        <Card><CardContent className="p-0">
          {processados.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Nenhum dia processado ainda.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400"><th className="p-3 font-medium">Dia</th><th className="p-3 text-right font-medium">Baixados</th><th className="p-3 text-right font-medium">Valor</th><th className="p-3 text-right font-medium">Pendentes</th><th className="p-3"></th></tr></thead>
              <tbody>{processados.map((d) => (
                <tr key={d.data} className="border-b border-slate-50 last:border-0">
                  <td className="p-3 font-medium text-slate-800">{fmtDia(d.data)}</td>
                  <td className="p-3 text-right tabular-nums text-slate-700">{d.baixados}</td>
                  <td className="p-3 text-right tabular-nums text-slate-900">{brl(d.valorBaixado)}</td>
                  <td className={`p-3 text-right tabular-nums ${d.pendentes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{d.pendentes}</td>
                  <td className="p-3 text-right"><button onClick={() => reprocessar(d.data)} className="inline-flex items-center gap-1 text-xs text-[#185FA5] hover:underline"><RefreshCw className="h-3 w-3" /> reprocessar</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent></Card>
      ) : aba === 'manual' ? (
        <LancamentoManual id={id} onProcessado={() => { carregarProcessados(); setAba('processados') }} />
      ) : (
        <>
          <Card><CardContent className="p-4">
            <input ref={fileRef} type="file" accept=".xls,.html,.htm" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5]">
              {carregando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} {carregando ? 'Lendo…' : preview ? 'Trocar arquivo' : 'Escolher o arquivo do Suitable (.xls)'}
            </button>
            {erro && <p className="mt-2 text-sm text-rose-600">{erro}</p>}
          </CardContent></Card>

          {recibo && (
            <Card className="border-emerald-300"><CardContent className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Receipt className="h-4 w-4" /> Vendas de {fmtDia(recibo.data)} processadas</p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-xs text-slate-500">Produtos baixados</p><p className="text-lg font-semibold text-slate-900">{recibo.baixados}</p></div>
                <div><p className="text-xs text-slate-500">Valor baixado</p><p className="text-lg font-semibold text-slate-900">{brl(recibo.valorBaixado)}</p></div>
                <div><p className="text-xs text-slate-500">Pendentes</p><p className={`text-lg font-semibold ${recibo.pendentes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{recibo.pendentes}</p></div>
              </div>
              <a href={`/empresas/${id}/estoque/movimentos`} className="mt-2 inline-block text-xs text-[#185FA5] hover:underline">ver os movimentos no extrato →</a>
            </CardContent></Card>
          )}

          {preview && (
            <>
              {/* ÁREA 2: PROCESSAR O DIA */}
              <Card className="border-[#185FA5]/30"><CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold text-slate-900">Processar o dia</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-slate-500">Data das vendas
                    <input ref={dateRef} type="date" value={data} onChange={(e) => { setData(e.target.value); setErroProc(null) }} onClick={() => { try { dateRef.current?.showPicker?.() } catch { /* fallback nativo */ } }}
                      className="mt-1 block w-44 cursor-pointer rounded-lg border border-slate-300 py-2 px-3 text-sm" />
                  </label>
                  <button onClick={abrirPreview} disabled={processando} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">
                    {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Confirmar baixa de {marcados.length} produto{marcados.length === 1 ? '' : 's'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">{marcados.length} marcados · {preview.naoMapeados} pendentes (não baixam) · parcial é normal.</p>
                {erroProc && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erroProc}</p>}
              </CardContent></Card>

              {/* ÁREA 1: MAPEAMENTO */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm font-semibold text-slate-900">Mapeamento ({preview.totalProdutos} produtos)</p>
                <div className="relative min-w-[160px]"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div>
                {preview.naoMapeados > 0 && <button onClick={() => setSoPendentes((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${soPendentes ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-600'}`}><AlertTriangle className="h-3.5 w-3.5" /> só pendentes ({preview.naoMapeados})</button>}
              </div>

              <Card><CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400"><th className="w-8 p-3"></th><th className="p-3 font-medium">Produto (Suitable)</th><th className="p-3 text-right font-medium">Qtd</th><th className="p-3 font-medium">Destino no estoque</th></tr></thead>
                  <tbody>
                    {linhasFiltradas.map((l) => {
                      const emEdicao = editando.has(l.produto)
                      const marcado = l.mapeado && !desmarcados.has(l.produto)
                      return (
                        <tr key={l.produto} className={`border-b border-slate-50 last:border-0 ${!l.mapeado ? 'bg-amber-50/30' : ''}`}>
                          <td className="p-3">{l.mapeado ? <input type="checkbox" checked={marcado} onChange={() => setDesmarcados((s) => { const n = new Set(s); n.has(l.produto) ? n.delete(l.produto) : n.add(l.produto); return n })} className="h-4 w-4 accent-[#185FA5]" /> : null}</td>
                          <td className="p-3 font-medium text-slate-800">{l.produto}</td>
                          <td className="p-3 text-right tabular-nums text-slate-600">{l.quantidade}</td>
                          <td className="p-3">
                            {l.mapeado && !emEdicao ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> {l.alvoNome}</span>
                                <button onClick={() => setEditando((s) => new Set(s).add(l.produto))} className="text-slate-400 hover:text-slate-600" title="trocar"><Pencil className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <select autoFocus={emEdicao} value={l.mapeado ? l.alvoTipo + ':' + l.alvoId : ''} onChange={(e) => e.target.value && mapear(l.produto, e.target.value)} className={`w-full max-w-xs rounded-lg border py-1.5 px-2 text-sm ${l.mapeado ? 'border-slate-200' : 'border-amber-300 text-amber-700'}`}>
                                <option value="">— escolher —</option>
                                {l.mapeado ? <option value="REMOVER">desmapear</option> : null}
                                <optgroup label="Criar novo">
                                  <option value="CRIAR_FICHA">+ criar ficha de produto final</option>
                                  <option value="CRIAR_REVENDA">+ criar item de revenda (bebida)</option>
                                </optgroup>
                                <optgroup label="Produtos finais (ficha)">{preview.opcoes.fichas.map((f) => <option key={f.id} value={'FICHA:' + f.id}>{f.nome}</option>)}</optgroup>
                                <optgroup label="Revenda (bebida etc.)">{preview.opcoes.itens.map((i) => <option key={i.id} value={'REVENDA:' + i.id}>{i.nome}</option>)}</optgroup>
                              </select>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent></Card>
            </>
          )}
        </>
      )}

      {/* modal ÚNICO de confirmação (import + reprocesso) */}
      {plano && <PlanoVendaModal plano={plano} data={modoReprocesso ?? data} titulo={modoReprocesso ? 'Reprocessar' : 'Confirmar baixa'} subtitulo={modoReprocesso && estornaItens > 0 ? `Estorna ${estornaItens} baixa(s) anterior(es) e refaz com o mapa atual.` : undefined} processando={processando} erro={erroModal} onConfirmar={confirmar} onClose={() => setPlano(null)} />}
    </div>
  )
}

// aba PDV manual: escolhe vendável + quantidade → mesmo modal preview/confirmar/recibo
function LancamentoManual({ id, onProcessado }: { id: string; onProcessado: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [vend, setVend] = useState<{ alvoTipo: 'FICHA' | 'REVENDA'; alvoId: string; nome: string }[]>([])
  const [data, setDataM] = useState(hoje)
  const [qtd, setQtd] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const [plano, setPlano] = useState<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [recibo, setRecibo] = useState<{ data: string; baixados: number; valorBaixado: number; pendentes: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const dRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetch(`/api/empresas/${id}/estoque/vendas/vendaveis`).then((r) => r.json()).then((j) => setVend([...(j.vendaveis?.fichas ?? []), ...(j.vendaveis?.itens ?? [])])).catch(() => {}) }, [id])

  const parse = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const entradas = vend.map((v) => ({ ...v, quantidade: parse(qtd[v.alvoId]) })).filter((e) => e.quantidade > 0)
  const filtrados = vend.filter((v) => !busca.trim() || v.nome.toLowerCase().includes(busca.toLowerCase()))

  const preview = async () => {
    setErro(null)
    if (!data) { setErro('Escolha a data.'); return }
    if (entradas.length === 0) { setErro('Ponha ao menos uma quantidade.'); return }
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, entradas: entradas.map((e) => ({ alvoTipo: e.alvoTipo, alvoId: e.alvoId, quantidade: e.quantidade })) }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui montar o preview.'); return }
      setPlano(j.plano)
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }
  const confirmar = async () => {
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, confirmar: true, entradas: entradas.map((e) => ({ alvoTipo: e.alvoTipo, alvoId: e.alvoId, quantidade: e.quantidade })) }) })
      const j = await r.json().catch(() => null)
      if (r.ok) { setRecibo(j.recibo); setPlano(null); setQtd({}); onProcessado() } else setErro(j?.erro ?? 'Não consegui processar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Pros dias sem o arquivo do Suitable (ou pra complementar). Escolha data, ponha as quantidades e confirme — mesmo fluxo do import. Convive com o import do dia.</p>
      {recibo && <Card className="border-emerald-300"><CardContent className="p-4 text-sm"><span className="font-semibold text-emerald-700">Lançado {fmtDia(recibo.data)}:</span> {recibo.baixados} baixados · custo {recibo.valorBaixado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</CardContent></Card>}
      <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs text-slate-500">Data<input ref={dRef} type="date" value={data} onChange={(e) => setDataM(e.target.value)} onClick={() => { try { dRef.current?.showPicker?.() } catch { /* nativo */ } }} className="mt-1 block w-44 cursor-pointer rounded-lg border border-slate-300 py-2 px-3 text-sm" /></label>
        <button onClick={preview} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Lançar {entradas.length} produto{entradas.length === 1 ? '' : 's'}</button>
        {erro && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
      </CardContent></Card>
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar produto vendável…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" /></div>
      <Card><CardContent className="p-0">
        {vend.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Nenhum vendável ainda. Crie fichas de produto final ou itens de revenda.</p> : (
          <table className="w-full text-sm"><tbody>
            {filtrados.map((v) => (
              <tr key={v.alvoId} className="border-b border-slate-50 last:border-0">
                <td className="p-3 text-slate-800">{v.nome} <span className="text-[11px] text-slate-400">{v.alvoTipo === 'FICHA' ? 'produto final' : 'revenda'}</span></td>
                <td className="p-3 text-right"><input value={qtd[v.alvoId] ?? ''} onChange={(e) => setQtd((q) => ({ ...q, [v.alvoId]: e.target.value }))} inputMode="decimal" placeholder="0" className="w-20 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" /></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </CardContent></Card>
      {plano && <PlanoVendaModal plano={plano} data={data} titulo="Confirmar lançamento" processando={busy} erro={erro} onConfirmar={confirmar} onClose={() => setPlano(null)} />}
    </div>
  )
}
