'use client'

// ESTOQUE FASE 3 — vendas do Suitable, 2 áreas claras: (1) MAPEAMENTO (cadastro permanente,
// chips) · (2) PROCESSAR O DIA (data + checkboxes do que entra + confirmar → preview → recibo).
// + aba PROCESSADOS (histórico por dia, reprocessar). Nada falha em silêncio: sempre preview
// ou erro visível. Date picker robusto no Safari (showPicker).

import { useEffect, useMemo, useRef, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { ShoppingCart, Loader2, Upload, Check, Layers, Pencil, Search, Play, Receipt, AlertTriangle, History, RefreshCw, Store, Download, CheckCircle2 } from 'lucide-react'
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
  const [aba, setAba] = useState<'importar' | 'complementos' | 'manual' | 'processados'>('importar')
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
    if (valor === 'CRIAR_FICHA') { window.location.href = `/empresas/${id}/estoque/fichas/nova?nome=${encodeURIComponent(nomeSuitable)}&mapear=${encodeURIComponent(nomeSuitable)}&tipo=PRODUTO_FINAL&voltar=${encodeURIComponent(`/empresas/${id}/estoque/vendas`)}`; return }
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
  const sp = useSort<'data' | 'baixados' | 'valor' | 'pendentes'>('data', 'desc')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <ShoppingCart className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Vendas (Suitable)</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">Mapeia uma vez (vale sempre) · processa o dia · a venda baixa o estoque</p>
        <button onClick={() => baixarCsv(`vendas-processadas-${hojeArquivo()}`,
          ['Dia', 'Produtos baixados', 'Valor baixado', 'Pendentes'],
          processados.map((d) => [fmtDia(d.data), d.baixados, d.valorBaixado, d.pendentes]))}
          disabled={processados.length === 0}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> CSV</button>
      </div>

      {processados.length > 0 && (
        <StatCardGrid>
          <StatCard tone="emerald" label="Baixado" value={brl(processados.reduce((a, d) => a + d.valorBaixado, 0))} sub={`${processados.reduce((a, d) => a + d.baixados, 0)} produtos`} icon={CheckCircle2} />
          <StatCard tone="sky" label="Dias processados" value={String(processados.length)} sub="com venda baixada" icon={History} />
          <StatCard tone="amber" label="Pendentes" value={String(processados.reduce((a, d) => a + d.pendentes, 0))} sub="sem destino no estoque" icon={AlertTriangle} />
        </StatCardGrid>
      )}

      {/* abas */}
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setAba('importar')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'importar' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}>Importar dia</button>
        <button onClick={() => setAba('complementos')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'complementos' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}><Layers className="mr-1 inline h-3.5 w-3.5" />Complementos</button>
        <button onClick={() => setAba('manual')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'manual' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}><Store className="mr-1 inline h-3.5 w-3.5" />Lançamento manual</button>
        <button onClick={() => setAba('processados')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${aba === 'processados' ? 'border-[#185FA5] text-[#185FA5]' : 'border-transparent text-slate-500'}`}><History className="mr-1 inline h-3.5 w-3.5" />Processados ({processados.length})</button>
      </div>

      {aba === 'processados' ? (
        <Card><CardContent className="p-0">
          {processados.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Nenhum dia processado ainda.</p> : (
            <table className="density-normal w-full">
              <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <SortableTh campo="data" col={sp.col} dir={sp.dir} onSort={sp.alternar}>Dia</SortableTh>
                <SortableTh campo="baixados" col={sp.col} dir={sp.dir} onSort={sp.alternar} align="right">Baixados</SortableTh>
                <SortableTh campo="valor" col={sp.col} dir={sp.dir} onSort={sp.alternar} align="right">Valor</SortableTh>
                <SortableTh campo="pendentes" col={sp.col} dir={sp.dir} onSort={sp.alternar} align="right">Pendentes</SortableTh>
                <th className="w-10 px-3 py-2"></th>
              </tr></thead>
              <tbody>{sp.ordenar(processados, (d, c) => (c === 'data' ? d.data : c === 'baixados' ? d.baixados : c === 'valor' ? d.valorBaixado : d.pendentes)).map((d) => (
                <tr key={d.data} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{fmtDia(d.data)}</td>
                  <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-700">{d.baixados}</td>
                  <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-900">{brl(d.valorBaixado)}</td>
                  <td className={`px-3 py-0 text-[13px] text-right tabular-nums ${d.pendentes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{d.pendentes}</td>
                  <td className="px-3 py-0 text-[13px] text-right"><button onClick={() => reprocessar(d.data)} className="inline-flex items-center gap-1 text-xs text-[#185FA5] hover:underline"><RefreshCw className="h-3 w-3" /> reprocessar</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent></Card>
      ) : aba === 'complementos' ? (
        <><ImportComplementos id={id} /><BaixaComplementos id={id} /></>
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
                <table className="density-normal w-full">
                  <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400"><th className="w-8 px-3 py-2"></th><th className="px-3 py-2 font-medium">Produto (Suitable)</th><th className="px-3 py-2 text-right font-medium">Qtd</th><th className="px-3 py-2 font-medium">Destino no estoque</th></tr></thead>
                  <tbody>
                    {linhasFiltradas.map((l) => {
                      const emEdicao = editando.has(l.produto)
                      const marcado = l.mapeado && !desmarcados.has(l.produto)
                      return (
                        <tr key={l.produto} className={`border-b border-slate-50 last:border-0 ${!l.mapeado ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-3 py-0 text-[13px]">{l.mapeado ? <input type="checkbox" checked={marcado} onChange={() => setDesmarcados((s) => { const n = new Set(s); n.has(l.produto) ? n.delete(l.produto) : n.add(l.produto); return n })} className="h-4 w-4 accent-[#185FA5]" /> : null}</td>
                          <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{l.produto}</td>
                          <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-600">{l.quantidade}</td>
                          <td className="px-3 py-0 text-[13px]">
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
          <table className="density-normal w-full"><tbody>
            {filtrados.map((v) => (
              <tr key={v.alvoId} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-0 text-[13px] text-slate-800">{v.nome} <span className="text-[11px] text-slate-400">{v.alvoTipo === 'FICHA' ? 'produto final' : 'revenda'}</span></td>
                <td className="px-3 py-0 text-[13px] text-right"><input value={qtd[v.alvoId] ?? ''} onChange={(e) => setQtd((q) => ({ ...q, [v.alvoId]: e.target.value }))} inputMode="decimal" placeholder="0" className="w-20 rounded-lg border border-slate-300 py-1.5 px-2 text-right text-sm tabular-nums" /></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </CardContent></Card>
      {plano && <PlanoVendaModal plano={plano} data={data} titulo="Confirmar lançamento" processando={busy} erro={erro} onConfirmar={confirmar} onClose={() => setPlano(null)} />}
    </div>
  )
}

/**
 * ⭐⭐ IMPORT DO RELATÓRIO DE COMPLEMENTOS (02/09) — a porta que faltava.
 *
 * ⚠️ SEM ELA A PRATELEIRA DO CARDÁPIO NASCERIA VAZIA PARA SEMPRE e o vazio dela mandava
 * pra cá, prometendo um caminho que não existia. Tela que promete caminho inexistente é a
 * mesma classe do menu que oferece o que a pessoa não pode fazer.
 *
 * ⭐ MESMO GESTO do import de produtos: escolhe a DATA (o arquivo NÃO traz — o período fica
 * na tela do Suitable) → arquivo → PREVIEW → confirmar. Nunca grava sem mostrar antes.
 *
 * ⛔ E NÃO BAIXA NADA: importar é trazer o que o PDV vendeu; a baixa é gesto separado.
 * A tela diz isso, pra ninguém achar que o estoque já mexeu.
 */
function ImportComplementos({ id }: { id: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState('')
  const [html, setHtml] = useState('')
  const [prev, setPrev] = useState<{
    totalLinhas: number; totalOcorrencias: number; comDestino: number; pendentes: number
    nosDoisRelatorios: number; jaImportado: boolean
    prateleira: { nomeSuitable: string; ocorrencias: number; destino: string; nomeFicha: string | null; tambemProduto: boolean }[]
  } | null>(null)
  const [ok, setOk] = useState<{ linhas: number; ocorrencias: number; substituiu: boolean; modo?: string } | null>(null)
  // ⛔ PERÍODO semeia a prateleira e NUNCA vira dia de baixa (a linha fica marcada)
  const [modo, setModo] = useState<'DIA' | 'PERIODO'>('DIA')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const chamar = async (confirmar: boolean, conteudo?: string) => {
    const corpo = conteudo ?? html
    if (!data) { setErro('Escolha a data do relatório — o arquivo do Suitable não traz o período.'); return }
    if (!corpo) { setErro('Escolha o arquivo do relatório de complementos.'); return }
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, html: corpo, confirmar, modo }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ler o arquivo.'); return }
      if (confirmar) { setOk(j); setPrev(null) } else { setPrev(j); setOk(null) }
    } catch { setErro('Não consegui falar com o servidor.') } finally { setBusy(false) }
  }

  const onFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => { const t = String(reader.result ?? ''); setHtml(t); chamar(false, t) }
    reader.readAsText(f, 'utf-8')
  }

  return (
    <div className="space-y-3">
      <Card><CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            Data do relatório
            <input type="date" value={data} onChange={(e) => { setData(e.target.value); setPrev(null); setOk(null) }}
              className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
          <label className="text-xs text-slate-500">
            O arquivo é de…
            <select value={modo} onChange={(e) => { setModo(e.target.value as 'DIA' | 'PERIODO'); setPrev(null); setOk(null) }}
              className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="DIA">um DIA de vendas</option>
              <option value="PERIODO">um PERÍODO (só pra montar a lista)</option>
            </select>
          </label>
          <p className="flex-1 text-[11px] text-slate-400">
            O arquivo do Suitable não traz o período — quem sabe é você, na tela dele.
            {modo === 'PERIODO' && <><br /><b>Período</b> entra pra você mapear os nomes e priorizar por ocorrência; <b>não</b> vira dia de baixa de estoque.</>}
          </p>
        </div>
        <input ref={fileRef} type="file" accept=".xls,.html,.htm" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-sm text-slate-500 hover:border-[#185FA5] hover:text-[#185FA5] disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {busy ? 'Lendo…' : prev ? 'Trocar arquivo' : 'Escolher o Relatório de Complementos (.xls)'}
        </button>
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
      </CardContent></Card>

      {prev && (
        <Card><CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-slate-500">Complementos</p><p className="text-lg font-semibold text-slate-900">{prev.totalLinhas}</p></div>
            <div><p className="text-xs text-slate-500">Ocorrências</p><p className="text-lg font-semibold text-slate-900">{prev.totalOcorrencias}</p></div>
            <div><p className="text-xs text-slate-500">Com destino</p><p className="text-lg font-semibold text-emerald-600">{prev.comDestino}</p></div>
            <div><p className="text-xs text-slate-500">Sem destino</p><p className={`text-lg font-semibold ${prev.pendentes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{prev.pendentes}</p></div>
          </div>

          {/* ⚠️ pendente NÃO trava o import — mapear a cauda longa é decisão do dono, e o
              nome só aparece na prateleira depois de importado. */}
          {prev.pendentes > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {prev.pendentes} sem destino ainda — eles entram assim mesmo e ficam
              <b> visíveis na prateleira</b> do Cardápio pra você apontar um a um. Nada baixa estoque agora.
            </p>
          )}
          {prev.nosDoisRelatorios > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              <b>{prev.nosDoisRelatorios} nome(s) estão nos DOIS relatórios</b> (produto e complemento).
              Cada um tem destino próprio — se os dois baixarem, o estoque sai duas vezes.
            </p>
          )}
          {prev.jaImportado && (
            <p className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
              Já existe import deste dia — confirmar <b>substitui</b> as linhas dele.
            </p>
          )}

          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="density-normal w-full">
              <thead className="sticky top-0 bg-slate-50"><tr>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500">Complemento</th>
                <th className="px-3 py-2 text-right text-[11px] uppercase tracking-wide text-slate-500">Ocorr.</th>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wide text-slate-500">Destino</th>
              </tr></thead>
              <tbody>{prev.prateleira.map((l) => (
                <tr key={l.nomeSuitable} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-0 text-[13px] text-slate-800">
                    {l.nomeSuitable}
                    {l.tambemProduto && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] text-amber-800">também produto</span>}
                  </td>
                  <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">{l.ocorrencias}</td>
                  <td className="px-3 py-0 text-[13px]">
                    {l.destino === 'FICHA' ? <span className="text-emerald-700">{l.nomeFicha ?? 'ficha'}</span>
                      : l.destino === 'IGNORAR' ? <span className="text-slate-400">ignorado</span>
                        : <span className="text-amber-600">sem destino</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <button onClick={() => chamar(true)} disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmar import de {prev.totalLinhas} complementos
          </button>
        </CardContent></Card>
      )}

      {ok && (
        <Card className="border-emerald-300"><CardContent className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Receipt className="h-4 w-4" /> {ok.linhas} complementos importados ({ok.ocorrencias} ocorrências)
            {ok.modo === 'PERIODO' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600">período — não baixa estoque</span>}
            {ok.substituiu && <span className="text-xs font-normal text-slate-500">— substituiu o import anterior deste dia</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500">Nada baixou estoque — o destino de cada sabor é você quem aponta.</p>
          <a href={`/empresas/${id}/estoque/cardapio`} className="mt-2 inline-block text-xs text-[#185FA5] hover:underline">
            ir pra prateleira de complementos no Cardápio →
          </a>
        </CardContent></Card>
      )}
    </div>
  )
}

/**
 * ⭐⭐⭐ A BAIXA DOS COMPLEMENTOS — preview → confirmar, como todo gesto que mexe no ledger.
 *
 * ⚠️ O NEGATIVO APARECE ANTES DE GRAVAR e **não bloqueia**: `INTERMEDIARIO` baixa o pack
 * pronto, e negativo quer dizer *"vendeu sem produzir"* — o sinal que o dono quer ver.
 * Bloquear trocaria uma informação verdadeira por um estoque bonito e falso.
 */
function BaixaComplementos({ id }: { id: string }) {
  const [dias, setDias] = useState<{ data: string; ehPeriodo: boolean; linhas: number; ocorrencias: number; baixado: boolean; precisaReprocessar: boolean }[] | null>(null)
  const [plano, setPlano] = useState<null | {
    data: string; ehPeriodo: boolean; jaBaixado: boolean; precisaReprocessar: boolean
    totalOcorrencias: number; ocorrenciasBaixadas: number
    complementos: { nomeSuitable: string; ocorrencias: number; alvo: string }[]
    pendentes: { nomeSuitable: string; ocorrencias: number }[]
    ignorados: { nomeSuitable: string; ocorrencias: number }[]
    agregada: { itemId: string; nome: string; qtd: number; valor: number | null; saldoDepois: number }[]
  }>(null)
  const [recibo, setRecibo] = useState<{ ocorrencias: number; itensBaixados: number; valorBaixado: number; pendentes: number; estornou: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/vendas/complementos/baixa`)
    .then((r) => r.json()).then((j) => setDias(j.dias ?? [])).catch(() => setDias([]))
  useEffect(() => { carregar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  const abrir = async (data: string) => {
    setBusy(true); setErro(null); setRecibo(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos/baixa?data=${data}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui montar o preview.'); return }
      setPlano(j.plano)
    } finally { setBusy(false) }
  }

  const confirmar = async () => {
    if (!plano) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos/baixa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: plano.data }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui baixar.'); return }
      setRecibo(j); setPlano(null); await carregar()
    } finally { setBusy(false) }
  }

  if (dias === null || !dias.length) return null

  return (
    <Card><CardContent className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">Baixar o estoque dos complementos</p>

      <table className="density-normal w-full">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
          <th className="px-3 py-2 font-medium">Dia</th>
          <th className="px-3 py-2 text-right font-medium">Ocorrências</th>
          <th className="px-3 py-2 font-medium">Estado</th>
          <th className="px-3 py-2"></th>
        </tr></thead>
        <tbody>{dias.map((d) => (
          <tr key={d.data} className="border-t border-slate-50">
            <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{fmtDia(d.data)}</td>
            <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{d.ocorrencias.toLocaleString('pt-BR')}</td>
            <td className="px-3 py-0 text-[13px]">
              {/* ⛔ PERÍODO nunca baixa: ele existe pra montar a lista de sabores */}
              {d.ehPeriodo ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">período — não baixa</span>
                : d.precisaReprocessar ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">precisa reprocessar</span>
                  : d.baixado ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">baixado</span>
                    : <span className="text-[11px] text-slate-400">não baixado</span>}
            </td>
            <td className="px-3 py-0 text-right">
              {!d.ehPeriodo && (
                <button onClick={() => abrir(d.data)} disabled={busy}
                  className="text-[11px] text-[#185FA5] hover:underline disabled:opacity-40">
                  {d.precisaReprocessar ? 'reprocessar' : d.baixado ? 'ver' : 'baixar'}
                </button>
              )}
            </td>
          </tr>
        ))}</tbody>
      </table>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      {recibo && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
          <b>{recibo.ocorrencias.toLocaleString('pt-BR')} ocorrências</b> baixadas em {recibo.itensBaixados} item(ns) · {brl(recibo.valorBaixado)}
          {recibo.estornou > 0 && <> · {recibo.estornou} baixa(s) anterior(es) estornada(s)</>}
          {recibo.pendentes > 0 && <> · {recibo.pendentes} sem ficha (não baixaram)</>}
        </div>
      )}

      {plano && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-xs text-slate-600">
            {fmtDia(plano.data)} · <b>{plano.ocorrenciasBaixadas.toLocaleString('pt-BR')}</b> de {plano.totalOcorrencias.toLocaleString('pt-BR')} ocorrências baixam
            {plano.jaBaixado && <span className="ml-1 text-amber-700">· este dia já foi baixado: confirmar ESTORNA e refaz</span>}
          </p>
          <table className="density-normal w-full">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Sai</th>
              <th className="px-3 py-2 text-right font-medium">Custo</th>
              <th className="px-3 py-2 text-right font-medium">Saldo depois</th>
            </tr></thead>
            <tbody>{plano.agregada.map((a) => (
              <tr key={a.itemId} className="border-t border-slate-50">
                <td className="px-3 py-0 text-[13px] text-slate-800">{a.nome}</td>
                <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-700">{a.qtd.toLocaleString('pt-BR')}</td>
                <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{a.valor == null ? '—' : brl(a.valor)}</td>
                {/* ⚠️ negativo AVISA e não impede: é "vendeu sem produzir", não erro */}
                <td className={`px-3 py-0 text-right text-[13px] tabular-nums ${a.saldoDepois < 0 ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>
                  {a.saldoDepois.toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {plano.agregada.some((a) => a.saldoDepois < 0) && (
            <p className="rounded bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              ⚠️ algum item fica <b>negativo</b>: é o sinal de <b>vendeu sem produzir</b> — a baixa segue, e o número diz o que falta produzir.
            </p>
          )}
          {plano.pendentes.length > 0 && (
            <p className="text-[11px] text-slate-500">{plano.pendentes.length} complemento(s) sem ficha não baixam: {plano.pendentes.slice(0, 5).map((p) => p.nomeSuitable).join(' · ')}{plano.pendentes.length > 5 ? '…' : ''}</p>
          )}
          <div className="flex items-center gap-2">
            <button onClick={confirmar} disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C] disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {plano.jaBaixado ? 'Estornar e refazer' : 'Confirmar a baixa'}
            </button>
            <button onClick={() => setPlano(null)} className="text-xs text-slate-500 hover:text-slate-700">cancelar</button>
          </div>
        </div>
      )}
    </CardContent></Card>
  )
}
