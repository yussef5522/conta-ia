// Sprint PF Fatia 3 — Keyword detector PF (paralelo ao PJ).
//
// Mesmo padrão word-boundary do PJ. Categoria sugerida é nome da
// PersonalCategory (não dreGroup). Confidence 0.85 (alto — marcas
// reconhecidas).
//
// FUNÇÃO PURA.

import { normalizeDescription } from './normalize'

export interface KeywordPfEntry {
  keyword: string
  displayName: string
  /** Nome da PersonalCategory padrão (Fatia 1 default ou custom do user). */
  personalCategoryHint: string
}

export interface KeywordPfMatch {
  matched: boolean
  entry?: KeywordPfEntry
  confidence: number
}

export const KEYWORD_PF_CONFIDENCE = 0.85

export const KEYWORDS_PF: readonly KeywordPfEntry[] = [
  // Alimentação — Delivery
  { keyword: 'ifood', displayName: 'iFood', personalCategoryHint: 'Alimentação' },
  { keyword: 'rappi', displayName: 'Rappi', personalCategoryHint: 'Alimentação' },
  { keyword: 'uber eats', displayName: 'Uber Eats', personalCategoryHint: 'Alimentação' },
  // Alimentação — Mercado
  { keyword: 'mercado', displayName: 'Mercado', personalCategoryHint: 'Alimentação' },
  { keyword: 'super', displayName: 'Supermercado', personalCategoryHint: 'Alimentação' },
  { keyword: 'supermercado', displayName: 'Supermercado', personalCategoryHint: 'Alimentação' },
  { keyword: 'pao de acucar', displayName: 'Pão de Açúcar', personalCategoryHint: 'Alimentação' },
  { keyword: 'extra', displayName: 'Extra', personalCategoryHint: 'Alimentação' },
  { keyword: 'carrefour', displayName: 'Carrefour', personalCategoryHint: 'Alimentação' },
  { keyword: 'walmart', displayName: 'Walmart', personalCategoryHint: 'Alimentação' },
  { keyword: 'assai', displayName: 'Assaí Atacadista', personalCategoryHint: 'Alimentação' },
  { keyword: 'sams club', displayName: "Sam's Club", personalCategoryHint: 'Alimentação' },
  { keyword: 'hortifruti', displayName: 'Hortifruti', personalCategoryHint: 'Alimentação' },
  // Alimentação — Restaurantes / Padaria / Outros
  { keyword: 'padaria', displayName: 'Padaria', personalCategoryHint: 'Alimentação' },
  { keyword: 'mcdonalds', displayName: "McDonald's", personalCategoryHint: 'Alimentação' },
  { keyword: 'burger king', displayName: 'Burger King', personalCategoryHint: 'Alimentação' },
  { keyword: 'subway', displayName: 'Subway', personalCategoryHint: 'Alimentação' },
  { keyword: 'starbucks', displayName: 'Starbucks', personalCategoryHint: 'Alimentação' },

  // Transporte — Apps
  { keyword: 'uber', displayName: 'Uber', personalCategoryHint: 'Transporte' },
  { keyword: '99 ', displayName: '99', personalCategoryHint: 'Transporte' },
  { keyword: 'cabify', displayName: 'Cabify', personalCategoryHint: 'Transporte' },
  // Transporte — Combustível
  { keyword: 'posto', displayName: 'Posto', personalCategoryHint: 'Transporte' },
  { keyword: 'shell', displayName: 'Shell', personalCategoryHint: 'Transporte' },
  { keyword: 'br mania', displayName: 'BR Mania', personalCategoryHint: 'Transporte' },
  { keyword: 'ipiranga', displayName: 'Ipiranga', personalCategoryHint: 'Transporte' },
  // Transporte — Pedágio / Estacionamento
  { keyword: 'sem parar', displayName: 'Sem Parar', personalCategoryHint: 'Transporte' },
  { keyword: 'autopass', displayName: 'AutoPass', personalCategoryHint: 'Transporte' },
  { keyword: 'estaciona', displayName: 'Estacionamento', personalCategoryHint: 'Transporte' },

  // Lazer — Streaming / Apps
  { keyword: 'netflix', displayName: 'Netflix', personalCategoryHint: 'Lazer' },
  { keyword: 'spotify', displayName: 'Spotify', personalCategoryHint: 'Lazer' },
  { keyword: 'hbo', displayName: 'HBO Max', personalCategoryHint: 'Lazer' },
  { keyword: 'disney', displayName: 'Disney+', personalCategoryHint: 'Lazer' },
  { keyword: 'amazon prime', displayName: 'Amazon Prime', personalCategoryHint: 'Lazer' },
  { keyword: 'youtube premium', displayName: 'YouTube Premium', personalCategoryHint: 'Lazer' },
  { keyword: 'apple.com', displayName: 'Apple', personalCategoryHint: 'Lazer' },
  { keyword: 'apple.com/bill', displayName: 'Apple Bill', personalCategoryHint: 'Lazer' },
  { keyword: 'google play', displayName: 'Google Play', personalCategoryHint: 'Lazer' },

  // Lazer — Viagem
  { keyword: 'airbnb', displayName: 'Airbnb', personalCategoryHint: 'Lazer' },
  { keyword: 'booking', displayName: 'Booking', personalCategoryHint: 'Lazer' },
  { keyword: 'decolar', displayName: 'Decolar', personalCategoryHint: 'Lazer' },
  { keyword: 'latam', displayName: 'LATAM', personalCategoryHint: 'Lazer' },
  { keyword: 'gol linhas', displayName: 'GOL', personalCategoryHint: 'Lazer' },
  { keyword: 'azul linhas', displayName: 'Azul', personalCategoryHint: 'Lazer' },
  { keyword: 'laghetto', displayName: 'Laghetto Hotel', personalCategoryHint: 'Lazer' },
  // Lazer — Cinema/Bar
  { keyword: 'cinemark', displayName: 'Cinemark', personalCategoryHint: 'Lazer' },
  { keyword: 'kinoplex', displayName: 'Kinoplex', personalCategoryHint: 'Lazer' },

  // Saúde
  { keyword: 'farmacia', displayName: 'Farmácia', personalCategoryHint: 'Saúde' },
  { keyword: 'drogaria', displayName: 'Drogaria', personalCategoryHint: 'Saúde' },
  { keyword: 'drogasil', displayName: 'Drogasil', personalCategoryHint: 'Saúde' },
  { keyword: 'pague menos', displayName: 'Pague Menos', personalCategoryHint: 'Saúde' },
  { keyword: 'unimed', displayName: 'Unimed', personalCategoryHint: 'Saúde' },
  { keyword: 'amil', displayName: 'Amil', personalCategoryHint: 'Saúde' },
  { keyword: 'bradesco saude', displayName: 'Bradesco Saúde', personalCategoryHint: 'Saúde' },
  { keyword: 'hospital', displayName: 'Hospital', personalCategoryHint: 'Saúde' },
  { keyword: 'clinica', displayName: 'Clínica', personalCategoryHint: 'Saúde' },

  // Educação
  { keyword: 'udemy', displayName: 'Udemy', personalCategoryHint: 'Educação' },
  { keyword: 'alura', displayName: 'Alura', personalCategoryHint: 'Educação' },
  { keyword: 'rocketseat', displayName: 'Rocketseat', personalCategoryHint: 'Educação' },
  { keyword: 'claude', displayName: 'Anthropic Claude', personalCategoryHint: 'Educação' },
  { keyword: 'anthropic', displayName: 'Anthropic', personalCategoryHint: 'Educação' },
  { keyword: 'chatgpt', displayName: 'OpenAI ChatGPT', personalCategoryHint: 'Educação' },
  { keyword: 'duolingo', displayName: 'Duolingo', personalCategoryHint: 'Educação' },

  // Vestuário
  { keyword: 'zara', displayName: 'Zara', personalCategoryHint: 'Vestuário' },
  { keyword: 'renner', displayName: 'Renner', personalCategoryHint: 'Vestuário' },
  { keyword: 'riachuelo', displayName: 'Riachuelo', personalCategoryHint: 'Vestuário' },
  { keyword: 'cea', displayName: 'C&A', personalCategoryHint: 'Vestuário' },
  { keyword: 'nike', displayName: 'Nike', personalCategoryHint: 'Vestuário' },
  { keyword: 'adidas', displayName: 'Adidas', personalCategoryHint: 'Vestuário' },

  // Contas (utilidades)
  { keyword: 'vivo', displayName: 'Vivo', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'claro', displayName: 'Claro', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'tim ', displayName: 'TIM', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'oi telecom', displayName: 'Oi', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'eletropaulo', displayName: 'Eletropaulo', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'sabesp', displayName: 'Sabesp', personalCategoryHint: 'Contas (luz, água, internet)' },
  { keyword: 'enel', displayName: 'Enel', personalCategoryHint: 'Contas (luz, água, internet)' },

  // Outros — Marketplace
  { keyword: 'mercadolivre', displayName: 'Mercado Livre', personalCategoryHint: 'Outros' },
  { keyword: 'mercado livre', displayName: 'Mercado Livre', personalCategoryHint: 'Outros' },
  { keyword: 'amazon', displayName: 'Amazon', personalCategoryHint: 'Outros' },
  { keyword: 'aliexpress', displayName: 'AliExpress', personalCategoryHint: 'Outros' },
  { keyword: 'shopee', displayName: 'Shopee', personalCategoryHint: 'Outros' },
  // Outros — Marketing/Anúncios
  { keyword: 'facebk', displayName: 'Facebook Ads', personalCategoryHint: 'Outros' },
  { keyword: 'google ads', displayName: 'Google Ads', personalCategoryHint: 'Outros' },

  // Encargos cartão
  { keyword: 'iof', displayName: 'IOF', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'multa', displayName: 'Multa cartão', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'juros do rotativo', displayName: 'Juros rotativo', personalCategoryHint: 'Cartão de crédito' },
  { keyword: 'valor pendente', displayName: 'Rotativo mês anterior', personalCategoryHint: 'Cartão de crédito' },
]

/** Normaliza word boundary + lowercase pra match seguro. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function detectKeywordPf(description: string): KeywordPfMatch {
  if (!description) return { matched: false, confidence: 0 }
  const normalized = normalizeDescription(description).toLowerCase()
  for (const entry of KEYWORDS_PF) {
    const kw = entry.keyword.toLowerCase()
    // Word boundary simples — exige espaço/início/fim antes/depois do match
    const re = new RegExp(`(^|\\W)${escapeRegex(kw)}(\\W|$)`, 'i')
    if (re.test(normalized)) {
      return { matched: true, entry, confidence: KEYWORD_PF_CONFIDENCE }
    }
  }
  return { matched: false, confidence: 0 }
}
