// Sprint Fix-PRICE-r_eff (17/06/2026)
//
// Quando entra um empréstimo PRICE em-andamento e o cliente passa a
// parcela FIXA real do contrato (vinda do PDF/banco), a taxa NOMINAL
// informada (ex: 1,95% a.m.) frequentemente NÃO fecha o schedule: o
// banco usa day-count + capitalização levemente diferente, e a parcela
// real resolve uma taxa EFETIVA (r_eff) um pouco menor.
//
// Identidade contábil obrigatória:
//   Passivo S, n parcelas de P → SUM(amort) = S, juros total = n×P − S,
//   saldo final = 0,00.
//
// Derivamos r_eff resolvendo:
//   S = P × (1 − (1+r)^−n) / r
//
// Bissecção é mais robusta que Newton-Raphson (sem derivada, garante
// convergência em [lo, hi] enquanto f(lo)·f(hi) < 0). Função
// monotonicamente decrescente em r > 0 — raiz única.
//
// Função PURA.

export interface SolveEffectiveRateInput {
  /** Saldo devedor atual (PV das parcelas) */
  outstandingBalance: number
  /** Parcela fixa do contrato */
  fixedPayment: number
  /** Quantas parcelas futuras */
  futureCount: number
  /** Tolerância no resíduo (saldo final em R$). Default 0,005 (meio centavo) */
  tolerance?: number
  /** Limite superior pra busca (default 1 = 100% a.m.) */
  upperBound?: number
  /** Limite de iterações pra segurança (default 200 — bissecção converge em ~50) */
  maxIterations?: number
}

/**
 * Resolve r_eff tal que S = P × (1 − (1+r)^−n) / r.
 *
 * Edge cases:
 *  - Se P × n ≤ S: matematicamente impossível (banco pagaria com a soma das
 *    parcelas menos que o principal). Lança erro — engine deve cair pra
 *    fallback nominal.
 *  - Se P × n ≈ S (juros total ~ 0): retorna r_eff ≈ 0 (taxa zero).
 *  - Se a função for monótona mas raiz fora de [0, upperBound]: lança erro.
 */
export function solveEffectiveRate(input: SolveEffectiveRateInput): number {
  const {
    outstandingBalance: S,
    fixedPayment: P,
    futureCount: n,
    tolerance = 0.005,
    upperBound = 1,
    maxIterations = 200,
  } = input

  if (!(S > 0)) throw new Error('outstandingBalance deve ser > 0')
  if (!(P > 0)) throw new Error('fixedPayment deve ser > 0')
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('futureCount deve ser inteiro >= 1')
  }

  const totalPayments = P * n

  // Se a soma das parcelas é menor que o principal, não há solução
  // econômica (juros negativos). Sinaliza pro caller cair em fallback.
  if (totalPayments < S - tolerance) {
    throw new Error(
      `Soma das parcelas (${totalPayments.toFixed(2)}) menor que saldo (${S.toFixed(2)}) — sem r_eff possível`,
    )
  }

  // Juros total ~ 0 (P × n ≈ S): taxa efetiva ≈ 0
  if (Math.abs(totalPayments - S) < tolerance) {
    return 0
  }

  // f(r) = P × (1 − (1+r)^−n) / r − S. Monótona decrescente em r > 0.
  //   f(0+) = P × n − S > 0
  //   f(∞)  → −S < 0
  // Tratamento numérico em r→0: usa expansão série.
  const f = (r: number): number => {
    if (r < 1e-15) {
      // f(0) = P × n − S
      return totalPayments - S
    }
    return (P * (1 - Math.pow(1 + r, -n))) / r - S
  }

  let lo = 0
  let hi = upperBound

  const fHi = f(hi)
  if (fHi > 0) {
    throw new Error(
      `Raiz acima de upperBound=${upperBound}: parcela ${P} muito baixa pra saldo ${S} em ${n} parcelas`,
    )
  }

  // Bissecção até convergência
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2
    const fMid = f(mid)

    // Convergiu (resíduo menor que tolerância em R$)
    if (Math.abs(fMid) < tolerance) {
      return mid
    }

    // Largura do intervalo muito pequena: estabiliza
    if (hi - lo < 1e-15) {
      return mid
    }

    // f é decrescente: fMid > 0 → raiz está à direita
    if (fMid > 0) {
      lo = mid
    } else {
      hi = mid
    }
  }

  // Saiu por maxIterations: retorna o meio do intervalo (melhor estimativa)
  return (lo + hi) / 2
}
