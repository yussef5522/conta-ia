'use client'

// Sprint Análise de Variação (28/05/2026) — UI cliente.
// Padrão padronizado: filtros + resumo + waterfall + tabela drivers.

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { WaterfallChartSvgDynamic } from '@/components/relatorios/analise-variacao/WaterfallChartSvgWrapper'
import {
  computeTabelaHeaders,
  type AnaliseVariacaoResult,
  type ComparacaoMode,
  type DriverVariacao,
} from '@/lib/relatorios/analise-variacao'
import type { ComparativoTipoFilter } from '@/lib/relatorios/comparativo'

const MES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function generateRefMonthOptions(currentRef: string): string[] {
  const [y, m] = currentRef.split('-').map(Number)
  const result: string[] = []
  let year = y
  let month = m
  for (let i = 0; i < 12; i++) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month--
    if (month < 1) {
      month = 12
      year--
    }
  }
  return result
}

function labelForRef(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES[m - 1]}/${String(y).slice(-2)}`
}

function formatPctSigned(v: number | null): string {
  if (v === null) return '—'
  const pct = v * 100
  const formatted = pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return pct >= 0 ? `+${formatted}%` : `${formatted}%`
}

interface Props {
  empresaId: string
}

export function AnaliseVariacaoClient({ empresaId }: Props) {
  const { toast } = useToast()
  const today = currentYearMonth()
  const lastMonth = useMemo(() => {
    const opts = generateRefMonthOptions(today)
    return opts[1] ?? opts[0]
  }, [today])

  const [mesInvestigado, setMesInvestigado] = useState(today)
  const [mode, setMode] = useState<ComparacaoMode>('mes-vs-mes')
  const [ymComparacao, setYmComparacao] = useState(lastMonth)
  const [nMesesContexto, setNMesesContexto] = useState(6)
  const [tipo, setTipo] = useState<ComparativoTipoFilter>('DESPESA')

  const [data, setData] = useState<AnaliseVariacaoResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [executed, setExecuted] = useState(false)

  const refOptions = useMemo(() => generateRefMonthOptions(today), [today])

  function handleAnalisar() {
    if (mode === 'mes-vs-mes' && mesInvestigado === ymComparacao) {
      toast({
        variant: 'destructive',
        title: 'Períodos iguais',
        description: 'Escolha 2 meses diferentes pra comparar.',
      })
      return
    }
    setLoading(true)
    setExecuted(true)

    const params = new URLSearchParams({
      mesInvestigado,
      mode,
      tipo,
      topNDrivers: '10',
    })
    if (mode === 'mes-vs-mes') {
      params.set('ymComparacao', ymComparacao)
    } else {
      params.set('nMesesContexto', String(nMesesContexto))
    }

    fetch(
      `/api/empresas/${empresaId}/relatorios/analise-variacao?${params}`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d as AnaliseVariacaoResult))
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Falha ao carregar',
          description: 'Tente novamente.',
        })
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Investigar:</Label>
              <Select value={mesInvestigado} onValueChange={setMesInvestigado}>
                <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {refOptions.map((ym) => (
                    <SelectItem key={ym} value={ym}>
                      {labelForRef(ym)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm">Tipo:</Label>
              <Select
                value={tipo}
                onValueChange={(v) => setTipo(v as ComparativoTipoFilter)}
              >
                <SelectTrigger className="w-auto min-w-[110px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESPESA">Despesas</SelectItem>
                  <SelectItem value="RECEITA">Receitas</SelectItem>
                  <SelectItem value="TODOS">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Comparar com:</Label>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="mes-vs-mes"
                  checked={mode === 'mes-vs-mes'}
                  onChange={() => setMode('mes-vs-mes')}
                  className="cursor-pointer"
                />
                <span className="text-sm">Outro mês:</span>
                <Select
                  value={ymComparacao}
                  onValueChange={setYmComparacao}
                  disabled={mode !== 'mes-vs-mes'}
                >
                  <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {refOptions.map((ym) => (
                      <SelectItem key={ym} value={ym}>
                        {labelForRef(ym)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="mes-vs-media"
                  checked={mode === 'mes-vs-media'}
                  onChange={() => setMode('mes-vs-media')}
                  className="cursor-pointer"
                />
                <span className="text-sm">Média dos últimos</span>
                <Select
                  value={String(nMesesContexto)}
                  onValueChange={(v) => setNMesesContexto(Number(v))}
                  disabled={mode !== 'mes-vs-media'}
                >
                  <SelectTrigger className="w-auto min-w-[70px] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm">meses</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleAnalisar} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analisar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!executed && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm font-medium">
              Pronto pra investigar a variação
            </p>
            <p className="text-xs mt-1">
              Selecione um mês e o ponto de comparação acima, clique em
              Analisar.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && executed && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-sm">Decompondo a variação…</p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Resumo executivo */}
          <ResumoCard data={data} />

          {/* Waterfall chart (Sprint Redesign McKinsey) */}
          <Card>
            <CardContent className="py-5">
              {/* Título dinâmico narrativo — substitui "Cascata da variação" */}
              <h3 className="text-base font-semibold mb-1 leading-snug">
                {data.tituloNarrativo}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Cada barra mostra o impacto de uma categoria. Linhas
                pontilhadas conectam o efeito acumulado.
              </p>
              <WaterfallChartSvgDynamic bars={data.waterfallBars} />
            </CardContent>
          </Card>

          {/* Tabela drivers — ANTIGO esquerda, NOVO direita (hotfix cronológica) */}
          {(() => {
            const headers = computeTabelaHeaders({
              modo: mode,
              novoLabel: data.novoLabel,
              antigoLabel: data.antigoLabel,
              nMesesContexto,
            })
            return (
              <DriversTabela
                drivers={data.drivers}
                labelAntigo={headers.labelAntigo}
                labelNovo={headers.labelNovo}
              />
            )
          })()}

          {/* Validação aritmética */}
          <ValidacaoArit data={data} />
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────

function ResumoCard({ data }: { data: AnaliseVariacaoResult }) {
  const aumentou = data.diferencaTotal > 0
  const corBorda = aumentou
    ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20'
    : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20'
  const corTexto = aumentou
    ? 'text-red-700 dark:text-red-300'
    : 'text-emerald-700 dark:text-emerald-300'
  const Icon = aumentou ? TrendingUp : TrendingDown
  return (
    <Card className={`border ${corBorda}`}>
      <CardContent className="py-5 space-y-2">
        {/* Hotfix cronológica: ANTIGO esquerda, NOVO direita, Diferença = novo - antigo */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {data.antigoLabel}
            </p>
            <p className="text-xl font-semibold tabular-nums mt-0.5 text-muted-foreground">
              {formatBRL(data.totalAntigo)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {data.novoLabel}
            </p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">
              {formatBRL(data.totalNovo)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Diferença
            </p>
            <p
              className={`text-2xl font-bold tabular-nums mt-0.5 ${corTexto} flex items-center gap-1`}
            >
              <Icon className="h-5 w-5" />
              {data.diferencaTotal >= 0 ? '+' : ''}
              {formatBRL(data.diferencaTotal)}
              <span className="text-sm font-medium ml-1">
                ({formatPctSigned(data.percentualTotal)})
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DriversTabela({
  drivers,
  labelAntigo,
  labelNovo,
}: {
  drivers: DriverVariacao[]
  labelAntigo: string
  labelNovo: string
}) {
  // Filtra os "estavel" pra mostrar só drivers relevantes
  const visiveis = drivers.filter((d) => d.tipo !== 'estavel')

  if (visiveis.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p className="text-sm">
            Nenhuma categoria com variação significativa entre os 2 períodos.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Hotfix cronológica: ANTIGO esquerda (col 2), NOVO direita (col 3).
  // Labels uppercase pra header consistente.
  const headerAntigo = labelAntigo.toUpperCase()
  const headerNovo = labelNovo.toUpperCase()

  return (
    <Card>
      <CardContent className="py-3">
        <h3 className="text-sm font-semibold mb-3 px-2">
          Onde foi a diferença ({visiveis.length} drivers)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Categoria</th>
                <th
                  className="text-right px-3 py-2 font-medium"
                  data-testid="header-antigo"
                >
                  {headerAntigo}
                </th>
                <th
                  className="text-right px-3 py-2 font-medium"
                  data-testid="header-novo"
                >
                  {headerNovo}
                </th>
                <th className="text-right px-3 py-2 font-medium">Diferença</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((d) => (
                <DriverRow key={d.categoryId ?? '__sem__'} d={d} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DriverRow({ d }: { d: DriverVariacao }) {
  const tipoMeta: Record<
    DriverVariacao['tipo'],
    { icon: typeof Plus; label: string; tone: string; bgRow: string }
  > = {
    aumentou: {
      icon: Plus,
      label: 'aumentou',
      tone: 'text-red-600 dark:text-red-400',
      bgRow: '',
    },
    reduziu: {
      icon: Minus,
      label: 'reduziu',
      tone: 'text-emerald-600 dark:text-emerald-400',
      bgRow: '',
    },
    estavel: {
      icon: Plus,
      label: 'estavel',
      tone: 'text-slate-400',
      bgRow: '',
    },
  }
  const m = tipoMeta[d.tipo]
  const Icon = m.icon
  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/20"
      data-testid={`driver-${d.categoryId ?? 'none'}`}
    >
      <td className="px-3 py-2.5">
        <div className="font-medium">{d.categoryName}</div>
        {d.dreGroup && (
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
            {d.dreGroup.replace(/_/g, ' ').toLowerCase()}
          </div>
        )}
      </td>
      {/* Hotfix cronológica: ANTIGO esquerda, NOVO direita */}
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
        {d.valorAntigo > 0 ? formatBRL(d.valorAntigo) : '—'}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {d.valorNovo > 0 ? formatBRL(d.valorNovo) : '—'}
      </td>
      <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${m.tone}`}>
        {d.diferenca >= 0 ? '+' : ''}
        {formatBRL(d.diferenca)}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-flex items-center gap-1 text-xs uppercase tracking-wide ${m.tone}`}
        >
          <Icon className="h-3 w-3" />
          {m.label}
        </span>
      </td>
    </tr>
  )
}

function ValidacaoArit({ data }: { data: AnaliseVariacaoResult }) {
  if (data.aritmeticaFecha) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400 italic text-center flex items-center justify-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Aritmética fecha: soma dos drivers = diferença total
        {data.aritmeticaResiduo > 0 && (
          <span className="text-muted-foreground">
            (resíduo R$ {data.aritmeticaResiduo.toFixed(4)})
          </span>
        )}
      </p>
    )
  }
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 italic text-center flex items-center justify-center gap-1.5">
      <AlertCircle className="h-3.5 w-3.5" />
      Atenção: resíduo aritmético R$ {data.aritmeticaResiduo.toFixed(2)}
    </p>
  )
}
