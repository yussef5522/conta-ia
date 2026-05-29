'use client'

// Sprint Drill-Down (29/05/2026) — Modal central genérico.
//
// Usado por Comparativo + Análise de Variação pra investigar "de onde veio
// esse número?" sem sair da tela do relatório. Decisões de produto:
//
// - Coluna "Estado" visível (Yussef Ajuste 1) — distingue PAGA (EFFECTED)
//   vs PENDENTE (PAYABLE/RECEIVABLE) pra eliminar ambiguidade.
// - Filtro "Mostrar: Todas / Só pagas / Só pendentes".
// - Stats topo: total + breakdown pagas/pendentes com qtd e valor.
// - Link 🔗 (Yussef Ajuste 2): /contas-a-pagar com search={fornecedor}
//   + dataDe/dataAte = bucketDate ± 1 dia pra filtrar pra 1-3 itens.
//
// Sem `?focusId=` ainda (sprint futura).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, Search, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { formatBRL } from '@/lib/format/money'

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface DrillDownTransacao {
  id: string
  bucketDate: string // ISO
  date: string
  competenceDate: string | null
  paymentDate: string | null
  description: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER'
  amount: number
  signedAmount: number
  favorecido: string | null
  favorecidoTipo: 'supplier' | 'employee' | 'customer' | null
  lifecycle: 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE'
  status: 'RECONCILED' | 'PENDING' | 'IGNORED'
}

export interface DrillDownResponse {
  categoria: { id: string; name: string; dreGroup: string | null }
  total: number
  qtd: number
  truncated: boolean
  breakdown: {
    pagas: { qtd: number; total: number }
    pendentes: { qtd: number; total: number }
  }
  transacoes: DrillDownTransacao[]
}

export interface DrillDownPeriodo {
  dataInicio: string // YYYY-MM-DD
  dataFim: string
  label: string // pra header "Janeiro/2026"
}

type EstadoFilter = 'todas' | 'pagas' | 'pendentes'
type OrdenacaoOpt = 'data-desc' | 'valor-desc'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresaId: string
  categoriaId: string
  categoriaName: string
  periodo: DrillDownPeriodo
  regime?: 'competencia' | 'caixa'
  tipo?: 'DESPESA' | 'RECEITA' | 'TODOS'
}

// ──────────────────────────────────────────────────────────────
// Helpers (puros — exportados pra teste)
// ──────────────────────────────────────────────────────────────

