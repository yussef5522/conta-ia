// Sprint 5.0.2.h — /bancos: hub de contas bancárias (padrão QuickBooks/Xero).
//
// Lista as contas da empresa atual com cards visuais + atalho "Importar OFX"
// direto. Substitui o caminho de 6 cliques (Dashboard → Empresas → Empresa
// → Contas modal → seleciona → Importar) por 1 clique no sidebar.

import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Landmark, Upload, FileBarChart } from 'lucide-react'
import { prisma } from '@/lib/db'
import { resolveEmpresaAccess } from '@/lib/auth/resolve-empresa-access'
import {
  NoEmpresaSelectedState,
  NoAccessState,
} from '@/components/empresa/empty-empresa-state'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/lib/format/money'

export const metadata: Metadata = { title: 'Bancos' }
export const dynamic = 'force-dynamic'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
}

function freshnessLabel(lastImport: Date | null): {
  label: string
  tone: 'green' | 'amber' | 'red' | 'zinc'
} {
  if (!lastImport) return { label: 'Nunca importado', tone: 'red' }
  const days = Math.floor((Date.now() - lastImport.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return { label: 'Importado hoje', tone: 'green' }
  if (days === 1) return { label: 'Importado ontem', tone: 'green' }
  if (days <= 7) return { label: `Importado há ${days} dias`, tone: 'green' }
  if (days <= 14) return { label: `Importado há ${days} dias`, tone: 'amber' }
  if (days <= 30) return { label: `Importado há ${days} dias`, tone: 'amber' }
  return { label: `Importado há ${days} dias`, tone: 'red' }
}

const TONE_CLASSES: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200',
}

export default async function BancosPage() {
  const access = await resolveEmpresaAccess()
  if (access.kind === 'no-empresa-selected') return <NoEmpresaSelectedState />
  if (access.kind === 'no-access') return <NoAccessState />
  if (access.kind === 'forbidden') return <NoAccessState />

  const empresaId = access.empresaId

  // Busca contas + última data de import (OFX/PLUGGY) em paralelo
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: empresaId, isActive: true },
    orderBy: [{ bankName: 'asc' }, { name: 'asc' }],
  })

  const lastImports = new Map<string, Date>()
  for (const conta of contas) {
    const tx = await prisma.transaction.findFirst({
      where: {
        bankAccountId: conta.id,
        origin: { in: ['OFX', 'PLUGGY'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (tx) lastImports.set(conta.id, tx.createdAt)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Bancos"
        description={`Contas bancárias de ${access.empresa.tradeName ?? access.empresa.name}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={`/empresas/${empresaId}/contas/nova`}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova conta
          </Link>
        </Button>
      </Header>

      {contas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Landmark className="h-12 w-12 text-zinc-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-zinc-700">
                Nenhuma conta bancária cadastrada
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                Adicione uma conta pra começar a importar extratos OFX.
              </p>
            </div>
            <Button asChild>
              <Link href={`/empresas/${empresaId}/contas/nova`}>
                <Plus className="h-4 w-4 mr-1.5" />
                Cadastrar primeira conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contas.map((conta) => {
            const last = lastImports.get(conta.id) ?? null
            const freshness = freshnessLabel(last)
            return (
              <Card key={conta.id} className="hover:border-indigo-300 transition-colors">
                <CardContent className="py-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">
                          {conta.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {conta.bankName ?? 'Banco'} · {TIPO_LABELS[conta.accountType] ?? conta.accountType}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase text-zinc-500 tracking-wide">Saldo</p>
                    <p
                      className={
                        'text-xl font-bold tabular-nums ' +
                        (conta.balance < 0 ? 'text-red-600' : 'text-zinc-900')
                      }
                    >
                      {formatBRL(conta.balance)}
                    </p>
                  </div>

                  <Badge variant="outline" className={'text-[10px] ' + TONE_CLASSES[freshness.tone]}>
                    {freshness.label}
                  </Badge>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <Button asChild variant="default" size="sm">
                      <Link
                        href={`/empresas/${empresaId}/contas/${conta.id}/importar`}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Importar OFX
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/transacoes?empresa=${empresaId}&contaId=${conta.id}`}
                      >
                        <FileBarChart className="h-3.5 w-3.5 mr-1" />
                        Ver tx
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
