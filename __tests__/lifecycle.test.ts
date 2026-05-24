// Sprint 4.0.1.a — testes do lib/lifecycle (validators + transitions).

import { describe, it, expect } from 'vitest'
import {
  isLifecycle,
  canTransition,
  validateLifecycleState,
  defaultTypeFromLifecycle,
  buildEffectivePatch,
  LifecycleValidationError,
  LIFECYCLES,
} from '@/lib/lifecycle'

describe('isLifecycle', () => {
  it('aceita os 3 valores válidos', () => {
    expect(isLifecycle('EFFECTED')).toBe(true)
    expect(isLifecycle('PAYABLE')).toBe(true)
    expect(isLifecycle('RECEIVABLE')).toBe(true)
  })

  it('rejeita strings inválidas', () => {
    expect(isLifecycle('PAID')).toBe(false)
    expect(isLifecycle('pending')).toBe(false)
    expect(isLifecycle('')).toBe(false)
  })

  it('rejeita não-strings', () => {
    expect(isLifecycle(null)).toBe(false)
    expect(isLifecycle(undefined)).toBe(false)
    expect(isLifecycle(123)).toBe(false)
  })

  it('LIFECYCLES tem exatamente 3 elementos', () => {
    expect(LIFECYCLES.length).toBe(3)
  })
})

describe('canTransition', () => {
  it('PAYABLE → EFFECTED é permitido (efetivação/conciliação)', () => {
    expect(canTransition('PAYABLE', 'EFFECTED')).toBe(true)
  })

  it('RECEIVABLE → EFFECTED é permitido', () => {
    expect(canTransition('RECEIVABLE', 'EFFECTED')).toBe(true)
  })

  it('EFFECTED → PAYABLE NÃO permitido (terminal)', () => {
    expect(canTransition('EFFECTED', 'PAYABLE')).toBe(false)
  })

  it('EFFECTED → RECEIVABLE NÃO permitido (terminal)', () => {
    expect(canTransition('EFFECTED', 'RECEIVABLE')).toBe(false)
  })

  it('PAYABLE → RECEIVABLE NÃO permitido (não faz sentido semântico)', () => {
    expect(canTransition('PAYABLE', 'RECEIVABLE')).toBe(false)
  })

  it('RECEIVABLE → PAYABLE NÃO permitido', () => {
    expect(canTransition('RECEIVABLE', 'PAYABLE')).toBe(false)
  })

  it('mesmo lifecycle não conta como transição', () => {
    expect(canTransition('PAYABLE', 'PAYABLE')).toBe(false)
    expect(canTransition('EFFECTED', 'EFFECTED')).toBe(false)
  })
})

describe('validateLifecycleState', () => {
  const validDueDate = new Date('2026-06-15')
  const validPaymentDate = new Date('2026-06-10')

  it('EFFECTED com paymentDate é válido', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'PENDING',
        paymentDate: validPaymentDate,
        dueDate: null,
        bankAccountId: 'cmp123',
      }),
    ).toEqual({ valid: true })
  })

  it('EFFECTED com paymentDate=null é válido (regime competência sem pagamento)', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'EFFECTED',
        status: 'PENDING',
        paymentDate: null,
        dueDate: null,
        bankAccountId: 'cmp123',
      }),
    ).toEqual({ valid: true })
  })

  it('PAYABLE com dueDate e sem paymentDate é válido', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'PAYABLE',
        status: 'PENDING',
        paymentDate: null,
        dueDate: validDueDate,
        bankAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('PAYABLE sem dueDate falha', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: null,
      dueDate: null,
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/dueDate/)
  })

  it('PAYABLE com paymentDate setado falha (não foi pago)', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: validPaymentDate,
      dueDate: validDueDate,
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/paymentDate/)
  })

  it('RECEIVABLE com dueDate é válido', () => {
    expect(
      validateLifecycleState({
        lifecycle: 'RECEIVABLE',
        status: 'PENDING',
        paymentDate: null,
        dueDate: validDueDate,
        bankAccountId: null,
      }),
    ).toEqual({ valid: true })
  })

  it('RECEIVABLE sem dueDate falha', () => {
    const r = validateLifecycleState({
      lifecycle: 'RECEIVABLE',
      status: 'PENDING',
      paymentDate: null,
      dueDate: null,
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/dueDate/)
  })

  it('lifecycle inválido falha', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAID' as 'EFFECTED',
      status: 'PENDING',
      paymentDate: null,
      dueDate: null,
      bankAccountId: null,
    })
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/lifecycle inválido/)
  })

  it('PAYABLE com bankAccountId null é OK (user não decidiu conta)', () => {
    const r = validateLifecycleState({
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      paymentDate: null,
      dueDate: validDueDate,
      bankAccountId: null,
    })
    expect(r.valid).toBe(true)
  })
})

describe('defaultTypeFromLifecycle', () => {
  it('PAYABLE → DEBIT (saída futura)', () => {
    expect(defaultTypeFromLifecycle('PAYABLE')).toBe('DEBIT')
  })

  it('RECEIVABLE → CREDIT (entrada futura)', () => {
    expect(defaultTypeFromLifecycle('RECEIVABLE')).toBe('CREDIT')
  })

  it('EFFECTED → null (depende do contexto)', () => {
    expect(defaultTypeFromLifecycle('EFFECTED')).toBeNull()
  })
})

describe('buildEffectivePatch', () => {
  const validDate = new Date('2026-06-10')

  it('cria patch correto sem markReconciled', () => {
    const patch = buildEffectivePatch(validDate, 'cmp-bank-1')
    expect(patch).toEqual({
      lifecycle: 'EFFECTED',
      paymentDate: validDate,
      bankAccountId: 'cmp-bank-1',
      status: 'PENDING',
    })
  })

  it('cria patch com markReconciled=true', () => {
    const patch = buildEffectivePatch(validDate, 'cmp-bank-1', { markReconciled: true })
    expect(patch.status).toBe('RECONCILED')
    expect(patch.lifecycle).toBe('EFFECTED')
  })

  it('rejeita bankAccountId vazio', () => {
    expect(() => buildEffectivePatch(validDate, '')).toThrow(LifecycleValidationError)
  })

  it('rejeita paymentDate inválido', () => {
    expect(() => buildEffectivePatch(new Date('invalid'), 'cmp-bank-1')).toThrow(LifecycleValidationError)
  })

  it('LifecycleValidationError tem nome correto pra catch', () => {
    try {
      buildEffectivePatch(validDate, '')
    } catch (e) {
      expect((e as Error).name).toBe('LifecycleValidationError')
    }
  })
})
