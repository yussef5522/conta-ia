// Sprint Engine de Assinatura FATIA 1 (31/05/2026) — Tipos compartilhados.

import type { PlanoId } from '@/lib/planos/config'

// Estados possíveis de uma Subscription. Mesma string-union no DB.
export type SubscriptionStatus =
  | 'TRIAL' // testando grátis, trialEndsAt no futuro
  | 'ACTIVE' // paga e em dia (Fatia 3)
  | 'EXPIRED' // trial acabou OU pagamento parou
  | 'CANCELED' // user cancelou
  | 'PAST_DUE' // cobrança falhou (Fatia 3)
  | 'GRANTED' // concedida sem cobrança (early adopter / cortesia)

// Features que podem ser checadas via canAccessFeature.
// Lista expansível — UI usa string literal e helper avalia.
export type SubscriptionFeature =
  | 'ia' // categorização IA, insights, análise variação
  | 'multi-empresa' // mais de 1 empresa
  | 'multi-empresa-3' // mais de 3 empresas
  | 'multi-empresa-10' // mais de 10 empresas
  | 'dre-avancado' // DRE/Fluxo Caixa avançado
  | 'export-pdf' // export PDF profissional
  | 'conciliacao' // conciliação bancária
  | 'consolidado' // consolidado multi-empresa
  | 'suporte-prioritario'

// Snapshot mínimo da subscription pra funções puras (sem depender do Prisma).
// As funções de access aceitam este shape pra serem testáveis isoladamente.
export interface SubscriptionSnapshot {
  status: SubscriptionStatus | string
  planId: PlanoId | string
  trialEndsAt: Date | null
}

// Resultado da query "qual o status efetivo agora?" — inclui derivação
// (TRIAL com trialEndsAt no passado vira EXPIRED).
export interface EffectiveSubscriptionStatus {
  rawStatus: SubscriptionStatus
  effectiveStatus: SubscriptionStatus
  planId: PlanoId
  trialEndsAt: Date | null
  diasRestantesTrial: number | null // null se não-trial; 0 = último dia; <0 nunca (clamp)
  isExpired: boolean
}
