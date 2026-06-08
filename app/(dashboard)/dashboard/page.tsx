// Dashboard Mundial — Sprint 1 Dia 1 + Sprint 2 Dia 1.
// Server Component. Cache via lib/dashboard/queries (unstable_cache 60s).
//
// URL params:
//   ?empresa=<id>  → fixa a empresa. Sem param: usa primeira por createdAt ASC.
//   ?wf=<periodo>  → período do Cashflow Waterfall (semana|mes|trimestre|ano).
//
// Empty states cobertos: sem empresas (a), sem contas (b), sem transações (c).

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { z } from 'zod'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getCurrentEmpresaIdFromCookie } from '@/lib/auth/current-empresa-cookie'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'
import type { WaterfallPeriodType } from '@/lib/dashboard/compute-waterfall'
// Sprint 5.0.3.2 — CompanySelector import removido (não usado mais aqui).
// Arquivo do componente preservado pra reuso futuro.
import { HeroKPIs } from './_components/HeroKPIs'
import { AIInsights } from './_components/AIInsights'
import { InsightsSkeleton } from './_components/InsightsSkeleton'
import { MiniDRE } from './_components/MiniDRE'
import { TopCategories } from './_components/TopCategories'
import { HealthCheck } from './_components/HealthCheck'
import { OrphanWithdrawalsBanner } from './_components/OrphanWithdrawalsBanner'
import { CashflowWaterfall } from './_components/CashflowWaterfall'
import { RecentActivity } from './_components/RecentActivity'
import { PrevistoSection } from './_components/PrevistoSection'
import { PendingClassification } from './_components/PendingClassification'
import {
  NoCompaniesEmpty,
  NoAccountsEmpty,
  NoTransactionsBanner,
} from './_components/EmptyDashboard'
import { ImportedBanner } from './_components/ImportedBanner'

export const metadata: Metadata = { title: 'Dashboard' }

// Valida ?wf= no server — nunca confiar na URL. Default 'mes' se inválido/ausente.
const waterfallPeriodSchema = z
  .enum(['semana', 'mes', 'trimestre', 'ano'])
  .catch('mes')

// Sprint 2 Dia 5: ?demoInsights=N → mock N insights (1-7). IGNORADO em prod.
// Validação no server pra evitar injection (string arbitrária).
const demoInsightsSchema = z.coerce.number().int().min(0).max(7).catch(0)

interface PageProps {
  searchParams: Promise<{ empresa?: string; wf?: string; demoInsights?: string; imported?: string; totalAmount?: string; empresaNome?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  // Bug 2 fix: se workspace=PF, redirect pro perfil PF correspondente.
  // Server Component não tem acesso ao workspace-context (client), então
  // lê do cookie httpOnly setado em /api/workspace/atual.
  const workspaceType = cookieStore.get('caixaos_workspace_type')?.value
  if (workspaceType === 'pf') {
    const profileId = cookieStore.get('caixaos_perfil_atual')?.value
    if (profileId) {
      redirect(`/perfis/${profileId}`)
    }
  }

  const user = await verifyToken(token)
  const {
    empresa: empresaQueryId,
    wf: wfRaw,
    demoInsights: demoRaw,
    imported: importedRaw,
    totalAmount: totalAmountRaw,
    empresaNome: importedFileName,
  } = await searchParams
  // Sprint 5.0.2.0 — banner pós-import (defensivo: parsing seguro)
  const importedCount = importedRaw ? parseInt(importedRaw, 10) : NaN
  const importedTotalAmount = totalAmountRaw ? parseFloat(totalAmountRaw) : NaN
  const waterfallPeriod: WaterfallPeriodType = waterfallPeriodSchema.parse(wfRaw)
  // SEGURANÇA: demoInsights só funciona em dev. Em prod, demoCount=undefined
  // sempre — AIInsights ignora e retorna lista real.
  const demoCount =
    process.env.NODE_ENV !== 'production'
      ? demoInsightsSchema.parse(demoRaw) || undefined
      : undefined

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

  // Sprint 5.0.3.3 — Resolve empresa atual com prioridade:
  //   1. URL param `?empresa=` (deep-link / share)
  //   2. Cookie httpOnly `current_empresa_id` (escolha do user no WorkspaceSwitcher)
  //   3. empresas[0] (primeira por createdAt — fallback determinístico)
  //
  // Antes: só (1) e (3) → dashboard sempre pegava `empresas[0]` quando user
  // navegava de outra tela sem `?empresa=` na URL. WorkspaceSwitcher setava
  // o cookie mas o dashboard ignorava — empresa errada exibida.
  const cookieEmpresaId = await getCurrentEmpresaIdFromCookie()
  const fromQuery = empresaQueryId
    ? empresas.find((e) => e.id === empresaQueryId)
    : undefined
  const fromCookie = cookieEmpresaId
    ? empresas.find((e) => e.id === cookieEmpresaId)
    : undefined
  const empresaAtual = fromQuery ?? fromCookie ?? empresas[0]

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
        {/* Sprint 5.0.3.2 — CompanySelector removido do dashboard.
            WorkspaceSwitcher (top bar global) é o canônico pra trocar empresa.
            Componente CompanySelector.tsx mantido no projeto pra reuso futuro. */}
      </Header>

      {/* Sprint 5.0.2.0 — Banner pós-import Excel (só renderiza com query params) */}
      <ImportedBanner
        imported={Number.isFinite(importedCount) ? importedCount : undefined}
        totalAmount={Number.isFinite(importedTotalAmount) ? importedTotalAmount : undefined}
        fileName={importedFileName}
      />

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

          {/* AI Insights — Sprint 2 Dia 3 + polish Dia 5. */}
          <Suspense fallback={<InsightsSkeleton />}>
            <AIInsights companyId={empresaAtual.id} demoCount={demoCount} />
          </Suspense>

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<CardSkeleton height={280} />}>
              <MiniDRE companyId={empresaAtual.id} />
            </Suspense>
            <Suspense fallback={<CardSkeleton height={280} />}>
              <TopCategories companyId={empresaAtual.id} />
            </Suspense>
          </div>

          <Suspense fallback={<CardSkeleton height={200} />}>
            <HealthCheck companyId={empresaAtual.id} />
          </Suspense>

          {/* Sprint Fluxo-Único-Retirada (08/06/2026) — contador de
              retiradas órfãs. Renderiza nada se count=0 (zero ruído). */}
          <Suspense fallback={null}>
            <OrphanWithdrawalsBanner companyId={empresaAtual.id} />
          </Suspense>

          {/* Sprint 4.0.3 — Fluxo Previsto + Alertas Vencimento */}
          <Suspense fallback={<CardSkeleton height={260} />}>
            <PrevistoSection companyId={empresaAtual.id} />
          </Suspense>

          {/* Cashflow Waterfall — full width */}
          <Suspense fallback={<CardSkeleton height={440} />}>
            <CashflowWaterfall
              companyId={empresaAtual.id}
              periodType={waterfallPeriod}
            />
          </Suspense>

          {/* Atividade Recente (60%) + Pendentes Classificação (40%) */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Suspense fallback={<CardSkeleton height={420} />}>
                <RecentActivity companyId={empresaAtual.id} />
              </Suspense>
            </div>
            <div className="lg:col-span-2">
              <Suspense fallback={<CardSkeleton height={420} />}>
                <PendingClassification companyId={empresaAtual.id} />
              </Suspense>
            </div>
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
