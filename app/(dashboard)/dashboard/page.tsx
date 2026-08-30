// Sprint 7 — Dashboard Mercury (24/06/2026).
//
// Reescrito do zero — fonte única (motor Sprint 4), layout calmo, seletor
// compacto de período. Componentes antigos (HeroKPIs, AIInsights, MiniDRE,
// HealthCheck, CashflowWaterfall, OrphanWithdrawalsBanner, PrevistoSection,
// RecentActivity, PendingClassification) preservados no projeto pra rota
// /dashboard-old caso seja necessário.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { getCurrentEmpresaIdFromCookie } from '@/lib/auth/current-empresa-cookie'
import { prisma } from '@/lib/db'
import { Skeleton } from '@/components/ui/skeleton'
import type { Metadata } from 'next'
import type { CustomPeriod, Regime } from '@/lib/dashboard/engine'
import {
  getCurrentMTD,
  getFullMonth,
  isCurrentMonth,
  labelMesAno,
  parsePeriodoYM,
} from '@/lib/dashboard/period-sp'
import { PeriodSelector } from './_components/PeriodSelector'
import { JuizSelo } from './_components/JuizSelo'
import { MercuryDashboard } from './_components/MercuryDashboard'
import {
  NoCompaniesEmpty,
  NoAccountsEmpty,
  NoTransactionsBanner,
} from './_components/EmptyDashboard'
import { ImportedBanner } from './_components/ImportedBanner'

export const metadata: Metadata = { title: 'Dashboard' }

interface PageProps {
  searchParams: Promise<{
    empresa?: string
    regime?: string
    periodo?: string
    de?: string
    ate?: string
    imported?: string
    totalAmount?: string
    empresaNome?: string
  }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  // PF redirect (preservado da versão anterior)
  const workspaceType = cookieStore.get('caixaos_workspace_type')?.value
  if (workspaceType === 'pf') {
    const profileId = cookieStore.get('caixaos_perfil_atual')?.value
    if (profileId) redirect(`/perfis/${profileId}`)
  }

  const user = await verifyToken(token)
  const sp = await searchParams

