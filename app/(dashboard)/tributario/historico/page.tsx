// Sprint 5.0.1 — Histórico de cálculos DAS.

import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/db'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { DisclaimerInfo } from '@/components/tax/disclaimer-info'
import { CalculationFooter } from '@/components/tax/calculation-footer'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format/money'

export const metadata: Metadata = { title: 'Histórico DAS' }
export const dynamic = 'force-dynamic'

const MESES = [
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

export default async function HistoricoPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const calcs = await prisma.taxCalculation.findMany({
    where: { companyId: access.empresaId },
    orderBy: [{ paYear: 'desc' }, { paMonth: 'desc' }],
    take: 60,
  })

  return (
    <div className="space-y-6">
      <Header
        title="Histórico DAS"
        description={`${calcs.length} cálculo${calcs.length === 1 ? '' : 's'} salvo${calcs.length === 1 ? '' : 's'}`}
      >
        <DisclaimerInfo />
        <Button asChild variant="outline" size="sm">
          <Link href="/tributario">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </Header>

      

      {calcs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-500">
            Nenhum DAS calculado. Calcule o primeiro em <Link href="/tributario" className="text-primary hover:underline">/tributario</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Header tabela */}
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
              <span className="text-right text-zinc-600 hidden md:inline">{formatBRL(c.rbaAcumulada)}</span>
              <span className="text-right text-zinc-600 hidden md:inline">
                {(c.aliquotaEfetiva ?? 0).toFixed(2)}%
              </span>
              <span className="text-right font-semibold text-primary">
                {formatBRL(c.dasValue)}
              </span>
              <span className="text-right text-[11px] text-zinc-400 hidden md:inline">
                {new Date(c.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
