'use client'

// Sprint 5.0.2.d — UI da análise tributária IA Real (Claude Sonnet 4.6).

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  AlertCircle,
  TrendingUp,
  Building2,
  Target,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface AnalysisResponse {
  resumoExecutivo: {
    cenarioAtual: string
    impostoPagoEstimado: number
    aliquotaEfetiva: number
    economiaPotencialAnual: number
  }
  oportunidades: Array<{
    prioridade: number
    titulo: string
    descricao: string
    economiaAnual: number
    baseLegal: string
    passosPraticos: string[]
    risco: 'BAIXO' | 'MEDIO' | 'ALTO'
  }>
  comparativoRegimes: {
    atual: { regime: string; total: number; aliquota: number }
    simples?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    presumido?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    real?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
    recomendacao: string
  }
  beneficiosEspecificos: Array<{
    tipo: string
    descricao: string
    economiaAnual: number
    aplicavel: boolean
    motivoAplicacao: string
  }>
  benchmarkRedes: Array<{
    rede: string
    regime: string
    estrategias: string[]
    aplicabilidade: string
  }>
  proximosPassos: Array<{
    ordem: number
    acao: string
    urgencia: 'IMEDIATA' | '30_DIAS' | '90_DIAS' | 'PROXIMO_ANO'
    impactoFinanceiro: number
  }>
  fromCache?: boolean
  cachedAt?: string
  expiresAt?: string
  metadata?: {
    modeloUsado: string
    tokensInput: number
    tokensOutput: number
    costUSD: number
  }
}

const RISCO_STYLE: Record<string, string> = {
  BAIXO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIO: 'bg-amber-50 text-amber-700 border-amber-200',
  ALTO: 'bg-red-50 text-red-700 border-red-200',
}

const URGENCIA_LABEL: Record<string, string> = {
  IMEDIATA: 'Imediato',
  '30_DIAS': '30 dias',
  '90_DIAS': '90 dias',
  PROXIMO_ANO: 'Próximo ano',
}

const URGENCIA_STYLE: Record<string, string> = {
  IMEDIATA: 'bg-red-50 text-red-700',
  '30_DIAS': 'bg-amber-50 text-amber-700',
  '90_DIAS': 'bg-sky-50 text-sky-700',
  PROXIMO_ANO: 'bg-zinc-100 text-zinc-700',
}

