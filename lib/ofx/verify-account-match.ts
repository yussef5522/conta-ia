// FASE 2.1 — trava anti "OFX na conta errada" (12/08/2026).
//
// QUASE-ACIDENTE: o Yussef abriu a tela pela conta STONE e anexou o OFX do
// SICREDI. O sistema aceitou e ofereceu importar 355 tx do Sicredi DENTRO da
// Stone. Só não aconteceu porque ele olhou o saldo. O sistema TINHA como saber:
//   BANKID do arquivo = 748 (Sicredi) × bankCode da conta = 197 (Stone)
//   ACCTID do arquivo = 5230000000241706 × conta Stone = 22155748-1
// Três campos divergindo, nenhum conferido. O PDF já tem essa trava
// (headerMatchesAccount); o OFX — o caminho diário — não tinha.
//
// Mesma filosofia do PDF: compara e, se diverge, RECUSA com mensagem clara.
// Se não dá pra conferir (conta sem bankCode ou arquivo sem BANKID) → AVISA,
// não bloqueia (nunca travar import legítimo por falta de dado).

import { normalizeBankCode, resolveBankProfile } from '../bank-profiles'

export interface OfxAccountMatchInput {
  bankId?: string | null
  accountId?: string | null
}
export interface AccountForMatch {
  bankCode: string | null
  bankName?: string | null
  accountNumber?: string | null
  name?: string | null
}
export interface OfxAccountMatchResult {
  /** true = bloquear o import (arquivo é de outra conta). */
  block: boolean
  /** mensagem de ERRO clara quando block. */
  error?: string
  code?: 'OFX_BANK_MISMATCH' | 'OFX_ACCOUNT_MISMATCH'
  /** aviso quando NÃO deu pra conferir (não bloqueia). */
  warning?: string
}

/** só dígitos, sem zeros à esquerda (mesma normalização do headerMatchesAccount do PDF). */
const normDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '').replace(/^0+/, '')
/** um contém o outro? (cobre ACCTID = agência+conta concatenados vs conta pura). */
const overlaps = (a: string, b: string) => a.includes(b) || b.includes(a)

/** Nome legível do banco a partir do código (perfil) ou fallback. */
function bankLabel(code: string | null | undefined, fallbackName?: string | null): string {
  const prof = resolveBankProfile(code ?? null)
  if (prof) return prof.displayName
  if (fallbackName) return fallbackName
  return code ? `código ${code}` : 'banco desconhecido'
}

/**
 * Confere se o OFX pertence à conta selecionada. Camada 1 = BANKID × bankCode
 * (pega banco trocado, o caso do quase-acidente). Camada 2 = ACCTID × número da
 * conta (pega conta errada do MESMO banco). Só bloqueia quando dá pra comparar
 * e diverge; senão avisa.
 */
export function verifyOfxMatchesAccount(
  file: OfxAccountMatchInput,
  account: AccountForMatch,
): OfxAccountMatchResult {
  const fileBank = normalizeBankCode(file.bankId)
  const acctBank = normalizeBankCode(account.bankCode)

  // Camada 1 — BANCO. Divergiu → bloqueia com nomes dos dois lados.
  if (fileBank && acctBank && fileBank !== acctBank) {
    const from = bankLabel(file.bankId, null)
    const to = account.name ?? bankLabel(account.bankCode, account.bankName)
    return {
      block: true,
      code: 'OFX_BANK_MISMATCH',
      error: `Este arquivo é do ${from} (${file.bankId}), mas você selecionou a conta "${to}" (${bankLabel(account.bankCode, account.bankName)}). Selecione a conta correta.`,
    }
  }

  // Camada 2 — CONTA (mesmo banco, conta diferente). Normaliza os dois lados.
  const fileAcct = normDigits(file.accountId)
  const acctNum = normDigits(account.accountNumber)
  if (fileAcct && acctNum && !overlaps(fileAcct, acctNum)) {
    return {
      block: true,
      code: 'OFX_ACCOUNT_MISMATCH',
      error: `A conta do arquivo (${file.accountId}) não bate com a conta selecionada (${account.accountNumber}). Selecione a conta correta.`,
    }
  }

  // Não deu pra conferir por BANKID/bankCode → avisa (não bloqueia).
  if (!fileBank || !acctBank) {
    const motivo = !fileBank ? 'o arquivo não traz o código do banco (BANKID)' : 'a conta não tem código de banco cadastrado'
    return {
      block: false,
      warning: `Não deu pra conferir automaticamente se este arquivo é desta conta (${motivo}). Confirme que selecionou a conta certa antes de importar.`,
    }
  }

  return { block: false }
}
