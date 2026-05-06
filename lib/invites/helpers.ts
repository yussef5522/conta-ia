// Helpers pra convites de empresa (Sub-sub-etapa 5.3.C3).
// Token random + Zod schemas + status calculator + URL builder.

import { randomBytes } from 'crypto'
import { z } from 'zod'

export const INVITE_EXPIRES_DAYS = 7

// Token único de 64 chars hex (32 bytes random crypto-safe).
// Suficiente pra ser unguessable; não precisa de unicidade explícita
// porque @unique no schema rejeita colisão (probabilidade ~0).
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

// Data de expiração: now + INVITE_EXPIRES_DAYS dias.
export function calculateExpiration(): Date {
  const date = new Date()
  date.setDate(date.getDate() + INVITE_EXPIRES_DAYS)
  return date
}

// Schema de validação pra criar convite.
// Email é normalizado pra lowercase (case-insensitive matching).
export const inviteCreateSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  roleId: z.string().cuid('roleId inválido'),
})

// Schema de validação pra mudar role de user.
export const userRoleChangeSchema = z.object({
  roleId: z.string().cuid('roleId inválido'),
})

// Schema de validação pra aceitar convite.
export const acceptInviteSchema = z.object({
  token: z.string().min(32, 'Token inválido'),
})

// Estado calculado a partir de acceptedAt + expiresAt.
// ACCEPTED tem precedência sobre EXPIRED (se aceitou, mesmo expirado já era).
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED'

export function getInviteStatus(invite: {
  acceptedAt: Date | null
  expiresAt: Date
}): InviteStatus {
  if (invite.acceptedAt) return 'ACCEPTED'
  if (invite.expiresAt < new Date()) return 'EXPIRED'
  return 'PENDING'
}

// URL completa pro link copiável: https://app.com/aceitar-convite?token=...
export function buildInviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/aceitar-convite?token=${token}`
}