export function AiAnalysisSection() {
  const { currentEmpresaId } = useEmpresa()
  const { toast } = useToast()
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ titulo: string; mensagem: string; link?: string } | null>(
    null,
  )

  async function runAnalysis() {
    if (!currentEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/empresas/${currentEmpresaId}/tax-ai-analysis`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setError({
          titulo: data.erro ?? 'Erro',
          mensagem: data.mensagem ?? `HTTP ${res.status}`,
          link: data.link,
        })
        return
      }
      setAnalysis(data)
    } catch (e) {
      setError({
        titulo: 'Erro de conexão',
        mensagem: e instanceof Error ? e.message : 'Tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!analysis && !loading && !error) {
    return (
      <Card className="text-center">
        <CardContent className="py-10 space-y-4">
          <Sparkles className="h-12 w-12 text-indigo-500 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-1">Análise Tributária com IA</h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              Claude Sonnet 4.6 analisa transações dos últimos 12 meses, compara regimes,
              cita leis específicas e benchmarka grandes redes do ramo.
            </p>
          </div>
          <Button onClick={runAnalysis} size="lg">
            <Sparkles className="h-4 w-4 mr-2" />
            Analisar agora
          </Button>
          <p className="text-xs text-zinc-500">
            ~30s na primeira análise · Cache 24h · Reanálise instantânea
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="text-center">
        <CardContent className="py-10 space-y-4">
          <Loader2 className="h-12 w-12 text-indigo-500 mx-auto animate-spin" />
          <h3 className="text-lg font-semibold">Analisando tuas transações…</h3>
          <ul className="text-sm text-zinc-600 space-y-1.5 max-w-xs mx-auto text-left">
            <li>📊 Lendo últimos 12 meses</li>
            <li>🔍 Identificando padrões e fornecedores</li>
            <li>📚 Consultando Knowledge Base (10 tópicos)</li>
            <li>🏆 Comparando com benchmarks de grandes redes</li>
            <li>⚖️ Citando leis específicas</li>
          </ul>
          <p className="text-xs text-zinc-400">Pode levar até 30 segundos…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="py-6 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">{error.titulo}</h3>
              <p className="text-sm text-amber-800 mt-1">{error.mensagem}</p>
              {error.link && (
                <Link
                  href={error.link}
                  className="inline-block mt-2 text-sm text-indigo-600 hover:underline"
                >
                  Ir para configuração →
                </Link>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={runAnalysis}>
              <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-indigo-50 via-white to-emerald-50 border-indigo-200">
        <CardContent className="py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <p className="text-[10px] uppercase font-semibold text-indigo-700 tracking-wide mb-2">
                Resumo Executivo
              </p>
              <p className="text-sm text-zinc-800 leading-relaxed">
                {analysis.resumoExecutivo.cenarioAtual}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4 max-w-md">
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Imposto pago (12m est.)</p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatBRL(analysis.resumoExecutivo.impostoPagoEstimado)}
                  </p>
                  <p className="text-[10px] text-zinc-500 tabular-nums">
                    Alíq. efetiva {analysis.resumoExecutivo.aliquotaEfetiva.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Economia potencial/ano</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">
                    {formatBRL(analysis.resumoExecutivo.economiaPotencialAnual)}
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading}>
              <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
              Refazer
            </Button>
          </div>
          {analysis.fromCache && analysis.cachedAt && (
            <p className="text-[10px] text-zinc-500 mt-4">
              Análise em cache · gerada {new Date(analysis.cachedAt).toLocaleString('pt-BR')} ·
              expira {analysis.expiresAt ? new Date(analysis.expiresAt).toLocaleString('pt-BR') : '—'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Comparativo 3 regimes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Comparativo de Regimes (calculado com dados reais)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <RegimeMiniCard
              label="Simples"
              data={analysis.comparativoRegimes.simples}
              isAtual={
                analysis.comparativoRegimes.atual.regime === 'SIMPLES_NACIONAL'
              }
            />
            <RegimeMiniCard
              label="Presumido"
              data={analysis.comparativoRegimes.presumido}
              isAtual={
                analysis.comparativoRegimes.atual.regime === 'LUCRO_PRESUMIDO'
              }
            />
            <RegimeMiniCard
              label="Real"
              data={analysis.comparativoRegimes.real}
              isAtual={analysis.comparativoRegimes.atual.regime === 'LUCRO_REAL'}
            />
          </div>
          <div className="mt-4 rounded-md bg-emerald-50/60 border border-emerald-200 p-3 text-sm text-emerald-900">
            <strong>Recomendação:</strong> {analysis.comparativoRegimes.recomendacao}
          </div>
        </CardContent>
      </Card>

      {/* Oportunidades */}
      {analysis.oportunidades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              Oportunidades identificadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.oportunidades
              .sort((a, b) => a.prioridade - b.prioridade)
              .map((op) => (
                <div
                  key={op.prioridade}
                  className="rounded-md border bg-white p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {op.prioridade}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-900">
                          {op.titulo}
                        </h4>
                        <p className="text-xs text-zinc-600 mt-0.5">{op.descricao}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-zinc-500">Economia/ano</p>
                      <p className="text-sm font-bold text-emerald-600 tabular-nums">
                        {formatBRL(op.economiaAnual)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    <Badge variant="outline" className={RISCO_STYLE[op.risco]}>
                      Risco {op.risco}
                    </Badge>
                    <span className="text-zinc-500">·</span>
                    <span className="text-zinc-600 font-mono">{op.baseLegal}</span>
                  </div>
                  {op.passosPraticos.length > 0 && (
                    <details>
                      <summary className="text-xs cursor-pointer text-indigo-600 hover:underline">
                        Passos práticos ({op.passosPraticos.length})
                      </summary>
                      <ol className="mt-1 ml-4 list-decimal text-xs text-zinc-700 space-y-0.5">
                        {op.passosPraticos.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Benefícios específicos do ramo */}
      {analysis.beneficiosEspecificos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              Benefícios específicos do ramo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.beneficiosEspecificos.map((b, i) => (
              <div
                key={i}
                className={
                  'rounded-md border p-3 text-xs ' +
                  (b.aplicavel
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-zinc-50 border-zinc-200 opacity-70')
                }
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-zinc-900 flex items-center gap-1.5">
                      {b.aplicavel ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-zinc-400" />
                      )}
                      {b.tipo}
                    </h4>
                    <p className="text-zinc-700 mt-1">{b.descricao}</p>
                    <p className="text-zinc-500 mt-0.5">
                      {b.aplicavel ? 'Aplicável: ' : 'Por que NÃO aplica: '}
                      {b.motivoAplicacao}
                    </p>
                  </div>
                  {b.aplicavel && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-zinc-500">Economia/ano</p>
                      <p className="text-sm font-bold text-emerald-600 tabular-nums">
                        {formatBRL(b.economiaAnual)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Benchmark redes */}
      {analysis.benchmarkRedes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-zinc-500" />
              Como grandes redes do ramo fazem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analysis.benchmarkRedes.map((r, i) => (
              <div key={i} className="rounded-md border bg-zinc-50/40 p-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-zinc-900">{r.rede}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.regime}
                  </Badge>
                </div>
                <ul className="mt-1 ml-4 list-disc text-zinc-700 space-y-0.5">
                  {r.estrategias.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
                {r.aplicabilidade && (
                  <p className="text-zinc-600 mt-2 italic">{r.aplicabilidade}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Próximos passos */}
      {analysis.proximosPassos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Próximos passos</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {analysis.proximosPassos
                .sort((a, b) => a.ordem - b.ordem)
                .map((p) => (
                  <li
                    key={p.ordem}
                    className="flex items-start gap-3 pb-2 border-b last:border-b-0"
                  >
                    <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {p.ordem}
                    </div>
                    <div className="flex-1 text-sm text-zinc-800">{p.acao}</div>
                    <div className="text-right shrink-0 text-xs">
                      <Badge
                        variant="outline"
                        className={URGENCIA_STYLE[p.urgencia] ?? URGENCIA_STYLE['90_DIAS']}
                      >
                        {URGENCIA_LABEL[p.urgencia] ?? p.urgencia}
                      </Badge>
                      {p.impactoFinanceiro > 0 && (
                        <p className="mt-1 text-emerald-600 font-semibold tabular-nums">
                          {formatBRL(p.impactoFinanceiro)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Footer disclaimer */}
      <p className="text-[10px] text-zinc-500 text-center">
        Análise gerada por {analysis.metadata?.modeloUsado ?? 'Claude'} ·
        {' '}Valores são ESTIMATIVAS. Valide tudo com seu contador antes de implementar.
      </p>
    </div>
  )
}

function RegimeMiniCard({
  label,
  data,
  isAtual,
}: {
  label: string
  data?: { aplicavel: boolean; total: number; aliquota: number; economia: number }
  isAtual: boolean
}) {
  if (!data) {
    return (
      <div className="rounded-md border bg-zinc-50/60 p-3 text-xs text-zinc-500">
        {label}: sem dados
      </div>
    )
  }
  if (!data.aplicavel) {
    return (
      <div className="rounded-md border bg-zinc-50 p-3 text-xs opacity-60">
        <p className="font-semibold text-zinc-700">{label}</p>
        <p className="text-zinc-500 mt-1">Não aplicável</p>
      </div>
    )
  }
  return (
    <div
      className={
        'rounded-md border p-3 ' +
        (isAtual ? 'border-primary/40 bg-primary/5' : 'bg-white')
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        {isAtual && (
          <Badge variant="outline" className="text-[10px]">
            Atual
          </Badge>
        )}
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums">
        {formatBRL(data.total)}
        <span className="text-[10px] font-normal text-zinc-500 ml-1">/mês</span>
      </p>
      <p className="text-[11px] text-zinc-500 tabular-nums">
        Alíquota efetiva {data.aliquota.toFixed(2)}%
      </p>
      {data.economia !== 0 && (
        <p
          className={
            'text-[11px] tabular-nums mt-1 ' +
            (data.economia > 0 ? 'text-emerald-600 font-semibold' : 'text-red-600')
          }
        >
          {data.economia > 0 ? 'Economia' : 'A mais'}: {formatBRL(Math.abs(data.economia))}/ano
        </p>
      )}
    </div>
  )
}
