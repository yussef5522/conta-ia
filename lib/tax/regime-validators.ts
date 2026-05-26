// Sprint 5.0.2.f — Validadores de elegibilidade dos regimes tributários.
//
// Centraliza regras legais que IMPEDEM um regime, com base legal citada.
// Roda ANTES do engine de cálculo: se inviável, não computa números (evita
// recomendar regime ilegal).

import { SIMPLES_LIMITE_RBA_2026 } from './simples-nacional-tables'
import { PRESUMIDO_LIMITE_RBA_2026 } from './presumido-engine'

export interface RegimeValidation {
  aplicavel: boolean
  motivoNaoAplicavel?: string
  baseLegal?: string
}

// CNAEs vedados ao Simples Nacional (LC 123/2006 art. 17 + Resolução CGSN 140/2018).
// Lista NÃO-EXAUSTIVA: cobre setores comumente vedados que costumam ser dúvida.
// Atualizada com base na Resolução CGSN 175/2025 (rol vigente em 2026).
const SIMPLES_CNAES_VEDADOS = new Set<string>([
  '6422-1/00', // Bancos comerciais
  '6423-9/00', // Caixas econômicas
  '6424-7/01', // Cooperativas de crédito
  '6431-0/00', // Bancos múltiplos
  '6432-8/00', // Bancos comerciais (sem carteira)
  '6435-2/01', // Sociedades de crédito imobiliário
  '6440-9/00', // Arrendamento mercantil (leasing)
  '6450-6/00', // Sociedades de capitalização
  '6461-1/00', // Holdings
  '6491-3/00', // Factoring
  '6492-1/00', // Securitização
  '6499-9/01', // Clube de investimento
  '6499-9/05', // Cooperativas de crédito mútuo
  '6499-9/99', // Outras intermediações
  '6511-1/01', // Seguros de vida
  '6512-0/00', // Seguros não-vida
  '6521-3/00', // Resseguros
  '6541-3/00', // Previdência complementar fechada
  '6542-1/00', // Previdência complementar aberta
  '6611-8/02', // Bolsas de valores
  '6620-3/00', // Intermediação de câmbio
  '6630-4/00', // Atividades auxiliares de fundos
  '6810-2/01', // Loteamento de imóveis próprios
  '6810-2/02', // Incorporação de imóveis (loteamento)
])

// CNAEs obrigados ao Lucro Real (Lei 9.718/1998 art. 14).
// Inclui bancos, factoring, seguros, etc — mesmo conjunto basicamente.
const REAL_CNAES_OBRIGATORIOS = new Set<string>([
  ...SIMPLES_CNAES_VEDADOS,
])

export interface ValidateSimplesInput {
  // Use a projeção PROSPECTIVA quando user simula uma receita mensal:
  //   rbaProjecada12m = max(rba real do banco, receitaBrutaMes × 12)
  rbaProjecada12m: number
  cnaeCode?: string | null
  hasSocioPJ?: boolean
  hasDebitos?: boolean
}

export function validateSimplesNacional(input: ValidateSimplesInput): RegimeValidation {
  if (input.rbaProjecada12m > SIMPLES_LIMITE_RBA_2026) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: `Receita anual projetada R$ ${formatM(input.rbaProjecada12m)} excede o limite Simples Nacional R$ 4,8M`,
      baseLegal: 'LC 123/2006 art. 3º, II',
    }
  }

  if (input.cnaeCode && SIMPLES_CNAES_VEDADOS.has(input.cnaeCode)) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: `CNAE ${input.cnaeCode} é vedado ao Simples Nacional`,
      baseLegal: 'LC 123/2006 art. 17',
    }
  }

  if (input.hasSocioPJ) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: 'Empresa possui sócio pessoa jurídica',
      baseLegal: 'LC 123/2006 art. 3º §4º VII',
    }
  }

  if (input.hasDebitos) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: 'Empresa possui débitos exigíveis com Receita Federal/Estado/Município',
      baseLegal: 'LC 123/2006 art. 17 V',
    }
  }

  return { aplicavel: true }
}

export interface ValidateLucroPresumidoInput {
  rbaProjecada12m: number
  cnaeCode?: string | null
}

export function validateLucroPresumido(input: ValidateLucroPresumidoInput): RegimeValidation {
  if (input.rbaProjecada12m > PRESUMIDO_LIMITE_RBA_2026) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: `Receita anual projetada R$ ${formatM(input.rbaProjecada12m)} excede o limite Lucro Presumido R$ 78M`,
      baseLegal: 'Lei 9.718/1998 art. 13',
    }
  }

  if (input.cnaeCode && REAL_CNAES_OBRIGATORIOS.has(input.cnaeCode)) {
    return {
      aplicavel: false,
      motivoNaoAplicavel: `CNAE ${input.cnaeCode} obriga ao Lucro Real (atividade financeira/seguros)`,
      baseLegal: 'Lei 9.718/1998 art. 14',
    }
  }

  return { aplicavel: true }
}

/**
 * Lucro Real é sempre uma opção válida (LC 123/06 art. 3º permite migração).
 * Pode ser obrigatório em alguns casos (atividade financeira, faturamento > R$ 78M)
 * mas isso é coberto por NÃO permitir os outros regimes.
 */
export function validateLucroReal(): RegimeValidation {
  return { aplicavel: true }
}

/**
 * Calcula a RBA usada para validar limites em uma simulação.
 *
 * Quando user simula "vou faturar X/mês", a projeção anual (X × 12) deve
 * ser usada — não o histórico real do banco (que pode estar baixo em
 * empresa nova ou em teste).
 *
 * Pega o MAIOR entre histórico real e projeção mensal × 12 — assim o
 * limite é validado de forma conservadora.
 */
export function calcularRBAProjecada(rbaHistorico: number, receitaBrutaMes: number): number {
  const projecaoAnual = receitaBrutaMes * 12
  return Math.max(rbaHistorico, projecaoAnual)
}

/**
 * Tem como verificar se um CNAE está na lista de vedados — útil pra UI mostrar
 * aviso já no momento de selecionar CNAE no perfil.
 */
export function isCNAEVedadoSimples(cnaeCode: string): boolean {
  return SIMPLES_CNAES_VEDADOS.has(cnaeCode)
}

function formatM(v: number): string {
  // Formato curto pra mensagens (5,4M / 1,2M / 78M)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return v.toFixed(0)
}
