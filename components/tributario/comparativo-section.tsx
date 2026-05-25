'use client'

// Sprint 5.0.2.c.2 — Body do comparativo de regimes (sem Header).

import { useEffect, useState } from 'react'
import { Trophy, TrendingDown, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { formatBRL } from '@/lib/format/money'
import { CalculationFooter } from '@/components/tax/calculation-footer'
import {
  ATIVIDADE_LABELS,
  type TaxCompareInput,
} from '@/lib/validations/tax-compare'
import { UF_LABELS } from '@/lib/tax/lucro-real-tables'

interface RegimeRow {
  regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  aplicavel: boolean
  motivoNaoAplicavel?: string
  total: number
  aliquotaEfetiva: number
  totalAnual: number
}

interface CompareResponse {
  result: {
    simples: RegimeRow
    presumido: RegimeRow
    real: RegimeRow
    recomendacao: {
      regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
      economiaMensal: number
      economiaAnual: number
      economiaVsPiorRegimePercent: number
      justificativa: string
    } | null
  }
}

const REGIME_LABEL: Record<RegimeRow['regime'], string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
}

export function ComparativoSection() {
  const { toast } = useToast()
  const { currentEmpresaId } = useEmpresa()

  const [receita, setReceita] = useState('100000')
  const [atividade, setAtividade] = useState<TaxCompareInput['atividade']>('SERVICOS')
  const [margemReal, setMargemReal] = useState('15')
  const [anexoSimples, setAnexoSimples] = useState<string>('ANEXO_III')
  const [estado, setEstado] = useState<string>('RS')
  const [hasICMS, setHasICMS] = useState(false)
  const [hasISS, setHasISS] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResponse['result'] | null>(null)

  useEffect(() => {
    if (!currentEmpresaId) return
    fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p = data?.profile
        if (!p) return
        if (p.atividade) setAtividade(p.atividade)
        if (p.simplesAnexo) setAnexoSimples(p.simplesAnexo)
        if (p.estado) setEstado(p.estado)
        if (typeof p.hasICMS === 'boolean') setHasICMS(p.hasICMS)
        if (typeof p.hasISS === 'boolean') setHasISS(p.hasISS)
        if (typeof p.margemReal === 'number') setMargemReal(String(p.margemReal))
      })
      .catch(() => {})
  }, [currentEmpresaId])

  async function calcular() {
    if (!currentEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    if (!receita || Number(receita) <= 0) {
      toast({ variant: 'destructive', title: 'Receita inválida' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/empresas/${currentEmpresaId}/tax-compare`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receitaBrutaMes: Number(receita),
          anexoSimples,
          atividade,
          margemRealPercent: Number(margemReal),
          estado,
          hasICMS,
          hasISS,
        }),
      })
      const data: CompareResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: (data as { erro?: string }).erro ?? `HTTP ${res.status}`,
        })
        return
      }
      setResult(data.result)
    } finally {
      setLoading(false)
    }
  }

  const melhor = result?.recomendacao?.regime

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs">Receita mensal (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receita}
                onChange={(e) => setReceita(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Atividade (Presumido)</label>
              <Select
                value={atividade}
                onValueChange={(v) => setAtividade(v as TaxCompareInput['atividade'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATIVIDADE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Margem real declarada (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={margemReal}
                onChange={(e) => setMargemReal(e.target.value)}
                placeholder="15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Anexo Simples</label>
              <Select value={anexoSimples} onValueChange={setAnexoSimples}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANEXO_I">Anexo I — Comércio</SelectItem>
                  <SelectItem value="ANEXO_II">Anexo II — Indústria</SelectItem>
                  <SelectItem value="ANEXO_III">Anexo III — Serviços (com Fator R)</SelectItem>
                  <SelectItem value="ANEXO_IV">Anexo IV — Construção</SelectItem>
                  <SelectItem value="ANEXO_V">Anexo V — Serviços (sem Fator R)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Estado (UF)</label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Object.entries(UF_LABELS).map(([uf, label]) => (
                    <SelectItem key={uf} value={uf}>
                      {uf} — {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasICMS} onCheckedChange={(v) => setHasICMS(!!v)} />
                Tem ICMS (comércio/indústria)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={hasISS} onCheckedChange={(v) => setHasISS(!!v)} />
                Tem ISS (serviços)
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={calcular} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Calculando…
                </>
              ) : (
                'Comparar regimes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <RegimeCard row={result.simples} highlight={melhor === 'SIMPLES_NACIONAL'} />
            <RegimeCard row={result.presumido} highlight={melhor === 'LUCRO_PRESUMIDO'} />
            <RegimeCard row={result.real} highlight={melhor === 'LUCRO_REAL'} />
          </div>

          {result.recomendacao && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  <Trophy className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                      Recomendação
                    </p>
                    <p className="mt-1 text-lg font-bold text-zinc-900">
                      {REGIME_LABEL[result.recomendacao.regime]}
                    </p>
                    <p className="mt-2 text-sm text-zinc-700">
                      {result.recomendacao.justificativa}
                    </p>
                    {result.recomendacao.economiaAnual > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
                        <div>
                          <p className="text-[10px] uppercase text-zinc-500">Economia anual</p>
                          <p className="text-lg font-bold text-emerald-600 tabular-nums">
                            {formatBRL(result.recomendacao.economiaAnual)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-zinc-500">Economia %</p>
                          <p className="text-lg font-bold text-emerald-600 tabular-nums">
                            {result.recomendacao.economiaVsPiorRegimePercent}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <CalculationFooter />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function RegimeCard({ row, highlight }: { row: RegimeRow; highlight: boolean }) {
  return (
    <Card
      className={
        highlight
          ? 'border-emerald-300 bg-emerald-50/40'
          : !row.aplicavel
            ? 'border-zinc-200 bg-zinc-50/60 opacity-70'
            : ''
      }
    >
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-zinc-900">{REGIME_LABEL[row.regime]}</p>
          {highlight && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <TrendingDown className="h-3 w-3 mr-1" />
              Melhor
            </Badge>
          )}
        </div>

        {!row.aplicavel ? (
          <div className="text-xs text-zinc-500 flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{row.motivoNaoAplicavel ?? 'Não aplicável'}</span>
          </div>
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums text-zinc-900">
              {formatBRL(row.total)}
              <span className="text-xs font-normal text-zinc-500 ml-1">/mês</span>
            </p>
            <p className="text-xs text-zinc-500 mt-1 tabular-nums">
              Alíquota efetiva {row.aliquotaEfetiva.toFixed(2)}%
            </p>
            <p className="text-xs text-zinc-600 mt-2 tabular-nums">
              Anual estimado <strong>{formatBRL(row.totalAnual)}</strong>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
