// Sprint Fechar-Ponte (08/08/2026) — helper PURO do "lucro disponível" da tela
// da ponte. Sem DB, testável isolado.
//
// Regra de negócio (decisões do Yussef 08/08):
//   - disponível = lucro apurado − já distribuído (bridges kind=DISTRIBUICAO)
//   - PODE ficar negativo e isso é INTENCIONAL: o sistema REGISTRA o que
//     aconteceu, não autoriza nem proíbe. Negativo = distribuiu além do apurado
//     no período → na prática, adiantamento a sócio na apuração contábil.
//   - NUNCA tratar como erro (sem cor de erro, sem alerta). É informação.

export interface DisponivelStatus {
  /** lucro apurado − já distribuído (2 casas). Pode ser negativo. */
  disponivel: number
  /** true quando distribuiu além do apurado (adiantamento). NÃO é erro. */
  negativo: boolean
}

export function computeDisponivelStatus(
  lucroApurado: number,
  distribuido: number,
): DisponivelStatus {
  const disponivel = Math.round((lucroApurado - distribuido) * 100) / 100
  return { disponivel, negativo: disponivel < 0 }
}
