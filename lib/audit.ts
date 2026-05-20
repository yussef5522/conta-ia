// Audit log helpers (Sub-etapa 5.3.B).
// Permite logAudit em rotas, suporta participação em prisma.$transaction
// (passa tx opcional) e captura snapshot de IP/user-agent.

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { AuthContext } from './auth/rbac'

// ============================================================
// Tipos
// ============================================================

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'RESTORE_TEMPLATE'
  | 'REORDER'
  | 'IMPORT'
  | 'EXPORT'
  // Sprint 1.5 — Esqueci senha + emails transacionais
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_VERIFIED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'PASSWORD_RESET_FAILED'
  | 'TEAM_INVITE_SENT'
  | 'WELCOME_EMAIL_SENT'
  | 'EMAIL_DELIVERY_FAILED'
  // Onda 2 Sprint 2.1 — IA Contadora regras
  | 'RULE_UPDATED'
  | 'RULE_DELETED'
  | 'RULE_PAUSED'
  | 'RULE_RESUMED'
  // Onda 2 Sprint 2.2 — IA Contadora fornecedores
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DELETED'
  // Onda 2 Sprint 2.3 — histórico OFX
  | 'OFX_IMPORT_STARTED'
  | 'OFX_IMPORT_COMPLETED'
  | 'OFX_IMPORT_FAILED'
  | 'OFX_IMPORT_REVERTED'

export type FieldsChanged = Record<string, { before: unknown; after: unknown }>

export interface LogAuditParams {
  action: AuditAction
  entityType: string
  entityId: string
  fieldsChanged?: FieldsChanged | null
  metadata?: Record<string, unknown> | null
  request?: NextRequest
}

// ============================================================
// extractRequestContext — extrai IP + user-agent
// ============================================================

// Captura IP do header (x-forwarded-for primeiro, x-real-ip fallback)
// e user-agent. Trunca pra evitar abuso.
//   - IPv6 max length é 45 chars (incluindo zona)
//   - User-agent é truncado em 500 (limite arbitrário razoável)
export function extractRequestContext(request: NextRequest | undefined): {
  ipAddress: string | null
  userAgent: string | null
} {
  if (!request) {
    return { ipAddress: null, userAgent: null }
  }

  const xForwardedFor = request.headers.get('x-forwarded-for')
  const xRealIp = request.headers.get('x-real-ip')

  let ipAddress: string | null = null
  if (xForwardedFor) {
    ipAddress = xForwardedFor.split(',')[0]?.trim() ?? null
  } else if (xRealIp) {
    ipAddress = xRealIp
  }

  ipAddress = ipAddress?.slice(0, 45) ?? null

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  return { ipAddress, userAgent }
}

// ============================================================
// diffFields — calcula diferenças entre objects
// ============================================================

// Compara apenas os campos passados em `fields`. Trata undefined como null
// pra simetria. Arrays/objects são comparados via JSON.stringify.
// Retorna null se nenhum campo mudou.
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T>,
  after: Partial<T>,
  fields: (keyof T)[],
): FieldsChanged | null {
  const diffs: FieldsChanged = {}

  for (const field of fields) {
    const b = before[field] ?? null
    const a = after[field] ?? null

    let changed = false

    if ((b !== null && typeof b === 'object') || (a !== null && typeof a === 'object')) {
      changed = JSON.stringify(b) !== JSON.stringify(a)
    } else {
      changed = b !== a
    }

    if (changed) {
      diffs[field as string] = { before: b, after: a }
    }
  }

  return Object.keys(diffs).length > 0 ? diffs : null
}

// ============================================================
// logAudit — função principal
// ============================================================

type PrismaClientType = typeof prisma
type TransactionClient = Prisma.TransactionClient

// Cria registro em audit_log. Se `tx` for passado, participa da transação.
// Falha se o contexto não tem company (audit é sempre escopado por empresa).
export async function logAudit(
  ctx: AuthContext,
  params: LogAuditParams,
  tx?: TransactionClient,
): Promise<void> {
  if (!ctx.company) {
    throw new Error('Audit log requer company context')
  }

  const client: PrismaClientType | TransactionClient = tx ?? prisma
  const { ipAddress, userAgent } = extractRequestContext(params.request)

  await client.auditLog.create({
    data: {
      companyId: ctx.company.id,
      userId: ctx.user.id,
      userName: ctx.user.name,
      userEmail: ctx.user.email,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      fieldsChanged: params.fieldsChanged ? JSON.stringify(params.fieldsChanged) : null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress,
      userAgent,
    },
  })
}
