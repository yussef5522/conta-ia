'use client'

// Client component da DRE (Sub-etapa 5.4.B).
// Filtros persistidos em URL params (deep-linking), fetch via /api/empresas/[id]/dre,
// integra DRETable + DREDrillDown.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Breadcrumb } from '@/components/sidebar/breadcrumb'
import { buildBreadcrumb } from '@/lib/sidebar/breadcrumb-helper'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DRETable, type DREResult } from './dre-table'
import { DREDrillDown } from './dre-drill-down'
import { HealthBanner } from './health-banner'
import { KPIGrid } from './kpi-grid'
import {
  PRESET_LABELS,
  PRESET_ORDER,
  calculatePresetDates,
  detectPreset,
  type PeriodPreset,
} from '@/lib/dre/presets'
import { formatDateInputBR } from '@/lib/format/dre'
import { calculateKPIs } from '@/lib/dre/kpis'

type Regime = 'competence' | 'cash'
type ComparisonType =
  | 'none'
  | 'previous_period'
  | 'same_period_last_year'
  | 'previous_year'
  | 'ytd_vs_ytd'

const COMPARISON_LABELS: Record<ComparisonType, string> = {
  none: 'Sem comparação',
  previous_period: 'Período anterior',
  same_period_last_year: 'Mesmo período ano anterior',
  previous_year: 'Ano anterior completo',
  ytd_vs_ytd: 'Acumulado YTD vs YTD anterior',
}

interface Props {
  empresaId: string
  empresaNome: string
}

export function DREClient({ empresaId, empresaNome }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Estado dos filtros (vem da URL ou usa default = mês atual).
  // useMemo só na 1ª renderização — depois useState mantém tudo.
  const initialFilters = useMemo(() => {
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')
    const regimeParam = searchParams.get('regime') as Regime | null
    const comparisonParam = searchParams.get('comparison') as ComparisonType | null

    let startDate: Date
    let endDate: Date

    if (startParam && endParam) {
      const s = new Date(startParam)
      const e = new Date(endParam)
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        startDate = s
        endDate = e
      } else {
        const dates = calculatePresetDates('current_month')
        startDate = dates.startDate
        endDate = dates.endDate
      }
    } else {
      const dates = calculatePresetDates('current_month')
      startDate = dates.startDate
      endDate = dates.endDate
    }

    return {
      startDate,
      endDate,
      regime: (regimeParam ?? 'competence') as Regime,
      comparison: (comparisonParam ?? 'previous_period') as ComparisonType,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [startDate, setStartDate] = useState(initialFilters.startDate)
  const [endDate, setEndDate] = useState(initialFilters.endDate)
  const [regime, setRegime] = useState<Regime>(initialFilters.regime)
  const [comparison, setComparison] = useState<ComparisonType>(initialFilters.comparison)

  const [data, setData] = useState<DREResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null)

  // Atualiza URL quando filtros mudam (replace pra não poluir histórico)
  const updateURL = useCallback(
    (filters: {
      startDate: Date
      endDate: Date
      regime: Regime
      comparison: ComparisonType
    }) => {
      const params = new URLSearchParams()
      params.set('startDate', filters.startDate.toISOString())
      params.set('endDate', filters.endDate.toISOString())
      params.set('regime', filters.regime)
      params.set('comparison', filters.comparison)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router],
  )

  const fetchDRE = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('startDate', startDate.toISOString())
      params.set('endDate', endDate.toISOString())
      params.set('regime', regime)
      if (comparison !== 'none') {
        params.set('comparison', comparison)
      }

      const res = await fetch(`/api/empresas/${empresaId}/dre?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao carregar DRE')
      }

      const json: DREResult = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId, startDate, endDate, regime, comparison])

  useEffect(() => {
    fetchDRE()
  }, [fetchDRE])

  // Atualiza URL inicial caso a página foi aberta sem params
  useEffect(() => {
    if (!searchParams.get('startDate')) {
      updateURL({ startDate, endDate, regime, comparison })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyPreset(preset: PeriodPreset) {
    if (preset === 'custom') return
    const dates = calculatePresetDates(preset)
    setStartDate(dates.startDate)
    setEndDate(dates.endDate)
    updateURL({ startDate: dates.startDate, endDate: dates.endDate, regime, comparison })
  }

  function handleApply() {
    updateURL({ startDate, endDate, regime, comparison })
    fetchDRE()
  }

  const currentPreset = useMemo(
    () => detectPreset(startDate, endDate),
    [startDate, endDate],
  )

  const periodLabel = useMemo(() => {
    if (currentPreset !== 'custom') return PRESET_LABELS[currentPreset]
    return `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`
  }, [currentPreset, startDate, endDate])

  const breadcrumbItems = buildBreadcrumb({
    pathname,
    empresaName: empresaNome,
    empresaId,
  })

  return (
    <div className="container max-w-7xl py-8 space-y-6">
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📊 DRE — {periodLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresaNome} · Regime de {regime === 'competence' ? 'Competência' : 'Caixa'}
            {comparison !== 'none' && ` · vs ${COMPARISON_LABELS[comparison]}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDRE} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Período</Label>
            <Select
              value={currentPreset}
              onValueChange={(v) => applyPreset(v as PeriodPreset)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date" className="text-xs">
              Data Início
            </Label>
            <Input
              id="start-date"
              type="date"
              value={formatDateInputBR(startDate)}
              onChange={(e) => {
                if (!e.target.value) return
                const d = new Date(e.target.value + 'T00:00:00')
                setStartDate(d)
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date" className="text-xs">
              Data Fim
            </Label>
            <Input
              id="end-date"
              type="date"
              value={formatDateInputBR(endDate)}
              onChange={(e) => {
                if (!e.target.value) return
                const d = new Date(e.target.value + 'T23:59:59')
                setEndDate(d)
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Regime</Label>
            <Select value={regime} onValueChange={(v) => setRegime(v as Regime)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="competence">Competência</SelectItem>
                <SelectItem value="cash">Caixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Comparar com</Label>
            <Select
              value={comparison}
              onValueChange={(v) => setComparison(v as ComparisonType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COMPARISON_LABELS) as ComparisonType[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {COMPARISON_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleApply} className="w-full md:w-auto">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Banner de Saúde Financeira + 12 KPIs (Sub-etapa 5.4.C) */}
      {data && !isLoading && (() => {
        const kpis = calculateKPIs(data)
        return (
          <>
            <HealthBanner health={kpis.health} />
            <KPIGrid kpis={kpis} />
          </>
        )
      })()}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <Card className="p-8">
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </Card>
      )}

      {/* Tabela DRE */}
      {data && !isLoading && (
        <DRETable
          data={data}
          onCategoryClick={(catId) => setDrillCategoryId(catId)}
        />
      )}

      {/* Sidebar de drill-down */}
      {drillCategoryId && (
        <DREDrillDown
          empresaId={empresaId}
          categoryId={drillCategoryId}
          startDate={startDate}
          endDate={endDate}
          regime={regime}
          onClose={() => setDrillCategoryId(null)}
        />
      )}
    </div>
  )
}

