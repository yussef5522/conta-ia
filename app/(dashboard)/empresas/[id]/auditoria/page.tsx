import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { permissionMatches } from '@/lib/auth/permissions'
import { AuditoriaClient } from './auditoria-client'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = { title: 'Auditoria' }

export default async function AuditoriaPage({ params }: PageProps) {
  const { id: empresaId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  let userSub: string
  try {
    const payload = await verifyToken(token)
    userSub = payload.sub
  } catch {
    redirect('/login')
  }

  // Multi-tenant: confirma acesso à empresa via UserCompanyRole
  const ucr = await prisma.userCompanyRole.findFirst({
    where: { userId: userSub, companyId: empresaId },
    include: {
      company: { select: { id: true, name: true, tradeName: true } },
      role: { include: { permissions: { include: { permission: true } } } },
    },
  })

  if (!ucr) notFound()

  const permKeys = ucr.role.permissions.map((rp) => rp.permission.key)

  const hasAuditView = permissionMatches(permKeys, 'audit.view')

  if (!hasAuditView) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-900/50 dark:bg-orange-950/30">
          <h1 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            🔒 Acesso restrito
          </h1>
          <p className="mt-2 text-sm text-orange-800 dark:text-orange-200">
            Você não tem permissão pra visualizar a auditoria desta empresa.
            Entre em contato com o administrador.
          </p>
        </div>
      </div>
    )
  }

  const canExport = permissionMatches(permKeys, 'audit.export')

  return (
    <AuditoriaClient
      empresaId={empresaId}
      empresaNome={ucr.company.tradeName ?? ucr.company.name}
      canExport={canExport}
    />
  )
}
