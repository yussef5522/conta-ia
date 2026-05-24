// Sprint 4.0.5.b — helper centralizado pras server pages globais.
//
// Lê current_empresa_id do cookie + verifyToken + valida acesso via
// UserCompanyRole + opcionalmente checa permission.
//
// Retorna shape pronto pra renderizar OU redireciona/retorna estado especial.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { permissionMatches } from '@/lib/auth/permissions'
import { getCurrentEmpresaIdFromCookie } from './current-empresa-cookie'

export type ResolveEmpresaResult =
  | {
      kind: 'ok'
      empresaId: string
      empresa: { id: string; name: string; tradeName: string | null }
      userId: string
      permissions: string[]
    }
  | { kind: 'no-empresa-selected' }
  | { kind: 'no-access' }
  | { kind: 'forbidden'; missingPermission: string }

export async function resolveEmpresaAccess(
  options: { requirePermission?: string } = {},
): Promise<ResolveEmpresaResult> {
  // 1. Auth check
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

  // 2. Empresa atual do cookie
  const empresaId = await getCurrentEmpresaIdFromCookie()
  if (!empresaId) return { kind: 'no-empresa-selected' }

  // 3. Multi-tenant guard via UserCompanyRole
  const ucr = await prisma.userCompanyRole.findFirst({
    where: { userId: userSub, companyId: empresaId },
    include: {
      company: { select: { id: true, name: true, tradeName: true } },
      role: { include: { permissions: { include: { permission: true } } } },
    },
  })

  if (!ucr) return { kind: 'no-access' }

  const permissions = ucr.role.permissions.map((rp) => rp.permission.key)

  // 4. Permission check opcional
  if (options.requirePermission && !permissionMatches(permissions, options.requirePermission)) {
    return { kind: 'forbidden', missingPermission: options.requirePermission }
  }

  return {
    kind: 'ok',
    empresaId: ucr.companyId,
    empresa: ucr.company,
    userId: userSub,
    permissions,
  }
}
