// Sprint 5.0.2.c.2 — Tab Histórico DAS. Server component.

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format/money'
import type { TaxCalculation } from '@prisma/client'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Props {
  calcs: TaxCalculation[]
}

export function HistoricoTab({ calcs }: Props) {
  if (calcs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-zinc-500">
          Nenhum DAS calculado. Calcule o primeiro na aba{' '}
          <Link href="/tributario?tab=visao" className="text-primary hover:underline">
            Visão
          </Link>
          .
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {calcs.length} cálculo{calcs.length === 1 ? '' : 's'} salvo{calcs.length === 1 ? '' : 's'}
      </p>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="hidden md:grid grid-cols-[80px_120px_140px_140px_100px_140px_110px] gap-3 px-4 py-2 border-b bg-zinc-50 text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
          <span>Período</span>
          <span>Anexo</span>
          <span className="text-right">Receita</span>
          <span className="text-right">RBA 12m</span>
          <span className="text-right">Alíq. Ef.</span>
          <span className="text-right">DAS</span>
          <span className="text-right">Calculado</span>
        </div>
        {calcs.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-2 md:grid-cols-[80px_120px_140px_140px_100px_140px_110px] gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-zinc-50 text-sm tabular-nums"
          >
            <span className="font-medium">
              {MESES[c.paMonth - 1]}/{c.paYear}
            </span>
            <Badge variant="outline" className="w-fit text-xs">
              {(c.simplesAnexo ?? '').replace('ANEXO_', '')}
            </Badge>
            <span className="text-right text-zinc-600">{formatBRL(c.receitaBruta)}</span>
            <span className="text-right text-zinc-600 hidden md:inline">
              {formatBRL(c.rbaAcumulada)}
            </span>
            <span className="text-right text-zinc-600 hidden md:inline">
              {(c.aliquotaEfetiva ?? 0).toFixed(2)}%
            </span>
            <span className="text-right font-semibold text-primary">{formatBRL(c.dasValue)}</span>
            <span className="text-right text-[11px] text-zinc-400 hidden md:inline">
              {new Date(c.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
