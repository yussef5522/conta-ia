'use client'

// Sprint 4.0.3 — Card "Fluxo Previsto" no dashboard.
// Client component com tabs 30/60/90. Recebe dados via prop (server fetcha).

import { useState } from 'react'
import { TrendingUp, TrendingDown, ArrowRight, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatBRL } from '@/lib/format/money'
import type { FluxoPrevistoResult } from '@/lib/dashboard/fluxo-previsto'

interface Props {
  data: FluxoPrevistoResult
}

export function FluxoPrevistoCard({ data }: Props) {
  const [tab, setTab] = useState<'30' | '60' | '90'>('30')
  const bucket = data.buckets.find((b) => String(b.days) === tab) ?? data.buckets[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Fluxo Previsto
          </CardTitle>
          <Tabs value={tab} onValueChange={(v) => setTab(v as '30' | '60' | '90')}>
            <TabsList className="h-7">
              <TabsTrigger value="30" className="text-xs px-2">30d</TabsTrigger>
              <TabsTrigger value="60" className="text-xs px-2">60d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Receitas previstas
            </span>
            <span className="tabular-nums font-medium text-emerald-600">
              {formatBRL(bucket.receitasPrevistas.total)}
              <span className="text-xs text-muted-foreground ml-1.5">
                ({bucket.receitasPrevistas.count})
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              Despesas previstas
            </span>
            <span className="tabular-nums font-medium text-red-600">
              − {formatBRL(bucket.despesasPrevistas.total)}
              <span className="text-xs text-muted-foreground ml-1.5">
                ({bucket.despesasPrevistas.count})
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-1 border-t">
            <span className="font-medium">Resultado previsto</span>
            <span
              className={`tabular-nums font-semibold ${
                bucket.resultadoPrevisto >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {bucket.resultadoPrevisto >= 0 ? '+' : ''}
              {formatBRL(bucket.resultadoPrevisto)}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Saldo projetado em {bucket.days}d
              </p>
              <p className="text-lg font-bold tabular-nums mt-0.5">
                {formatBRL(bucket.saldoProjetado)}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/50 shrink-0" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Saldo atual {formatBRL(data.saldoAtual)} + resultado previsto
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
