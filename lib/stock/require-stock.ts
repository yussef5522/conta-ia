// ESTOQUE Fase 3 — guard de permissão das rotas de estoque (substitui o check antigo
// userCompany.findFirst). Usa o RBAC (getAuthContext → UserCompanyRole) e exige a chave
// stock.view | stock.operate | stock.manage. Devolve 401/403 claros ou o userId+nome.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'

export type StockPerm = 'stock.view' | 'stock.operate' | 'stock.manage'

export async function requireStock(request: NextRequest, companyId: string, perm: StockPerm): Promise<{ ok: true; userId: string; userName: string } | { ok: false; res: NextResponse }> {
  try {
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission(perm)
    return { ok: true, userId: ctx.user.id, userName: ctx.user.name }
  } catch (e) {
    if (e instanceof AuthenticationError) return { ok: false, res: NextResponse.json({ erro: 'Sessão expirada', code: 'AUTH_REQUIRED' }, { status: 401 }) }
    if (e instanceof ForbiddenError) return { ok: false, res: NextResponse.json({ erro: e.message, code: 'FORBIDDEN', permission: e.permission }, { status: 403 }) }
    throw e
  }
}
