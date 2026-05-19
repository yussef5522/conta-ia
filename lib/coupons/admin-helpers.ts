// Helpers de auth + audit pros endpoints admin de cupons — Sprint 1.7.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  getAdminSessionFromRequest,
  loadGerenciador,
} from '@/lib/admin-auth/session'
import { isAdminHost } from '@/lib/middleware/subdomain'

export interface AdminGuardOk {
  ok: true
  gerenciador: {
    id: string
    name: string
    email: string
    role: string
  }
  ipAddress: string | null
  userAgent: string | null
}

export interface AdminGuardFail {
  ok: false
  response: NextResponse
}

// Centraliza: host check (404 se chamado via app.*) + auth + active check.
// Retorna gerenciador fresh + ip/ua pra audit.
export async function adminGuard(
  request: NextRequest,
): Promise<AdminGuardOk | AdminGuardFail> {
  if (!isAdminHost(request.headers.get('host'))) {
    return {
      ok: false,
      response: new NextResponse('Not Found', { status: 404 }),
    }
  }

  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { erro: 'Não autenticado', success: false },
        { status: 401 },
      ),
    }
  }

  const gerenciador = await loadGerenciador(session.sub)
  if (!gerenciador || !gerenciador.active) {
    return {
      ok: false,
      response: NextResponse.json(
        { erro: 'Sessão inválida', success: false },
        { status: 401 },
      ),
    }
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  return {
    ok: true,
    gerenciador: {
      id: gerenciador.id,
      name: gerenciador.name,
      email: gerenciador.email,
      role: gerenciador.role,
    },
    ipAddress,
    userAgent,
  }
}

// Audit log helper (fire-and-forget — não bloqueia retorno).
export function logAdminAudit(args: {
  gerenciadorId: string
  action: string
  entityType?: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}): void {
  void prisma.gerenciadorAuditLog
    .create({
      data: {
        gerenciadorId: args.gerenciadorId,
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        metadata: args.metadata ? JSON.stringify(args.metadata) : null,
        ipAddress: args.ipAddress ?? null,
        userAgent: args.userAgent ?? null,
      },
    })
    .catch((e) =>
      console.error('[admin audit]', e instanceof Error ? e.message : 'erro'),
    )
}
