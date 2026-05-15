// Ajuste de Saldo Inicial — Sprint 1.5.
// Função PURA: calcula a transação de ajuste necessária pra fazer o saldo
// do sistema bater com o saldo real do extrato bancário.
//
// Caso de uso: conta criada com saldo zero (ou errado), OFX importado por cima.
// O saldo do sistema = só os movimentos do OFX, sem o saldo inicial real.
// "Ajustar Saldo" cria um lançamento especial que cobre a diferença.
//
// A transação de ajuste usa categoria com dreGroup='AJUSTE_SALDO' — NÃO entra
// no DRE (não infla receita/despesa/lucro). Ver lib/dre/types.ts.

export interface BalanceAdjustmentInput {
  // Saldo cacheado atual da conta (BankAccount.balance)
  currentBalance: number
  // Saldo correto informado pelo user (o que aparece no extrato do banco hoje)
  targetBalance: number
}

export interface BalanceAdjustmentResult {
  // false quando currentBalance === targetBalance (nada a fazer)
  needed: boolean
  // targetBalance - currentBalance (pode ser negativo)
  difference: number
  // CREDIT se diferença > 0 (saldo sobe), DEBIT se < 0 (saldo desce)
  type: 'CREDIT' | 'DEBIT'
  // Valor absoluto da diferença (amount da transação é sempre positivo)
  amount: number
  // Delta pra aplicar via bankAccount.update({ balance: { increment } }).
  // Igual a `difference` — o increment leva o saldo cacheado ao targetBalance.
  balanceDelta: number
}

// Tolerância de 1 centavo: diferenças menores que isso são consideradas "zero"
// (ruído de ponto flutuante acumulado em somas de Float).
const CENT_TOLERANCE = 0.005

export function buildBalanceAdjustment(
  input: BalanceAdjustmentInput,
): BalanceAdjustmentResult {
  // Arredonda pra 2 casas pra evitar lixo de ponto flutuante na diferença
  const difference = roundCents(input.targetBalance - input.currentBalance)

  if (Math.abs(difference) < CENT_TOLERANCE) {
    return {
      needed: false,
      difference: 0,
      type: 'CREDIT',
      amount: 0,
      balanceDelta: 0,
    }
  }

  const type: 'CREDIT' | 'DEBIT' = difference > 0 ? 'CREDIT' : 'DEBIT'

  return {
    needed: true,
    difference,
    type,
    amount: Math.abs(difference),
    balanceDelta: difference,
  }
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}
