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
import { ListChecks, ShoppingCart, Loader2, Upload, Check, Layers, Search, Play, Receipt, AlertTriangle, History, RefreshCw, Store, Download, CheckCircle2 } from 'lucide-react'
import { PlanoVendaModal } from '@/components/estoque/plano-venda-modal'
import { RevisaoDoImport, type RevisaoDTO, type ConfirmarDelegado } from '@/components/estoque/revisao-do-import'
import { SeletorDeDestino } from '@/components/estoque/seletor-de-destino'
import { hrefDoEditor } from '@/lib/stock/vendas/volta-da-revisao'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Linha { produto: string; quantidade: number; valorTotal: number; mapeado: boolean; alvoTipo: string | null; alvoId: string | null; alvoNome: string | null }
interface Preview { linhas: Linha[]; totalUnidades: number; totalProdutos: number; naoMapeados: number; opcoes: { fichas: { id: string; nome: string; tipo: string }[]; itens: { id: string; nome: string }[] } }
interface Plano { produtos: { nome: string; quantidade: number; alvoNome: string }[]; pendentes: { nome: string; quantidade: number }[]; fora: { nome: string; quantidade: number }[]; agregada: { nome: string; qtd: number; valor: number | null }[]; totalMapeados: number; totalPendentes: number }
interface Recibo { data: string; baixados: number; itensBaixados: number; pendentes: number; valorBaixado: number }
interface Dia { data: string; totalUnidades: number; baixados: number; valorBaixado: number; pendentes: number; status: string }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmtDia = (d: string) => d.split('-').reverse().join('/')