export function formatDataBR(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getUTCFullYear()}`
}

export function buildContasPagarHref(
  empresaId: string,
  tx: Pick<DrillDownTransacao, 'favorecido' | 'bucketDate'>,
): string {
  const params = new URLSearchParams({ empresaId })
  if (tx.favorecido) params.set('search', tx.favorecido)
  // Janela ±1 dia em torno do bucketDate (Yussef Ajuste 2)
  const d = new Date(tx.bucketDate)
  const back = new Date(d)
  back.setUTCDate(back.getUTCDate() - 1)
  const fwd = new Date(d)
  fwd.setUTCDate(fwd.getUTCDate() + 1)
  params.set('dataDe', back.toISOString().slice(0, 10))
  params.set('dataAte', fwd.toISOString().slice(0, 10))
  return `/contas-a-pagar?${params.toString()}`
}

export function filterTransacoes(
  txs: DrillDownTransacao[],
  estado: EstadoFilter,
  q: string,
): DrillDownTransacao[] {
  const qNorm = q.trim().toLowerCase()
  return txs.filter((t) => {
    if (estado === 'pagas' && t.lifecycle !== 'EFFECTED') return false
    if (estado === 'pendentes' && t.lifecycle === 'EFFECTED') return false
    if (!qNorm) return true
    return (
      t.description.toLowerCase().includes(qNorm) ||
      (t.favorecido?.toLowerCase().includes(qNorm) ?? false)
    )
  })
}

export function sortTransacoes(
  txs: DrillDownTransacao[],
  ord: OrdenacaoOpt,
): DrillDownTransacao[] {
  const copy = [...txs]
  if (ord === 'valor-desc') {
    copy.sort((a, b) => b.amount - a.amount)
  } else {
    copy.sort(
      (a, b) =>
        new Date(b.bucketDate).getTime() - new Date(a.bucketDate).getTime(),
    )
  }
  return copy
}

// ──────────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────────

export function TransacaoDrillDownModal({
  open,
  onOpenChange,
  empresaId,
  categoriaId,
  categoriaName,
  periodo,
  regime = 'competencia',
  tipo = 'DESPESA',
}: Props) {
  const [data, setData] = useState<DrillDownResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [estado, setEstado] = useState<EstadoFilter>('todas')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoOpt>('data-desc')

  // Fetch quando abrir + reset state ao fechar
  useEffect(() => {
    if (!open) {
      setData(null)
      setErro(null)
      setBusca('')
      setEstado('todas')
      setOrdenacao('data-desc')
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setErro(null)
    const params = new URLSearchParams({
      categoriaId,
      dataInicio: periodo.dataInicio,
      dataFim: periodo.dataFim,
      regime,
      tipo,
    })
    fetch(
      `/api/empresas/${empresaId}/relatorios/drill-down/transacoes?${params}`,
      { credentials: 'include', signal: ctrl.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: DrillDownResponse) => setData(d))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setErro(e instanceof Error ? e.message : 'Erro desconhecido')
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [
    open,
    empresaId,
    categoriaId,
    periodo.dataInicio,
    periodo.dataFim,
    regime,
    tipo,
  ])

  const transacoesFiltradas = useMemo(() => {
    if (!data) return []
    return sortTransacoes(
      filterTransacoes(data.transacoes, estado, busca),
      ordenacao,
    )
  }, [data, estado, busca, ordenacao])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        data-testid="drill-down-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            <span className="text-foreground">{categoriaName}</span>
            <span className="text-muted-foreground font-normal text-sm ml-2">
              — {periodo.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Stats topo: total + breakdown */}
        {data && (
          <div className="grid grid-cols-3 gap-3 py-2 border-y">
            <Stat
              label="Total"
              value={formatBRL(data.total)}
              qtd={`${data.qtd} ${data.qtd === 1 ? 'transação' : 'transações'}`}
              tone="default"
            />
            <Stat
              label="Pagas"
              value={formatBRL(data.breakdown.pagas.total)}
              qtd={`${data.breakdown.pagas.qtd} ${data.breakdown.pagas.qtd === 1 ? 'transação' : 'transações'}`}
              tone="success"
            />
            <Stat
              label="Pendentes"
              value={formatBRL(data.breakdown.pendentes.total)}
              qtd={`${data.breakdown.pendentes.qtd} ${data.breakdown.pendentes.qtd === 1 ? 'transação' : 'transações'}`}
              tone="warning"
            />
          </div>
        )}

        {/* Filtros: busca + estado + ordenação */}
        <div className="flex flex-wrap gap-2 py-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por descrição ou fornecedor…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-7 h-9 text-sm"
              data-testid="drill-down-busca"
            />
          </div>
          <Select
            value={estado}
            onValueChange={(v) => setEstado(v as EstadoFilter)}
          >
            <SelectTrigger
              className="w-auto min-w-[140px] h-9 text-sm"
              data-testid="drill-down-estado"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="pagas">Só pagas</SelectItem>
              <SelectItem value="pendentes">Só pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={ordenacao}
            onValueChange={(v) => setOrdenacao(v as OrdenacaoOpt)}
          >
            <SelectTrigger className="w-auto min-w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="data-desc">Data ↓</SelectItem>
              <SelectItem value="valor-desc">Valor ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Truncated warning */}
        {data?.truncated && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Mostrando as primeiras 200 transações. Use a busca pra refinar.
          </div>
        )}

        {/* Tabela scrollável */}
        <div className="overflow-auto flex-1 -mx-2 px-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Carregando transações…
            </div>
          )}
          {erro && (
            <div className="py-8 text-center text-sm text-red-600 dark:text-red-400">
              Falha ao carregar: {erro}
            </div>
          )}
          {!loading && !erro && data && transacoesFiltradas.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma transação encontrada
              {busca || estado !== 'todas' ? ' com os filtros aplicados' : ''}.
            </div>
          )}
          {!loading && !erro && transacoesFiltradas.length > 0 && (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Data</th>
                  <th className="text-left py-2 pr-3 font-medium">Estado</th>
                  <th className="text-left py-2 pr-3 font-medium">
                    Fornecedor
                  </th>
                  <th className="text-left py-2 pr-3 font-medium">Descrição</th>
                  <th className="text-right py-2 pr-3 font-medium">Valor</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradas.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                    data-testid={`drill-down-tx-${t.id}`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDataBR(t.bucketDate)}
                    </td>
                    <td className="py-2 pr-3">
                      <EstadoBadge lifecycle={t.lifecycle} />
                    </td>
                    <td
                      className="py-2 pr-3 max-w-[180px] truncate"
                      title={t.favorecido ?? ''}
                    >
                      {t.favorecido ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td
                      className="py-2 pr-3 max-w-[280px] truncate"
                      title={t.description}
                    >
                      {t.description}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums whitespace-nowrap">
                      {formatBRL(t.amount)}
                    </td>
                    <td className="py-2 pr-1 text-right">
                      <Link
                        href={buildContasPagarHref(empresaId, t)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:text-primary/80"
                        title="Abrir em Contas a Pagar (nova aba)"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ──────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  qtd,
  tone,
}: {
  label: string
  value: string
  qtd: string
  tone: 'default' | 'success' | 'warning'
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground'
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className={`text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{qtd}</p>
    </div>
  )
}

function EstadoBadge({
  lifecycle,
}: {
  lifecycle: DrillDownTransacao['lifecycle']
}) {
  if (lifecycle === 'EFFECTED') {
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        data-testid="estado-paga"
      >
        Paga
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      data-testid="estado-pendente"
    >
      Pendente
    </span>
  )
}
