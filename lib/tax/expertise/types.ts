// Sprint 5.0.2.b — Tipos compartilhados pelos 3 ramos de expertise.

export type Ramo = 'RESTAURANTE' | 'ACADEMIA' | 'COMERCIO_ROUPA'

export interface CNAEEntry {
  code: string // "5611-2/01"
  name: string // "Restaurantes e similares"
  anexo: string // "I" | "III/V" | etc — convenção curta pra display
  aliases?: string[] // termos de busca alternativos (case-insensitive, sem acento)
  icon?: string // emoji/pictograma 1 char
}

export interface BeneficioFiscal {
  tipo: string
  descricao: string
  detalhes: string
  aplicaA?: string[]
  economiaPotencial: string
  comoAproveitar?: string[]
  validade?: string
}

export interface FatorRAnalysis {
  importancia: 'BAIXA' | 'MÉDIA' | 'CRÍTICA' | 'EXTREMA - Maior alavanca tributária'
  detalhes: string
  economiaTipica?: string
  estrategias: string[]
}

export interface ProLaboreEstrategia {
  formula: string
  exemplo: string
}

export interface ExpertiseRamo {
  ramo: Ramo
  cnaes: CNAEEntry[]
  anexoPreferido: string
  aliquotaInicial?: number
  aliquotaMaxima?: number
  aliquotaSeFatorR_OK?: number
  aliquotaSeFatorR_NAO?: number

  beneficios: BeneficioFiscal[]
  fatorRAnalysis?: FatorRAnalysis
  proLaboreOtimo?: ProLaboreEstrategia
  particularidades: string[]
  errosComuns: string[]
  redesGrandes?: Record<string, string | { regime?: string; estrategia: string }>
}
