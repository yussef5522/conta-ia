// Camada 2A do Pipeline IA Contadora — Fase 3 Etapa 2.
//
// Detecta empresas conhecidas brasileiras na descrição via keyword matching
// com WORD BOUNDARY (nunca substring solta). 100% local, sem internet.
//
// Caso de uso: OFX traz "STONE PAGAMENTOS S.A CARTAO ANTECIP" sem CNPJ.
// A Camada 2B (BrasilAPI) não bate sem CNPJ. Mas o nome "STONE" é
// reconhecível. Esta Camada 2A mapeia keyword → fornecedor + sugestão de
// categoria DRE.
//
// Knowledge GERAL (não por empresa): keyword table é o mesmo pra todos.
// Mas Supplier criado a partir dela é POR EMPRESA (companyId injetado fora).
//
// FUNÇÃO PURA: testável sem DB.

import { normalizeDescription, normalizeExact } from './normalize'

// dreGroup é o mesmo enum string usado no Plano de Contas (Etapa 5.3.A).
// Mantém alinhamento com lib/dre/types.ts pra Insights cobrirem mesmo bucket.
export type DreGroupHint =
  | 'RECEITA_BRUTA'
  | 'DESPESAS_ADMINISTRATIVAS'
  | 'DESPESAS_COMERCIAIS'
  | 'DESPESAS_FINANCEIRAS'
  | 'DESPESAS_OPERACIONAIS'
  | 'CUSTOS_VARIAVEIS'
  | 'DEDUCOES'

export interface KeywordEntry {
  // Keyword EXATA pra match (ignora caso e acentos — normalizada).
  // Word boundary aplicado automaticamente.
  keyword: string
  // Nome da empresa pra exibir no badge "Detectado: VIVO"
  displayName: string
  // dreGroup pra cruzar com Plano de Contas
  dreGroup: DreGroupHint
  // Nome da categoria sugerida (matcher no Plano de Contas da empresa)
  // Quando a empresa tem categoria com esse nome ou similar, aplica.
  categoryNameHint: string
}

export interface KeywordMatch {
  keyword: string
  displayName: string
  dreGroup: DreGroupHint
  categoryNameHint: string
  // Posição onde casou (debug)
  position: number
}

// ============================================================
// Top 50 keywords BR — knowledge geral, atualizar conforme expansão
// ============================================================

