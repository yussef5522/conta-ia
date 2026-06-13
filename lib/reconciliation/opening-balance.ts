// Heurística: detecta se um memo corresponde a um lançamento contábil de
// SALDO DE ABERTURA / SALDO INICIAL — que NUNCA aparece no extrato bancário
// e portanto deve ser excluído da conciliação (não conta como orphan).
//
// Cobre as variações comuns que o produto e os usuários costumam adotar:
//   "SALDO INICIAL"
//   "SALDO DE ABERTURA"
//   "SALDO_ABERTURA" (categoria/notes)
//   "ABERTURA DE CONTA"
// Case-insensitive + tolera variações de espaço.

export function isOpeningBalanceMemo(memo: string | null | undefined): boolean {
  if (!memo) return false
  const norm = memo.toUpperCase().replace(/\s+/g, ' ').trim()
  return (
    norm.includes('SALDO INICIAL') ||
    norm.includes('SALDO DE ABERTURA') ||
    norm.includes('SALDO_ABERTURA') ||
    norm.includes('ABERTURA DE CONTA')
  )
}
