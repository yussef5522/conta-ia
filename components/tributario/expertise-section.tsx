'use client'

// Sprint 5.0.2.c.2 — Body da análise expert (sem Header).
// Reuso pela tab Análise + fallback se voltar como página.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Target,
  Info,
  TrendingUp,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { useToast } from '@/components/ui/use-toast'

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const SEVERIDADE_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-900',
  WARNING: 'bg-amber-50 border-amber-200 text-amber-900',
  INFO: 'bg-sky-50 border-sky-200 text-sky-900',
}

const SEVERIDADE_ICON: Record<string, JSX.Element> = {
  CRITICAL: <AlertCircle className="h-4 w-4 text-red-600" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  INFO: <Info className="h-4 w-4 text-sky-600" />,
}

interface Analysis {
  cnae: string
  cnaeNome: string
  ramo: string
  anexoRecomendado: string
  fatorR: number
  fatorROK: boolean
  economiaTotalEstimada: number
  beneficiosAplicaveis: Array<{
    tipo: string
    descricao: string
    detalhes: string
    economiaPotencial: string
    comoAproveitar: string[]
  }>
  otimizacoes: Array<{ titulo: string; descricao: string; economiaEstimada: number }>
  alertas: Array<{ severidade: string; mensagem: string }>
  recomendacoes: Array<{
    prioridade: number
    titulo: string
    descricao: string
    impactoFinanceiro: number
  }>
  expertise: {
    ramo: string
    particularidades: string[]
    errosComuns: string[]
    redesGrandes?: Record<string, string | { regime?: string; estrategia: string }>
  }
}

export function ExpertiseSection() {
  const { currentEmpresaId } = useEmpresa()
  const { toast } = useToast()
  const [profileCNAE, setProfileCNAE] = useState<string>('')
  const [receitaMensal, setReceitaMensal] = useState('50000')
  const [hasDelivery, setHasDelivery] = useState(false)
  const [vendeBebidas, setVendeBebidas] = useState(true)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  useEffect(() => {
    if (!currentEmpresaId) return
    setLoading(true)
    fetch(`/api/empresas/${currentEmpresaId}/tax-profile`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile?.cnae) setProfileCNAE(d.profile.cnae)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [currentEmpresaId])

  async function calcular() {
    if (!currentEmpresaId) {
      toast({ variant: 'destructive', title: 'Selecione uma empresa' })
      return
    }
    if (!profileCNAE) {
      toast({
        variant: 'destructive',
        title: 'Configure o CNAE primeiro',
        description: 'Vá em Configurações e selecione um CNAE.',
      })
      return
    }
    setCalculating(true)
    try {
      const res = await fetch(`/api/empresas/${currentEmpresaId}/tax-expertise`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnae: profileCNAE,
          receitaMensal: Number(receitaMensal) || 0,
          hasDelivery,
          vendeBebidas,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha na análise',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      setAnalysis(data.analysis)
    } finally {
      setCalculating(false)
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Carregando…</p>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Análise especializada por ramo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profileCNAE && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <strong>Nenhum CNAE no perfil.</strong>{' '}
              <Link href="/tributario?tab=config" className="underline">
                Configurar agora
              </Link>
              .
            </div>
          )}
          {profileCNAE && (
            <div className="text-xs text-zinc-500">
              CNAE: <span className="font-mono text-zinc-900">{profileCNAE}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs">Receita mensal estimada (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receitaMensal}
                onChange={(e) => setReceitaMensal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs">Flags do negócio</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={hasDelivery} onCheckedChange={(v) => setHasDelivery(!!v)} />
                  Tem delivery
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={vendeBebidas} onCheckedChange={(v) => setVendeBebidas(!!v)} />
                  Vende bebidas
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={calcular} disabled={calculating || !profileCNAE}>
              {calculating ? 'Analisando…' : 'Analisar expertise'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
            <CardContent className="py-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="text-xs text-indigo-700 font-medium uppercase tracking-wide">
                    {analysis.ramo.replace('_', ' ')} · {analysis.cnaeNome}
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    Economia estimada: {fmtBRL(analysis.economiaTotalEstimada)}/mês
                  </div>
                  <div className="text-sm text-zinc-600 mt-1">
                    = {fmtBRL(analysis.economiaTotalEstimada * 12)} por ano · Anexo recomendado:{' '}
                    <strong>{analysis.anexoRecomendado}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Fator R</div>
                  <div
                    className={
                      'text-xl font-bold ' +
                      (analysis.fatorROK ? 'text-emerald-600' : 'text-red-600')
                    }
                  >
                    {(analysis.fatorR * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {analysis.fatorROK ? '✓ acima 28%' : '× abaixo 28%'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {analysis.alertas.length > 0 && (
            <div className="space-y-2">
              {analysis.alertas.map((a, i) => (
                <div
                  key={i}
                  className={
                    'flex items-start gap-2 rounded-md border p-3 text-sm ' +
                    (SEVERIDADE_STYLE[a.severidade] ?? SEVERIDADE_STYLE.INFO)
                  }
                >
                  {SEVERIDADE_ICON[a.severidade] ?? SEVERIDADE_ICON.INFO}
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </div>
          )}

          {analysis.recomendacoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Recomendações por impacto financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.recomendacoes.map((r) => (
                  <div
                    key={r.prioridade}
                    className="flex items-start gap-3 pb-3 border-b last:border-b-0"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {r.prioridade}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900">{r.titulo}</div>
                      <div className="text-xs text-zinc-600 mt-0.5">{r.descricao}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-zinc-500">Impacto/mês</div>
                      <div className="text-sm font-semibold text-emerald-700">
                        {fmtBRL(r.impactoFinanceiro)}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {analysis.otimizacoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Otimizações detectadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.otimizacoes.map((o, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-emerald-50/50 border border-emerald-100 p-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-sm font-medium text-emerald-900">{o.titulo}</div>
                        <div className="text-xs text-emerald-800/80 mt-1">{o.descricao}</div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-700">
                        {fmtBRL(o.economiaEstimada)}/mês
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Benefícios fiscais do ramo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.beneficiosAplicaveis.map((b, i) => (
                <details key={i} className="rounded-md border bg-white">
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{b.descricao}</span>
                    <span className="text-xs text-emerald-700 shrink-0">
                      {b.economiaPotencial}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 text-xs space-y-2">
                    <p className="text-zinc-700">{b.detalhes}</p>
                    {b.comoAproveitar.length > 0 && (
                      <div>
                        <div className="font-medium text-zinc-900 mb-1">Como aproveitar:</div>
                        <ul className="list-disc list-inside space-y-0.5 text-zinc-600">
                          {b.comoAproveitar.map((c, j) => (
                            <li key={j}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-sky-500" />
                  Particularidades do ramo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-zinc-700">
                  {analysis.expertise.particularidades.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-sky-500 shrink-0">›</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Erros comuns (evitar)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-zinc-700">
                  {analysis.expertise.errosComuns.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-500 shrink-0">✗</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {analysis.expertise.redesGrandes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-zinc-500" />
                  Como grandes redes do ramo otimizam
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analysis.expertise.redesGrandes).map(([nome, info]) => {
                  const obj = typeof info === 'string' ? { estrategia: info } : info
                  return (
                    <div key={nome} className="rounded-md border bg-zinc-50/50 p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="font-medium text-zinc-900 capitalize">{nome}</span>
                        {obj.regime && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-200 text-zinc-700 rounded">
                            {obj.regime}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-700">{obj.estrategia}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
