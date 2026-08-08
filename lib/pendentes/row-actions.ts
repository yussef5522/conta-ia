// Sprint Dropdown-não-trava (08/08). Decide O QUE a linha de Pendentes mostra
// quando há detecção de empréstimo.
//
// REGRA (igual ao resto do sistema — IA sugere + selo, usuário decide): detectar
// pagamento de empréstimo é SUGESTÃO. Mostra a ação de VINCULAR em destaque, mas
// NUNCA remove a saída padrão (o dropdown de categoria). O usuário escolhe:
// vincular à parcela OU categorizar. Antes, a detecção substituía o dropdown e
// TRAVAVA o usuário (não categorizava nem vinculava — caso C61021766).
//
// Puro + testado. O render DEVE usar `showCategoryDropdown` pra gatear a categoria
// — assim o guard pega qualquer regressão que volte a esconder a saída.

export interface RowLoanDetection {
  kind: 'CONTRACT' | 'CANDIDATES' | 'NOT_REGISTERED'
}

export interface PendenteRowActions {
  /** ação de empréstimo a destacar; null quando não há detecção. */
  loanAction: 'CONTRACT' | 'CANDIDATES' | 'NOT_REGISTERED' | null
  /** dropdown de categoria — SEMPRE disponível (sugestão nunca remove a saída). */
  showCategoryDropdown: boolean
}

export function pendenteRowActions(
  det: RowLoanDetection | null | undefined,
): PendenteRowActions {
  return {
    loanAction: det?.kind ?? null,
    // Invariante do fix: true SEMPRE, inclusive com detecção de empréstimo.
    showCategoryDropdown: true,
  }
}
