// Validação de saldo antes de criar/transferir transação.
// Sprint 0.5 Dia 3 — função PURA.
//
// Regras (alinhadas com decisões de produto do Yussef):
//
//   allowNegativeBalance === false  → conta tipo poupança (sem cheque especial)
//     effectiveFloor = 0
//
//   allowNegativeBalance === true   → conta com cheque especial (caso normal das 13 academias)
//     effectiveFloor = -creditLimit
//     IMPORTANTE: creditLimit é o limite REAL do cheque especial (ex: 600.000 Banrisul,
//     80.000 Sicredi). Default no Dia 1 é 0 — backfill ajusta contas existentes.
//
// allowed = (currentBalance + amountChange) >= effectiveFloor

export interface BalanceCheckInput {
  currentBalance: number
  allowNegativeBalance: boolean
  creditLimit: number
  // Mudança de saldo: negativa pra saída (DEBIT/TRANSFER out), positiva pra entrada.
  amountChange: number
  // Apenas pra mensagem de erro
  accountName?: string
}

export interface BalanceCheckResult {
  allowed: boolean
  reason?: string
  projectedBalance: number
  effectiveFloor: number
}

export function checkBalance(input: BalanceCheckInput): BalanceCheckResult {
  if (input.creditLimit < 0) {
    throw new Error('creditLimit deve ser >= 0')
  }

  // Normaliza -0 pra 0 (acontece quando allowNegative=true && creditLimit=0)
  const rawFloor = input.allowNegativeBalance ? -input.creditLimit : 0
  const effectiveFloor = rawFloor === 0 ? 0 : rawFloor
  const projectedBalance = input.currentBalance + input.amountChange
  const allowed = projectedBalance >= effectiveFloor

  if (allowed) {
    return { allowed: true, projectedBalance, effectiveFloor }
  }

  const accountLabel = input.accountName ? `"${input.accountName}"` : 'conta'
  const reason = input.allowNegativeBalance
    ? `Limite de cheque especial excedido em ${accountLabel}. Saldo projetado: ${formatMoney(projectedBalance)}. Limite negativo: ${formatMoney(effectiveFloor)}.`
    : `Saldo insuficiente em ${accountLabel}. Saldo projetado: ${formatMoney(projectedBalance)}. Esta conta não permite saldo negativo.`

  return { allowed: false, reason, projectedBalance, effectiveFloor }
}

// Erro tipado pra rota mapear pra HTTP 422 (regra de negócio falhou em request bem-formada).
export class BalanceCheckError extends Error {
  status = 422
  result: BalanceCheckResult

  constructor(result: BalanceCheckResult) {
    super(result.reason ?? 'Saldo insuficiente')
    this.name = 'BalanceCheckError'
    this.result = result
  }
}

// Formato pt-BR simples pra mensagens. Não usa Intl pra ser determinístico em testes.
function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const int = Math.floor(abs)
  const cents = Math.round((abs - int) * 100)
  const intStr = int.toLocaleString('pt-BR')
  return `R$ ${sign}${intStr},${cents.toString().padStart(2, '0')}`
}
