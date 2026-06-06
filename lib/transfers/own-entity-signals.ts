// Sprint Central de Transferências — sinais de "essa tx tem cara de
// transferência interna" extraídos da descrição.
//
// 3 tipos de sinal verificados:
//   1. CNPJ próprio na descrição (sinal forte — boost +0.15)
//   2. Nome de outra conta da empresa (sicredi/stone/banrisul) (+0.10)
//   3. Razão social/nome fantasia da empresa (+0.10)
//
// Função PURA: recebe descrição + entidades pré-extraídas. Sem regex
// complicado pra evitar falso positivo de palavras comuns.

export interface OwnEntityRefs {
  /** CNPJ da empresa (só dígitos, ex: '29756732000198') */
  cnpj: string | null
  /** Nome fantasia/tradeName + razão social */
  names: string[]
  /** Nomes das bank_accounts da empresa (ex: ['sicredi', 'stone', 'banrisul']) */
  accountNames: string[]
}

export interface OwnEntitySignals {
  hasOwnCnpj: boolean
  hasOwnName: boolean
  hasOwnAccountName: boolean
  /** 0-3 sinais (somatório) */
  signalCount: number
  /** Boost a aplicar no score (max 0.30) */
  scoreBoost: number
}

const CNPJ_BOOST = 0.15
const NAME_BOOST = 0.1
const ACCOUNT_NAME_BOOST = 0.1

/**
 * Normaliza CNPJ pra só dígitos. Retorna null se vazio ou inválido (≠14 dígitos).
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length === 14 ? digits : null
}

/**
 * Extrai todas as sequências de 14 dígitos da descrição (potenciais CNPJs).
 */
export function extractCnpjsFromDescription(desc: string): string[] {
  if (!desc) return []
  const matches = desc.match(/\b\d{14}\b/g) ?? []
  return matches
}

/**
 * Verifica se a descrição contém algum dos sinais da empresa própria.
 *
 * Exemplos cobertos (caso real Yussef):
 *   - "PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX" → 2 sinais (CNPJ + nome)
 *   - "PIX RECEBIDO SICREDI" → 1 sinal (nome de conta própria)
 *   - "PIX João Silva" → 0 sinais (nada da empresa)
 */
// Normaliza pra comparação: lowercase + remove acentos. Isso garante que
// "caçula" (com cedilha) bate em descrição "CACULA" (sem cedilha — como
// banco brasileiro tipicamente envia no extrato OFX).
function normalizeForCompare(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function extractOwnSignals(
  description: string,
  refs: OwnEntityRefs,
): OwnEntitySignals {
  const desc = normalizeForCompare(description)
  const cnpjsInDesc = extractCnpjsFromDescription(description)

  const hasOwnCnpj =
    refs.cnpj !== null && cnpjsInDesc.includes(refs.cnpj)

  // Nome da empresa: case-insensitive + sem acento (banco BR não preserva
  // acento na descrição OFX). Filtra nomes muito curtos (< 4 chars) pra
  // evitar ruído.
  const namesNormalized = refs.names
    .map((n) => normalizeForCompare(n))
    .filter((n) => n.length >= 4)
  const hasOwnName = namesNormalized.some((n) => desc.includes(n))

  // Nome de conta própria: idem.
  const accountsNormalized = refs.accountNames
    .map((a) => normalizeForCompare(a))
    .filter((a) => a.length >= 4)
  const hasOwnAccountName = accountsNormalized.some((a) => desc.includes(a))

  let signalCount = 0
  let scoreBoost = 0
  if (hasOwnCnpj) {
    signalCount++
    scoreBoost += CNPJ_BOOST
  }
  if (hasOwnName) {
    signalCount++
    scoreBoost += NAME_BOOST
  }
  if (hasOwnAccountName) {
    signalCount++
    scoreBoost += ACCOUNT_NAME_BOOST
  }

  return {
    hasOwnCnpj,
    hasOwnName,
    hasOwnAccountName,
    signalCount,
    scoreBoost,
  }
}

/** Boost máximo possível (CNPJ + nome + conta) — usado em testes/UI. */
export const MAX_OWN_SIGNAL_BOOST =
  CNPJ_BOOST + NAME_BOOST + ACCOUNT_NAME_BOOST
