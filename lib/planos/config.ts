// Sprint Landing Page (30/05/2026) — Fonte ÚNICA dos planos CAIXAOS.
// Reusada em: app/page.tsx (landing pricing summary), app/planos/page.tsx
// (detalhado), e futura engine de subscription/checkout.

export type PlanoId = 'inicio' | 'controle' | 'inteligencia' | 'performance'

export interface Plano {
  id: PlanoId
  nome: string
  /** Preço base mensal em BRL (Decimal serializado). */
  precoMensal: number
  /** Preço efetivo mensal quando cobrado anualmente (20% off). */
  precoAnual: number
  publico: string
  /** Limite de empresas. Use Infinity pra ilimitado. */
  empresas: number
  empresasLabel: string
  temIA: boolean
  /** Card destacado como MAIS POPULAR — só 1 por vez. */
  destaque: boolean
  /** Descrição curta (1 linha) que vai no card. */
  tagline: string
  /** Features INCREMENTAIS sobre o plano anterior. UI cumula automaticamente. */
  featuresIncrementais: string[]
}

/** Desconto anual aplicado uniformemente — 20% off no preço efetivo. */
export const DESCONTO_ANUAL = 0.2

export const PLANOS: readonly Plano[] = [
  {
    id: 'inicio',
    nome: 'Início',
    precoMensal: 29.99,
    precoAnual: 29.99 * (1 - DESCONTO_ANUAL),
    publico: 'Autônomo · MEI',
    empresas: 1,
    empresasLabel: '1 empresa',
    temIA: false,
    destaque: false,
    tagline: 'O essencial pra começar a enxergar seu caixa.',
    featuresIncrementais: [
      '1 empresa',
      'Contas a pagar e receber',
      'Import Excel e CSV',
      'Relatórios básicos',
      'Importação inteligente',
    ],
  },
  {
    id: 'controle',
    nome: 'Controle',
    precoMensal: 89.99,
    precoAnual: 89.99 * (1 - DESCONTO_ANUAL),
    publico: 'Pequeno negócio',
    empresas: 3,
    empresasLabel: 'Até 3 empresas',
    temIA: false,
    destaque: false,
    tagline: 'Pra quem precisa de números profissionais.',
    featuresIncrementais: [
      '3 empresas',
      'Relatórios avançados (DRE, Fluxo de Caixa)',
      'Export PDF profissional',
      'Conciliação bancária',
    ],
  },
  {
    id: 'inteligencia',
    nome: 'Inteligência',
    precoMensal: 149.99,
    precoAnual: 149.99 * (1 - DESCONTO_ANUAL),
    publico: 'Empresa em crescimento',
    empresas: 10,
    empresasLabel: 'Até 10 empresas',
    temIA: true,
    destaque: true,
    tagline: 'Sua contadora com IA, 24/7.',
    featuresIncrementais: [
      '10 empresas',
      'IA: insights automáticos do seu caixa',
      'Análise de Variação (waterfall)',
      'Comparativo com heatmap por categoria',
      'Drill-down de transações',
      'Categorização automática por IA',
    ],
  },
  {
    id: 'performance',
    nome: 'Performance',
    precoMensal: 349.99,
    precoAnual: 349.99 * (1 - DESCONTO_ANUAL),
    publico: 'Multi-negócio',
    empresas: Number.POSITIVE_INFINITY,
    empresasLabel: 'Empresas ilimitadas',
    temIA: true,
    destaque: false,
    tagline: 'Pra holdings e grupos com múltiplos CNPJs.',
    featuresIncrementais: [
      'Empresas ilimitadas',
      'Consolidado multi-empresa',
      'Suporte prioritário',
      'API e white-label (em breve)',
    ],
  },
] as const

/** Calcula todas as features cumulativas pra exibição no card. */
export function featuresCumulativas(planoId: PlanoId): string[] {
  const idx = PLANOS.findIndex((p) => p.id === planoId)
  if (idx < 0) return []
  const out: string[] = []
  for (let i = 0; i <= idx; i++) {
    out.push(...PLANOS[i].featuresIncrementais)
  }
  return out
}

export function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}
