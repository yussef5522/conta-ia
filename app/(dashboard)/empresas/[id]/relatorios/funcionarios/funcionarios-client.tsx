'use client'

// Sprint 5.0.4.0b Fase 5 — UI Folha de Pagamento.

import { useEffect, useState } from 'react'
import { Loader2, Users, Calculator } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface Row {
  employeeId: string
  nome: string
  tipo: string
  ativo: boolean
  amount: number
  count: number
  percentDoTotal: number
}

interface TypeBucket {
  tipo: string
  count: number
  amount: number
  percent: number
}

interface ApiResponse {
  rows: Row[]
  byType: TypeBucket[]
  totals: {
    funcionariosPagos: number
    funcionariosAtivos: number
    valorTotal: number
    transacoesCount: number
    mediaPorFuncionario: number
  }
  period: { from: string; to: string }
  filterTipo: string | null
}

interface Props {
  empresaId: string
}

function defaultPeriod(): { from: string; to: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + 1
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: first, to: last }
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(v)
}

const TIPO_COLORS: Record<string, string> = {
  CLT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ESTAGIO: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  PJ: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  AUTONOMO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  OUTRO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function tipoBadgeClass(tipo: string): string {
  return TIPO_COLORS[tipo] ?? TIPO_COLORS.OUTRO
}

export function FuncionariosClient({ empresaId }: Props) {
  const { toast } = useToast()
  const initial = defaultPeriod()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [tipoFilter, setTipoFilter] = useState<string>('ALL')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (tipoFilter !== 'ALL') params.set('tipo', tipoFilter)
    fetch(`/api/empresas/${empresaId}/relatorios/funcionarios?${params}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {
        toast({ variant: 'destructive', title: 'Falha ao carregar' })
      })
      .finally(() => setLoading(false))
  }, [empresaId, from, to, tipoFilter, toast])

  const tiposDisponiveis = data ? data.byType.map((t) => t.tipo) : []

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">De:</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Até:</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Tipo:</label>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {tiposDisponiveis.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Calculando folha…</p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">Sem dados.</p>
          </CardContent>
        </Card>
      ) : data.totals.valorTotal === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">
              Sem pagamentos de funcionários no período
            </p>
            <p className="text-xs mt-1">
              {data.totals.funcionariosAtivos > 0
                ? `${data.totals.funcionariosAtivos} funcionários ativos cadastrados. Vincule pagamentos a eles via Contas a Pagar.`
                : 'Cadastre funcionários em Pessoas Vinculadas pra começar.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total folha
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-0.5">
                  {formatBRL(data.totals.valorTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.totals.transacoesCount} pagamento
                  {data.totals.transacoesCount !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Funcionários
                </p>
                <p className="text-2xl font-semibold tabular-nums mt-0.5">
                  {data.totals.funcionariosPagos}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.totals.funcionariosAtivos} ativos cadastrados
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 flex items-start gap-2">
                <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-1 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Média por funcionário
                  </p>
                  <p className="text-xl font-semibold tabular-nums mt-0.5">
                    {formatBRL(data.totals.mediaPorFuncionario)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown por tipo */}
          {data.byType.length > 0 && tipoFilter === 'ALL' && (
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
                  Breakdown por tipo
                </p>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {data.byType.map((t) => (
                    <div
                      key={t.tipo}
                      className="rounded-lg border p-3"
                      data-testid={`tipo-${t.tipo}`}
                    >
                      <Badge className={`${tipoBadgeClass(t.tipo)} text-[10px]`}>
                        {t.tipo}
                      </Badge>
                      <p className="text-sm font-semibold tabular-nums mt-1.5">
                        {formatBRL(t.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.count} func ·{' '}
                        <span className="tabular-nums">
                          {t.percent.toFixed(0)}%
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela */}
          <Card>
            <CardContent className="py-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="funcionarios-table">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide font-medium text-muted-foreground">
                      <th className="text-left px-3 py-2">Funcionário</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">% Folha</th>
                      <th className="text-right px-3 py-2">Pgtos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr
                        key={r.employeeId}
                        className="border-b last:border-0 hover:bg-muted/20"
                        data-testid={`funcionario-row-${r.employeeId}`}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{r.nome}</span>
                          {!r.ativo && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] text-muted-foreground"
                            >
                              inativo
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={`${tipoBadgeClass(r.tipo)} text-[10px]`}>
                            {r.tipo}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                          {formatBRL(r.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {r.percentDoTotal.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {r.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
