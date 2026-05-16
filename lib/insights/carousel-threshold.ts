// Threshold de ativação do carrossel mobile — Sprint 2 Dia 5.
// Função pura, testável sem React.
//
// Regra: carrossel só ativa em VIEWPORT mobile (<640px) E quando há 4+ insights.
// 1-3 insights: empilhado vertical em mobile (mais legível, sem overhead).

export const CAROUSEL_MIN_INSIGHTS = 4

export function shouldUseCarousel(
  count: number,
  viewport: 'mobile' | 'desktop',
): boolean {
  return viewport === 'mobile' && count >= CAROUSEL_MIN_INSIGHTS
}
