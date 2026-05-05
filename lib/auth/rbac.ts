// Helpers RBAC (Sub-etapa 5.3.B).
// Reusa lib/auth.ts (getAuthUser) e adiciona contexto de role/permissions
// pra cada par (user, company). Não substitui o auth atual — convive.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { permissionMatches } from './permissions'

// ============================================================
// Tipos públicos
// ============================================================

export interface AuthContext {
  user: {
    id: string
    name: string
    email: string
  }
  company: {
    id: string
  } | null
  role: {
    id: string
    name: string
    isSystemDefault: boolean
  } | null
  permissions: string[]
  hasPermission: (key: string) => boolean
  requirePermission: (key: string) => void
}

// ============================================================
// Erros customizados
// ============================================================

export class AuthenticationError extends Error {
  status = 401
  constructor(message = 'Não autenticado') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class ForbiddenError extends Error {
  status = 403
  permission?: string
  constructor(message: string, permission?: string) {
    super(message)
    this.name = 'ForbiddenError'
    this.permission = permission
  }
}

// ============================================================
// getAuthContext — função principal
// ============================================================

// Retorna o contexto de auth com role/permissions resolvidas pra a empresa.
// - Sem companyId: contexto sem company (rotas globais).
// - Com companyId mas user sem UserCompanyRole: ForbiddenError (403).
// - Sem auth: AuthenticationError (401).
export async function getAuthContext(
  request: NextRequest,
  companyId?: string,
): Promise<AuthContext> {
  const tokenUser = await getAuthUser(request)
  if (!tokenUser) {
    throw new AuthenticationError()
  }

  const user = {
    id: tokenUser.sub,
    name: tokenUser.name,
    email: tokenUser.email,
  }

  if (!companyId) {
    return buildContext(user, null, null, [])
  }

  const ucr = await prisma.userCompanyRole.findFirst({
    where: { userId: user.id, companyId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  })

  if (!ucr) {
    throw new ForbiddenError('Você não tem acesso a esta empresa')
  }

  const permissionKeys = ucr.role.permissions.map((rp) => rp.permission.key)

  return buildContext(
    user,
    { id: companyId },
    {
      id: ucr.role.id,
      name: ucr.role.name,
      isSystemDefault: ucr.role.isSystemDefault,
    },
    permissionKeys,
  )
}

// ============================================================
// buildContext — factory interno
// ============================================================

function buildContext(
  user: AuthContext['user'],
  company: AuthContext['company'],
  role: AuthContext['role'],
  permissions: string[],
): AuthContext {
  return {
    user,
    company,
    role,
    permissions,
    hasPermission(key: string): boolean {
      return permissionMatches(permissions, key)
    },
    requirePermission(key: string): void {
      if (!this.hasPermission(key)) {
        throw new ForbiddenError(`Permissão necessária: ${key}`, key)
      }
    },
  }
}

// ============================================================
// buildAuthContextForTest — pra testes (sem DB)
// ============================================================

export function buildAuthContextForTest(params: {
  user?: Partial<AuthContext['user']>
  company?: AuthContext['company']
  role?: AuthContext['role']
  permissions?: string[]
}): AuthContext {
  return buildContext(
    {
      id: params.user?.id ?? 'test-user-id',
      name: params.user?.name ?? 'Test User',
      email: params.user?.email ?? 'test@example.com',
    },
    params.company ?? null,
    params.role ?? null,
    params.permissions ?? [],
  )
}
