import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Landmark, Plus, ArrowUpRight, ArrowDownRight, Inbox, ListTree } from 'lucide-react'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { t } from '@/lib/i18n/pt-BR'
import { exibirCNPJ } from '@/lib/format/cnpj'
import { formatBRL } from '@/lib/format/money'
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

// Conta transações sem categoria (pendentes de classificação) da empresa.
// status=PENDING exclui as marcadas como ignoradas pelo usuário.
async function getContagemPendentes(empresaId: string): Promise<number> {
  return prisma.transaction.count({
    where: {
      categoryId: null,
      status: 'PENDING',
      bankAccount: { companyId: empresaId },
    },
  })
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

  const pendentesCount = await getContagemPendentes(empresa.id)

  const tipo = t.empresa.tipos[empresa.type as keyof typeof t.empresa.tipos] ?? empresa.type
  const regime = t.empresa.regimes[empresa.taxRegime as keyof typeof t.empresa.regimes] ?? empresa.taxRegime

  return (
    <div className="space-y-6">
      <Header title={empresa.tradeName || empresa.name} description={exibirCNPJ(empresa.cnpj)}>
        {pendentesCount > 0 && (
          <Button variant="outline" asChild>
            <Link href={`/empresas/${empresa.id}/pendentes`}>
              <Inbox className="mr-2 h-4 w-4" />
              Pendentes ({pendentesCount})
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresa.id}/categorias`}>
            <ListTree className="mr-2 h-4 w-4" />
            Plano de Contas
          </Link>
        </Button>
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
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{t.empresa.detail.contas}</CardTitle>
              {empresa.bankAccounts.length > 0 && (
                <Badge variant="secondary">{empresa.bankAccounts.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {empresa.bankAccounts.length > 0 && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/empresas/${empresa.id}/contas`}>Ver todas</Link>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href={`/empresas/${empresa.id}/contas/nova`}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar Conta
                </Link>
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {empresa.bankAccounts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Cadastre uma conta para controlar o saldo desta empresa.</p>
                <Button size="sm" asChild>
                  <Link href={`/empresas/${empresa.id}/contas/nova`}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar primeira conta
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {empresa.bankAccounts.map((conta) => (
                  <Link
                    key={conta.id}
                    href={`/empresas/${empresa.id}/contas/${conta.id}/transacoes`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{conta.name}</p>
                      <p className="text-xs text-muted-foreground">{conta.bankName ?? 'Banco não informado'}</p>
                    </div>
                    <div className={`flex items-center gap-1 font-semibold text-sm shrink-0 ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {conta.balance >= 0
                        ? <ArrowUpRight className="h-3.5 w-3.5" />
                        : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {formatBRL(conta.balance)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
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
