// Tooltip "Como detectei?" — Sprint 2 Dia 5.
// Mapping ID do detector → copy pt-BR explicando a lógica.
// Função pura: testável sem React.

const TOOLTIP_COPY: Record<string, string> = {
  'pending-classifications':
    'Identifiquei transações importadas sem categoria. Quando você classifica, o DRE e os relatórios refletem a realidade do seu negócio.',
  'large-uncategorized':
    'Transações grandes (acima de R$ 5.000) sem categoria nos últimos 30 dias. Essas movimentações têm maior impacto no DRE.',
  'high-overdraft-usage':
    'Saldo negativo usando mais de 70% do limite de cheque especial. Acima de 90% é crítico — sistema bloqueia novos lançamentos.',
  'burn-rate-spike':
    'Despesas dos últimos 3 meses cresceram pelo menos 30% comparado aos 3 meses anteriores.',
  'duplicate-subscriptions':
    '3 ou mais cobranças recorrentes com descrições similares (Levenshtein ≤ 5) e valores próximos (±10%).',
  'concentration-risk':
    'Mais de 70% das receitas vêm de uma única fonte (ou 80%+ vêm de 3 fontes). Diversificar reduz o risco se algum cliente sair ou atrasar pagamento.',
  'revenue-growth':
    'Receitas (categoria RECEITA_*) do mês cresceram pelo menos 20% comparado à média dos 3 meses anteriores.',
}

const FALLBACK_COPY =
  'Esta descoberta foi gerada pelo motor de AI Insights com base nos seus dados.'

// Retorna a explicação do detector. Caso novo (ainda sem copy mapeada),
// devolve fallback amigável em vez de string vazia.
export function getDetectorTooltip(insightId: string): string {
  return TOOLTIP_COPY[insightId] ?? FALLBACK_COPY
}

// Pros testes — checa coverage do mapping.
export const TOOLTIP_COPY_KEYS = Object.keys(TOOLTIP_COPY)