const KEYWORDS: KeywordEntry[] = [
  // Adquirentes / Maquininhas → Vendas
  { keyword: 'STONE', displayName: 'Stone', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'CIELO', displayName: 'Cielo', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'REDECARD', displayName: 'Rede', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'REDE', displayName: 'Rede', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'GETNET', displayName: 'GetNet', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'VERO', displayName: 'Vero', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'PAGSEGURO', displayName: 'PagSeguro', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'PAGBANK', displayName: 'PagBank', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'MERCADO PAGO', displayName: 'Mercado Pago', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },
  { keyword: 'BANRICARD', displayName: 'Banricard', dreGroup: 'RECEITA_BRUTA', categoryNameHint: 'Vendas' },

  // Telecom → Telefonia
  { keyword: 'VIVO', displayName: 'Vivo', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },
  { keyword: 'CLARO', displayName: 'Claro', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },
  { keyword: 'TIM', displayName: 'TIM', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },
  { keyword: 'NEXTEL', displayName: 'Nextel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },
  { keyword: 'OI', displayName: 'Oi', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },
  { keyword: 'TELEFONICA', displayName: 'Telefônica', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Telefonia' },

  // Energia → Energia Elétrica
  { keyword: 'CELESC', displayName: 'Celesc', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'RGE', displayName: 'RGE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'CEMIG', displayName: 'Cemig', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'COPEL', displayName: 'Copel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'ELETROBRAS', displayName: 'Eletrobras', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'ENEL', displayName: 'Enel', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },
  { keyword: 'LIGHT', displayName: 'Light', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Energia Elétrica' },

  // Saneamento → Água
  { keyword: 'SABESP', displayName: 'Sabesp', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },
  { keyword: 'SANEPAR', displayName: 'Sanepar', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },
  { keyword: 'CORSAN', displayName: 'Corsan', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },
  { keyword: 'COPASA', displayName: 'Copasa', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },
  { keyword: 'CAGECE', displayName: 'Cagece', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },
  { keyword: 'CEDAE', displayName: 'Cedae', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },

  // Seguros / Capitalização → Seguros
  { keyword: 'HDI', displayName: 'HDI Seguros', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'PORTO SEGURO', displayName: 'Porto Seguro', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'SULAMERICA', displayName: 'SulAmérica', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'BRADESCO SEGUROS', displayName: 'Bradesco Seguros', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'ITAU SEGUROS', displayName: 'Itaú Seguros', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'RG CAPITALIZACAO', displayName: 'RG Capitalização', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'BRASILCAP', displayName: 'BrasilCap', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },
  { keyword: 'SEGURO RIOGRANDE', displayName: 'Seguros RioGrande', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Seguros' },

  // Empréstimos → Empréstimos
  { keyword: 'EMPRESTIMO', displayName: 'Empréstimo Bancário', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Empréstimos' },
  { keyword: 'MUTUO', displayName: 'Mútuo', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Empréstimos' },
  { keyword: 'BBH', displayName: 'Empréstimo BBH', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Empréstimos' },
  { keyword: 'CREDITO C/GARANTIA', displayName: 'Crédito com Garantia', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Empréstimos' },

  // Combustível
  { keyword: 'POSTO', displayName: 'Posto de Combustível', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível' },
  { keyword: 'IPIRANGA', displayName: 'Ipiranga', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível' },
  { keyword: 'RAIZEN', displayName: 'Raízen', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível' },
  { keyword: 'SHELL', displayName: 'Shell', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível' },
  { keyword: 'PETROBRAS', displayName: 'Petrobras', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Combustível' },

  // Software / Assinaturas
  { keyword: 'NETFLIX', displayName: 'Netflix', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },
  { keyword: 'SPOTIFY', displayName: 'Spotify', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },
  { keyword: 'GOOGLE', displayName: 'Google', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },
  { keyword: 'MICROSOFT', displayName: 'Microsoft', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },
  { keyword: 'AWS', displayName: 'Amazon Web Services', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },
  { keyword: 'AMAZON PRIME', displayName: 'Amazon Prime', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Software/Assinaturas' },

  // Tarifas Bancárias → Tarifas
  { keyword: 'IOF', displayName: 'IOF', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias' },
  { keyword: 'ANUIDADE', displayName: 'Anuidade Bancária', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias' },
  { keyword: 'MENSALIDADE PACOTE', displayName: 'Mensalidade Pacote Bancário', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias' },
  { keyword: 'TARIFA', displayName: 'Tarifa Bancária', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Tarifas Bancárias' },

  // Públicos / governo
  { keyword: 'DETRAN', displayName: 'Detran', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Impostos e Taxas' },
  { keyword: 'PAGAMENTO SANEAMENTO', displayName: 'Saneamento', dreGroup: 'DESPESAS_ADMINISTRATIVAS', categoryNameHint: 'Água' },

  // Consórcio
  { keyword: 'CONSORCIO', displayName: 'Consórcio', dreGroup: 'DESPESAS_FINANCEIRAS', categoryNameHint: 'Consórcio' },
]

// Indexação por keyword normalizada (lower + sem acentos). Pré-compilada
// pra busca O(1) por palavra encontrada na descrição.
const KEYWORD_INDEX: Map<string, KeywordEntry> = (() => {
  const map = new Map<string, KeywordEntry>()
  for (const e of KEYWORDS) {
    map.set(normalizeExact(e.keyword), e)
  }
  return map
})()

// Lista de keywords normalizadas com prioridade por COMPRIMENTO desc
// — assim "MERCADO PAGO" casa antes de "PAGO" (se existisse).
const KEYWORDS_NORMALIZED_SORTED: string[] = Array.from(KEYWORD_INDEX.keys()).sort(
  (a, b) => b.length - a.length,
)

// Escape de regex pra keywords (pontos, parenteses, etc — embora a tabela
// atual não tenha; defensivo pra adições futuras)
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Detecta a primeira keyword que casa na descrição.
// Word boundary nas extremidades pra evitar matches como "stoneware" vs STONE.
// Retorna a entry mais longa que casou (priority por especificidade).
export function detectKeyword(rawDescription: string): KeywordMatch | null {
  if (!rawDescription) return null

  // Normaliza a descrição da MESMA forma que a keyword (lower + sem acentos).
  // Mas mantém estrutura suficiente pra word boundary trabalhar.
  const haystack = normalizeExact(rawDescription)
  if (!haystack) return null

  for (const kw of KEYWORDS_NORMALIZED_SORTED) {
    // Word boundary com regex. \b funciona com [a-z0-9_] então funciona
    // pra português pós-normalização (sem acentos).
    // Para keywords compostas ("mercado pago"), o espaço interno faz parte
    // do match; \b vai entre palavra↔não-palavra.
    const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`)
    const match = haystack.match(pattern)
    if (match && match.index !== undefined) {
      const entry = KEYWORD_INDEX.get(kw)!
      return {
        keyword: entry.keyword,
        displayName: entry.displayName,
        dreGroup: entry.dreGroup,
        categoryNameHint: entry.categoryNameHint,
        position: match.index,
      }
    }
  }

  return null
}

// Confidência fixa pra Camada 2A — nunca dispara AUTO no import.
// Sugestão visível pra user confirmar com 1 click.
export const KEYWORD_DETECTION_CONFIDENCE = 0.8

// Helpers pros testes / inspeção:
export const ALL_KEYWORDS: ReadonlyArray<KeywordEntry> = KEYWORDS
export function keywordCount(): number {
  return KEYWORDS.length
}

// Para uso externo (apply.ts cruza categoryNameHint com plano de contas
// da empresa pra resolver categoryId real):
//
//   normalizeExact(category.name) === normalizeExact(hint.categoryNameHint)
// OU
//   category.dreGroup === hint.dreGroup
export { normalizeDescription, normalizeExact }
