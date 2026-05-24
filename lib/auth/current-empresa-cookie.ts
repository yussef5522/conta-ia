// Sprint 4.0.5.b — cookie httpOnly de empresa atual.
//
// Setado pelo TopBar WorkspaceSwitcher (via POST /api/empresas/atual).
// Lido pelas server pages globais (/dre, /categorias, etc).
//
// Estratégia:
//   - httpOnly + sameSite=lax (segurança)
//   - 90 dias (lembrança longa, user troca pouco de empresa)
//   - Path '/' (disponível em toda app)
//   - Secure conforme COOKIE_SECURE env (mesma flag do auth_token)

import { cookies } from 'next/headers'

export const CURRENT_EMPRESA_COOKIE = 'current_empresa_id'
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60 // 90 dias

function isSecure(): boolean {
  // Mesma lógica do auth_token (lib/auth.ts compatível)
  return process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'
}

/** Lê cookie no server (use em page.tsx ou route.ts) */
export async function getCurrentEmpresaIdFromCookie(): Promise<string | null> {
  const store = await cookies()
  return store.get(CURRENT_EMPRESA_COOKIE)?.value ?? null
}

/** Seta cookie (use em route handler POST) */
export async function setCurrentEmpresaCookie(empresaId: string): Promise<void> {
  const store = await cookies()
  store.set({
    name: CURRENT_EMPRESA_COOKIE,
    value: empresaId,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

/** Remove (logout ou empresa deletada) */
export async function clearCurrentEmpresaCookie(): Promise<void> {
  const store = await cookies()
  store.delete(CURRENT_EMPRESA_COOKIE)
}
