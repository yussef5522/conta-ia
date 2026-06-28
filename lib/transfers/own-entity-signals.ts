// Sprint Central de Transferências — sinais de "essa tx tem cara de
// transferência interna" extraídos da descrição.
//
// Sprint Owner Detection (28/06/2026): estendido pra reconhecer também
// o DONO da empresa (nome do sócio + CPF), porque em PMEs brasileiras o
// nome do dono nos extratos REPRESENTA a PJ — ex: PIX "YUSSEF ABU ZAHRY
// MUSA" no Stone é movimentação entre contas da Cacula (dono = PJ hoje;
// accountKind do par decide se é transfer interna ou aporte/retirada).
//
// 5 tipos de sinal verificados:
//   1. CNPJ próprio na descrição (sinal forte — boost +0.15)
//   2. CPF do dono na descrição (sinal forte — boost +0.15)        [NOVO]
//   3. Nome do dono/sócio (sinal medio — boost +0.10)               [NOVO]
//   4. Razão social/nome fantasia da empresa (+0.10)
//   5. Nome de outra conta da empresa (sicredi/stone/banrisul) (+0.10)
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
  /** CPFs dos sócios/donos (só dígitos, 11 chars). Sprint Owner Detection. */
  ownerCpfs: string[]
  /** Nomes dos sócios/donos (ex: ['YUSSEF ABU ZAHRY MUSA']). Sprint Owner Detection. */
  ownerNames: string[]
}

export interface OwnEntitySignals {
  hasOwnCnpj: boolean
  hasOwnName: boolean
  hasOwnAccountName: boolean
  /** Sprint Owner Detection — CPF do dono bate na descrição (sinal FORTE) */
  hasOwnerCpf: boolean
  /** Sprint Owner Detection — Nome do dono bate na descrição (sinal MÉDIO) */
  hasOwnerName: boolean
  /** 0-5 sinais (somatório) */
  signalCount: number
  /** Boost a aplicar no score (max 0.60) */
  scoreBoost: number
}

const CNPJ_BOOST = 0.15
const NAME_BOOST = 0.1
const ACCOUNT_NAME_BOOST = 0.1
const OWNER_CPF_BOOST = 0.15
const OWNER_NAME_BOOST = 0.1

/**
 * Normaliza CNPJ pra só dígitos. Retorna null se vazio ou inválido (≠14 dígitos).
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length === 14 ? digits : null
}

/**
 * Sprint Owner Detection (28/06/2026). Normaliza CPF pra só dígitos.
 * Retorna null se vazio ou inválido (≠11 dígitos).
 */
export function normalizeCpf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  return digits.length === 11 ? digits : null
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
 * Sprint Owner Detection (28/06/2026). Extrai sequências de 11 dígitos
 * que podem ser CPF. Garante que não fazem parte de um CNPJ (14 dígitos),
 * pra evitar falso positivo quando CPF está embutido num CNPJ.
 */
export function extractCpfsFromDescription(desc: string): string[] {
  if (!desc) return []
  // Encontra qualquer sequência de 11+ dígitos
  const allMatches = desc.match(/\d{11,}/g) ?? []
  // Pega APENAS as que têm exatamente 11 dígitos (CPF puro).
  // 14 dígitos = CNPJ; outros tamanhos = ignorar.
  return allMatches.filter((m) => m.length === 11)
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
  const cpfsInDesc = extractCpfsFromDescription(description)

  const hasOwnCnpj =
    refs.cnpj !== null && cnpjsInDesc.includes(refs.cnpj)

  // Sprint Owner Detection: CPF do dono na descrição (sinal FORTE).
  const ownerCpfsSet = new Set(refs.ownerCpfs)
  const hasOwnerCpf = cpfsInDesc.some((c) => ownerCpfsSet.has(c))

  // Nome da empresa: case-insensitive + sem acento (banco BR não preserva
  // acento na descrição OFX). Filtra nomes muito curtos (< 4 chars) pra
  // evitar ruído.
  const namesNormalized = refs.names
    .map((n) => normalizeForCompare(n))
    .filter((n) => n.length >= 4)
  const hasOwnName = namesNormalized.some((n) => desc.includes(n))

  // Sprint Owner Detection: nome do dono/sócio (sinal MÉDIO).
  // Filtra nomes muito curtos (< 8 chars) pra evitar match em prenome solto
  // tipo "ANA" ou "JOAO" que pode ter homônimo no nome de cliente.
  const ownerNamesNormalized = refs.ownerNames
    .map((n) => normalizeForCompare(n))
    .filter((n) => n.length >= 8)
  const hasOwnerName = ownerNamesNormalized.some((n) => desc.includes(n))

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
  if (hasOwnerCpf) {
    signalCount++
    scoreBoost += OWNER_CPF_BOOST
  }
  if (hasOwnName) {
    signalCount++
    scoreBoost += NAME_BOOST
  }
  if (hasOwnerName) {
    signalCount++
    scoreBoost += OWNER_NAME_BOOST
  }
  if (hasOwnAccountName) {
    signalCount++
    scoreBoost += ACCOUNT_NAME_BOOST
  }

  return {
    hasOwnCnpj,
    hasOwnName,
    hasOwnAccountName,
    hasOwnerCpf,
    hasOwnerName,
    signalCount,
    scoreBoost,
  }
}

/** Boost máximo possível (CNPJ + CPF dono + nome + nome dono + conta) — usado em testes/UI. */
export const MAX_OWN_SIGNAL_BOOST =
  CNPJ_BOOST + NAME_BOOST + ACCOUNT_NAME_BOOST + OWNER_CPF_BOOST + OWNER_NAME_BOOST
