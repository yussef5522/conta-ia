// Sprint Loans Monthly — testa a logica visual de status

import { describe, it, expect } from 'vitest'

// Espelha o que o endpoint /parcelas-do-mes calcula
function visualStatusOf(input: {
  status: string
  payment: number
  isEstimate: boolean
  dueDate: Date
  now: Date
}): 'PAGA' | 'AGUARDANDO' | 'ATRASADA' | 'PLACEHOLDER' {
  if (input.status === 'PAID' && input.payment === 0 && input.isEstimate) {
    return 'PLACEHOLDER'
  }
  if (input.status === 'PAID') return 'PAGA'
  const daysSinceDue = Math.floor(
    (input.now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24),
  )
  return daysSinceDue > 3 ? 'ATRASADA' : 'AGUARDANDO'
}

describe('visualStatusOf — status visual de parcela do mês', () => {
  it('PAID + payment=0 + isEstimate=true → PLACEHOLDER (histórico pré-cadastro)', () => {
    expect(
      visualStatusOf({
        status: 'PAID',
        payment: 0,
        isEstimate: true,
        dueDate: new Date('2025-03-25'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('PLACEHOLDER')
  })

  it('PAID com payment real → PAGA', () => {
    expect(
      visualStatusOf({
        status: 'PAID',
        payment: 10234.35,
        isEstimate: false,
        dueDate: new Date('2026-06-25'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('PAGA')
  })

  it('OPEN dentro de 3 dias do vencimento → AGUARDANDO', () => {
    expect(
      visualStatusOf({
        status: 'OPEN',
        payment: 4385.96,
        isEstimate: false,
        dueDate: new Date('2026-06-26'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('AGUARDANDO')
  })

  it('OPEN passou 3+ dias do vencimento → ATRASADA', () => {
    expect(
      visualStatusOf({
        status: 'OPEN',
        payment: 4385.96,
        isEstimate: false,
        dueDate: new Date('2026-06-20'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('ATRASADA')
  })

  it('OPEN futuro → AGUARDANDO', () => {
    expect(
      visualStatusOf({
        status: 'OPEN',
        payment: 10000,
        isEstimate: true,
        dueDate: new Date('2026-07-25'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('AGUARDANDO')
  })

  it('LATE com passou 3 dias → ATRASADA', () => {
    expect(
      visualStatusOf({
        status: 'LATE',
        payment: 4092.02,
        isEstimate: false,
        dueDate: new Date('2026-06-11'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('ATRASADA')
  })

  it('caso real C41033828 #18 → atualmente OPEN aguardando junho', () => {
    expect(
      visualStatusOf({
        status: 'OPEN',
        payment: 10234.35,
        isEstimate: false,
        dueDate: new Date('2026-06-25'),
        now: new Date('2026-06-26'),
      }),
    ).toBe('AGUARDANDO')
  })

  it('caso real C41022227 #21 → PAID após match', () => {
    expect(
      visualStatusOf({
        status: 'PAID',
        payment: 4385.96,
        isEstimate: false,
        dueDate: new Date('2026-06-15'),
        now: new Date('2026-06-27'),
      }),
    ).toBe('PAGA')
  })
})
