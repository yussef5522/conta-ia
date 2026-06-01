// Sprint post-3B (01/06/2026) — Guard das rotas /api/dev/*.
//
// 🚨 PROTEÇÃO CRÍTICA: estas rotas NUNCA podem rodar em produção.
// O guard checa 2 condições redundantes:
//   1. ASAAS_ENV === 'sandbox'   (precisa estar em ambiente de teste)
//   2. NODE_ENV !== 'production'  OPCIONAL — em prod só vale se sandbox
//
// Se a condição falha, retorna { allow: false, reason } e a rota deve
// responder com 404 (não 403 — não revela existência).
//
// Para verificar em UI/sidebar/etc, use isDevToolsEnabled() (server-side).

export function isDevToolsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ASAAS_ENV === 'sandbox'
}

export interface DevGuardResult {
  allow: boolean
  reason?: 'NOT_SANDBOX'
}

export function checkDevGuard(
  env: Record<string, string | undefined> = process.env,
): DevGuardResult {
  if (!isDevToolsEnabled(env)) {
    return { allow: false, reason: 'NOT_SANDBOX' }
  }
  return { allow: true }
}
