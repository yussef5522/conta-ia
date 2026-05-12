// Status visual do saldo da conta — função PURA pra renderizar badges.
// Sprint 0.5 Dia 4.
//
// Lógica das cores (decidida com Yussef pra UX brasileira):
//
//   balance < 0 (cheque especial em uso):
//     variant = 'red'
//     label = 'Saldo negativo'
//     Se creditLimit > 0: subtext = "R$ X de R$ Y usados (Z%)"
//     Se creditLimit === 0: subtext = "Saldo negativo: R$ X"
//     Porcentagem colorida (overlay no subtext):
//       ≤ 50% → 'green' percentColor
//       50-80% → 'yellow'
//       > 80% → 'red'
//
//   balance > 0 mas ≤ lowBalanceThreshold:
//     variant = 'yellow'
//     label = 'Atenção'
//     subtext = "Saldo baixo: R$ X"
//
//   balance positivo confortável:
//     variant = 'green'
//     label = 'Normal'
//     subtext = "Saldo: R$ X"
//
//   balance === 0:
//     variant = 'green' (zerado é melhor que negativo)
//     label = 'Normal'
//     subtext = "Saldo: R$ 0,00"

export interface BadgeStatusInput {
  balance: number
  creditLimit: number
  lowBalanceThreshold: number | null
}

export type BadgeVariant = 'green' | 'yellow' | 'red'

export interface BadgeStatusResult {
  variant: BadgeVariant
  label: string
  subtext: string
  // Cor da porcentagem (só quando variant=red E creditLimit>0). null caso contrário.
  percentColor: BadgeVariant | null
  // Porcentagem de uso do cheque especial (só quando variant=red E creditLimit>0). null caso contrário.
  usagePercent: number | null
}

export function computeBalanceBadgeStatus(input: BadgeStatusInput): BadgeStatusResult {
  const { balance, creditLimit, lowBalanceThreshold } = input

  if (creditLimit < 0) {
    throw new Error('creditLimit deve ser >= 0')
  }

  // Caso 1: saldo negativo
  if (balance < 0) {
    if (creditLimit > 0) {
      const usado = Math.abs(balance)
      const usagePercent = Math.round((usado / creditLimit) * 100)
      const percentColor: BadgeVariant =
        usagePercent <= 50 ? 'green' : usagePercent <= 80 ? 'yellow' : 'red'
      return {
        variant: 'red',
        label: 'Saldo negativo',
        subtext: `${formatBRL(usado)} de ${formatBRL(creditLimit)} usados (${usagePercent}%)`,
        percentColor,
        usagePercent,
      }
    }
    // creditLimit === 0 (edge case: conta sem cheque especial mas com allowNegative)
    return {
      variant: 'red',
      label: 'Saldo negativo',
      subtext: `Saldo negativo: ${formatBRL(balance)}`,
      percentColor: null,
      usagePercent: null,
    }
  }

  // Caso 2: saldo positivo mas ≤ threshold
  if (
    balance > 0 &&
    lowBalanceThreshold !== null &&
    lowBalanceThreshold > 0 &&
    balance <= lowBalanceThreshold
  ) {
    return {
      variant: 'yellow',
      label: 'Atenção',
      subtext: `Saldo baixo: ${formatBRL(balance)}`,
      percentColor: null,
      usagePercent: null,
    }
  }

  // Caso 3: saldo confortável (positivo, zero, ou sem threshold definido)
  return {
    variant: 'green',
    label: 'Normal',
    subtext: `Saldo: ${formatBRL(balance)}`,
    percentColor: null,
    usagePercent: null,
  }
}

// Formato BR simples (sem dep de Intl pra ser determinístico em testes).
function formatBRL(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const int = Math.floor(abs)
  const cents = Math.round((abs - int) * 100)
  const intStr = int.toLocaleString('pt-BR')
  return `R$ ${sign}${intStr},${cents.toString().padStart(2, '0')}`
}
