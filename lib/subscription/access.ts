// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Funções PURAS de
// acesso. Sem Prisma, 100% testáveis. UI usa pra mostrar "upgrade pra X"
// quando quiser (B2 do plano: NÃO bloqueia nada hoje).

import type { PlanoId } from '@/lib/planos/config'
import type {
  EffectiveSubscriptionStatus,
  SubscriptionFeature,
  SubscriptionSnapshot,
  SubscriptionStatus,
} from './types'

/** Limite de empresas por plano. `Infinity` = ilimitado. */
export function getEmpresaLimit(planoId: PlanoId | string): number {
  switch (planoId) {
    case 'inicio':
      return 1
    case 'controle':
      return 3
    case 'inteligencia':
      return 10
    case 'performance':
      return Number.POSITIVE_INFINITY
    default:
      // Plano desconhecido — conservador: 1 empresa
      return 1
  }
}

/** True se o plano tem direito à feature. */
export function canAccessFeature(
  planoId: PlanoId | string,
  feature: SubscriptionFeature,
): boolean {
  switch (feature) {
    case 'ia':
      return planoId === 'inteligencia' || planoId === 'performance'
    case 'multi-empresa':
      return getEmpresaLimit(planoId) > 1
    case 'multi-empresa-3':
      return getEmpresaLimit(planoId) > 3
    case 'multi-empresa-10':
      return getEmpresaLimit(planoId) > 10
    case 'dre-avancado':
      return planoId !== 'inicio'
    case 'export-pdf':
      return planoId !== 'inicio'
    case 'conciliacao':
      return planoId !== 'inicio'
    case 'consolidado':
      return planoId === 'performance'
    case 'suporte-prioritario':
      return planoId === 'performance'
    default:
      return false
  }
}

/**
 * True se subscription é TRIAL e o trialEndsAt já passou.
 * Status GRANTED, ACTIVE, etc. NUNCA são considerados expirados aqui.
 */
export function isTrialExpired(
  sub: { status: string; trialEndsAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (sub.status !== 'TRIAL') return false
  if (!sub.trialEndsAt) return false
  return sub.trialEndsAt.getTime() <= now.getTime()
}

/**
 * Status "lazy" — calculado on-read. Se DB diz TRIAL mas trialEndsAt
 * passou, retorna EXPIRED sem precisar de cron pra atualizar.
 *
 * Status terminais (CANCELED, EXPIRED, ACTIVE, GRANTED, PAST_DUE) são
 * retornados sem modificação.
 */
export function computeEffectiveStatus(
  sub: SubscriptionSnapshot,
  now: Date = new Date(),
): SubscriptionStatus {
  const raw = sub.status as SubscriptionStatus
  if (raw === 'TRIAL' && isTrialExpired(sub, now)) {
    return 'EXPIRED'
  }
  return raw
}

/**
 * Dias restantes do trial. Retorna `null` se status != TRIAL.
 * Resultado em DIAS arredondado para cima (ceil), com piso 0.
 *
 * Ex: trialEndsAt = +14d agora → 14 dias
 *     trialEndsAt = +0.5d agora → 1 dia (ceil)
 *     trialEndsAt = -1d agora → 0 (clamp)
 */
export function diasRestantesTrial(
  sub: { status: string; trialEndsAt: Date | null },
  now: Date = new Date(),
): number | null {
  if (sub.status !== 'TRIAL') return null
  if (!sub.trialEndsAt) return null
  const diffMs = sub.trialEndsAt.getTime() - now.getTime()
  if (diffMs <= 0) return 0
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  return Math.ceil(diffMs / MS_PER_DAY)
}

/**
 * Resultado "completo" do status efetivo — o que rotas/UI consomem.
 * Reune os 4 helpers acima num único shape estável.
 */
export function getEffectiveSubscriptionStatus(
  sub: SubscriptionSnapshot,
  now: Date = new Date(),
): EffectiveSubscriptionStatus {
  const raw = sub.status as SubscriptionStatus
  const effective = computeEffectiveStatus(sub, now)
  return {
    rawStatus: raw,
    effectiveStatus: effective,
    planId: sub.planId as PlanoId,
    trialEndsAt: sub.trialEndsAt,
    diasRestantesTrial: diasRestantesTrial(sub, now),
    isExpired: effective === 'EXPIRED',
  }
}
