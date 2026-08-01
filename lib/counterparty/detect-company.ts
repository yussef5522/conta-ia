// Sprint FASE 4 (01/08/2026) — detecção de "própria empresa" e "intra-grupo"
// por DADO CADASTRADO (razão social/CNPJ), NÃO por lista de nomes hardcodada.
// Determinístico, escala sozinho, nunca envelhece.
//
// ⚠️ Conservador: banco trunca/muda grafia ("PRO FIT" vs "profit"). Casamos por:
//   1) CNPJ exato (quando a contraparte trouxer documento) — mais forte.
//   2) razão social normalizada SEM espaços (resolve "PRO FIT"↔"profit") — exata
//      ou prefixo forte (≥12 chars). Na dúvida, NÃO casa: errar transferência
//      entre empresas é pior que pedir confirmação.

import { normalizeCounterparty } from './normalize'

export interface CompanyRef {
  id: string
  name: string
  cnpj: string
}

export type CounterpartyClass =
  | { kind: 'OWN' }
  | { kind: 'INTRA_GROUP'; company: CompanyRef }
  | null

const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
/** normaliza + remove espaços (grafia "PRO FIT ITAQUI" == "PROFIT ITAQUI"). */
const squash = (s: string | null | undefined) => normalizeCounterparty(s).replace(/\s+/g, '')

function companyMatches(
  cpName: string,
  cpDoc: string | null | undefined,
  comp: CompanyRef,
): boolean {
  const doc = digits(cpDoc)
  if (doc.length >= 11 && doc === digits(comp.cnpj)) return true
  const a = squash(cpName)
  const b = squash(comp.name)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 12 && long.startsWith(short)
}

export function detectCounterpartyCompany(
  counterpartyName: string | null | undefined,
  counterpartyDocument: string | null | undefined,
  ownCompany: CompanyRef,
  otherCompanies: CompanyRef[],
): CounterpartyClass {
  if (!counterpartyName) return null
  if (companyMatches(counterpartyName, counterpartyDocument, ownCompany)) return { kind: 'OWN' }
  for (const c of otherCompanies) {
    if (companyMatches(counterpartyName, counterpartyDocument, c)) return { kind: 'INTRA_GROUP', company: c }
  }
  return null
}
