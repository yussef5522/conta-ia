'use client'

// ESTOQUE — RECEBIMENTOS na ANATOMIA OFICIAL (24/08), copiada da /contas-a-pagar:
//   1. cards de resumo grandes no topo (valor em destaque, cor por estado, contagem)
//   2. ações no canto direito do título
//   3. barra de filtros numa linha + contador de resultados à direita
//   4. TABELA: colunas ordenáveis, chip de status, borda esquerda por estado,
//      checkbox por linha, menu "..." por linha
//   5. rodapé com a régua de totais
//
// Era um empilhado de cards soltos por seção. Nenhuma regra mudou: a fila, o "deixar pra
// depois", a busca por chave, as históricas e as recebidas fazem exatamente o mesmo — o
// que mudou é que agora dá pra COMPARAR as linhas (ordenar por valor, por espera) em vez
// de ler card por card.
//
// Mobile continua cards empilhados. Density-normal mantido.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { TotalsBar, type TotalItem } from '@/components/ui/totals-bar'
import { SortableTh, useSort } from '@/components/ui/sortable-th'
import { baixarCsv, hojeArquivo } from '@/lib/format/csv-cliente'
import { casaBusca, casaDigitos } from '@/lib/busca-texto'
import { CardFilaBoletos } from '@/components/estoque/card-fila-boletos'
import { AjustarParcelasDaNota } from '@/components/estoque/ajustar-parcelas-da-nota'
import {
  Inbox, PackageOpen, Archive, Info, Loader2, FlaskConical, MoonStar, Search, Loader,
  CheckCircle2, Receipt, AlertTriangle, MoreHorizontal, ChevronRight, X, Download,
  Ban,
} from 'lucide-react'

interface FilaCard {
  id: string; emitNome: string | null; emitCnpj: string | null; vNF: number | null
  dataEmissao: string | null; nItens: number; cancelada: boolean; esperandoDias: number | null
  adiada: boolean; motivoAdiada: string | null
}
interface Recebida {
  nfeId: string; conferenceId: string | null; chave: string; nNF: string | null
  emitNome: string | null; vNF: number | null; confirmadoEm: string | null; divergente: boolean
}
interface Recebimentos {
  dataCorte: string | null; ultimoDownload: string | null
  fila: FilaCard[]; recebidas: Recebida[]
  historicasCount: number; historicasPeriodo: { de: string | null; ate: string | null }
}
interface EntradaManual { id: string; fornecedorNome: string; data: string; valorTotal: number; geraPayable: boolean; criadoPorNome: string | null }
interface Relatorio { total: number; historicas: number; novas: number; fornecedoresDistintos: number; valorTotalNovas: number }

