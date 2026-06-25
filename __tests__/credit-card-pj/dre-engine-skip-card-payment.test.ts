// Garante que o engine DRE PULA tx com isCardPayment=true (pagamento de fatura).
// Caso real: pagamento R$ 2.654,63 Banrisul não conta como despesa porque a
// despesa foi a COMPRA registrada com businessCreditCardId.

import { describe, it, expect } from 'vitest'
import { calculateDRE } from '@/lib/dre/calculator'
import type { TransactionForDRE } from '@/lib/dre/types'

const baseCategory = (id: string, name: string, dreGroup: string, type: 'EXPENSE' | 'INCOME' = 'EXPENSE') => ({
  id,
  name,
  type,
  dreGroup,
  parentId: null,
  isAtivoCirculante: false,
  isPassivoCirculante: false,
  code: null,
  isActive: true,
})

describe('DRE engine pula isCardPayment=true', () => {
  it('compra no cartão (DEBIT bankAccountId=null, businessCreditCardId set) conta como despesa', () => {
    const tx: TransactionForDRE[] = [
      {
        id: 'compra',
        type: 'DEBIT',
        amount: 200,
        date: new Date('2026-06-01'),
        competenceDate: null,
        paymentDate: new Date('2026-06-01'),
        categoryId: 'cat-marketing',
      },
    ]
    const totals = calculateDRE(tx, [baseCategory('cat-marketing', 'Marketing', 'DESPESAS_COMERCIAIS')], {
      period: { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), regime: 'cash' },
    }).totals
    expect(totals.totalDespesasComerciais).toBe(200)
  })

  it('pagamento da fatura (isCardPayment=true) NAO conta como despesa', () => {
    const tx: TransactionForDRE[] = [
      {
        id: 'compra',
        type: 'DEBIT',
        amount: 200,
        date: new Date('2026-06-01'),
        competenceDate: null,
        paymentDate: new Date('2026-06-01'),
        categoryId: 'cat-marketing',
      },
      {
        id: 'pagamento',
        type: 'DEBIT',
        amount: 200,
        date: new Date('2026-06-25'),
        competenceDate: null,
        paymentDate: new Date('2026-06-25'),
        categoryId: 'cat-marketing', // mesmo se tiver categoria, deve ser ignorada
        isCardPayment: true,
      },
    ]
    const totals = calculateDRE(tx, [baseCategory('cat-marketing', 'Marketing', 'DESPESAS_COMERCIAIS')], {
      period: { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), regime: 'cash' },
    }).totals
    // Só a compra (R$ 200), pagamento foi ignorado
    expect(totals.totalDespesasComerciais).toBe(200)
  })

  it('pagamento sem flag (legado, antes do reclassificar) AINDA conta como despesa', () => {
    // Compatibilidade: tx antigas sem o campo continuam funcionando.
    const tx: TransactionForDRE[] = [
      {
        id: 'pagamento-legado',
        type: 'DEBIT',
        amount: 2654.63,
        date: new Date('2026-06-25'),
        competenceDate: null,
        paymentDate: new Date('2026-06-25'),
        categoryId: 'cat-financeiro',
        // isCardPayment undefined — comportamento legado
      },
    ]
    const totals = calculateDRE(tx, [baseCategory('cat-financeiro', 'Despesa Financeira', 'DESPESAS_FINANCEIRAS')], {
      period: { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), regime: 'cash' },
    }).totals
    // Pagamento sem flag entra como despesa (igual à situação atual do Yussef antes de reclassificar)
    expect(totals.despesasFinanceiras).toBe(2654.63)
  })
})