  // ⭐⭐ AS DUAS PORTAS DE VÍNCULO (30/08/2026) — mesma correção de `/api/empresas`.
  // Esta página lia só `UserCompany` (o modelo ANTIGO), e o convite grava
  // `UserCompanyRole` (RBAC): a convidada caía no empty state "você não está em nenhuma
  // empresa" mesmo sendo membro de verdade.
  const [porLegado, porPapel] = await Promise.all([
    prisma.userCompany.findMany({ where: { userId: user.sub }, include: { company: true }, orderBy: { createdAt: 'asc' } }),
    prisma.userCompanyRole.findMany({
      where: { userId: user.sub },
      include: { company: true, role: { include: { permissions: { include: { permission: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const porId = new Map<string, (typeof porLegado)[number]['company']>()
  for (const uc of porLegado) porId.set(uc.company.id, uc.company)
  for (const ucr of porPapel) porId.set(ucr.company.id, ucr.company)
  const empresas = [...porId.values()]

  // ⭐⭐ QUEM SÓ OPERA ESTOQUE NÃO PASSA PELO DASHBOARD (pedido do dono, 30/08).
  //
  // ⚠️ O dashboard mostra FATURAMENTO. Pra uma operadora de estoque ele não é só inútil —
  // é o número que ela não deveria ver, na primeira tela do login. Enquanto não existir um
  // "dashboard do estoque", o login dela cai direto na Posição.
  const chaves = new Set(porPapel.flatMap((p) => p.role.permissions.map((rp) => rp.permission.key)))
  const soEstoque = !chaves.has('transaction.view') && !chaves.has('*') && chaves.has('stock.view')
  if (soEstoque && empresas.length > 0) {
    redirect(`/empresas/${porPapel[0].companyId}/estoque/posicao`)
  }

  // ====== Empty state — sem empresas ======
  if (empresas.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-medium">Bem-vindo, {user.name.split(' ')[0]}</h1>
        <NoCompaniesEmpty />
      </div>
    )
  }

  // Resolução de empresa: URL → cookie → first
  const cookieEmpresaId = await getCurrentEmpresaIdFromCookie()
  const fromQuery = sp.empresa ? empresas.find((e) => e.id === sp.empresa) : undefined
  const fromCookie = cookieEmpresaId ? empresas.find((e) => e.id === cookieEmpresaId) : undefined
  const empresaAtual = fromQuery ?? fromCookie ?? empresas[0]

  // ====== Regime e Período ======
  const regime: Regime = sp.regime === 'competencia' ? 'competencia' : 'caixa'

  const now = new Date()
  let currentYear: number
  let currentMonth: number // 0-11
  let customPeriod!: CustomPeriod // definite assignment via if/else abaixo

  // Prioridade: ?de=&ate= (raro, custom range) → ?periodo=YYYY-MM → MTD default
  if (sp.de && sp.ate) {
    const start = new Date(`${sp.de}T00:00:00.000Z`)
    const end = new Date(`${sp.ate}T23:59:59.999Z`)
    customPeriod = { start, end }
    currentYear = start.getUTCFullYear()
    currentMonth = start.getUTCMonth()
  } else {
    const parsed = parsePeriodoYM(sp.periodo)
    if (parsed && !isCurrentMonth(parsed.year, parsed.month, now)) {
      // Mês passado completo
      customPeriod = getFullMonth(parsed.year, parsed.month)
      currentYear = parsed.year
      currentMonth = parsed.month
    } else {
      // Default: MTD em SP
      const mtd = getCurrentMTD(now)
      customPeriod = { start: mtd.start, end: mtd.end }
      currentYear = mtd.year
      currentMonth = mtd.month
    }
  }

  const isMTD = isCurrentMonth(currentYear, currentMonth, now)
  const periodLabel = isMTD
    ? `${labelMesAno(currentYear, currentMonth).toLowerCase()} até hoje`
    : labelMesAno(currentYear, currentMonth).toLowerCase()

  // ====== Empty checks ======
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

  // Banner pós-import (preservado)
  const importedCount = sp.imported ? parseInt(sp.imported, 10) : NaN
  const importedTotalAmount = sp.totalAmount ? parseFloat(sp.totalAmount) : NaN

  // ====== Render ======
  return (
    <div className="space-y-6">
      {/* Header sutil */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Dashboard
          </div>
          <h1 className="text-xl font-medium">
            {empresaAtual.tradeName ?? empresaAtual.name}
          </h1>
          {/* Fase 3 CAMADA 3: selo do juiz — verde/vermelho/amarelo(>24h) */}
          <div className="pt-1">
            <JuizSelo />
          </div>
        </div>
        <PeriodSelector
          empresaId={empresaAtual.id}
          currentYear={currentYear}
          currentMonth={currentMonth}
          regime={regime}
          isMTD={isMTD}
        />
      </div>

      <ImportedBanner
        imported={Number.isFinite(importedCount) ? importedCount : undefined}
        totalAmount={Number.isFinite(importedTotalAmount) ? importedTotalAmount : undefined}
        fileName={sp.empresaNome}
      />

      {/* Empty states */}
      {contasCount === 0 && <NoAccountsEmpty empresaId={empresaAtual.id} />}
      {contasCount > 0 && transacoesCount === 0 && primeiraConta && (
        <NoTransactionsBanner
          empresaId={empresaAtual.id}
          contaId={primeiraConta.id}
        />
      )}

      {/* Mercury layout */}
      {contasCount > 0 && (
        <Suspense fallback={<DashboardSkeleton />}>
          <MercuryDashboard
            empresaId={empresaAtual.id}
            regime={regime}
            customPeriod={customPeriod}
            periodLabel={periodLabel}
          />
        </Suspense>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-20 w-72" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
