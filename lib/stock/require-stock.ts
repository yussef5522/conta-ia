// ESTOQUE Fase 3 — guard de permissão das rotas de estoque (substitui o check antigo
// userCompany.findFirst). Usa o RBAC (getAuthContext → UserCompanyRole) e exige a chave
// stock.view | stock.operate | stock.manage. Devolve 401/403 claros ou o userId+nome.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'

export type StockPerm = 'stock.view' | 'stock.operate' | 'stock.manage'

/**
 * MESMA decisão, no formato que as 31 rotas antigas já consomem
 * (`const a = await guardStock(...); if (a.erro) return a.erro;` e depois `a.user.sub`).
 *
 * Existe pra a migração ter UM choke-point (REGRA 5): o check estava COPIADO em 31
 * arquivos como um helper `auth()` local — 31 cópias da mesma decisão, cada uma livre pra
 * divergir. Trocar cópia por cópia por `requireStock` obrigaria a reescrever cada call
 * site (formato diferente) e abriria espaço pra errar em silêncio numa delas. Este
 * adaptador mantém a forma e troca a REGRA: quem decide é o RBAC, não a `UserCompany`.
 */
export async function guardStock(
  request: NextRequest,
  companyId: string,
  perm: StockPerm,
): Promise<{ erro: NextResponse; user?: undefined } | { erro?: undefined; user: { sub: string; name: string } }> {
  const r = await requireStock(request, companyId, perm)
  if (!r.ok) return { erro: r.res }
  return { user: { sub: r.userId, name: r.userName } }
}

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
