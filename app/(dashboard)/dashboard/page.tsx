import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, Landmark, TrendingUp, Plus } from 'lucide-react'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n/pt-BR'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardData(userId: string) {
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId },
    include: { company: true },
  })

  const empresas = userCompanies.map((uc) => uc.company)
  const total = empresas.length
  const ativas = empresas.filter((e) => e.isActive).length

  return { total, ativas, empresas }
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)
  const { total, ativas, empresas } = await getDashboardData(user.sub)

  const primeiroNome = user.name.split(' ')[0]

  return (
    <div className="space-y-8">
      <Header
        title={`${t.dashboard.welcome}, ${primeiroNome}!`}
        description="Aqui está um resumo das suas empresas."
      />

      {/* Cards de métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.dashboard.totalEmpresas}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {total === 1 ? t.empresa.list.total : t.empresa.list.totalPlural} cadastradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.dashboard.empresasAtivas}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{ativas}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {total > 0 ? `${Math.round((ativas / total) * 100)}% do total` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.dashboard.saldoTotal}
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.emBreve}</p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.dashboard.transacoesHoje}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">—</div>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.emBreve}</p>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo principal */}
      {total === 0 ? (
        // Estado vazio — sem empresas ainda
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{t.dashboard.primeiraEmpresa}</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {t.dashboard.primeiraEmpresaDesc}
            </p>
            <Button className="mt-6" asChild>
              <Link href="/empresas/nova">
                <Plus className="mr-2 h-4 w-4" />
                {t.dashboard.adicionarEmpresa}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Lista resumida das empresas
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Suas Empresas</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/empresas">Ver todas</Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {empresas.slice(0, 5).map((empresa) => (
              <Link
                key={empresa.id}
                href={`/empresas/${empresa.id}`}
                className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                  {(empresa.tradeName || empresa.name)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{empresa.tradeName || empresa.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{empresa.cnpj}</p>
                </div>
                <Badge variant={empresa.isActive ? 'success' : 'outline'} className="shrink-0">
                  {empresa.isActive ? t.empresa.status.ativo : t.empresa.status.inativo}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
