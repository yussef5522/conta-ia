'use client'

// Sprint 5.0.2.e — Comparativo de Regimes SEM dropdown genérico.
// Atividade + hasICMS/hasISS são DERIVADOS automaticamente do CNAE
// configurado em Tributário > Configurações. Se sem CNAE, mostra alert
// vermelho com botão pra configurar.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, TrendingDown, AlertCircle, Loader2, XCircle, Sparkles } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { formatBRL } from '@/lib/format/money'
import { CalculationFooter } from '@/components/tax/calculation-footer'
import { UF_LABELS } from '@/lib/tax/lucro-real-tables'
import { deriveActivityFromCNAE } from '@/lib/tax/derive-activity-from-cnae'
import { findCNAE, RAMO_LABELS } from '@/lib/tax/expertise'

interface RegimeRow {
  regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
  aplicavel: boolean
  motivoNaoAplicavel?: string
  baseLegal?: string
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
  const [margemReal, setMargemReal] = useState('15')
  const [anexoSimples, setAnexoSimples] = useState<string>('ANEXO_III')
  const [estado, setEstado] = useState<string>('RS')
  const [cnae, setCnae] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResponse['result'] | null>(null)
  // Sprint 5.0.2.f — compras mensais (gera créditos PIS/COFINS no Real)
  const [comprasMes, setComprasMes] = useState('0')
  const [comprasDetectadas, setComprasDetectadas] = useState<{
    mensalMedia: number
    percentSobreReceita: number
    fornecedores: number
  } | null>(null)

  // Carrega perfil pra pegar CNAE + estado + anexo + margem
  useEffect(() => {
    if (!currentEmpresaId) {
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
    fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const p = data?.profile
        if (!p) {
          setProfileLoading(false)
          return
        }
        if (p.simplesAnexo) setAnexoSimples(p.simplesAnexo)
        if (p.estado) setEstado(p.estado)
        if (typeof p.margemReal === 'number') setMargemReal(String(p.margemReal))
        if (p.cnae) setCnae(p.cnae)
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [currentEmpresaId])

  // Sprint 5.0.2.f — auto-detect compras das Transactions
  useEffect(() => {
    if (!currentEmpresaId) return
    fetch(`/api/empresas/${currentEmpresaId}/detectar-compras`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        if (d.totalCompras12m > 0) {
          setComprasDetectadas({
            mensalMedia: d.comprasMensalMedia,
            percentSobreReceita: d.percentSobreReceita,
            fornecedores: d.fornecedoresDetectados,
          })
        }
      })
      .catch(() => {})
  }, [currentEmpresaId])

  const cnaeEntry = cnae ? findCNAE(cnae) : null
  const derived = cnae ? deriveActivityFromCNAE(cnae) : null

  async function calcular() {
    if (!currentEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    if (!cnae || !derived) {
      toast({
        variant: 'destructive',
        title: 'CNAE não configurado',
        description: 'Configure o CNAE em Tributário > Configurações.',
      })
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
          atividade: derived.presumidoAtividade,
          margemRealPercent: Number(margemReal),
          estado,
          hasICMS: derived.hasICMS,
          hasISS: derived.hasISS,
          comprasMes: Number(comprasMes) || 0,
          cnaeCode: cnae,
        }),
      })
      const data: CompareResponse = await res.json().catch(() => ({}) as CompareResponse)
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

  if (profileLoading) {
    return <p className="text-sm text-zinc-500">Carregando perfil…</p>
  }

  // Sem CNAE: alert vermelho + CTA
  if (!cnae) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-3 flex-wrap">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-red-900">CNAE não configurado</p>
              <p className="text-xs text-red-700 mt-1">
                O comparativo precisa do CNAE pra derivar a atividade e os tributos
                aplicáveis (ICMS/ISS). Sem isso usaríamos valores genéricos imprecisos.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/tributario?tab=config">Configurar CNAE →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Card resumo do CNAE */}
      <Card className="bg-indigo-50/50 border-indigo-100">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl">{cnaeEntry?.icon ?? '📋'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-semibold text-indigo-700 tracking-wide">
                Comparando para
              </p>
              <p className="text-sm font-medium text-zinc-900 truncate">
                {cnaeEntry?.name ?? cnae}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">
                <span className="font-mono">{cnae}</span>
                {cnaeEntry && <> · {RAMO_LABELS[cnaeEntry.ramo]}</>}
                {derived && (
                  <>
                    {' '}· Atividade Lucro Presumido: <strong>{derived.presumidoAtividade}</strong>
                  </>
                )}
              </p>
              {derived && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Tributos derivados: {derived.hasICMS ? 'ICMS ✓' : 'ICMS ✗'} ·{' '}
                  {derived.hasISS ? 'ISS ✓' : 'ISS ✗'}
                </p>
              )}
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/tributario?tab=config">Trocar CNAE →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <label className="text-xs">Compras mensais (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={comprasMes}
                onChange={(e) => setComprasMes(e.target.value)}
                placeholder="0"
              />
              <p className="text-[10px] text-zinc-500">
                Insumos/embalagens/mercadorias. Gera crédito PIS+COFINS 9,25% no Lucro Real.
              </p>
              {comprasDetectadas && comprasDetectadas.mensalMedia > 0 && (
                <button
                  type="button"
                  onClick={() => setComprasMes(String(Math.round(comprasDetectadas.mensalMedia)))}
                  className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Detectado nas suas transações: R$ {Math.round(comprasDetectadas.mensalMedia).toLocaleString('pt-BR')}/mês
                  ({(comprasDetectadas.percentSobreReceita * 100).toFixed(0)}% da receita,{' '}
                  {comprasDetectadas.fornecedores} fornecedores)
                </button>
              )}
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
              <p className="text-[10px] text-zinc-500">% lucro tributável (Lucro Real)</p>
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
            ? 'border-zinc-300 bg-zinc-50'
            : ''
      }
    >
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-3">
          <p
            className={
              'text-sm font-semibold ' + (row.aplicavel ? 'text-zinc-900' : 'text-zinc-500')
            }
          >
            {REGIME_LABEL[row.regime]}
          </p>
          {highlight && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <TrendingDown className="h-3 w-3 mr-1" />
              Melhor
            </Badge>
          )}
          {!row.aplicavel && (
            <Badge variant="outline" className="text-[10px] text-zinc-600 border-zinc-300">
              Não aplicável
            </Badge>
          )}
        </div>

        {!row.aplicavel ? (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-700 flex items-start gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-400" />
              <span>{row.motivoNaoAplicavel ?? 'Não aplicável'}</span>
            </div>
            {row.baseLegal && (
              <p className="text-[10px] text-zinc-500 ml-5">
                Base legal: <span className="font-mono">{row.baseLegal}</span>
              </p>
            )}
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
