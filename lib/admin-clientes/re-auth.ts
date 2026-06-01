// Sprint Gestão de Conta (31/05/2026) — Re-auth do Gerenciador.
//
// Ações sensíveis (reset password, change email, delete user) exigem
// que o Gerenciador re-confirme a senha mesmo já estando logado.
// Padrão Google Workspace/Microsoft 365.
//
// Rate-limit: 3 tentativas → lockout 15min via lib/rate-limit.ts
// (chave por gerenciadorId+action).

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export type ReAuthResult =
  | { ok: true }
  | { ok: false; code: 'RATE_LIMITED'; retryAfterMs: number }
  | { ok: false; code: 'INVALID_PASSWORD' }
  | { ok: false; code: 'GERENCIADOR_INVALID' }

export async function reAuthGerenciador(
  gerenciadorId: string,
  password: string,
  action: 'reset-password' | 'change-email' | 'delete-user',
): Promise<ReAuthResult> {
  // Rate-limit ANTES de hashing pra mitigar timing attacks
  const key = `admin-reauth:${gerenciadorId}:${action}`
  const rl = rateLimit(key, 3, 15 * 60 * 1000) // 3 tentativas / 15min
  if (!rl.allowed) {
    return { ok: false, code: 'RATE_LIMITED', retryAfterMs: rl.retryAfterMs }
  }

  const gerenciador = await prisma.gerenciador.findUnique({
    where: { id: gerenciadorId },
    select: { id: true, passwordHash: true, active: true },
  })

  if (!gerenciador || !gerenciador.active) {
    return { ok: false, code: 'GERENCIADOR_INVALID' }
  }

  const valid = await bcrypt.compare(password, gerenciador.passwordHash)
  if (!valid) {
    return { ok: false, code: 'INVALID_PASSWORD' }
  }

  return { ok: true }
}
