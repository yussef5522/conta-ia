// Dashboard Mundial — Sprint 1 Dia 1.
// Server Component. Cache via lib/dashboard/queries (unstable_cache 60s).
//
// URL params:
//   ?empresa=<id>  → fixa a empresa. Sem param: usa primeira por createdAt ASC.
//
// Empty states cobertos: sem empresas (a), sem contas (b), sem transações (c).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'
import { CompanySelector } from './_components/CompanySelector'
import { HeroKPIs } from './_components/HeroKPIs'
import { MiniDRE } from './_components/MiniDRE'
import { TopCategories } from './_components/TopCategories'
import {
  NoCompaniesEmpty,
  NoAccountsEmpty,
  NoTransactionsBanner,
} from './_components/EmptyDashboard'

export const metadata: Metadata = { title: 'Dashboard' }

interface PageProps {
  searchParams: Promise<{ empresa?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)
  const { empresa: empresaQueryId } = await searchParams

  // Busca empresas do user (createdAt ASC pra determinismo)
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: user.sub },
    include: { company: true },
    orderBy: { createdAt: 'asc' },
  })

  const empresas = userCompanies.map((uc) => uc.company)
  const primeiroNome = user.name.split(' ')[0]

  // ============================================================
  // EMPTY STATE (a) — sem empresas
  // ============================================================
  if (empresas.length === 0) {
    return (
      <div className="space-y-8">
        <Header
          title={`Bem-vindo, ${primeiroNome}!`}
          description="Vamos começar cadastrando sua empresa."
        />
        <NoCompaniesEmpty />
      </div>
    )
  }

  // Resolve empresa atual: URL param OU primeira da lista
  const empresaAtual =
    (empresaQueryId && empresas.find((e) => e.id === empresaQueryId)) || empresas[0]

  const companyOptions = empresas.map((e) => ({
    id: e.id,
    name: e.name,
    tradeName: e.tradeName,
  }))

  // Checa contas e transações pra empresa atual (decidir empty states b/c)
  const [contasCount, primeiraConta, transacoesCount] = await Promise.all([
    prisma.bankAccount.count({
      where: { companyId: empresaAtual.id, isActive: true },
    }),
    prisma.bankAccount.findFirst({
      where: { companyId: empresaAtual.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.transaction.count({
      where: { bankAccount: { companyId: empresaAtual.id } },
    }),
  ])

  return (
    <div className="space-y-6">
      <Header
        title={`Bem-vindo, ${primeiroNome}!`}
        description={empresaAtual.tradeName || empresaAtual.name}
      >
        <CompanySelector empresas={companyOptions} currentEmpresaId={empresaAtual.id} />
      </Header>

      {/* EMPTY STATE (b) — sem contas */}
      {contasCount === 0 && <NoAccountsEmpty empresaId={empresaAtual.id} />}

      {/* EMPTY STATE (c) — sem transações: banner discreto + KPIs zerados em sequência */}
      {contasCount > 0 && transacoesCount === 0 && primeiraConta && (
        <NoTransactionsBanner
          empresaId={empresaAtual.id}
          contaId={primeiraConta.id}
        />
      )}

      {/* Hero Strip — sempre renderiza quando há contas (mesmo zerado) */}
      {contasCount > 0 && (
        <>
          <Suspense fallback={<HeroKPIsSkeleton />}>
            <HeroKPIs companyId={empresaAtual.id} />
          </Suspense>

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<CardSkeleton height={280} />}>
              <MiniDRE companyId={empresaAtual.id} />
            </Suspense>
            <Suspense fallback={<CardSkeleton height={280} />}>
              <TopCategories companyId={empresaAtual.id} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  )
}

function HeroKPIsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[148px] w-full rounded-lg" />
      ))}
    </div>
  )
}

function CardSkeleton({ height }: { height: number }) {
  return <Skeleton style={{ height }} className="w-full rounded-lg" />
}