const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const fmtDataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const fmtCnpj = (c: string | null) => (c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—')

/** uma linha da tabela — nota da fila OU recebida OU entrada manual, no mesmo formato */
type Estado = 'aguardando' | 'depois' | 'recebida' | 'manual'
interface Linha {
  key: string; nfeId: string | null
  fornecedor: string; cnpj: string | null
  data: string | null; nItens: number | null; valor: number | null
  esperandoDias: number | null; estado: Estado
  cancelada: boolean; divergente: boolean
  href: string | null; reciboHref: string | null
}
type Campo = 'fornecedor' | 'data' | 'nItens' | 'valor' | 'espera' | 'estado'

const CHIP: Record<Estado, { label: string; cls: string }> = {
  aguardando: { label: 'aguardando', cls: 'bg-sky-100 text-sky-700' },
  depois: { label: 'pra depois', cls: 'bg-slate-100 text-slate-500' },
  recebida: { label: 'recebida', cls: 'bg-emerald-100 text-emerald-700' },
  manual: { label: 'manual', cls: 'bg-violet-100 text-violet-700' },
}
const BORDA: Record<Estado, string> = {
  aguardando: 'border-l-sky-400', depois: 'border-l-slate-200',
  recebida: 'border-l-emerald-400', manual: 'border-l-violet-400',
}

export default function RecebimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ recebimentos: Recebimentos; relatorio: Relatorio } | null | undefined>(undefined)
  const [manuais, setManuais] = useState<EntradaManual[]>([])
  const [verHistoricas, setVerHistoricas] = useState(false)
  const [buscarAberto, setBuscarAberto] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | Estado>('todas')
  const [soAtrasadas, setSoAtrasadas] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const { col, dir, alternar, ordenar } = useSort<Campo>('espera', 'desc')

  const recarregar = () => fetch(`/api/empresas/${id}/estoque/recebimentos`).then((r) => r.json()).then((j) => setData(j.recebimentos ? j : null)).catch(() => setData(null))
  useEffect(() => { recarregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetch(`/api/empresas/${id}/estoque/entrada-manual`).then((x) => x.json()).then((j) => setManuais(j.entradas ?? [])).catch(() => {}) }, [id])

  // ── as 3 origens viram UMA lista de linhas comparáveis ──
  const todas: Linha[] = useMemo(() => {
    if (!data) return []
    const r = data.recebimentos
    return [
      ...r.fila.map((n): Linha => ({
        key: `f-${n.id}`, nfeId: n.id, fornecedor: n.emitNome ?? '(sem nome)', cnpj: n.emitCnpj,
        data: n.dataEmissao, nItens: n.nItens, valor: n.vNF, esperandoDias: n.esperandoDias,
        estado: n.adiada ? 'depois' : 'aguardando', cancelada: n.cancelada, divergente: false,
        href: `/empresas/${id}/estoque/recebimentos/${n.id}`, reciboHref: null,
      })),
      ...r.recebidas.map((n): Linha => ({
        key: `r-${n.nfeId}`, nfeId: n.nfeId, fornecedor: n.emitNome ?? '(sem nome)', cnpj: null,
        data: n.confirmadoEm, nItens: null, valor: n.vNF, esperandoDias: null,
        estado: 'recebida', cancelada: false, divergente: n.divergente,
        href: null, reciboHref: n.conferenceId ? `/empresas/${id}/estoque/recibos/${n.conferenceId}` : null,
      })),
      ...manuais.map((m): Linha => ({
        key: `m-${m.id}`, nfeId: null, fornecedor: m.fornecedorNome, cnpj: null,
        data: m.data, nItens: null, valor: m.valorTotal, esperandoDias: null,
        estado: 'manual', cancelada: false, divergente: false,
        href: null, reciboHref: `/empresas/${id}/estoque/entradas/${m.id}`,
      })),
    ]
  }, [data, manuais, id])

  const filtradas = useMemo(() => {
    let ls = todas
    if (filtro !== 'todas') ls = ls.filter((l) => l.estado === filtro)
    if (soAtrasadas) ls = ls.filter((l) => (l.esperandoDias ?? 0) > 2)
    // ⛔⛔ A BUSCA NÃO FILTRAVA NADA (31/08): a cláusula do CNPJ era
    // `(l.cnpj ?? '').includes(q.replace(/\D/g,''))` — termo de letras virava `''` e
    // `includes('')` é sempre true, então TODA linha passava. Agora o nome usa a busca
    // normalizada (sem acento, sem caixa, por palavra em qualquer ordem — a mesma de
    // `lib/busca-texto.ts`, feita pro bug do "PAO DE XIS") e os dígitos só opinam quando
    // o termo TEM dígito.
    const q = busca.trim()
    if (q) ls = ls.filter((l) => casaBusca(l.fornecedor, q) || casaDigitos(l.cnpj, q))
    return ordenar(ls, (l, c) => (
      c === 'fornecedor' ? l.fornecedor : c === 'data' ? l.data : c === 'nItens' ? l.nItens
        : c === 'valor' ? l.valor : c === 'espera' ? l.esperandoDias : l.estado
    ))
  }, [todas, filtro, soAtrasadas, busca, ordenar])

  const naFila = todas.filter((l) => l.estado === 'aguardando')
  const praDepois = todas.filter((l) => l.estado === 'depois')
  const recebidas = todas.filter((l) => l.estado === 'recebida' || l.estado === 'manual')
  const soma = (ls: Linha[]) => ls.reduce((s, l) => s + (l.valor ?? 0), 0)

  // seleção só faz sentido em linha da FILA (é lá que "deixar pra depois" existe)
  const selecionaveis = filtradas.filter((l) => l.nfeId && (l.estado === 'aguardando' || l.estado === 'depois'))
  const selLinhas = selecionaveis.filter((l) => sel.includes(l.key))

  async function bulkAdiar(adiar: boolean) {
    setBulkBusy(true)
    try {
      // usa a MESMA rota por linha que o menu "..." usa — nenhuma rota nova
      for (const l of selLinhas) {
        await fetch(`/api/empresas/${id}/estoque/recebimentos/${l.nfeId}/adiar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adiar }),
        })
      }
      setSel([])
      await recarregar()
    } finally { setBulkBusy(false) }
  }

  if (data === undefined) return <Card><CardContent className="flex items-center gap-2 p-6 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</CardContent></Card>
  if (data === null) return <Card><CardContent className="p-6 text-sm text-slate-500">Não consegui carregar os recebimentos.</CardContent></Card>
  const r = data.recebimentos

  const totais: TotalItem[] = [
    { chave: 'fila', label: 'Na fila', tone: 'sky', valor: soma(naFila), n: naFila.length, onClick: () => setFiltro('aguardando') },
    { chave: 'depois', label: 'Pra depois', tone: 'slate', valor: soma(praDepois), n: praDepois.length, onClick: () => setFiltro('depois') },
    { chave: 'recebidas', label: 'Recebidas', tone: 'emerald', valor: soma(recebidas), n: recebidas.length, onClick: () => setFiltro('recebida') },
  ]

  return (
    <div className="space-y-3 pb-4">
      {/* ── 2. TÍTULO + AÇÕES à direita ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Inbox className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Recebimentos</h1>
        <p className="hidden min-w-[16rem] flex-1 truncate text-xs text-slate-400 lg:block">Notas emitidas contra o CNPJ da empresa, direto da SEFAZ — a fila enche sozinha a partir de {fmt(r.dataCorte)}</p>
        <div className="ml-auto flex items-center gap-1.5">
          {/* CSV do que está NA TELA (já filtrado/ordenado) — sem rota nova */}
          <button
            onClick={() => baixarCsv(`recebimentos-${hojeArquivo()}`,
              ['Fornecedor', 'CNPJ', 'Data', 'Itens', 'Valor', 'Esperando (dias)', 'Status'],
              filtradas.map((l) => [l.fornecedor, l.cnpj ?? '', fmt(l.data), l.nItens, l.valor, l.esperandoDias, CHIP[l.estado].label]))}
            disabled={filtradas.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => setBuscarAberto((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
            <Search className="h-3.5 w-3.5" /> Buscar pela chave
          </button>
          <a href={`/empresas/${id}/estoque/entrada-manual`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
            <PackageOpen className="h-3.5 w-3.5" /> Entrada manual
          </a>
        </div>
      </div>

      {buscarAberto && <BuscarChave id={id} onAchou={() => { setBuscarAberto(false); recarregar() }} onFechar={() => setBuscarAberto(false)} />}

      {/* ⭐ A FILA DE ENVIO (30/08) — some sozinho quando está vazia; a operadora não vê */}
      <CardFilaBoletos empresaId={id} />

      {/* ── 1. CARDS DE RESUMO ── */}
      <StatCardGrid>
        <StatCard tone="sky" label="Na fila" value={brl(soma(naFila))} sub={`${naFila.length} ${naFila.length === 1 ? 'nota' : 'notas'}`} icon={PackageOpen}
          onClick={() => setFiltro(filtro === 'aguardando' ? 'todas' : 'aguardando')} active={filtro === 'aguardando'} />
        <StatCard tone="slate" label="Pra depois" value={brl(soma(praDepois))} sub={`${praDepois.length} ${praDepois.length === 1 ? 'nota' : 'notas'}`} icon={MoonStar}
          onClick={() => setFiltro(filtro === 'depois' ? 'todas' : 'depois')} active={filtro === 'depois'} />
        <StatCard tone="emerald" label="Recebidas" value={brl(soma(recebidas))} sub={`${recebidas.length} ${recebidas.length === 1 ? 'entrada' : 'entradas'}`} icon={CheckCircle2}
          onClick={() => setFiltro(filtro === 'recebida' ? 'todas' : 'recebida')} active={filtro === 'recebida'} />
        <StatCard tone="violet" label="Último download" value={fmtDataHora(r.ultimoDownload)} sub={`${r.historicasCount} históricas`} icon={Archive} />
      </StatCardGrid>

      {/* ── 3. BARRA DE FILTROS numa linha ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative w-full max-w-[320px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar fornecedor ou CNPJ…" className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-sm" />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-9 shrink-0 rounded-lg border border-slate-300 px-2 text-xs text-slate-600">
          <option value="todas">Todas</option>
          <option value="aguardando">Aguardando</option>
          <option value="depois">Pra depois</option>
          <option value="recebida">Recebidas</option>
          <option value="manual">Entradas manuais</option>
        </select>
        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600">
          <Checkbox checked={soAtrasadas} onCheckedChange={(v) => setSoAtrasadas(!!v)} /> Só atrasadas (&gt;2d)
        </label>
        <span className="ml-auto text-xs tabular-nums text-slate-400">{filtradas.length} de {todas.length}</span>
      </div>

      {/* barra de seleção (ações em massa usando a MESMA rota por linha) */}
      {selLinhas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#185FA5]/30 bg-[#185FA5]/5 px-3 py-2">
          <span className="text-xs font-medium text-[#185FA5]">{selLinhas.length} selecionada(s)</span>
          <button onClick={() => bulkAdiar(true)} disabled={bulkBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {bulkBusy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <MoonStar className="h-3.5 w-3.5" />} deixar pra depois
          </button>
          <button onClick={() => bulkAdiar(false)} disabled={bulkBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            trazer de volta
          </button>
          <button onClick={() => setSel([])} className="ml-auto text-xs text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ── 4. TABELA ── */}
      {filtradas.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Inbox className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">{todas.length === 0 ? 'A fila está vazia — e é assim que começa.' : 'Nenhuma nota com esse filtro.'}</p>
          {todas.length === 0 && (<>
            <p className="max-w-lg text-xs text-slate-500">Nada do que já passou entra no estoque. Quando um fornecedor emitir uma nota a partir de {fmt(r.dataCorte)}, ela aparece aqui sozinha (a SEFAZ é consultada de hora em hora).</p>
            <a href={`/empresas/${id}/estoque/recebimentos/preview`} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#185FA5] px-4 py-2 text-sm font-medium text-[#185FA5] hover:bg-slate-50"><FlaskConical className="h-4 w-4" /> Testar a conferência (modo teste)</a>
          </>)}
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <table className="density-normal hidden w-full sm:table">
            <thead className="group/thead"><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-10 px-3 py-2">
                <Checkbox
                  checked={selecionaveis.length > 0 && selLinhas.length === selecionaveis.length}
                  onCheckedChange={(v) => setSel(v ? selecionaveis.map((l) => l.key) : [])}
                  aria-label="selecionar todas" />
              </th>
              <SortableTh campo="fornecedor" col={col} dir={dir} onSort={alternar}>Fornecedor</SortableTh>
              <SortableTh campo="data" col={col} dir={dir} onSort={alternar}>Data</SortableTh>
              <SortableTh campo="nItens" col={col} dir={dir} onSort={alternar} align="right">Itens</SortableTh>
              <SortableTh campo="valor" col={col} dir={dir} onSort={alternar} align="right">Valor</SortableTh>
              <SortableTh campo="espera" col={col} dir={dir} onSort={alternar} align="right">Esperando</SortableTh>
              <SortableTh campo="estado" col={col} dir={dir} onSort={alternar}>Status</SortableTh>
              <th className="w-10 px-3 py-2" />
            </tr></thead>
            <tbody>
              {filtradas.map((l) => {
                const marcada = sel.includes(l.key)
                const podeSelecionar = !!l.nfeId && (l.estado === 'aguardando' || l.estado === 'depois')
                return (
                  <tr key={l.key} className={`border-b border-l-2 border-slate-50 last:border-b-0 hover:bg-slate-50 ${BORDA[l.estado]} ${marcada ? 'bg-[#185FA5]/5' : ''}`}>
                    <td className="px-3 py-1">
                      {podeSelecionar && <Checkbox checked={marcada} onCheckedChange={() => setSel((s) => marcada ? s.filter((x) => x !== l.key) : [...s, l.key])} aria-label={`selecionar ${l.fornecedor}`} />}
                    </td>
                    <td className="px-3 py-1 text-[13px]">
                      {l.href ? <a href={l.href} className="font-medium text-slate-800 hover:text-[#185FA5]">{l.fornecedor}</a> : <span className="font-medium text-slate-800">{l.fornecedor}</span>}
                      <span className="block text-[11px] tabular-nums text-slate-400">
                        {l.cnpj ? fmtCnpj(l.cnpj) : l.estado === 'manual' ? 'sem nota' : ''}
                        {l.cancelada && <b className="ml-1 text-rose-600">CANCELADA</b>}
                        {l.divergente && <span className="ml-1 text-amber-700">divergência</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-[13px] tabular-nums text-slate-500">{fmt(l.data)}</td>
                    <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">{l.nItens ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-1 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(l.valor)}</td>
                    <td className={`whitespace-nowrap px-3 py-1 text-right text-[13px] tabular-nums ${(l.esperandoDias ?? 0) > 5 ? 'font-semibold text-rose-600' : (l.esperandoDias ?? 0) > 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {l.estado === 'depois' ? <span className="text-slate-300">silenciada</span> : l.esperandoDias != null && l.esperandoDias > 0 ? `${l.esperandoDias}d` : '—'}
                    </td>
                    <td className="px-3 py-1"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP[l.estado].cls}`}>{CHIP[l.estado].label}</span></td>
                    <td className="px-3 py-1 text-right"><AcoesLinha l={l} id={id} onMudou={recarregar} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* MOBILE — cards empilhados (intocado no espírito: o dono confere no celular) */}
          <div className="divide-y divide-slate-50 sm:hidden">
            {filtradas.map((l) => (
              <div key={l.key} className={`border-l-2 p-4 ${BORDA[l.estado]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {l.href ? <a href={l.href} className="truncate text-sm font-medium text-slate-900">{l.fornecedor}</a> : <p className="truncate text-sm font-medium text-slate-900">{l.fornecedor}</p>}
                    <p className="text-xs text-slate-500">{fmt(l.data)}{l.nItens != null ? ` · ${l.nItens} ${l.nItens === 1 ? 'item' : 'itens'}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(l.valor)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP[l.estado].cls}`}>{CHIP[l.estado].label}</span>
                  <AcoesLinha l={l} id={id} onMudou={recarregar} />
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* ── 5. RÉGUA DE TOTAIS ── */}
      {todas.length > 0 && <TotalsBar itens={totais} totalLabel="Total geral" />}

      {/* HISTÓRICAS — visíveis, sem ação (regra do corte: não entram no estoque) */}
      <div>
        <button onClick={() => setVerHistoricas((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100">
          <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> {r.historicasCount} notas históricas (antes de {fmt(r.dataCorte)})</span>
          <span className="text-xs text-slate-400">{verHistoricas ? 'ocultar' : 'ver'}</span>
        </button>
        {verHistoricas && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-slate-50 p-4 text-xs text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{r.historicasCount} notas de {fmt(r.historicasPeriodo.de)} a {fmt(r.historicasPeriodo.ate)} — a mercadoria delas já foi recebida e consumida. Ficam aqui só pra consulta: <b>não entram no estoque</b> (senão criariam estoque fantasma). O estoque começa do zero, daqui pra frente.</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** menu "..." por linha — as MESMAS ações que existiam, agora agrupadas */
function AcoesLinha({ l, id, onMudou }: { l: Linha; id: string; onMudou: () => void }) {
  const [busy, setBusy] = useState(false)
  // ⭐ renegociar mudou de casa (30/08): saiu da tela de boletos — que era uma 2ª lista de
  // dívida — e passou a abrir da própria NOTA, que é o documento que se renegocia.
  const [ajustando, setAjustando] = useState(false)
  const [recusando, setRecusando] = useState(false)

  const adiar = async (v: boolean) => {
    if (!l.nfeId) return
    setBusy(true)
    try {
      await fetch(`/api/empresas/${id}/estoque/recebimentos/${l.nfeId}/adiar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adiar: v }) })
      onMudou()
    } finally { setBusy(false) }
  }
  return (
    <>
    {ajustando && l.nfeId && (
      <AjustarParcelasDaNota empresaId={id} nfeId={l.nfeId} onFechar={() => setAjustando(false)} onSalvo={onMudou} />
    )}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={`ações de ${l.fornecedor}`}>
          {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {l.href && <DropdownMenuItem asChild><a href={l.href} className="cursor-pointer"><ChevronRight className="mr-2 h-3.5 w-3.5" /> Conferir mercadoria</a></DropdownMenuItem>}
        {l.reciboHref && <DropdownMenuItem asChild><a href={l.reciboHref} className="cursor-pointer"><Receipt className="mr-2 h-3.5 w-3.5" /> Ver recibo</a></DropdownMenuItem>}
        {l.nfeId && l.estado === 'recebida' && (
          <DropdownMenuItem onClick={() => setAjustando(true)}>
            <Receipt className="mr-2 h-3.5 w-3.5" /> Ajustar parcelas (renegociou?)
          </DropdownMenuItem>
        )}
        {l.nfeId && (l.estado === 'aguardando' || l.estado === 'depois') && (<>
          <DropdownMenuSeparator />
          {l.estado === 'aguardando'
            ? <DropdownMenuItem onClick={() => adiar(true)}><MoonStar className="mr-2 h-3.5 w-3.5" /> Deixar pra depois</DropdownMenuItem>
            : <DropdownMenuItem onClick={() => adiar(false)}><PackageOpen className="mr-2 h-3.5 w-3.5" /> Trazer de volta pra fila</DropdownMenuItem>}
          {/* ⛔⛔ RECUSAR ≠ EXCLUIR: a nota existe na SEFAZ contra o CNPJ do dono. Sai da fila
              ativa, vai pra "Recusadas" com motivo e rastro, e volta se a mercadoria aparecer. */}
          <DropdownMenuItem onClick={() => setRecusando(true)} className="text-rose-600">
            <Ban className="mr-2 h-3.5 w-3.5" /> Recusar nota
          </DropdownMenuItem>
        </>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {recusando && l.nfeId && (
      <ModalRecusa empresaId={id} nfeId={l.nfeId} fornecedor={l.fornecedor} onFechar={() => setRecusando(false)} />
    )}
    </>
  )
}

/**
 * ⭐⭐ RECUSAR — motivo de lista FECHADA + observação livre, com preview do que será desfeito.
 *
 * ⚠️ A lista é fechada de propósito: são os 3 casos reais do negócio, e cada um mapeia numa
 * manifestação fiscal diferente. Texto livre viraria 20 jeitos de escrever a mesma coisa e o
 * dia da manifestação seria arqueologia.
 *
 * ⛔ E RECUSAR NÃO MANDA NADA PRA SEFAZ — a tela DIZ isso, pra ninguém achar que manifestou.
 */
function ModalRecusa({ empresaId, nfeId, fornecedor, onFechar }: {
  empresaId: string; nfeId: string; fornecedor: string; onFechar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [obs, setObs] = useState('')
  const [prev, setPrev] = useState<{ sugestoes: number; movimentos: number; bloqueio: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/estoque/recebimentos/${nfeId}/recusar`)
      .then((r) => r.json()).then((j) => setPrev(j.preview ?? null)).catch(() => {})
  }, [empresaId, nfeId])

  const recusar = async () => {
    if (!motivo) return
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/recebimentos/${nfeId}/recusar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'RECUSAR', motivo, observacao: obs || undefined }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui recusar.'); return }
      window.location.reload()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-slate-900">Recusar a nota de {fornecedor}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          A nota <b>continua existindo</b> na SEFAZ e no sistema — ela só sai da fila e vai pra
          &quot;Recusadas&quot;. Você pode reabrir se a mercadoria aparecer.
        </p>

        {prev?.bloqueio && <p className="mt-2 rounded bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">{prev.bloqueio}</p>}

        <div className="mt-3 space-y-1.5">
          {[
            ['NAO_CHEGOU', 'Não chegou', 'a mercadoria nunca veio'],
            ['RECUSADA_NA_ENTREGA', 'Recusada na entrega', 'veio errada e foi devolvida na porta'],
            ['NAO_E_MINHA', 'Não é minha', 'emitida por engano contra meu CNPJ'],
          ].map(([v, titulo, ajuda]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 ${motivo === v ? 'border-[#185FA5] bg-blue-50/50' : 'border-slate-200'}`}>
              <input type="radio" name="motivo" value={v} checked={motivo === v} onChange={() => setMotivo(v)} className="mt-0.5" />
              <span className="text-xs"><b className="text-slate-800">{titulo}</b><span className="block text-[11px] text-slate-500">{ajuda}</span></span>
            </label>
          ))}
        </div>

        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
          placeholder="observação (opcional) — ex: falei com o vendedor, vai cancelar"
          className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />

        {prev && (prev.sugestoes > 0 || prev.movimentos > 0) && !prev.bloqueio && (
          <p className="mt-2 rounded bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            Isto vai desfazer: {prev.sugestoes > 0 && <>{prev.sugestoes} parcela(s) de contas a pagar</>}
            {prev.sugestoes > 0 && prev.movimentos > 0 && ' e '}
            {prev.movimentos > 0 && <>{prev.movimentos} movimento(s) de estoque (estorno, o histórico fica)</>}.
          </p>
        )}
        <p className="mt-2 text-[10px] text-slate-400">
          ⚠️ Recusar aqui <b>não</b> manifesta nada na SEFAZ. Desconhecimento / operação não realizada
          têm prazo legal — combine com o contador.
        </p>
        {erro && <p className="mt-2 text-xs text-rose-600">{erro}</p>}

        <div className="mt-3 flex items-center gap-2">
          <button onClick={recusar} disabled={!motivo || busy || !!prev?.bloqueio}
            className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40">
            {busy ? 'Recusando…' : 'Recusar nota'}
          </button>
          <button onClick={onFechar} className="text-xs text-slate-500 hover:text-slate-700">cancelar</button>
        </div>
      </div>
    </div>
  )
}

function BuscarChave({ id, onAchou, onFechar }: { id: string; onAchou: () => void; onFechar: () => void }) {
  const [chave, setChave] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const digitos = chave.replace(/\D/g, '')

  const buscar = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/recebimentos/buscar-chave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave: digitos }) })
      const j = await r.json().catch(() => null)
      setMsg({ ok: !!j?.ok, texto: j?.motivo ?? 'Não consegui buscar.' })
      if (j?.ok) { setChave(''); onAchou() }
    } catch { setMsg({ ok: false, texto: 'Falha de conexão.' }) } finally { setBusy(false) }
  }

  return (
    <Card><CardContent className="space-y-2 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Search className="h-4 w-4" /> Buscar nota pela chave</p>
      <p className="text-xs text-slate-500">Os 44 dígitos da chave de acesso do DANFE. A gente consulta a SEFAZ e coloca a nota na fila.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={chave} onChange={(e) => setChave(e.target.value)} inputMode="numeric" placeholder="chave de 44 dígitos" className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 text-sm tabular-nums" />
        <span className={`text-xs tabular-nums ${digitos.length === 44 ? 'text-emerald-600' : 'text-slate-400'}`}>{digitos.length}/44</span>
        <button onClick={buscar} disabled={busy || digitos.length !== 44} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#185FA5] px-4 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50">{busy ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar</button>
        <button onClick={onFechar} className="text-xs text-slate-400 hover:text-slate-600">fechar</button>
      </div>
      {/* ⚠️ RECUSA EM SILÊNCIO, NÃO (a família do "não declarou o total" que dizia três
          coisas diferentes): digitar NOME aqui deixava o botão inerte sem explicar. */}
      {digitos.length === 0 && chave.trim() !== '' && (
        <p className="text-xs text-amber-700">
          Aqui vão os <b>44 dígitos</b> da chave de acesso. Pra achar por <b>fornecedor</b>,
          use a busca da lista, logo abaixo.
        </p>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.texto}</p>}
    </CardContent></Card>
  )
}
