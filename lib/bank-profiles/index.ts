// FASE 2 — Modelo de perfil por banco. Ponto de entrada único.
//
// Uso no pipeline de import (FASE seguinte — wiring):
//   const bankid = parsed.bankId
//   const profile = resolveBankProfile(bankid)          // null = desconhecido
//   const warning = bankProfileWarning(profile, bankid) // pra tela, se houver
//   const { anchor } = resolveStatementAnchor(profile, { dtAsOf, dtEnd, lastRealTxDate })
//
// Adicionar banco = adicionar um objeto em registry.ts. Mudar um banco = editar
// o objeto dele. Banco desconhecido = resolveBankProfile devolve null → avisa.

export type {
  BankProfile,
  DateAnchorRule,
  FitidStability,
  CounterpartySource,
} from './types'
export { BANK_PROFILES, resolveBankProfile, normalizeBankCode } from './registry'
export { resolveStatementAnchor, type AnchorInput, type AnchorResult } from './anchor'
export { bankProfileWarning, type BankProfileWarning } from './warnings'
// ⭐ A pergunta "o saldo declarado serve de régua?" tem UM dono (05/09) — ver o arquivo.
export {
  podeConferirPorLedgerbal, avisoSemReguaDeSaldo, avaliarFechamentoDeSaldo,
  type FichaParaLedgerbal, type FechamentoDeSaldo,
} from './pode-conferir-por-ledgerbal'
