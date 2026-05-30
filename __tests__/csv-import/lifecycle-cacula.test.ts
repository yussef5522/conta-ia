// Sprint CSV Import (30/05/2026) — Tests do lifecycle (guard R$ 939k)

import { describe, it, expect } from 'vitest'
import { decidirLifecycleCacula } from '@/lib/csv-import/lifecycle-cacula'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

describe('decidirLifecycleCacula — happy paths', () => {
  it('STATUS=PAGO + paymentDate preenchida → EFFECTED', () => {
    const r = decidirLifecycleCacula({
      status: 'PAGO',
      paymentDate: D('2026-05-30'),
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('EFFECTED')
    expect(r.reason).toBe('PAGO_COM_DATA_PAGAMENTO')
    expect(r.precisaRevisar).toBe(false)
    expect(r.paymentDateFinal).toEqual(D('2026-05-30'))
  })

  it('STATUS=VENCE HOJE + paymentDate=null → PAYABLE', () => {
    const r = decidirLifecycleCacula({
      status: 'VENCE HOJE',
      paymentDate: null,
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.reason).toBe('NAO_PAGO_VENCE_HOJE')
    expect(r.precisaRevisar).toBe(false)
    expect(r.paymentDateFinal).toBeNull()
  })

  it('STATUS=VENCIDO + paymentDate=null → PAYABLE', () => {
    const r = decidirLifecycleCacula({
      status: 'VENCIDO',
      paymentDate: null,
      dueDate: D('2026-05-29'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.reason).toBe('NAO_PAGO_VENCIDO')
    expect(r.paymentDateFinal).toBeNull()
  })
})

describe('decidirLifecycleCacula — edge cases', () => {
  it('STATUS=PAGO + paymentDate=null → PAYABLE defensivo + precisaRevisar=true', () => {
    const r = decidirLifecycleCacula({
      status: 'PAGO',
      paymentDate: null,
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.reason).toBe('PAGO_SEM_DATA_PAGAMENTO_DEFENSIVO')
    expect(r.precisaRevisar).toBe(true)
    expect(r.motivoRevisar).toContain('PAGO sem data')
    expect(r.paymentDateFinal).toBeNull()
  })

  it('STATUS lowercase "pago" + paymentDate → EFFECTED (case-insensitive)', () => {
    const r = decidirLifecycleCacula({
      status: 'pago',
      paymentDate: D('2026-05-30'),
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('EFFECTED')
  })

  it('STATUS com whitespace " PAGO " + paymentDate → EFFECTED', () => {
    const r = decidirLifecycleCacula({
      status: ' PAGO ',
      paymentDate: D('2026-05-30'),
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('EFFECTED')
  })

  it('STATUS desconhecido (qualquer string) → PAYABLE NAO_PAGO_OUTRO', () => {
    const r = decidirLifecycleCacula({
      status: 'CANCELADO',
      paymentDate: null,
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.reason).toBe('NAO_PAGO_OUTRO')
  })

  it('STATUS null/undefined → PAYABLE NAO_PAGO_OUTRO', () => {
    const r = decidirLifecycleCacula({
      status: null,
      paymentDate: null,
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
  })
})

describe('decidirLifecycleCacula — guard contra bug R$ 939k', () => {
  it('NUNCA retorna PAYABLE com paymentDate preenchida (validateLifecycleState reprova)', () => {
    const r = decidirLifecycleCacula({
      status: 'CANCELADO',
      paymentDate: D('2026-05-30'),
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('PAYABLE')
    expect(r.paymentDateFinal).toBeNull()
  })

  it('PAYABLE SEM dueDate → joga erro (bug do mapper)', () => {
    expect(() =>
      decidirLifecycleCacula({
        status: 'VENCE HOJE',
        paymentDate: null,
        dueDate: null,
      }),
    ).toThrow(/PAYABLE requer dueDate/)
  })

  it('EFFECTED pode ter paymentDate ou não (regra 3 da lib/lifecycle)', () => {
    const r = decidirLifecycleCacula({
      status: 'PAGO',
      paymentDate: D('2026-05-30'),
      dueDate: D('2026-05-30'),
    })
    expect(r.lifecycle).toBe('EFFECTED')
    expect(r.paymentDateFinal).not.toBeNull()
  })

  it('garantia explícita: PAGO sem data → paymentDateFinal=null (nunca herda lixo)', () => {
    const r = decidirLifecycleCacula({
      status: 'PAGO',
      paymentDate: null,
      dueDate: D('2026-05-30'),
    })
    expect(r.paymentDateFinal).toBeNull()
    expect(r.lifecycle).toBe('PAYABLE')
  })
})
