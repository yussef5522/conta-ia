'use client'

// Hotfix 5.0.4.0c1-fix — Seletor de período pra Análise IA.
// 7 presets + custom dates + botão Gerar. Validação 12 meses no front.

import { useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  PRESETS,
  validatePeriodLimit,
  formatISODateUTC,
  startOfMonthUTC,
  endOfMonthUTC,
  type PresetId,
} from '@/lib/dates/period-presets'

export interface AnalysisParams {
  startDate: string
  endDate: string
  compareStartDate?: string
  compareEndDate?: string
}

interface Props {
  onAnalyze: (params: AnalysisParams) => void
  loading: boolean
  /** Se true, mostra botão "Gerar novamente" pra forçar bypass de cache na próxima */
  showForce?: boolean
}

const PRESET_DEFAULT: PresetId = 'month-vs-prev'

export function PeriodSelector({ onAnalyze, loading }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<PresetId>(PRESET_DEFAULT)
  const [customMode, setCustomMode] = useState(false)
  const today = useMemo(() => new Date(), [])
  const defaultCustomStart = useMemo(
    () => formatISODateUTC(startOfMonthUTC(today)),
    [today],
  )
  const defaultCustomEnd = useMemo(
    () => formatISODateUTC(endOfMonthUTC(today)),
    [today],
  )
  const [customStartDate, setCustomStartDate] = useState(defaultCustomStart)
  const [customEndDate, setCustomEndDate] = useState(defaultCustomEnd)
  const [validationError, setValidationError] = useState<string | null>(null)

  function handlePresetClick(presetId: PresetId) {
    setSelectedPreset(presetId)
    setCustomMode(false)
    setValidationError(null)
  }

  function handleAnalyzeClick() {
    setValidationError(null)
    let params: AnalysisParams

    if (customMode) {
      if (!customStartDate || !customEndDate) {
        setValidationError('Selecione data inicial e final.')
        return
      }
      const v = validatePeriodLimit(customStartDate, customEndDate, 12)
      if (!v.ok) {
        setValidationError(v.error)
        return
      }
      params = {
        startDate: customStartDate,
        endDate: customEndDate,
      }
    } else {
      const preset = PRESETS.find((p) => p.id === selectedPreset)
      if (!preset) return
      const computed = preset.compute()
      params = {
        startDate: computed.startDate,
        endDate: computed.endDate,
        compareStartDate: computed.compareStartDate,
        compareEndDate: computed.compareEndDate,
      }
    }

    onAnalyze(params)
  }

  return (
    <div className="bg-white dark:bg-slate-900 border rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-1">
        Escolha o período para análise
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        A IA vai analisar os dados do período selecionado e gerar insights
        práticos em português.
      </p>

      {/* Grid de presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePresetClick(preset.id)}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border text-left transition',
              selectedPreset === preset.id && !customMode
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            )}
            data-testid={`preset-${preset.id}`}
          >
            <span className="text-xl shrink-0">{preset.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{preset.label}</div>
              {preset.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {preset.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Toggle custom */}
      <button
        type="button"
        onClick={() => {
          setCustomMode(!customMode)
          setValidationError(null)
        }}
        className={cn(
          'w-full p-3 rounded-lg border text-left transition mb-3 flex items-center gap-3',
          customMode
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300',
        )}
        data-testid="preset-custom-toggle"
      >
        <span className="text-xl">📅</span>
        <span className="font-medium text-sm">Período personalizado</span>
      </button>

      {customMode && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              De:
            </label>
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-9"
              data-testid="custom-start-date"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Até:
            </label>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-9"
              data-testid="custom-end-date"
            />
          </div>
        </div>
      )}

      {validationError && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-3">
          ⚠️ {validationError}
        </p>
      )}

      <Button
        onClick={handleAnalyzeClick}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
        data-testid="analyze-button"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando análise…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Gerar análise da IA
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-3">
        ~ 20-30 segundos · custo estimado: R$ 0,10 a R$ 0,15 por análise
      </p>
    </div>
  )
}
