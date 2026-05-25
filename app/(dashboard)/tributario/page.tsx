// Sprint 5.0.1 — Visão tributária da empresa atual.

import type { Metadata } from 'next'
import Link from 'next/link'
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
import { SIMPLES_ANEXO_LABELS, type SimplesAnexo } from '@/lib/tax/simples-nacional-tables'
import { TributarioRecalcButton } from './recalc-button'

export const metadata: Metadata = { title: 'Tributário' }
export const dynamic = 'force-dynamic'

export default async function TributarioPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const [profile, lastCalc] = await Promise.all([
    prisma.companyTaxProfile.findUnique({ where: { companyId: access.empresaId } }),
    prisma.taxCalculation.findFirst({
      where: { companyId: access.empresaId },
      orderBy: [{ paYear: 'desc' }, { paMonth: 'desc' }],
    }),
  ])

  return (
    <div className="space-y-6">
      <Header
        title="Tributário"
        description={`Visão fiscal — ${access.empresa.tradeName ?? access.empresa.name}`}
      >
        <DisclaimerInfo />
        <Button asChild variant="outline" size="sm">
          <Link href="/tributario/perfil">Editar perfil</Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/tributario/historico">Histórico</Link>
        </Button>
      </Header>

      

      {!profile ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-zinc-600">
              Perfil tributário não configurado.
            </p>
            <Button asChild className="mt-4">
              <Link href="/tributario/perfil">Configurar agora</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Regime atual */}
          <Card>
            <CardContent className="py-5">
              <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                Regime atual
              </p>
              <p className="mt-2 text-lg font-bold text-zinc-900">
                {profile.regime === 'SIMPLES_NACIONAL'
                  ? 'Simples Nacional'
                  : profile.regime === 'LUCRO_PRESUMIDO'
                    ? 'Lucro Presumido'
                    : 'Lucro Real'}
              </p>
              {profile.simplesAnexo && (
                <p className="mt-1 text-xs text-zinc-600">
                  {SIMPLES_ANEXO_LABELS[profile.simplesAnexo as SimplesAnexo]}
                </p>
              )}
              {profile.cnae && (
                <p className="mt-2 text-xs text-zinc-500">CNAE {profile.cnae}</p>
              )}
            </CardContent>
          </Card>

          {/* Folha + Fator R (se Simples) */}
          <Card>
            <CardContent className="py-5">
              <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                Folha 12m + Pró-labore
              </p>
              <p className="mt-2 text-lg font-bold text-zinc-900 tabular-nums">
                {formatBRL(profile.folha12m)}
              </p>
              {profile.proLabore > 0 && (
                <p className="mt-1 text-xs text-zinc-600">
                  Pró-labore mensal {formatBRL(profile.proLabore)}
                </p>
              )}
              {profile.regime === 'SIMPLES_NACIONAL' && lastCalc?.fatorR != null && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                    Fator R (último cálculo)
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {(lastCalc.fatorR * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-zinc-600">
                    {lastCalc.fatorR >= 0.28
                      ? '✓ Acima de 28% — Anexo III (benefício)'
                      : '⚠ Abaixo de 28% — Anexo V (alíquota maior)'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Último DAS calculado */}
          {lastCalc && (
            <Card className="md:col-span-2 border-primary/20 bg-primary/5">
              <CardContent className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wide">
                      Último DAS estimado · {String(lastCalc.paMonth).padStart(2, '0')}/{lastCalc.paYear}
                    </p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-primary">
                      {formatBRL(lastCalc.dasValue)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-zinc-600">
                      <Badge variant="outline">
                        Alíq. efetiva {(lastCalc.aliquotaEfetiva ?? 0).toFixed(2)}%
                      </Badge>
                      <Badge variant="outline">
                        Anexo {(lastCalc.simplesAnexo ?? '').replace('ANEXO_', '')}
                      </Badge>
                      <Badge variant="outline">
                        RBA {formatBRL(lastCalc.rbaAcumulada)}
                      </Badge>
                      <span className="text-[10px] text-zinc-400">
                        v{lastCalc.versaoTabela} · calculado em{' '}
                        {new Date(lastCalc.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <TributarioRecalcButton empresaId={access.empresaId} />
                </div>
                <CalculationFooter versaoTabela={lastCalc.versaoTabela} />
              </CardContent>
            </Card>
          )}

          {!lastCalc && profile.regime === 'SIMPLES_NACIONAL' && (
            <Card className="md:col-span-2">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-zinc-600 mb-3">
                  Nenhum DAS calculado ainda.
                </p>
                <TributarioRecalcButton empresaId={access.empresaId} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
