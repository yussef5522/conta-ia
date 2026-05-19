// Session helpers do painel Gerenciador — Sprint 1.6.

import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import {
  ADMIN_COOKIE_NAME,
  verifyAdminToken,
  type AdminTokenPayload,
} from './jwt'

export interface AdminSession {
  gerenciadorId: string
  email: string
  name: string
  role: string
}

// Lê cookie admin_session, valida JWT, retorna sessão OU null.
// NÃO touch DB — só JWT (rápido). Pra dados frescos do gerenciador,
// use loadGerenciador(session.gerenciadorId).
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const store = await cookies()
    const token = store.get(ADMIN_COOKIE_NAME)?.value
    if (!token) return null
    const payload = await verifyAdminToken(token)
    return {
      gerenciadorId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    }
  } catch {
    return null
  }
}

// Variante que lê de NextRequest (uso em middleware/proxy.ts).
export async function getAdminSessionFromRequest(
  request: { cookies: { get: (name: string) => { value: string } | undefined } },
): Promise<AdminTokenPayload | null> {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!token) return null
    return await verifyAdminToken(token)
  } catch {
    return null
  }
}

// Carrega gerenciador fresh do banco. Use quando precisar de active/role atualizados
// (proteção contra "gerenciador suspenso mas com JWT válido").
export async function loadGerenciador(gerenciadorId: string) {
  return prisma.gerenciador.findUnique({
    where: { id: gerenciadorId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })
}