export default function VendasImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // ⭐ a aba pode vir da URL (08/09/2026): o histórico do item linka a baixa de venda pra
  // `?aba=processados#dia-YYYY-MM-DD`, e cair na aba "Importar dia" seria não chegar na fonte.
  // ⚠️ lido no 1º render (não em effect) pra a aba não PISCAR de importar → processados.
  // ⛔⛔⛔ 8ª VOLTA DA "PORTA SEM MAÇANETA" (14/09) — a revisão existia e o dono NÃO ACHAVA.
  // Ela só abria por um link `text-xs hover:underline` na ÚLTIMA coluna da 4ª aba — e
  // `hover` não existe no celular, que é onde ele importa. E o caminho real dele (subir o
  // arquivo → confirmar) desembocava no RESUMO VELHO, sem nenhum caminho pra revisão.
  //
  // ⭐ A RÉGUA: a revisão nasce ONDE A PERGUNTA NASCE — (a) o RESULTADO do upload ABRE ela
  // e (b) todo import da lista tem "revisar" À VISTA, com borda e ícone (nunca só hover).
  //
  // ⚠️ `origem` diz em qual SLOT o painel renderiza: aberto pelo upload, ele aparece
  // colado no resultado; aberto pela lista, embaixo da lista. Um slot só faria o painel
  // nascer longe do dedo que clicou — o defeito de 10/09, de novo.
  //
  // ⭐⭐ E A VOLTA DO EDITOR CAI AQUI (14/09): `?revisar=<dia>&relatorio=<R>` reabre o
  // painel no MESMO dia, e o hash `#rev-<nome>` leva o olho pra linha. ⚠️ Lido no 1º render
  // (não em effect), como o `?aba=` — ler depois faria a tela piscar sem a revisão antes
  // de abri-la, e "voltar e não ver nada" é indistinguível de "não gravou".
  const [revisao, setRevisao] = useState<{ data: string; relatorio: 'PRODUTOS' | 'COMPLEMENTOS'; origem: 'IMPORT' | 'LISTA' } | null>(() => {
    if (typeof window === 'undefined') return null
    const q = new URLSearchParams(window.location.search)
    const dia = q.get('revisar')
    if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null
    return { data: dia, relatorio: q.get('relatorio') === 'COMPLEMENTOS' ? 'COMPLEMENTOS' : 'PRODUTOS', origem: 'LISTA' }
  })
  const [aba, setAba] = useState<'importar' | 'complementos' | 'manual' | 'processados'>(() => {
    if (typeof window === 'undefined') return 'importar'
    const q = new URLSearchParams(window.location.search).get('aba')
    return q === 'processados' || q === 'complementos' || q === 'manual' ? q : 'importar'
  })
  const [preview, setPreview] = useState<Preview | null>(null)
  /** ⭐ a revisão do arquivo recém-lido — a MESMA lista de depois do import (14/09) */
  const [prevRevisao, setPrevRevisao] = useState<RevisaoDTO | null>(null)
  const [html, setHtml] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<Set<string>>(new Set())
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
  // ⚠️ ajustar um vínculo na revisão de complementos muda o ESTADO do dia ("precisa
  // reprocessar") — a lista tem que recarregar, senão a tela fica contando o mundo velho.
  const [recargaComp, setRecargaComp] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const carregarProcessados = () => fetch(`/api/empresas/${id}/estoque/vendas/processados`).then((r) => r.json()).then((j) => setProcessados(j.processados ?? [])).catch(() => {})
  useEffect(() => { carregarProcessados() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * ⭐⭐ O UPLOAD JÁ DEVOLVE A REVISÃO (14/09) — a MESMA lista de depois do import.
   *
   * ⛔ A tabela velha "Mapeamento (N)" existia só porque a revisão não sabia desenhar um dia
   * que ainda não está no banco. Com o preview devolvendo a lista pronta, a página passa a
   * ter **uma vitrine e um confirmar**. ⚠️ E o upload continua **sem escrever nada**: o que
   * a revisão pré-import edita é o MAPA (configuração, vale pra sempre), e o dia só nasce no
   * confirmar — a régua de 07/09 (um preview, um clique) fica intacta.
   */
  const enviar = async (conteudo: string, dia?: string): Promise<RevisaoDTO | null> => {
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: conteudo, data: dia || data || undefined }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ler o arquivo.'); setPreview(null); setPrevRevisao(null); return null }
      setPreview(j.preview); setPrevRevisao(j.revisao ?? null)
      return j.revisao ?? null
    } catch { setErro('Falha de conexão.'); return null } finally { setCarregando(false) }
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


  const abrirModal = (p: Plano, reprocessoDia: string | null, estorna: number) => { setPlano(p); setModoReprocesso(reprocessoDia); setEstornaItens(estorna); setVerLista(false); setErroModal(null) }

  const abrirPreview = async () => {
    setErroProc(null)
    if (!data) { setErroProc('Escolha a data das vendas antes de processar.'); return }
    setProcessando(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/processar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, data, confirmar: false, incluir: null }) })
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
  const confirmar = async (confirmouSanidade = false) => {
    setProcessando(true); setErroModal(null)
    try {
      const body = modoReprocesso
        ? { data: modoReprocesso, reprocessar: true, confirmar: true, confirmouSanidade }
        : { html, data, confirmar: true, incluir: null, confirmouSanidade }
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/processar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => null)
      if (r.ok) {
        setRecibo(j.recibo); setPlano(null); setModoReprocesso(null); carregarProcessados()
        // ⛔⛔ O PREVIEW MORRE NO CONFIRMAR (14/09): sem isto a página ficaria com a lista
        // do ARQUIVO e a lista do DIA ao mesmo tempo — as duas vitrines de novo, agora
        // por dentro. Depois de confirmar existe UMA verdade: o dia gravado.
        setPreview(null); setPrevRevisao(null); setHtml('')
        // ⭐⭐ O RESULTADO DO UPLOAD **ABRE A REVISÃO** — não o resumo velho. Os 3 números
        // do recibo dizem "quanto"; a pergunta que o dono tem na mão é "o que chegou e
        // pra onde foi", e ela nasce aqui.
        const dia = j.recibo?.data ?? modoReprocesso ?? data
        if (dia) setRevisao({ data: dia, relatorio: 'PRODUTOS', origem: modoReprocesso ? 'LISTA' : 'IMPORT' })
        if (modoReprocesso) setAba('processados')
      }
      else setErroModal(j?.erro ?? 'Não consegui processar.')
    } catch { setErroModal('Falha de conexão.') } finally { setProcessando(false) }
  }

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
        <>
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
                <tr key={d.data} id={`dia-${d.data}`} className="scroll-mt-24 border-b border-slate-50 last:border-0 target:bg-amber-50">
                  <td className="px-3 py-0 text-[13px] font-medium text-slate-800">{fmtDia(d.data)}</td>
                  <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-700">{d.baixados}</td>
                  <td className="px-3 py-0 text-[13px] text-right tabular-nums text-slate-900">{brl(d.valorBaixado)}</td>
                  <td className={`px-3 py-0 text-[13px] text-right tabular-nums ${d.pendentes > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{d.pendentes}</td>
                  <td className="px-3 py-0 text-[13px] text-right">
                    {/* ⭐⭐ A REVISÃO ABRE DAQUI (14/09) — o extrato do que chegou naquele
                        dia, com o destino de cada nome e o ajuste inline. ⛔ Antes o dono
                        via "N pendentes" e tinha que sair da tela pra resolver: o número
                        sem o caminho é o mesmo defeito da fila sem lista. */}
                    {/* ⛔ BOTÃO DE VERDADE, não texto que só sublinha no hover: no celular
                        não existe hover, e foi exatamente assim que este caminho ficou
                        invisível (a lição do "converter a unidade", 30/08). */}
                    <button onClick={() => setRevisao(revisao?.data === d.data && revisao.origem === 'LISTA' ? null : { data: d.data, relatorio: 'PRODUTOS', origem: 'LISTA' })}
                      className="mr-2 inline-flex h-7 items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2 text-xs font-medium text-violet-700 hover:bg-violet-100">
                      <ListChecks className="h-3 w-3" /> {revisao?.data === d.data && revisao.origem === 'LISTA' ? 'fechar' : 'revisar'}
                    </button>
                    <button onClick={() => reprocessar(d.data)} className="inline-flex items-center gap-1 text-xs text-[#185FA5] hover:underline"><RefreshCw className="h-3 w-3" /> reprocessar</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </CardContent></Card>
        {revisao?.origem === 'LISTA' && revisao.relatorio === 'PRODUTOS' && (
          <BlocoRevisao id={id} data={revisao.data} relatorio="PRODUTOS" onMudou={carregarProcessados} onFechar={() => setRevisao(null)} />
        )}
        </>
      ) : aba === 'complementos' ? (
        <>
          <ImportComplementos id={id} onImportado={(dia) => setRevisao({ data: dia, relatorio: 'COMPLEMENTOS', origem: 'IMPORT' })} />
          {revisao?.origem === 'IMPORT' && revisao.relatorio === 'COMPLEMENTOS' && (
            <BlocoRevisao id={id} data={revisao.data} relatorio="COMPLEMENTOS" onMudou={() => setRecargaComp((n) => n + 1)} onFechar={() => setRevisao(null)} />
          )}
          <BaixaComplementos id={id} recarga={recargaComp} revisandoDia={revisao?.origem === 'LISTA' ? revisao.data : null} onRevisar={(dia) => setRevisao(revisao?.origem === 'LISTA' && revisao.data === dia ? null : { data: dia, relatorio: 'COMPLEMENTOS', origem: 'LISTA' })} />
          {revisao?.origem === 'LISTA' && revisao.relatorio === 'COMPLEMENTOS' && (
            <BlocoRevisao id={id} data={revisao.data} relatorio="COMPLEMENTOS" onMudou={() => setRecargaComp((n) => n + 1)} onFechar={() => setRevisao(null)} />
          )}
        </>
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

          {/* ⭐⭐ CAÍ NA REVISÃO — o resultado do upload ABRE o extrato do dia (14/09).
              ⚠️ Fica DEPOIS do recibo e ANTES do mapeamento: é a resposta à pergunta que
              o recibo levanta ("{recibo.pendentes} pendentes — quais?"). */}
          {revisao?.origem === 'IMPORT' && revisao.relatorio === 'PRODUTOS' && (
            <BlocoRevisao id={id} data={revisao.data} relatorio="PRODUTOS" onMudou={carregarProcessados} onFechar={() => setRevisao(null)} />
          )}

          {preview && (
            <>
              {/* ⭐⭐⭐ UMA VITRINE, UM CONFIRMAR (14/09) — a tabela velha "Mapeamento (N)"
                  MORREU aqui. **O dono:** *"a tela velha não morreu quando a nova nasceu:
                  recibo + REVISÃO nova + o RELATÓRIO/TABELA VELHA, dois confirmares — é a
                  segunda derivação em forma de página."*
                  ⚠️ O que sobrou desta área é o que a revisão NÃO sabe: a DATA do arquivo
                  (o Suitable não a traz). O botão de confirmar desceu pro rodapé da revisão. */}
              <Card className="border-[#185FA5]/30"><CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-slate-500">Data das vendas
                    <input ref={dateRef} type="date" value={data} onChange={(e) => { setData(e.target.value); setErroProc(null) }} onClick={() => { try { dateRef.current?.showPicker?.() } catch { /* fallback nativo */ } }}
                      className="mt-1 block w-44 cursor-pointer rounded-lg border border-slate-300 py-2 px-3 text-sm" />
                  </label>
                  <p className="flex-1 text-[11px] text-slate-400">
                    O arquivo do Suitable não traz o período — quem sabe é você, na tela dele.
                  </p>
                </div>
                {erroProc && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erroProc}</p>}
              </CardContent></Card>

              {prevRevisao && (
                <BlocoRevisao
                  id={id} data={data || prevRevisao.data} relatorio="PRODUTOS"
                  revisaoExterna={prevRevisao}
                  recarregarExterna={() => enviar(html)}
                  confirmar={{
                    rotulo: processando ? 'processando…' : `Confirmar e baixar${data ? ' ' + fmtDia(data) : ''}`,
                    acao: abrirPreview,
                    habilitado: !!data && !processando,
                    // ⚠️ o rodapé DIZ por que não dá, em vez de ficar cinza mudo
                    resumo: !data
                      ? 'escolha a data das vendas pra confirmar'
                      : `${prevRevisao.contadores.vinculados} nome(s) baixam · ${prevRevisao.contadores.semVinculo} sem destino não baixam`,
                  }}
                  onFechar={null}
                />
              )}
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
/**
 * ⭐⭐ O PAINEL DA REVISÃO, COM UM DONO SÓ.
 *
 * ⛔ Ele é aberto de QUATRO lugares (upload de produtos, lista de produtos, upload de
 * complementos, lista de complementos). Copiar o cabeçalho e a chamada em cada um faria
 * quatro telas que divergem no primeiro rótulo novo — a doença que esta casa mais paga.
 * Aqui o texto e a moldura moram num lugar; o que muda é só ONDE ele é renderizado.
 */
function BlocoRevisao({ id, data, relatorio, onMudou, onFechar, revisaoExterna, recarregarExterna, confirmar }: {
  id: string; data: string; relatorio: 'PRODUTOS' | 'COMPLEMENTOS'
  onMudou?: () => void
  /** ⚠️ `null` = painel do FLUXO (não dá pra fechar, ele É a tela); função = painel aberto sob demanda */
  onFechar: (() => void) | null
  revisaoExterna?: RevisaoDTO | null
  recarregarExterna?: () => Promise<RevisaoDTO | null>
  confirmar?: ConfirmarDelegado
}) {
  return (
    <Card className="mt-3 border-violet-300"><CardContent className="p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ListChecks className="h-4 w-4 shrink-0 text-violet-700" />
        <p className="text-[13px] font-semibold text-slate-800">
          O que chegou em {fmtDia(data)} — e pra onde foi
          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600">
            {relatorio === 'COMPLEMENTOS' ? 'complementos' : 'produtos'}
          </span>
        </p>
        {onFechar && <button onClick={onFechar} className="ml-auto inline-flex h-7 items-center rounded-lg border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50">fechar</button>}
      </div>
      <RevisaoDoImport
        empresaId={id} data={data} relatorio={relatorio} onMudou={onMudou}
        revisaoExterna={revisaoExterna} recarregarExterna={recarregarExterna} confirmar={confirmar}
      />
    </CardContent></Card>
  )
}

function LancamentoManual({ id, onProcessado }: { id: string; onProcessado: () => void }) {
  const hoje = diaEmSaoPaulo()
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
  const confirmar = async (confirmouSanidade = false) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, confirmar: true, confirmouSanidade, entradas: entradas.map((e) => ({ alvoTipo: e.alvoTipo, alvoId: e.alvoId, quantidade: e.quantidade })) }) })
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
function ImportComplementos({ id, onImportado }: { id: string; onImportado: (dia: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState('')
  const [html, setHtml] = useState('')
  const [prev, setPrev] = useState<{
    totalLinhas: number; totalOcorrencias: number; comDestino: number; pendentes: number
    nosDoisRelatorios: number; jaImportado: boolean
    prateleira: { nomeSuitable: string; ocorrencias: number; destino: string; nomeFicha: string | null; tambemProduto: boolean }[]
    /** ⭐ a MESMA lista da revisão pós-import — uma vitrine só (14/09) */
    revisao: RevisaoDTO
    /** ⭐ o plano na forma do modal ÚNICO da tela de produtos */
    plano: { produtos: { nome: string; quantidade: number; alvoNome: string }[]; pendentes: { nome: string; quantidade: number }[]; fora: { nome: string; quantidade: number }[]; agregada: { nome: string; qtd: number; valor: number | null }[] } | null
    /** ⭐⭐ o que a baixa vai fazer — porque CONFIRMAR JÁ BAIXA (07/09) */
    baixa: { ocorrenciasQueBaixam: number; complementosComFicha: number; ehPeriodo: boolean; jaBaixado: boolean
      itens: { nome: string; qtd: number; saldoDepois: number }[] } | null
  } | null>(null)
  const [ok, setOk] = useState<{
    linhas: number; ocorrencias: number; substituiu: boolean; modo?: string
    baixa: { ocorrencias: number; itensBaixados: number; valorBaixado: number; estornou: number } | null
    avisoBaixa: string | null; baixaFalhou: boolean
  } | null>(null)
  // ⛔ PERÍODO semeia a prateleira e NUNCA vira dia de baixa (a linha fica marcada)
  const [modo, setModo] = useState<'DIA' | 'PERIODO'>('DIA')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const chamar = async (confirmar: boolean, conteudo?: string): Promise<{ revisao?: RevisaoDTO } | null> => {
    const corpo = conteudo ?? html
    if (!data) { setErro('Escolha a data do relatório — o arquivo do Suitable não traz o período.'); return null }
    if (!corpo) { setErro('Escolha o arquivo do relatório de complementos.'); return null }
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, html: corpo, confirmar, modo }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui ler o arquivo.'); return null }
      if (confirmar) {
        setOk(j); setPrev(null)
        // ⭐⭐ O RESULTADO DO UPLOAD ABRE A REVISÃO (14/09) — o mesmo gesto do lado dos
        // produtos. ⛔ PERÍODO fica de fora: ele não é um dia de venda, é semente da
        // prateleira — abrir "o que chegou no dia" ali prometeria um dia que não existe.
        if (modo !== 'PERIODO') onImportado(data)
      } else { setPrev(j); setOk(null) }
      return j
    } catch { setErro('Não consegui falar com o servidor.'); return null } finally { setBusy(false) }
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

      {/* ⭐⭐⭐ UMA VITRINE (14/09) — o "relatório velho pós-upload" MORREU.
          **O dono:** *"o relatório feio antigo que não edita nada"*. Ele e a revisão
          mostravam o MESMO dado, e só um dos dois deixava agir. Agora o upload cai
          direto na REVISÃO, com definir/apelidar/ignorar/desmapear na linha. */}
      {prev && (
        <>
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
          {modo === 'PERIODO' && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <b>Período não baixa estoque</b> — ele entra pra montar a lista de sabores e priorizar por ocorrência.
            </p>
          )}
          <Card><CardContent className="p-3">
            <RevisaoDoImport
              empresaId={id} data={data} relatorio="COMPLEMENTOS"
              revisaoExterna={prev.revisao}
              recarregarExterna={async () => { const r = await chamar(false); return r?.revisao ?? null }}
              confirmar={{
                rotulo: busy ? 'processando…' : modo === 'PERIODO' ? `Confirmar import de ${prev.totalLinhas} complementos` : `Confirmar e baixar ${fmtDia(data)}`,
                acao: () => setModal(true),
                habilitado: !busy,
                resumo: modo === 'PERIODO'
                  ? 'período semeia a prateleira e não baixa estoque'
                  : `${prev.revisao.contadores.vinculados} nome(s) baixam · ${prev.revisao.contadores.semVinculo} sem destino não baixam`,
              }}
            />
          </CardContent></Card>
        </>
      )}

      {/* ⭐⭐ O MESMO MODAL DE PRÉVIA DA TELA DE PRODUTOS (o modal único) — dois desenhos
          da mesma pergunta ("o que acontece se eu confirmar?") divergem no 1º campo novo. */}
      {modal && prev && (
        <PlanoVendaModal
          plano={prev.plano ?? { produtos: [], pendentes: [], fora: [], agregada: [] }}
          data={data}
          titulo={modo === 'PERIODO' ? 'Import do período' : 'Baixa dos complementos'}
          subtitulo={prev.jaImportado ? 'este dia já foi importado — confirmar substitui as linhas dele' : undefined}
          processando={busy}
          erro={erro}
          onConfirmar={() => { setModal(false); void chamar(true) }}
          onClose={() => setModal(false)}
        />
      )}

      {ok && (
        <Card className="border-emerald-300"><CardContent className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Receipt className="h-4 w-4" /> {ok.linhas} complementos importados ({ok.ocorrencias} ocorrências)
            {ok.modo === 'PERIODO' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600">período — não baixa estoque</span>}
            {ok.substituiu && <span className="text-xs font-normal text-slate-500">— substituiu o import anterior deste dia</span>}
          </p>
          {/* ⭐ o recibo diz o que BAIXOU — era aqui que a tela antes afirmava, sempre, que
              nada tinha baixado. Depois de 07/09 isso passou a ser mentira no caminho normal. */}
          {ok.baixa ? (
            <p className="mt-1 text-xs text-emerald-700">
              <b>{ok.baixa.ocorrencias.toLocaleString('pt-BR')} ocorrências</b> baixaram o estoque em {ok.baixa.itensBaixados} item(ns) · {brl(ok.baixa.valorBaixado)}
              {ok.baixa.estornou > 0 && <> · {ok.baixa.estornou} baixa(s) anterior(es) estornada(s)</>}
            </p>
          ) : ok.baixaFalhou ? (
            // ⛔ a ponte falhou e o import FICOU — a tela grita, e o dia continua pendente
            <p className="mt-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <b>O import gravou, mas a baixa NÃO rodou:</b> {ok.avisoBaixa}
              <br />O dia fica como <b>pendente</b> — dá pra reprocessar por aqui depois de resolver.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Nada baixou estoque: {ok.avisoBaixa ?? 'nenhum complemento com ficha ainda'}.</p>
          )}
          <a href={`/empresas/${id}/estoque/cardapio`} className="mt-2 inline-block text-xs text-[#185FA5] hover:underline">
            ir pra prateleira de complementos no Cardápio →
          </a>
        </CardContent></Card>
      )}
    </div>
  )
}

/**
 * ⭐⭐ OS DIAS IMPORTADOS E O ESTADO DA BAIXA DE CADA UM.
 *
 * ⛔⛔ **O PASSO SEPARADO DE "BAIXAR" MORREU EM 07/09** (decisão do dono): *"é estado
 * intermediário que só serve pra ser esquecido — provou isso a semana inteira (dias 02–04
 * importados e nunca baixados)"*. **Confirmar o import já baixa.**
 *
 * ⚠️ O que sobra aqui é (a) o ESTADO de cada dia, (b) o **reprocesso** — que continua sendo
 * gesto próprio com preview, porque estornar e refazer o ledger nunca pode ser efeito
 * colateral —, e (c) o acerto dos dias **pendentes de antes da mudança**.
 *
 * ⚠️ O NEGATIVO APARECE ANTES DE GRAVAR e **não bloqueia**: `INTERMEDIARIO` baixa o pack
 * pronto, e negativo quer dizer *"vendeu sem produzir"* — o sinal que o dono quer ver.
 */
function BaixaComplementos({ id, recarga, revisandoDia, onRevisar }: { id: string; recarga: number; revisandoDia: string | null; onRevisar: (dia: string) => void }) {
  const [dias, setDias] = useState<{ data: string; ehPeriodo: boolean; linhas: number; ocorrencias: number; baixado: boolean; precisaReprocessar: boolean; dispensado: boolean; importadoEm: string }[] | null>(null)
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
  useEffect(() => { carregar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, recarga])

  const abrir = async (data: string) => {
    setBusy(true); setErro(null); setRecibo(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/complementos/baixa?data=${data}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui montar o preview.'); return }
      setPlano(j.plano)
    } finally { setBusy(false) }
  }

  // ⭐⭐ "NÃO BAIXAR — DECISÃO" (05/09): o dia sai do aviso e do juiz, com rastro e
  // reversível. ⛔ Sem isto, o alarme novo gritaria pra sempre sobre dias que o dono pulou
  // de propósito — e alarme falso repetido mata o alarme.
  const dispensar = async (data: string, jaDispensado: boolean) => {
    setBusy(true); setErro(null)
    try {
      const url = `/api/empresas/${id}/estoque/vendas/dispensar`
      const r = jaDispensado
        ? await fetch(`${url}?escopo=COMPLEMENTO&data=${data}`, { method: 'DELETE' })
        : await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ escopo: 'COMPLEMENTO', data, motivo: 'produção não estava montada neste dia' }),
        })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui marcar o dia.'); return }
      await carregar()
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
      <p className="text-sm font-semibold text-slate-900">Dias importados</p>
      <p className="-mt-2 text-[11px] text-slate-400">
        Confirmar o import já baixa o estoque. Os dias abaixo mostram o estado; “pendente” é dia
        importado <b>antes</b> dessa mudança, ou dia cuja baixa não rodou.
      </p>

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
                    : d.dispensado ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">não baixar — decisão</span>
                      : <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">pendente — não baixou</span>}
            </td>
            <td className="px-3 py-0 text-right">
              {!d.ehPeriodo && (
                <span className="inline-flex items-center gap-2">
                  {/* ⭐⭐ "REVISAR" À VISTA EM TODO IMPORT DA LISTA (14/09) — era a metade
                      que faltava: a revisão de complementos NÃO tinha caminho nenhum na
                      tela, só existia por rota direta. Botão com borda, nunca hover. */}
                  <button onClick={() => onRevisar(d.data)} disabled={busy}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2 text-[11px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-40">
                    <ListChecks className="h-3 w-3" /> {revisandoDia === d.data ? 'fechar' : 'revisar'}
                  </button>
                  {/* ⚠️ o rótulo segue o ESTADO: "baixar" só aparece em dia pendente (o
                      legado), nunca como passo do fluxo normal — que agora é um clique só. */}
                  <button onClick={() => abrir(d.data)} disabled={busy}
                    className="text-[11px] text-[#185FA5] hover:underline disabled:opacity-40">
                    {d.precisaReprocessar ? 'reprocessar' : d.baixado ? 'ver' : d.dispensado ? 'ver' : 'baixar (pendente)'}
                  </button>
                  {/* ⚠️ dia JÁ baixado não se dispensa: a saída ali é estornar, que é outro
                      gesto, com outro nome. Dispensar é "este dia não vai baixar". */}
                  {!d.baixado && (
                    <button onClick={() => dispensar(d.data, d.dispensado)} disabled={busy}
                      className="text-[11px] text-slate-400 hover:text-slate-700 hover:underline disabled:opacity-40"
                      title={d.dispensado ? 'volta a ser pendência e o aviso volta a valer' : 'sai do aviso e do juiz — reversível, com rastro'}>
                      {d.dispensado ? 'voltar a cobrar' : 'não baixar'}
                    </button>
                  )}
                </span>
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
