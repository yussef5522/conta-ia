// Sprint 5.0.3.0a — Tests do payableVisualStatus (função pura).

import { describe, it, expect } from 'vitest'
import {
  payableVisualStatus,
  payableStatusLabel,
  PAYABLE_STATUS_COLOR,
} from '@/components/contas-pagar/payable-status'

const NOW = new Date('2026-05-27T12:00:00.000Z')

describe('payableVisualStatus', () => {
  it('paymentDate preenchida → paid (independe de status DB)', () => {
    expect(
      payableVisualStatus(
        {
          status: 'RECONCILED',
          dueDate: '2026-03-10',
          paymentDate: '2026-03-15',
        },
        NOW,
      ),
    ).toBe('paid')
  })

  it('paymentDate vazia + dueDate no passado → overdue', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-01', paymentDate: null },
        NOW,
      ),
    ).toBe('overdue')
  })

  it('paymentDate vazia + dueDate hoje → warn (≤3d)', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-27', paymentDate: null },
        NOW,
      ),
    ).toBe('warn')
  })

  it('paymentDate vazia + dueDate em 2 dias → warn (≤3d)', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-29', paymentDate: null },
        NOW,
      ),
    ).toBe('warn')
  })

  it('paymentDate vazia + dueDate em 7 dias → pending', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-06-03', paymentDate: null },
        NOW,
      ),
    ).toBe('pending')
  })

  it('paymentDate vazia + dueDate null → pending (sem prazo)', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: null, paymentDate: null },
        NOW,
      ),
    ).toBe('pending')
  })

  it('aceita Date object e string', () => {
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: new Date('2026-05-01'),
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('overdue')
  })

  it('exatamente 3 dias à frente (mesmo horário ou diferente) → warn', () => {
    // Comparação por DIA — qualquer horário em day(now+3) vira warn
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: '2026-05-30', // 3 dias após 2026-05-27 (NOW)
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('warn')
  })

  it('4 dias à frente → pending (sai do warn de 3d)', () => {
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: '2026-05-31', // 4 dias após NOW
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('pending')
  })

  it('dueDate ONTEM (independente de horário) → overdue', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-26', paymentDate: null },
        NOW,
      ),
    ).toBe('overdue')
  })
})

describe('payableStatusLabel', () => {
  it.each([
    ['paid', 'Paga'],
    ['pending', 'A pagar'],
    ['warn', 'Vence em breve'],
    ['overdue', 'Vencida'],
  ] as const)('%s → %s', (s, label) => {
    expect(payableStatusLabel(s)).toBe(label)
  })
})

describe('PAYABLE_STATUS_COLOR — safelist Tailwind', () => {
  it('todos os 4 status tem mapeamento completo', () => {
    for (const k of ['paid', 'pending', 'warn', 'overdue'] as const) {
      expect(PAYABLE_STATUS_COLOR[k]).toBeDefined()
      expect(PAYABLE_STATUS_COLOR[k].stripe).toMatch(/^bg-/)
      expect(PAYABLE_STATUS_COLOR[k].badgeBg).toMatch(/^bg-/)
      expect(PAYABLE_STATUS_COLOR[k].badgeText).toMatch(/^text-/)
    }
  })

  it('cores semânticas distintas (não duplicadas)', () => {
    const stripes = new Set(
      Object.values(PAYABLE_STATUS_COLOR).map((c) => c.stripe),
    )
    expect(stripes.size).toBe(4)
  })
})
