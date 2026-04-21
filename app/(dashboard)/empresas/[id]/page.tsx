import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Landmark } from 'lucide-react'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { t } from '@/lib/i18n/pt-BR'
import { exibirCNPJ } from '@/lib/format/cnpj'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

async function getEmpresa(id: string, userId: string) {
  const userCompany = await prisma.userCompany.findFirst({
    where: { companyId: id, userId },
    include: { company: { include: { bankAccounts: true } } },
  })
  return userCompany?.company ?? null
}

export const metadata: Metadata = { title: 'Detalhes da Empresa' }

export default async function EmpresaDetailPage({ params }: Props) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const user = await verifyToken(token)
  const empresa = await getEmpresa(id, user.sub)

  if (!empresa) notFound()

  const tipo = t.empresa.tipos[empresa.type as keyof typeof t.empresa.tipos] ?? empresa.type
  const regime = t.empresa.regimes[empresa.taxRegime as keyof typeof t.empresa.regimes] ?? empresa.taxRegime

  return (
    <div className="space-y-6">
      <Header title={empresa.tradeName || empresa.name} description={exibirCNPJ(empresa.cnpj)}>
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresa.id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            {t.common.edit}
          </Link>
        </Button>
      </Header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.empresa.detail.infoBasica}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Razão Social" value={empresa.name} />
            {empresa.tradeName && <InfoRow label="Nome Fantasia" value={empresa.tradeName} />}
            <InfoRow label="CNPJ" value={exibirCNPJ(empresa.cnpj)} mono />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Setor</span>
              <Badge variant="secondary">{tipo}</Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Regime Tributário</span>
              <Badge variant="outline">{regime}</Badge>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={empresa.isActive ? 'success' : 'outline'}>
                {empresa.isActive ? t.empresa.status.ativo : t.empresa.status.inativo}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.empresa.detail.contato}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {empresa.email && <InfoRow label="E-mail" value={empresa.email} />}
            {empresa.phone && <InfoRow label="Telefone" value={empresa.phone} />}
            {empresa.address && <InfoRow label="Endereço" value={empresa.address} />}
            {empresa.city && (
              <InfoRow
                label="Cidade"
                value={`${empresa.city}${empresa.state ? ` - ${empresa.state}` : ''}`}
              />
            )}
            {empresa.zipCode && <InfoRow label="CEP" value={empresa.zipCode} />}
            {!empresa.email && !empresa.phone && !empresa.address && (
              <p className="text-sm text-muted-foreground">
                Nenhuma informação de contato cadastrada.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-3">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{t.empresa.detail.contas}</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">{t.empresa.detail.nenhumaContaDesc}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
